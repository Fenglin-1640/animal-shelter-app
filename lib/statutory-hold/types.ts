import type { RegisteredOwnerContact } from "@/lib/microchip/types";

// FR-MC-02: Statutory Holding Period days and reminder lead days are
// Administrator-configurable via FR-SA-02 (lib/system-administration/
// settings-store.ts's getSystemSettings()) - see lib/statutory-hold/store.ts.

export type StatutoryHoldStatus = "Active" | "Reclaimed By Owner" | "Expired";

export interface StatutoryHold {
  id: string;
  animalId: string;
  ownerContact: RegisteredOwnerContact;
  holdStartAt: string;
  holdEndAt: string;
  holdingPeriodDays: number;
  status: StatutoryHoldStatus;
  createdAt: string;
  // ownerReclaimed
  reclaimedAt?: string;
  reclaimedByEmail?: string;
  reclaimedByName?: string;
  // completed custody transfer -> currentStatus = ReturnedToOwner
  custodyTransferCompletedAt?: string;
  custodyTransferByEmail?: string;
  custodyTransferByName?: string;
  // holdPeriodExpired
  expiredAt?: string;
}
