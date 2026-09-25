"use client";

import { useEffect, useState } from "react";
import type { Species } from "@/lib/animals/types";
import { getBreedsForSpecies, type BreedOption } from "@/lib/options/breeds";

// Breed picker backed by the FR-SA-01 "Breed and Description" options for
// the given species. Used by Intake (where Breed is first identified) and
// by the Animal Profile's edit form (correcting a misidentified breed).
// Retired breeds are hidden, except the currently saved value, so an
// existing animal's breed never silently disappears from its own form.
export function BreedSelect({
  id,
  species,
  value,
  onChange,
  disabled,
  className,
}: {
  id: string;
  species: Species | "";
  value: string;
  onChange: (breed: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [loaded, setLoaded] = useState<{ species: Species; breeds: BreedOption[] } | null>(null);

  useEffect(() => {
    if (!species) return;
    let cancelled = false;
    getBreedsForSpecies(species).then((result) => {
      if (!cancelled) setLoaded({ species, breeds: result });
    });
    return () => {
      cancelled = true;
    };
  }, [species]);

  const breeds = loaded && loaded.species === species ? loaded.breeds : [];
  const names = breeds.filter((b) => !b.isRetired).map((b) => b.name);
  if (value && value !== "Unknown" && breeds.length > 0 && !names.includes(value)) names.push(value);

  return (
    <select
      id={id}
      value={value === "Unknown" ? "" : value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !species}
      className={className}
    >
      <option value="">{species ? "Select" : "Select a species first"}</option>
      {names.map((name) => (
        <option key={name} value={name}>{name}</option>
      ))}
    </select>
  );
}
