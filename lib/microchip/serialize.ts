import type { MicrochipLookup, MicrochipLookupResult } from "@/lib/microchip/types";

export interface MicrochipLookupRow
  extends Omit<MicrochipLookup, "result" | "ownerContact" | "performedAt"> {
  result: string;
  ownerContactName: string | null;
  ownerContactPhone: string | null;
  ownerContactAddress: string | null;
  performedAt: string;
}

export function toMicrochipLookup(row: MicrochipLookupRow): MicrochipLookup {
  return {
    ...row,
    result: row.result as MicrochipLookupResult,
    ownerContact: row.ownerContactName
      ? {
          name: row.ownerContactName,
          phone: row.ownerContactPhone ?? "",
          address: row.ownerContactAddress ?? "",
        }
      : undefined,
    performedAt: row.performedAt,
  };
}
