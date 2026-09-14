import type { Species } from "@/lib/animals/types";
import { listAllOptions, listOptions } from "@/lib/system-administration/store";

// Sourced from the FR-SA-01 dropdown option store (category "Breed and
// Description") so retiring a breed there is reflected in the Animals
// filter panel.
export interface BreedOption {
  species: Species;
  name: string;
  description: string;
  isRetired: boolean;
}

export function getBreedSpeciesList(): Species[] {
  return Array.from(
    new Set(
      listAllOptions()
        .filter((o) => o.category === "Breed and Description" && o.speciesId)
        .map((o) => o.speciesId as Species),
    ),
  );
}

export function getBreedsForSpecies(species: Species): BreedOption[] {
  return listOptions("Breed and Description", { speciesId: species }).map((o) => ({
    species,
    name: o.value,
    description: o.description,
    isRetired: o.isRetired,
  }));
}
