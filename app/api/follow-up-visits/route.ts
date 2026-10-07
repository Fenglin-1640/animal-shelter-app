import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { auditRow } from "@/lib/audit/server";
import { DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts";
import { toFollowUpVisit } from "@/lib/follow-up-visits/serialize";
import type { FollowUpType } from "@/lib/follow-up-visits/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { ADOPTER, CARE_TEAM, STAFF, isOwnRecord, seesAllRecords } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole([...CARE_TEAM, ...ADOPTER]);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.FollowUpVisit.where({}).all();
  // Adopters see only their own records; the care team sees all.
  const items = rows.map(toFollowUpVisit).filter((item) => seesAllRecords(auth.role) || isOwnRecord(auth, item.adopterEmail));
  return NextResponse.json({ items });
}

interface ReleaseBody {
  animalId?: string;
  careInstructionsProvided?: boolean;
  releaseDate?: string;
  receivingAdopter?: string;
  targetDate?: string;
  followUpType?: FollowUpType;
  handoverNotes?: string;
}

const FOLLOW_UP_TYPES: FollowUpType[] = ["Phone Call", "Home Visit"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function refuse(status: number, reason: string, message: string) {
  return NextResponse.json({ ok: false, reason, message }, { status });
}

// Release to Adopter (Shelter Staff Member or Administrator). One
// transaction moves the animal Awaiting Release -> inFollowUpPeriod,
// schedules the Follow-Up Visit and writes both audit entries, so a double
// submit or a concurrent release cannot create a second visit.
export async function POST(request: Request) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as ReleaseBody;
  const animalId = body.animalId?.trim() ?? "";
  // Dates are local calendar dates (YYYY-MM-DD); a full ISO string is cut down to its date.
  const releaseDate = (body.releaseDate ?? "").slice(0, 10);
  const targetDate = (body.targetDate ?? "").slice(0, 10);
  const receivingAdopter = body.receivingAdopter?.trim() ?? "";
  const handoverNotes = body.handoverNotes?.trim() ?? "";
  const followUpType = body.followUpType ?? "Phone Call";

  if (!animalId) return refuse(400, "invalid", "An animal is required.");
  if (body.careInstructionsProvided !== true) return refuse(400, "care_instructions_required", "Confirm that care instructions have been handed over.");
  if (!receivingAdopter || receivingAdopter.length > 200) return refuse(400, "receiving_adopter_required", "The receiving Adopter's name is required (200 characters or fewer).");
  if (!DATE.test(releaseDate) || !DATE.test(targetDate)) return refuse(400, "invalid", "Release and follow-up dates must be valid dates.");
  // One day of slack for time zones ahead of the server.
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  if (releaseDate > tomorrow) return refuse(400, "invalid", "The release date cannot be in the future.");
  if (targetDate < releaseDate) return refuse(400, "invalid", "The follow-up date cannot be before the release date.");
  if (!FOLLOW_UP_TYPES.includes(followUpType)) return refuse(400, "invalid", "Unknown follow-up type.");
  if (handoverNotes.length > 2000) return refuse(400, "invalid", "Handover notes must be 2000 characters or fewer.");

  const [animal, checks, finalised] = await Promise.all([
    db.orm.Animal.where({ animalId }).first(),
    db.orm.PreReleaseCheck.where({ animalId }).all(),
    db.orm.AdoptionApplication.where({ animalId, applicationStatus: "Finalised" }).first(),
  ]);
  if (!animal) return refuse(404, "not_found", "Animal not found.");
  if (animal.currentStatus !== "Awaiting Release") return refuse(409, "not_awaiting_release", "This animal is not awaiting release.");
  const latest = [...checks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (latest?.fitnessResult !== "Fit for Release") {
    return refuse(409, "not_fit_for_release", "The latest Pre-Release Check is not Fit for Release.");
  }

  // Seed animals that predate the application workflow carry only a linked
  // Adopter name; match it against the demo Adopter account.
  let adopter: { applicationId: string; adopterEmail: string; adopterName: string } | undefined;
  if (finalised) {
    adopter = { applicationId: finalised.applicationId, adopterEmail: finalised.adopterEmail, adopterName: finalised.adopterName };
  } else if (animal.linkedPersonRole === "Adopter" && animal.linkedPersonName) {
    const demo = DEMO_ACCOUNTS.find((a) => a.role === "Adopter" && `${a.firstName} ${a.lastName}` === animal.linkedPersonName);
    if (demo) adopter = { applicationId: `SEED-${animalId}`, adopterEmail: demo.email, adopterName: animal.linkedPersonName };
  }
  if (!adopter) return refuse(409, "no_finalised_application", "No finalised adoption was found for this animal.");

  const now = toTimestamptz(new Date().toISOString());
  const actor = { email: auth.email, name: auth.displayName };
  const followUpVisitId = `FUV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const created = await db.transaction(async (orm) => {
    const moved = await orm.Animal.where({ animalId, currentStatus: "Awaiting Release" }).update({
      currentStatus: "inFollowUpPeriod",
      statusUpdatedAt: now,
    });
    if (!moved) return null;
    const visit = await orm.FollowUpVisit.create({
      followUpVisitId,
      animalId,
      animalName: animal.name,
      applicationId: adopter.applicationId,
      adopterEmail: adopter.adopterEmail,
      adopterName: adopter.adopterName,
      careInstructionsProvided: 1,
      releaseDate,
      receivingAdopter,
      releasedByEmail: actor.email,
      releasedByName: actor.name,
      targetDate,
      followUpType,
      assignedStaffEmail: actor.email,
      assignedStaffName: actor.name,
      status: "Scheduled",
      outcome: null,
      outcomeNotes: "",
      handoverNotes: handoverNotes || null,
      completedByEmail: null,
      completedByName: null,
      completedAt: null,
      createdAt: now,
    });
    await orm.AuditLogEntry.create(
      auditRow({
        actor,
        action: "Release Animal to Adopter",
        entityType: "Animal",
        entityId: animalId,
        oldValue: `currentStatus=Awaiting Release, listingStatus=${animal.listingStatus}`,
        newValue: `currentStatus=inFollowUpPeriod, listingStatus=${animal.listingStatus}`,
      }),
    );
    await orm.AuditLogEntry.create(
      auditRow({
        actor,
        action: "Release Animal to Adopter",
        entityType: "FollowUpVisit",
        entityId: followUpVisitId,
        oldValue: "",
        newValue: `releaseDate=${releaseDate}, receivingAdopter=${receivingAdopter}, targetDate=${targetDate}, followUpType=${followUpType}${handoverNotes ? `, handoverNotes=${handoverNotes}` : ""}`,
      }),
    );
    return visit;
  });
  if (!created) return refuse(409, "not_awaiting_release", "This animal was released meanwhile - please reload.");
  return NextResponse.json({ ok: true, item: toFollowUpVisit(created) });
}
