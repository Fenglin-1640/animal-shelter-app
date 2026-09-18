import { getAnimalById, updateAnimal } from "@/lib/animals/animal-store";
import { completeTaskByType } from "@/lib/adoption-fitness/store";
import { createHoldForOwnerMatch } from "@/lib/statutory-hold/store";
import { queryNationalPetRegistry } from "@/lib/microchip/mock-registry";
import type { MicrochipLookup } from "@/lib/microchip/types";

// FR-MC-01: MicrochipLookup now lives in the database (see
// prisma/contract.prisma) behind /api/microchip-lookups - see
// prisma/README.md for this Prisma toolchain's quirks. Records are
// never edited or deleted once created ("不可删除") - performScan only
// ever appends.

async function fetchAll(): Promise<MicrochipLookup[]> {
  const response = await fetch("/api/microchip-lookups");
  const result = await response.json();
  return result.items as MicrochipLookup[];
}

function generateLookupId(): string {
  return `ML-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function listLookupsForAnimal(animalId: string): Promise<MicrochipLookup[]> {
  return (await fetchAll())
    .filter((l) => l.animalId === animalId)
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
}

export type ScanResult = { ok: true; lookup: MicrochipLookup } | { ok: false; reason: "not_found" };

// Definitive outcomes (Owner Match/No Match/No Chip) mark the Microchip
// Check assessment task (FR-INT-04) Continuable and, when a chip number
// was actually read (Owner Match/No Match), write it back onto the
// Animal record. Timeout is not definitive - PRD requires Staff be
// offered Retry - so neither happens until a retry succeeds or returns a
// non-Timeout result.
export async function performScan(
  animalId: string,
  microchipNumber: string,
  email: string,
  name: string,
): Promise<ScanResult> {
  const animal = await getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };

  const outcome = await queryNationalPetRegistry(microchipNumber);

  const lookup: MicrochipLookup = {
    id: generateLookupId(),
    animalId,
    microchipNumber: microchipNumber.trim(),
    result: outcome.result,
    ownerContact: outcome.ownerContact,
    performedByEmail: email,
    performedByName: name,
    performedAt: new Date().toISOString(),
  };
  await fetch("/api/microchip-lookups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lookup),
  });

  if (outcome.result === "Owner Match" || outcome.result === "No Match") {
    await updateAnimal(animalId, { microchipNumber: lookup.microchipNumber });
  }
  if (outcome.result !== "Timeout") {
    completeTaskByType(animalId, "Microchip Check", email, name);
  }
  // FR-MC-02: Owner Match automatically links the owner and starts a
  // Statutory Hold - a direct system consequence of the lookup result,
  // not a separate Staff action.
  if (outcome.result === "Owner Match" && outcome.ownerContact) {
    await createHoldForOwnerMatch(animalId, outcome.ownerContact, email, name);
  }

  return { ok: true, lookup };
}
