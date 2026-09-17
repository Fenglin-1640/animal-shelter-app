import { changeAnimalStatus, getAnimalById } from "@/lib/animals/animal-store";
import { SYSTEM_ACTOR } from "@/lib/audit/types";
import { linkRegisteredOwnerContact } from "@/lib/intake-records/store";
import type { RegisteredOwnerContact } from "@/lib/microchip/types";
import { getSystemSettings } from "@/lib/system-administration/settings-store";
import type { StatutoryHold } from "@/lib/statutory-hold/types";

// FR-MC-02: StatutoryHold now lives in the database (see
// prisma/contract.prisma) behind /api/statutory-holds - see
// prisma/README.md for this Prisma toolchain's quirks. One hold per
// animal (Owner Match is idempotent - re-scanning an animal that already
// has a hold does not create a second one).

async function fetchAllHolds(): Promise<StatutoryHold[]> {
  const response = await fetch("/api/statutory-holds");
  const result = await response.json();
  return result.items as StatutoryHold[];
}

async function patchHold(id: string, patch: Partial<StatutoryHold>): Promise<void> {
  await fetch(`/api/statutory-holds/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

function generateHoldId(): string {
  return `SH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// There is no scheduler in this prototype, so expiry (PRD:
// holdPeriodExpired) is resolved lazily whenever holds are read: any
// Active hold whose holdEndAt has passed is flipped to Expired and, if
// the Animal is still On Statutory Hold (nothing else has moved it on),
// reverted to Under Assessment.
async function resolveExpiredHolds() {
  const all = await fetchAllHolds();
  const now = new Date();

  for (const hold of all) {
    if (hold.status !== "Active" || new Date(hold.holdEndAt) > now) continue;

    const expiredAt = now.toISOString();
    await patchHold(hold.id, { status: "Expired", expiredAt });

    const animal = await getAnimalById(hold.animalId);
    if (animal?.currentStatus === "On Statutory Hold") {
      await changeAnimalStatus(
        hold.animalId,
        { currentStatus: "Under Assessment", statusUpdatedAt: expiredAt },
        SYSTEM_ACTOR,
        "Statutory Hold Expired (holdPeriodExpired)",
      );
    }
  }
}

export async function listHoldsForAnimal(animalId: string): Promise<StatutoryHold[]> {
  await resolveExpiredHolds();
  const all = await fetchAllHolds();
  return all
    .filter((h) => h.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getLatestHold(animalId: string): Promise<StatutoryHold | undefined> {
  return (await listHoldsForAnimal(animalId))[0];
}

// FR-LIST-01 precondition 3 / FR-MED-03's Pre-Listing gate: "不存在未结束的
// Statutory Hold".
export async function hasUnresolvedHold(animalId: string): Promise<boolean> {
  return (await listHoldsForAnimal(animalId)).some((h) => h.status === "Active");
}

export type HoldResult = { ok: true; hold: StatutoryHold } | { ok: false; reason: "not_found" };

// FR-MC-02 steps 1-3, run automatically as a consequence of Scan
// Microchip (FR-MC-01) returning Owner Match.
export async function createHoldForOwnerMatch(
  animalId: string,
  ownerContact: RegisteredOwnerContact,
  email: string,
  name: string,
): Promise<HoldResult> {
  const animal = await getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };

  const existing = (await fetchAllHolds()).find((h) => h.animalId === animalId);
  if (existing) return { ok: true, hold: existing };

  const holdingPeriodDays = getSystemSettings().holdingPeriodDays;
  const holdStart = new Date(animal.enteredAt);
  const holdEnd = new Date(holdStart);
  holdEnd.setDate(holdEnd.getDate() + holdingPeriodDays);
  const now = new Date().toISOString();

  const hold: StatutoryHold = {
    id: generateHoldId(),
    animalId,
    ownerContact,
    holdStartAt: holdStart.toISOString(),
    holdEndAt: holdEnd.toISOString(),
    holdingPeriodDays,
    status: "Active",
    createdAt: now,
  };
  const response = await fetch("/api/statutory-holds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hold),
  });
  const result = await response.json();

  await changeAnimalStatus(
    animalId,
    {
      currentStatus: "On Statutory Hold",
      statusUpdatedAt: now,
      linkedPerson: { role: "Registered Owner", name: ownerContact.name },
    },
    { email, name },
    "Owner Match - Statutory Hold Created",
  );
  linkRegisteredOwnerContact(animalId, ownerContact);

  return { ok: true, hold: result.item as StatutoryHold };
}

export type MutationResult = { ok: true } | { ok: false; reason: "not_found" | "invalid_state" };

// PRD: ownerReclaimed -> Record Owner Reclamation.
export async function recordOwnerReclamation(
  animalId: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const hold = await getLatestHold(animalId);
  if (!hold) return { ok: false, reason: "not_found" };
  if (hold.status !== "Active") return { ok: false, reason: "invalid_state" };

  const now = new Date().toISOString();
  await patchHold(hold.id, {
    status: "Reclaimed By Owner",
    reclaimedAt: now,
    reclaimedByEmail: email,
    reclaimedByName: name,
  });

  await changeAnimalStatus(
    animalId,
    { currentStatus: "Reclaimed By Owner", statusUpdatedAt: now, listingStatus: "Removed" },
    { email, name },
    "Record Owner Reclamation",
  );

  return { ok: true };
}

// PRD: 完成 custody transfer 后归档为 ReturnedToOwner (a named final state).
export async function confirmCustodyTransfer(
  animalId: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const hold = await getLatestHold(animalId);
  if (!hold) return { ok: false, reason: "not_found" };
  if (hold.status !== "Reclaimed By Owner" || hold.custodyTransferCompletedAt) {
    return { ok: false, reason: "invalid_state" };
  }

  const now = new Date().toISOString();
  await patchHold(hold.id, {
    custodyTransferCompletedAt: now,
    custodyTransferByEmail: email,
    custodyTransferByName: name,
  });

  await changeAnimalStatus(
    animalId,
    { currentStatus: "ReturnedToOwner", statusUpdatedAt: now },
    { email, name },
    "Confirm Custody Transfer Completed",
  );

  return { ok: true };
}

// FR-MC-02 step 4 / FR-NOT-01 "Statutory Hold approaching end date" -
// holds within the reminder window that haven't ended yet.
export async function listHoldsNeedingReminder(): Promise<StatutoryHold[]> {
  await resolveExpiredHolds();
  const now = new Date();
  const reminderLeadDays = getSystemSettings().reminderLeadDays;
  const all = await fetchAllHolds();
  return all.filter((h) => {
    if (h.status !== "Active") return false;
    const reminderFrom = new Date(h.holdEndAt);
    reminderFrom.setDate(reminderFrom.getDate() - reminderLeadDays);
    return now >= reminderFrom && now < new Date(h.holdEndAt);
  });
}
