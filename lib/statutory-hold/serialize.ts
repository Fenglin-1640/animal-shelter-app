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
  holdStartAt: Date;
  holdEndAt: Date;
  createdAt: Date;
  reclaimedAt: Date | null;
  reclaimedByEmail: string | null;
  reclaimedByName: string | null;
  custodyTransferCompletedAt: Date | null;
  custodyTransferByEmail: string | null;
  custodyTransferByName: string | null;
  expiredAt: Date | null;
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
    holdStartAt: row.holdStartAt.toISOString(),
    holdEndAt: row.holdEndAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    reclaimedAt: row.reclaimedAt?.toISOString(),
    reclaimedByEmail: row.reclaimedByEmail ?? undefined,
    reclaimedByName: row.reclaimedByName ?? undefined,
    custodyTransferCompletedAt: row.custodyTransferCompletedAt?.toISOString(),
    custodyTransferByEmail: row.custodyTransferByEmail ?? undefined,
    custodyTransferByName: row.custodyTransferByName ?? undefined,
    expiredAt: row.expiredAt?.toISOString(),
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
    } else if (
      key === "holdStartAt" ||
      key === "holdEndAt" ||
      key === "createdAt" ||
      key === "reclaimedAt" ||
      key === "custodyTransferCompletedAt" ||
      key === "expiredAt"
    ) {
      row[key] = typeof value === "string" ? new Date(value) : value;
    } else {
      row[key] = value;
    }
  }
  return row;
}
