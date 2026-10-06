import { NextResponse } from "next/server";
import { auditRow } from "@/lib/audit/server";
import { STAFF } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { toAdoptionApplication } from "@/lib/applications/serialize";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";

type ReviewAction = "start" | "hold" | "resume" | "request_info";

const UNDECIDED = ["Submitted", "Under Review", "On Hold"];

function refuse(status: number, reason: string, message: string) {
  return NextResponse.json({ ok: false, reason, message }, { status });
}

// Shelter Staff / Administrator review steps on an application, each
// checked against its current status and audited in the same transaction:
//   start         Submitted -> Under Review
//   hold          Under Review -> On Hold (optional note)
//   resume        On Hold -> Under Review, once the animal is available again
//   request_info  ask the Adopter for more documents or information
//                 (message required); the status is unchanged and the
//                 Adopter can upload documents until a decision is made
// Approve and Reject keep their own flow (lib/applications/store.ts).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const body = (await request.json()) as { action?: ReviewAction; message?: string };
  const app = await db.orm.AdoptionApplication.where({ applicationId: id }).first();
  if (!app) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const status = app.applicationStatus;
  const message = body.message?.trim() ?? "";
  const now = toTimestamptz(new Date().toISOString());

  let patch: Record<string, unknown>;
  let action: string;
  let newValue: string;
  switch (body.action) {
    case "start":
      if (status !== "Submitted") return refuse(409, "invalid_state", "Only a submitted application can be put under review.");
      patch = { applicationStatus: "Under Review" };
      action = "Start Application Review";
      newValue = "Under Review";
      break;
    case "hold":
      if (status !== "Under Review") return refuse(409, "invalid_state", "Only an application under review can be put on hold.");
      if (message.length > 1000) return refuse(400, "invalid", "The note must be 1000 characters or fewer.");
      patch = { applicationStatus: "On Hold" };
      action = "Place Application On Hold";
      newValue = message ? `On Hold: ${message}` : "On Hold";
      break;
    case "resume": {
      if (status !== "On Hold") return refuse(409, "invalid_state", "Only an application on hold can be resumed.");
      const animal = await db.orm.Animal.select("currentStatus").where({ animalId: app.animalId }).first();
      if (animal?.currentStatus !== "Available For Adoption") {
        return refuse(409, "animal_not_available", "The animal is not available for adoption, so this application cannot be resumed yet.");
      }
      patch = { applicationStatus: "Under Review" };
      action = "Resume Application Review";
      newValue = "Under Review";
      break;
    }
    case "request_info":
      if (!UNDECIDED.includes(status)) return refuse(409, "invalid_state", "Information can only be requested before a decision is made.");
      if (!message) return refuse(400, "invalid", "A message to the Adopter is required.");
      if (message.length > 2000) return refuse(400, "invalid", "The message must be 2000 characters or fewer.");
      patch = { infoRequestMessage: message, infoRequestedAt: now, infoRequestedByName: auth.displayName };
      action = "Request More Information";
      newValue = `Requested from the Adopter: ${message}`;
      break;
    default:
      return refuse(400, "invalid", "Unknown review action.");
  }

  const updated = await db.transaction(async (orm) => {
    const saved = await orm.AdoptionApplication.where({ applicationId: id, applicationStatus: status }).update({ ...patch, updatedAt: now });
    if (!saved) return null;
    await orm.AuditLogEntry.create(
      auditRow({
        actor: { email: auth.email, name: auth.displayName },
        action,
        entityType: "Animal",
        entityId: app.animalId,
        oldValue: `applicationId=${id}; status=${status}`,
        newValue,
      }),
    );
    return saved;
  });
  if (!updated) return refuse(409, "invalid_state", "The application changed meanwhile - please reload.");
  return NextResponse.json({ ok: true, item: toAdoptionApplication(updated) });
}
