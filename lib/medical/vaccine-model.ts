// Which species each Vaccine Type applies to and which antigens it
// covers, resolved from the Dropdown Options data so types an
// Administrator adds work without code changes. Shared by the screens
// (pickers, previews) and the routes (validation), so both apply the same
// rules.
//
// Resolution per Vaccine Type option:
//   - Administrator values (applicableSpecies / coversAntigens) win.
//   - Otherwise the built-in options (seeded ids "Vaccine Type:<key>")
//     use BUILT_IN below; their display value may have been edited, so
//     they are matched by id, never by text.
//   - Otherwise an option covers one antigen named after its value and
//     applies to no species - it is never proposed or offered.
// Species are compared by the Species option's id (its stable key).

export interface OptionLike {
  id: string;
  category: string;
  value: string;
  isRetired?: boolean;
  applicableSpecies?: string[] | null;
  coversAntigens?: string[] | null;
}

export interface ResolvedVaccineType {
  id: string;
  value: string;
  speciesIds: string[];
  // Normalised antigen keys, and the labels to show for them.
  antigens: string[];
  antigenLabels: string[];
  source: "admin" | "built-in" | "default";
}

const BUILT_IN: Record<string, { species: string[]; antigens: string[] }> = {
  C3: { species: ["Dog"], antigens: ["parvovirus", "distemper", "hepatitis"] },
  C4: { species: ["Dog"], antigens: ["parvovirus", "distemper", "hepatitis", "parainfluenza"] },
  C5: { species: ["Dog"], antigens: ["parvovirus", "distemper", "hepatitis", "parainfluenza", "bordetella"] },
  C7: { species: ["Dog"], antigens: ["parvovirus", "distemper", "hepatitis", "parainfluenza", "bordetella", "leptospirosis strains"] },
  "Kennel Cough (Bordetella)": { species: ["Dog"], antigens: ["bordetella"] },
  F3: { species: ["Cat"], antigens: ["feline enteritis", "herpesvirus", "calicivirus"] },
  F4: { species: ["Cat"], antigens: ["feline enteritis", "herpesvirus", "calicivirus", "FeLV"] },
  F5: { species: ["Cat"], antigens: ["feline enteritis", "herpesvirus", "calicivirus", "chlamydia", "FeLV"] },
  "Reptile Preventive Health Check": { species: ["Reptile"], antigens: ["Reptile Preventive Health Check"] },
};

const VACCINE_PREFIX = "Vaccine Type:";

// Antigen names recorded before this model existed, mapped to the short
// names above so older antibody results still count.
const ANTIGEN_ALIASES: Record<string, string> = {
  "canine parvovirus": "parvovirus",
  "canine distemper": "distemper",
  "canine adenovirus (hepatitis)": "hepatitis",
  "canine parainfluenza": "parainfluenza",
  leptospirosis: "leptospirosis strains",
  "feline panleukopenia (enteritis)": "feline enteritis",
  "feline herpesvirus": "herpesvirus",
  "feline calicivirus": "calicivirus",
  "feline leukaemia (felv)": "felv",
};

export function antigenKey(name: string): string {
  const k = name.trim().toLowerCase().replace(/\s+/g, " ");
  return ANTIGEN_ALIASES[k] ?? k;
}

// The built-in key of a seeded option (null for Administrator-added ones).
export function builtInKey(optionId: string): string | null {
  if (!optionId.startsWith(VACCINE_PREFIX)) return null;
  const key = optionId.slice(VACCINE_PREFIX.length);
  return key in BUILT_IN ? key : null;
}

function speciesIdsFor(names: string[], species: OptionLike[]): string[] {
  return names.map((n) => speciesKeyFor(n, species)).filter((id): id is string => Boolean(id));
}

// The Species option id for a species name as stored on an animal.
export function speciesKeyFor(speciesName: string, species: OptionLike[]): string | null {
  const name = speciesName.trim().toLowerCase();
  return species.find((s) => s.category === "Species" && s.value.trim().toLowerCase() === name)?.id ?? null;
}

export function resolveVaccineType(option: OptionLike, species: OptionLike[]): ResolvedVaccineType {
  const builtIn = builtInKey(option.id);
  const def = builtIn ? BUILT_IN[builtIn] : null;
  const adminSpecies = option.applicableSpecies?.length ? option.applicableSpecies : null;
  const adminAntigens = option.coversAntigens?.length ? option.coversAntigens : null;
  const labels = adminAntigens ?? def?.antigens ?? [option.value];
  const unique = new Map<string, string>();
  for (const l of labels) if (l.trim() && !unique.has(antigenKey(l))) unique.set(antigenKey(l), l.trim());
  return {
    id: option.id,
    value: option.value,
    speciesIds: adminSpecies ?? (def ? speciesIdsFor(def.species, species) : []),
    antigens: [...unique.keys()],
    antigenLabels: [...unique.values()],
    source: adminSpecies || adminAntigens ? "admin" : def ? "built-in" : "default",
  };
}

