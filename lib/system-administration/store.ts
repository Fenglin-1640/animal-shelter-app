import type { Species } from "@/lib/animals/types";
import { buildSeedOptions } from "@/lib/system-administration/seed-options";
import type { DropdownCategory, DropdownOption } from "@/lib/system-administration/types";

// FR-SA-01: Administrator-maintained dropdown options, persisted to
// localStorage since there is no backend. Soft-deleted (isRetired)
// options are excluded from new-record pickers by default but remain
// listable so historical records keep displaying their original value.
const STORAGE_KEY = "asams-dropdown-options";

function loadAll(): DropdownOption[] {
  if (typeof window === "undefined") return buildSeedOptions();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = buildSeedOptions();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DropdownOption[]) : buildSeedOptions();
  } catch {
    return buildSeedOptions();
  }
}

function saveAll(options: DropdownOption[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
}

export function listAllOptions(): DropdownOption[] {
  return loadAll();
}

export function listOptions(
  category: DropdownCategory,
  opts?: { includeRetired?: boolean; speciesId?: Species },
): DropdownOption[] {
  let options = loadAll().filter((o) => o.category === category);
  if (!opts?.includeRetired) options = options.filter((o) => !o.isRetired);
  if (opts?.speciesId) options = options.filter((o) => o.speciesId === opts.speciesId);
  return options;
}

// Convenience for consumers that just need the active value strings for a
// picker (e.g. Sign Up's Title select, an Animal form's Breed select).
export function getActiveValues(category: DropdownCategory, speciesId?: Species): string[] {
  return listOptions(category, { speciesId }).map((o) => o.value);
}

export interface CreateOptionInput {
  category: DropdownCategory;
  value: string;
  description: string;
  speciesId?: Species;
}

export type MutationResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" }
  | { ok: false; reason: "locked" }
  | { ok: false; reason: "not_found" };

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

export function createOption(input: CreateOptionInput): MutationResult {
  const all = loadAll();
  if (isDuplicate(all, input.category, input.value, input.speciesId)) {
    return { ok: false, reason: "duplicate" };
  }

  const now = new Date().toISOString();
  const option: DropdownOption = {
    id: `${input.category}:${input.value.trim()}:${Math.random().toString(36).slice(2, 6)}`,
    category: input.category,
    value: input.value.trim(),
    description: input.description.trim(),
    speciesId: input.speciesId,
    isRetired: false,
    systemLocked: false,
    createdAt: now,
    updatedAt: now,
  };
  saveAll([...all, option]);
  return { ok: true };
}

export interface UpdateOptionInput {
  value: string;
  description: string;
  speciesId?: Species;
}

export function updateOption(id: string, patch: UpdateOptionInput): MutationResult {
  const all = loadAll();
  const index = all.findIndex((o) => o.id === id);
  if (index === -1) return { ok: false, reason: "not_found" };

  if (isDuplicate(all, all[index].category, patch.value, patch.speciesId, id)) {
    return { ok: false, reason: "duplicate" };
  }

  const now = new Date().toISOString();
  all[index] = {
    ...all[index],
    value: patch.value.trim(),
    description: patch.description.trim(),
    speciesId: patch.speciesId,
    updatedAt: now,
  };
  saveAll(all);
  return { ok: true };
}

export function setRetired(id: string, retired: boolean): MutationResult {
  const all = loadAll();
  const index = all.findIndex((o) => o.id === id);
  if (index === -1) return { ok: false, reason: "not_found" };
  if (retired && all[index].systemLocked) return { ok: false, reason: "locked" };

  all[index] = { ...all[index], isRetired: retired, updatedAt: new Date().toISOString() };
  saveAll(all);
  return { ok: true };
}
