import { NextResponse } from "next/server";
import { CARE_TEAM } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { computeJourney, needsRole, preListingBlockers, publishBlockers } from "@/lib/process/engine";
import { loadAnimalRecords } from "@/lib/process/load";

// One animal's process journey for the tracker shown on every animal page,
// plus the Pre-Listing and Publish blockers the Fitness/Publish page shows
// (from the same records, so that page needs no extra requests).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const records = (await loadAnimalRecords(id)).get(id);
  if (!records) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const steps = computeJourney(records);
  return NextResponse.json({
    ok: true,
    animalId: id,
    steps: steps.map((s) => ({ ...s, needsMe: needsRole(s, auth.role) })),
    preListingBlockers: preListingBlockers(records),
    publishBlockers: publishBlockers(records),
  });
}
