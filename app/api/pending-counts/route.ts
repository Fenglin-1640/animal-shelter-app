import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAnimal } from "@/lib/animals/serialize";
import { toAdoptionApplication } from "@/lib/applications/serialize";
import { toSuitabilityCheck } from "@/lib/checks/serialize";
import { toCouncilTransferSubmission } from "@/lib/council-transfers/serialize";
import { toPreReleaseCheck } from "@/lib/medical/serialize";
import { toMeetAndGreet } from "@/lib/meet-and-greets/serialize";
import { toAdoptionPayment } from "@/lib/payments/serialize";
import {
  countAwaitingDecision,
  countAwaitingPreReleaseCheck,
  countPendingForAdopter,
  countPendingVerification,
  countUnlinkedSubmittedTransfers,
  pendingCountLabelsForRole,
  type PendingCountLabel,
} from "@/lib/pending-actions/counts";
import { requireRole } from "@/lib/auth/server-session";
import { ALL_ROLES } from "@/lib/auth/api-roles";

// Sidebar badge counts for the signed-in user: only the badges in their
// role's sidebar are computed, and the Adopter's Meet and Greet count is
// their own. Returns { counts: { label: n } }
// - numbers only, instead of every page downloading the payments,
// applications, checks, transfers, intake records and Meet and Greets
// collections to count them client-side.
const COUNTERS: Record<PendingCountLabel, (email: string) => Promise<number>> = {
  Adoptions: async () => {
    const rows = await db.orm.AdoptionPayment.where({ paymentStatus: "Pending" }).all();
    return countPendingVerification(rows.map(toAdoptionPayment));
  },
  "Adoption Applications": async () => {
    const applications = (await db.orm.AdoptionApplication.where({ applicationStatus: "Under Review" }).all()).map(
      toAdoptionApplication,
    );
    const checks = (
      await Promise.all(
        applications.map((a) => db.orm.SuitabilityCheck.where({ applicationId: a.applicationId }).all()),
      )
    )
      .flat()
      .map(toSuitabilityCheck);
    return countAwaitingDecision(applications, checks);
  },
  "Animal Intake": async () => {
    const [transferRows, intakeRows] = await Promise.all([
      db.orm.CouncilTransferSubmission.where({ status: "Submitted" }).all(),
      db.orm.IntakeRecord.select("intakeId", "councilTransferSubmissionId").all(),
    ]);
    const linked = new Set(
      intakeRows.map((r) => r.councilTransferSubmissionId).filter((id): id is string => Boolean(id)),
    );
    return countUnlinkedSubmittedTransfers(transferRows.map(toCouncilTransferSubmission), linked);
  },
  "Pre-Release Checks": async () => {
    const animals = (await db.orm.Animal.where({ currentStatus: "Awaiting Release" }).all()).map(toAnimal);
    const checks = (
      await Promise.all(animals.map((a) => db.orm.PreReleaseCheck.where({ animalId: a.animalId }).all()))
    )
      .flat()
      .map(toPreReleaseCheck);
    return countAwaitingPreReleaseCheck(animals, checks);
  },
  "My Meet and Greets": async (email) => {
    const rows = await db.orm.MeetAndGreet.where({}).all();
    return countPendingForAdopter(rows.map(toMeetAndGreet), email);
  },
};

export async function GET() {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const labels = pendingCountLabelsForRole(auth.role);
  const values = await Promise.all(labels.map((label) => COUNTERS[label](auth.email)));
  return NextResponse.json({
    ok: true,
    counts: Object.fromEntries(labels.map((label, i) => [label, values[i]])),
  });
}
