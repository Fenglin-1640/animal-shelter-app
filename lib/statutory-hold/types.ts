import type { RegisteredOwnerContact } from "@/lib/microchip/types";

// FR-MC-02: Statutory Holding Period days and reminder lead days are
// meant to be Administrator-configurable (FR-SA-02 - System
// Administration rule configuration - not built yet). Hardcoded here as
// a placeholder default, disclosed in the UI wherever a hold is shown.
export const DEFAULT_HOLDING_PERIOD_DAYS = 7;
export const DEFAULT_REMINDER_LEAD_DAYS = 2;

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
