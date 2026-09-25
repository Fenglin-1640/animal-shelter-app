"use client";

import { useEffect, useState } from "react";
import { getActiveValues } from "@/lib/system-administration/store";

// The FR-SA-01 "Temperament" option list as a checkbox group. Shared by
// Intake and the Animal Profile's edit form. A saved value that has since
// been retired is still listed so it can be seen and unticked.
export function TemperamentCheckboxes({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getActiveValues("Temperament").then((result) => {
      if (!cancelled) setOptions(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = [...options, ...selected.filter((s) => !options.includes(s))];

  const toggle = (option: string) => {
    onChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((option) => (
        <label key={option} className="flex items-center gap-1.5 text-sm text-text">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => toggle(option)}
            disabled={disabled}
            className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
          />
          {option}
        </label>
      ))}
    </div>
  );
}
