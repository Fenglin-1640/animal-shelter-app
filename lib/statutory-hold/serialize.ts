import type { StatutoryHold, StatutoryHoldStatus } from "@/lib/statutory-hold/types";

// Server-side row shape returned by the Prisma 8 contract client (see
// prisma/contract.prisma) - ownerContact is flattened into 3 columns,
// status is a generic String column, not narrowed to StatutoryHoldStatus.
export interface StatutoryHoldRow
  extends Omit<
    StatutoryHold,
    | "ownerContact"
    | "status"
    | "holdStartAt"
    | "holdEndAt"
    | "createdAt"
    | "reclaimedAt"
    | "reclaimedByEmail"
    | "reclaimedByName"
    | "custodyTransferCompletedAt"
    | "custodyTransferByEmail"
    | "custodyTransferByName"
    | "expiredAt"
  > {
  ownerContactName: string;
  ownerContactPhone: string;
  ownerContactAddress: string;
  status: string;
  holdStartAt: string;
  holdEndAt: string;
  createdAt: string;
  reclaimedAt: string | null;
  reclaimedByEmail: string | null;
  reclaimedByName: string | null;
  custodyTransferCompletedAt: string | null;
  custodyTransferByEmail: string | null;
  custodyTransferByName: string | null;
  expiredAt: string | null;
}

export function toStatutoryHold(row: StatutoryHoldRow): StatutoryHold {
  return {
    ...row,
    ownerContact: {
      name: row.ownerContactName,
      phone: row.ownerContactPhone,
      address: row.ownerContactAddress,
    },
    status: row.status as StatutoryHoldStatus,
    holdStartAt: row.holdStartAt,
    holdEndAt: row.holdEndAt,
    createdAt: row.createdAt,
    reclaimedAt: row.reclaimedAt ?? undefined,
    reclaimedByEmail: row.reclaimedByEmail ?? undefined,
    reclaimedByName: row.reclaimedByName ?? undefined,
    custodyTransferCompletedAt: row.custodyTransferCompletedAt ?? undefined,
    custodyTransferByEmail: row.custodyTransferByEmail ?? undefined,
    custodyTransferByName: row.custodyTransferByName ?? undefined,
    expiredAt: row.expiredAt ?? undefined,
  };
}

// Translates a client-supplied Partial<StatutoryHold> patch (same field
// names as the domain type) into the DB column shape, for the generic
// PATCH route - mirrors lib/animals/serialize.ts's toAnimalRowPatch.
export function toStatutoryHoldRowPatch(patch: Partial<StatutoryHold>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "ownerContact") {
      const contact = value as StatutoryHold["ownerContact"];
      row.ownerContactName = contact.name;
      row.ownerContactPhone = contact.phone;
      row.ownerContactAddress = contact.address;
    } else {
      row[key] = value;
    }
  }
  return row;
}
