"use client";

import { useEffect, useState } from "react";
import { listAllOptions } from "@/lib/system-administration/store";
import type { DropdownOption } from "@/lib/system-administration/types";

// The Species options (including ones an Administrator has added, such as
// Rabbit), retired ones included so existing records still resolve.
// Callers filter out retired species for new choices.
export function useSpeciesOptions(): DropdownOption[] {
  const [species, setSpecies] = useState<DropdownOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    listAllOptions().then((all) => {
      if (!cancelled) setSpecies(all.filter((o) => o.category === "Species"));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return species;
}
