// FR-MC-01: Staff enters a microchip number (scanned by a physical
// reader in the real system - here, typed directly), the system creates
// an immutable MicrochipLookup record and calls a simulated National Pet
// Registry. The mock service supports the 4 outcomes PRD 6.6 requires.
export type MicrochipLookupResult = "Owner Match" | "No Match" | "No Chip" | "Timeout";

export interface RegisteredOwnerContact {
  name: string;
  phone: string;
  address: string;
}

export interface MicrochipLookup {
  id: string;
  animalId: string;
  microchipNumber: string;
  result: MicrochipLookupResult;
  ownerContact?: RegisteredOwnerContact;
  performedByEmail: string;
  performedByName: string;
  performedAt: string;
}
