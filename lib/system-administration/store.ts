import type { Species } from "@/lib/animals/types";
import type { DropdownCategory, DropdownOption } from "@/lib/system-administration/types";
import { getJson, send } from "@/lib/shared/http";

// FR-SA-01: Administrator-maintained dropdown options now live in the
// database (see prisma/contract.prisma) behind /api/dropdown-options -
// see prisma/README.md for this Prisma toolchain's quirks. The ~85
// PRD-seeded options (lib/system-administration/seed-options.ts) are
// seeded via prisma/seed.ts now, not a runtime localStorage-empty
// fallback. Soft-deleted (isRetired) options are excluded from new-
// record pickers by default but remain listable so historical records
// keep displaying their original value.

async function fetchAll(): Promise<DropdownOption[]> {
  const result = await getJson("/api/dropdown-options");
  return result.items as DropdownOption[];
}

async function patchOption(id: string, patch: Partial<DropdownOption>): Promise<DropdownOption | { invalid: string } | undefined> {
  const response = await send(`/api/dropdown-options/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const result = await response.json();
  if (result.reason === "invalid") return { invalid: result.message ?? "Invalid value." };
  if (!result.ok) return undefined;
  return result.item as DropdownOption;
}

export async function listAllOptions(): Promise<DropdownOption[]> {
  return fetchAll();
}

export async function listOptions(
  category: DropdownCategory,
  opts?: { includeRetired?: boolean; speciesId?: Species },
): Promise<DropdownOption[]> {
  let options = (await fetchAll()).filter((o) => o.category === category);
  if (!opts?.includeRetired) options = options.filter((o) => !o.isRetired);
  if (opts?.speciesId) options = options.filter((o) => o.speciesId === opts.speciesId);
  return options;
}

// Convenience for consumers that just need the active value strings for a
// picker (e.g. Sign Up's Title select, an Animal form's Breed select).
export async function getActiveValues(category: DropdownCategory, speciesId?: Species): Promise<string[]> {
  return (await listOptions(category, { speciesId })).map((o) => o.value);
}

export interface CreateOptionInput {
  category: DropdownCategory;
  value: string;
  description: string;
  speciesId?: Species;
  // Vaccine Type options only.
  applicableSpecies?: string[];
  coversAntigens?: string[];
}

export type MutationResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" }
  | { ok: false; reason: "locked" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid"; message: string };

function isDuplicate(
  options: DropdownOption[],
  category: DropdownCategory,
  value: string,
  speciesId: Species | undefined,
  excludeId?: string,
): boolean {
  const normalized = value.trim().toLowerCase();
  return options.some(
    (o) =>
      o.id !== excludeId &&
      o.category === category &&
      o.value.trim().toLowerCase() === normalized &&
      (category !== "Breed and Description" || o.speciesId === speciesId),
  );
}

function generateOptionId(category: DropdownCategory, value: string): string {
  return `${category}:${value.trim()}:${Math.random().toString(36).slice(2, 6)}`;
}

export async function createOption(input: CreateOptionInput): Promise<MutationResult> {
  const all = await fetchAll();
  if (isDuplicate(all, input.category, input.value, input.speciesId)) {
    return { ok: false, reason: "duplicate" };
  }

  const now = new Date().toISOString();
  const option: DropdownOption = {
    id: generateOptionId(input.category, input.value),
    category: input.category,
    value: input.value.trim(),
    description: input.description.trim(),
    speciesId: input.speciesId,
    isRetired: false,
    systemLocked: false,
    createdAt: now,
    updatedAt: now,
    ...(input.category === "Vaccine Type" ? { applicableSpecies: input.applicableSpecies ?? [], coversAntigens: input.coversAntigens ?? [] } : {}),
  };
  const response = await send("/api/dropdown-options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(option),
  });
  const result = await response.json().catch(() => ({ ok: false }));
  if (result.reason === "invalid") return { ok: false, reason: "invalid", message: result.message ?? "Invalid value." };
  return { ok: true };
}

export interface UpdateOptionInput {
  value: string;
  description: string;
  speciesId?: Species;
  // Vaccine Type options only.
  applicableSpecies?: string[];
  coversAntigens?: string[];
}

export async function updateOption(id: string, patch: UpdateOptionInput): Promise<MutationResult> {
  const all = await fetchAll();
  const existing = all.find((o) => o.id === id);
  if (!existing) return { ok: false, reason: "not_found" };

  if (isDuplicate(all, existing.category, patch.value, patch.speciesId, id)) {
    return { ok: false, reason: "duplicate" };
  }

  const updated = await patchOption(id, {
    value: patch.value.trim(),
    description: patch.description.trim(),
    speciesId: patch.speciesId,
    ...(existing.category === "Vaccine Type" ? { applicableSpecies: patch.applicableSpecies ?? [], coversAntigens: patch.coversAntigens ?? [] } : {}),
    updatedAt: new Date().toISOString(),
  });
  if (updated && "invalid" in updated) return { ok: false, reason: "invalid", message: updated.invalid };
  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true };
}

export async function setRetired(id: string, retired: boolean): Promise<MutationResult> {
  const all = await fetchAll();
  const existing = all.find((o) => o.id === id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (retired && existing.systemLocked) return { ok: false, reason: "locked" };

  const updated = await patchOption(id, { isRetired: retired, updatedAt: new Date().toISOString() });
  if (!updated || "invalid" in updated) return { ok: false, reason: "not_found" };
  return { ok: true };
}
