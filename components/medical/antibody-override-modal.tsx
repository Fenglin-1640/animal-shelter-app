"use client";

import { useEffect, useRef, useState } from "react";
import { OVERRIDE_REASONS } from "@/lib/medical/antibodies";
import type { FlaggedVaccine } from "@/lib/medical/store";

export interface OverrideChoice {
  reason: string;
  note: string;
}

// Shown when one or more of the vaccines about to be given cover an
// antigen the animal already has a current Protective antibody result
// for. "No" cancels the whole submission; "Yes" asks for a reason for
// each flagged vaccine before anything is saved.
export function AntibodyOverrideModal({
  animalName,
  flagged,
  saving,
  onCancel,
  onConfirm,
}: {
  animalName: string;
  flagged: FlaggedVaccine[];
  saving: boolean;
  onCancel: () => void;
  onConfirm: (choices: Record<string, OverrideChoice>) => void;
}) {
  const [continuing, setContinuing] = useState(false);
  const [choices, setChoices] = useState<Record<string, OverrideChoice>>(() =>
    Object.fromEntries(flagged.map((f) => [f.vaccineType, { reason: "", note: "" }])),
  );
  const noRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    noRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const valid = flagged.every((f) => {
    const c = choices[f.vaccineType];
    return c?.reason && (c.reason !== "Other" || c.note.trim().length > 0);
  });
  const set = (type: string, patch: Partial<OverrideChoice>) => setChoices((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  const single = flagged.length === 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="antibody-override-title"
        className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[12px] border border-border bg-surface p-6 shadow-lg"
      >
        <h2 id="antibody-override-title" className="text-lg font-bold text-text">
          {single
            ? `${animalName} already has antibodies for this vaccine. Continue?`
            : `${animalName} already has antibodies for ${flagged.length} of these vaccines. Continue?`}
        </h2>
        <ul className="mt-2 flex flex-col gap-0.5 text-sm text-text-muted">
          {flagged.map((f) => (
            <li key={f.vaccineType}>
              {f.vaccineType}: current protective antibodies for {f.antigens.join(", ")}
            </li>
          ))}
        </ul>

        {!continuing ? (
          <div className="mt-4 flex gap-2">
            <button
              ref={noRef}
              type="button"
              onClick={onCancel}
              className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => setContinuing(true)}
              className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
            >
              Yes
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-3">
              {flagged.map((f, i) => (
                <div key={f.vaccineType} className="flex flex-col gap-1 rounded-[12px] border border-border bg-page p-3">
                  <label htmlFor={`override-reason-${i}`} className="text-sm font-semibold text-text">
                    Reason for giving {f.vaccineType} (required)
                  </label>
                  <select
                    id={`override-reason-${i}`}
                    value={choices[f.vaccineType]?.reason ?? ""}
                    onChange={(e) => set(f.vaccineType, { reason: e.target.value })}
                    className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <option value="">Select a reason</option>
                    {OVERRIDE_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {choices[f.vaccineType]?.reason === "Other" && (
                    <>
                      <label htmlFor={`override-note-${i}`} className="text-xs font-semibold text-text-muted">
                        Describe the reason (required)
                      </label>
                      <textarea
                        id={`override-note-${i}`}
                        rows={2}
                        value={choices[f.vaccineType]?.note ?? ""}
                        onChange={(e) => set(f.vaccineType, { note: e.target.value })}
                        className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!valid || saving}
                onClick={() => onConfirm(choices)}
                className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : single ? "Save vaccination" : "Save vaccinations"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
