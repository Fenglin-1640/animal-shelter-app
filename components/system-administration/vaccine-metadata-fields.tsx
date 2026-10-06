"use client";

import { builtInKey, resolveVaccineType } from "@/lib/medical/vaccine-model";
import type { DropdownOption } from "@/lib/system-administration/types";

// "Applicable species" and "Covers (antigens)" for a Vaccine Type option.
// Both are optional: a built-in option keeps its standard meaning while
// they are empty, and an option with no applicable species is not offered
// to Veterinarians.
export function VaccineMetadataFields({
  idPrefix,
  option,
  speciesOptions,
  applicableSpecies,
  onSpeciesChange,
  covers,
  onCoversChange,
}: {
  idPrefix: string;
  option?: DropdownOption;
  speciesOptions: DropdownOption[];
  applicableSpecies: string[];
  onSpeciesChange: (ids: string[]) => void;
  covers: string;
  onCoversChange: (text: string) => void;
}) {
  const builtIn = option ? builtInKey(option.id) : null;
  const defaults = option && builtIn ? resolveVaccineType({ ...option, applicableSpecies: [], coversAntigens: [] }, speciesOptions) : null;
  const speciesName = (id: string) => speciesOptions.find((s) => s.id === id)?.value ?? id;
  const active = speciesOptions.filter((s) => !s.isRetired || applicableSpecies.includes(s.id));

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs font-semibold text-text-muted">Applicable species</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {active.map((s) => (
            <label key={s.id} className="flex items-center gap-1.5 text-sm text-text">
              <input
                type="checkbox"
                checked={applicableSpecies.includes(s.id)}
                onChange={(e) => onSpeciesChange(e.target.checked ? [...applicableSpecies, s.id] : applicableSpecies.filter((x) => x !== s.id))}
              />
              {s.value}
            </label>
          ))}
        </div>
        <p id={`${idPrefix}-species-help`} className="text-xs text-text-muted">
          Vaccine types without an applicable species are not offered to Veterinarians.
          {defaults && applicableSpecies.length === 0 && defaults.speciesIds.length > 0
            ? ` Left empty, this built-in type applies to ${defaults.speciesIds.map(speciesName).join(", ")}.`
            : ""}
        </p>
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-covers`} className="text-xs font-semibold text-text-muted">
          Covers (antigens)
        </label>
        <input
          id={`${idPrefix}-covers`}
          type="text"
          value={covers}
          placeholder={defaults ? defaults.antigenLabels.join(", ") : "e.g. parvovirus, distemper"}
          onChange={(e) => onCoversChange(e.target.value)}
          aria-describedby={`${idPrefix}-covers-help`}
          className="h-9 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        <p id={`${idPrefix}-covers-help`} className="text-xs text-text-muted">
          Comma-separated short antigen names.
          {defaults && !covers.trim()
            ? ` Left empty, this built-in type covers: ${defaults.antigenLabels.join(", ")}.`
            : !covers.trim()
              ? " Left empty, the type covers one antigen named after its value."
              : ""}{" "}
          Changing these does not alter existing vaccination records.
        </p>
      </div>
    </div>
  );
}
