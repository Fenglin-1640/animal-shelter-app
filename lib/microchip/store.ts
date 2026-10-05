import { getAnimalById, updateAnimal } from "@/lib/animals/animal-store";
import { completeTaskByType } from "@/lib/adoption-fitness/store";
import { createHoldForOwnerMatch } from "@/lib/statutory-hold/store";
import { evaluatePreListingEligibility } from "@/lib/adoption-listings/pre-listing";
import { queryNationalPetRegistry } from "@/lib/microchip/mock-registry";
import type { MicrochipLookup } from "@/lib/microchip/types";
import { getJson, send } from "@/lib/shared/http";
import type { MicrochipImplantTask } from "@/lib/microchip/implant";

// FR-MC-01: MicrochipLookup now lives in the database (see
// prisma/contract.prisma) behind /api/microchip-lookups - see
// prisma/README.md for this Prisma toolchain's quirks. Records are
// never edited or deleted once created ("不可删除") - performScan only
// ever appends.

async function fetchAll(): Promise<MicrochipLookup[]> {
  const result = await getJson("/api/microchip-lookups");
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
  await send("/api/microchip-lookups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lookup),
  });

  if (outcome.result === "Owner Match" || outcome.result === "No Match") {
    await updateAnimal(animalId, { microchipNumber: lookup.microchipNumber });
  }
  // No chip: a new number is assigned and the Veterinarian gets an implant
  // task; the Microchip Check completes when the chip is implanted.
  // Otherwise any definitive result completes the check.
  if (outcome.result === "No Chip") {
    await requestMicrochipImplant(animalId);
  } else if (outcome.result !== "Timeout") {
    await completeTaskByType(animalId, "Microchip Check", email, name);
  }
  // FR-MC-02: Owner Match automatically links the owner and starts a
  // Statutory Hold - a direct system consequence of the lookup result,
  // not a separate Staff action.
  if (outcome.result === "Owner Match" && outcome.ownerContact) {
    await createHoldForOwnerMatch(animalId, outcome.ownerContact, email, name);
    // The hold withdrew any automatic Vet fitness confirmation (server-
    // side); re-run the eligibility evaluation on the new state.
    await evaluatePreListingEligibility(animalId, { email, name });
  }

  return { ok: true, lookup };
}

// Microchip implant tasks (No Chip result) - see app/api/microchip-implants.
export async function requestMicrochipImplant(animalId: string): Promise<MicrochipImplantTask | undefined> {
  const response = await send("/api/microchip-implants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ animalId }),
  });
  const result = await response.json();
  return result.ok ? (result.item as MicrochipImplantTask) : undefined;
}

export async function listMicrochipImplants(filter: { animalId?: string; status?: "Pending" | "Completed" } = {}): Promise<MicrochipImplantTask[]> {
  const params = new URLSearchParams(filter as Record<string, string>);
  const result = await getJson(`/api/microchip-implants${params.size ? `?${params}` : ""}`);
  return (result.items as MicrochipImplantTask[]) ?? [];
}

export async function getLatestMicrochipImplant(animalId: string): Promise<MicrochipImplantTask | undefined> {
  return (await listMicrochipImplants({ animalId })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

export async function completeMicrochipImplant(taskId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const response = await send(`/api/microchip-implants/${encodeURIComponent(taskId)}/complete`, { method: "POST" });
  const result = await response.json();
  return result.ok ? { ok: true } : { ok: false, reason: result.reason ?? "failed" };
}