export interface VaccineModel {
  speciesId: string | null;
  // Active types applicable to the species, alphabetical by value.
  types: ResolvedVaccineType[];
  // Every type (any species), for reading older records.
  all: ResolvedVaccineType[];
  // Antigen key -> label, for the species.
  antigenLabels: Map<string, string>;
}

export function buildVaccineModel(options: OptionLike[], animalSpecies: string): VaccineModel {
  const species = options.filter((o) => o.category === "Species");
  const all = options.filter((o) => o.category === "Vaccine Type").map((o) => ({ option: o, resolved: resolveVaccineType(o, species) }));
  const speciesId = speciesKeyFor(animalSpecies, species);
  const types = speciesId
    ? all.filter((t) => !t.option.isRetired && t.resolved.speciesIds.includes(speciesId)).map((t) => t.resolved)
    : [];
  types.sort((a, b) => a.value.localeCompare(b.value));
  const antigenLabels = new Map<string, string>();
  for (const t of types) t.antigens.forEach((k, i) => antigenLabels.has(k) || antigenLabels.set(k, t.antigenLabels[i]));
  return { speciesId, types, all: all.map((t) => t.resolved), antigenLabels };
}

// The type a stored vaccine name refers to: its current value, or for a
// built-in option the name it had when it was seeded (e.g. "C5").
export function findType(name: string, types: ResolvedVaccineType[]): ResolvedVaccineType | undefined {
  const n = name.trim().toLowerCase();
  return types.find((t) => t.value.trim().toLowerCase() === n) ?? types.find((t) => builtInKey(t.id)?.toLowerCase() === n);
}

export function isApplicable(name: string, model: VaccineModel): boolean {
  return Boolean(findType(name, model.types));
}

// Greedy cover of the antigen gap, one vaccine type at a time: among the
// types whose antigens are all still missing, the one covering most
// (ties alphabetical); when none fits entirely, the one overlapping most.
export function proposeTypes(gap: Set<string>, types: ResolvedVaccineType[]): ResolvedVaccineType[] {
  const remaining = new Set(gap);
  const picked: ResolvedVaccineType[] = [];
  const candidates = [...types].sort((a, b) => a.value.localeCompare(b.value));
  while (remaining.size > 0) {
    const inside = candidates.filter((t) => !picked.includes(t) && t.antigens.length > 0 && t.antigens.every((a) => remaining.has(a)));
    const pool = inside.length > 0 ? inside : candidates.filter((t) => !picked.includes(t) && t.antigens.some((a) => remaining.has(a)));
    if (pool.length === 0) break;
    const score = (t: ResolvedVaccineType) => t.antigens.filter((a) => remaining.has(a)).length;
    const best = pool.reduce((b, t) => (score(t) > score(b) ? t : b));
    picked.push(best);
    for (const a of best.antigens) remaining.delete(a);
  }
  return picked.sort((a, b) => a.value.localeCompare(b.value));
}

// Antigens shared by two or more of the selected types, for the overlap
// notice: [label, the type values covering it].
export function overlaps(selected: ResolvedVaccineType[], labels: Map<string, string>): { antigen: string; types: string[] }[] {
  const byAntigen = new Map<string, string[]>();
  for (const t of selected) for (const a of t.antigens) byAntigen.set(a, [...(byAntigen.get(a) ?? []), t.value]);
  return [...byAntigen.entries()].filter(([, v]) => v.length > 1).map(([a, v]) => ({ antigen: labels.get(a) ?? a, types: v }));
}

// Normalise an Administrator's comma-separated antigen list.
export function parseAntigenList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(",")) {
    const v = raw.trim().replace(/\s+/g, " ");
    if (v && !seen.has(antigenKey(v))) {
      seen.add(antigenKey(v));
      out.push(v);
    }
  }
  return out;
}

export function validateVaccineMetadata(
  applicableSpecies: unknown,
  coversAntigens: unknown,
  speciesIds: Set<string>,
): string | null {
  if (applicableSpecies != null) {
    if (!Array.isArray(applicableSpecies) || applicableSpecies.some((s) => typeof s !== "string" || !speciesIds.has(s))) return "Applicable species must be chosen from the species list.";
  }
  if (coversAntigens != null) {
    if (!Array.isArray(coversAntigens) || coversAntigens.some((a) => typeof a !== "string" || !a.trim() || a.length > 40)) return "Each antigen must be 1 to 40 characters.";
    if (coversAntigens.length > 20) return "At most 20 antigens.";
  }
  return null;
}

export const NO_VACCINES_MESSAGE = "No vaccine types are configured for this species. An Administrator can add them under Dropdown Options.";
