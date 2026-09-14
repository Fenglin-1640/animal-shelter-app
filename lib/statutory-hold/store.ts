import { changeAnimalStatus, getAnimalById } from "@/lib/animals/animal-store";
import { SYSTEM_ACTOR } from "@/lib/audit/types";
import { linkRegisteredOwnerContact } from "@/lib/intake-records/store";
import type { RegisteredOwnerContact } from "@/lib/microchip/types";
import {
  DEFAULT_HOLDING_PERIOD_DAYS,
  DEFAULT_REMINDER_LEAD_DAYS,
  type StatutoryHold,
} from "@/lib/statutory-hold/types";

// FR-MC-02: StatutoryHold records, persisted to localStorage since there
// is no backend. One hold per animal in this prototype (Owner Match is
// idempotent - re-scanning an animal that already has a hold does not
// create a second one).
const STORAGE_KEY = "asams-statutory-holds";

function loadAll(): StatutoryHold[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StatutoryHold[]) : [];
  } catch {
    return [];
  }
}

function saveAll(holds: StatutoryHold[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(holds));
}

function generateHoldId(): string {
  return `SH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// There is no scheduler in this prototype, so expiry (PRD:
// holdPeriodExpired) is resolved lazily whenever holds are read: any
// Active hold whose holdEndAt has passed is flipped to Expired and, if
// the Animal is still On Statutory Hold (nothing else has moved it on),
// reverted to Under Assessment.
function resolveExpiredHolds() {
  const all = loadAll();
  const now = new Date();
  let changed = false;

  for (let i = 0; i < all.length; i++) {
    const hold = all[i];
    if (hold.status !== "Active" || new Date(hold.holdEndAt) > now) continue;

    const expiredAt = now.toISOString();
    all[i] = { ...hold, status: "Expired", expiredAt };
    changed = true;

    const animal = getAnimalById(hold.animalId);
    if (animal?.currentStatus === "On Statutory Hold") {
      changeAnimalStatus(
        hold.animalId,
        { currentStatus: "Under Assessment", statusUpdatedAt: expiredAt },
        SYSTEM_ACTOR,
        "Statutory Hold Expired (holdPeriodExpired)",
      );
    }
  }

  if (changed) saveAll(all);
}

export function listHoldsForAnimal(animalId: string): StatutoryHold[] {
  resolveExpiredHolds();
  return loadAll()
    .filter((h) => h.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getLatestHold(animalId: string): StatutoryHold | undefined {
  return listHoldsForAnimal(animalId)[0];
}

// FR-LIST-01 precondition 3 / FR-MED-03's Pre-Listing gate: "不存在未结束的
// Statutory Hold".
export function hasUnresolvedHold(animalId: string): boolean {
  return listHoldsForAnimal(animalId).some((h) => h.status === "Active");
}

export type HoldResult = { ok: true; hold: StatutoryHold } | { ok: false; reason: "not_found" };

// FR-MC-02 steps 1-3, run automatically as a consequence of Scan
// Microchip (FR-MC-01) returning Owner Match.
export function createHoldForOwnerMatch(
  animalId: string,
  ownerContact: RegisteredOwnerContact,
  email: string,
  name: string,
): HoldResult {
  const animal = getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };

  const existing = loadAll().find((h) => h.animalId === animalId);
  if (existing) return { ok: true, hold: existing };

  const holdStart = new Date(animal.enteredAt);
  const holdEnd = new Date(holdStart);
  holdEnd.setDate(holdEnd.getDate() + DEFAULT_HOLDING_PERIOD_DAYS);
  const now = new Date().toISOString();

  const hold: StatutoryHold = {
    id: generateHoldId(),
    animalId,
    ownerContact,
    holdStartAt: holdStart.toISOString(),
    holdEndAt: holdEnd.toISOString(),
    holdingPeriodDays: DEFAULT_HOLDING_PERIOD_DAYS,
    status: "Active",
    createdAt: now,
  };
  saveAll([...loadAll(), hold]);

  changeAnimalStatus(
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

  return { ok: true, hold };
}

export type MutationResult = { ok: true } | { ok: false; reason: "not_found" | "invalid_state" };

// PRD: ownerReclaimed -> Record Owner Reclamation.
export function recordOwnerReclamation(
  animalId: string,
  email: string,
  name: string,
): MutationResult {
  const hold = getLatestHold(animalId);
  if (!hold) return { ok: false, reason: "not_found" };
  if (hold.status !== "Active") return { ok: false, reason: "invalid_state" };

  const all = loadAll();
  const index = all.findIndex((h) => h.id === hold.id);
  const now = new Date().toISOString();
  all[index] = {
    ...hold,
    status: "Reclaimed By Owner",
    reclaimedAt: now,
    reclaimedByEmail: email,
    reclaimedByName: name,
  };
  saveAll(all);

  changeAnimalStatus(
    animalId,
    { currentStatus: "Reclaimed By Owner", statusUpdatedAt: now, listingStatus: "Removed" },
    { email, name },
    "Record Owner Reclamation",
  );

  return { ok: true };
}

// PRD: 完成 custody transfer 后归档为 ReturnedToOwner (a named final state).
export function confirmCustodyTransfer(
  animalId: string,
  email: string,
  name: string,
): MutationResult {
  const hold = getLatestHold(animalId);
  if (!hold) return { ok: false, reason: "not_found" };
  if (hold.status !== "Reclaimed By Owner" || hold.custodyTransferCompletedAt) {
    return { ok: false, reason: "invalid_state" };
  }

  const all = loadAll();
  const index = all.findIndex((h) => h.id === hold.id);
  const now = new Date().toISOString();
  all[index] = {
    ...hold,
    custodyTransferCompletedAt: now,
    custodyTransferByEmail: email,
    custodyTransferByName: name,
  };
  saveAll(all);

  changeAnimalStatus(
    animalId,
    { currentStatus: "ReturnedToOwner", statusUpdatedAt: now },
    { email, name },
    "Confirm Custody Transfer Completed",
  );

  return { ok: true };
}

// FR-MC-02 step 4 / FR-NOT-01 "Statutory Hold approaching end date" -
// holds within the reminder window that haven't ended yet.
export function listHoldsNeedingReminder(): StatutoryHold[] {
  resolveExpiredHolds();
  const now = new Date();
  return loadAll().filter((h) => {
    if (h.status !== "Active") return false;
    const reminderFrom = new Date(h.holdEndAt);
    reminderFrom.setDate(reminderFrom.getDate() - DEFAULT_REMINDER_LEAD_DAYS);
    return now >= reminderFrom && now < new Date(h.holdEndAt);
  });
}
