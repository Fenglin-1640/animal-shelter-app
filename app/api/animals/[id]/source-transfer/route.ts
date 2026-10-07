import { NextResponse } from "next/server";
import { CARE_TEAM } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";

// The Council Transfer an animal came from (Administrator, Shelter Staff,
// Veterinarian): reference, found location and the submitting officer.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const link = await db.orm.AnimalTransferLink.select("councilTransferId").where({ animalId: id }).first();
  const transfer = link
    ? await db.orm.CouncilTransferSubmission.select("id", "foundLocation", "submittedByName").where({ id: link.councilTransferId }).first()
    : null;
  return NextResponse.json({
    ok: true,
    transfer: transfer ? { id: transfer.id, foundLocation: transfer.foundLocation, submittedByName: transfer.submittedByName } : null,
  });
}
