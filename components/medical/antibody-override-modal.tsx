"use client";

import { useEffect, useRef, useState } from "react";
import { OVERRIDE_REASONS } from "@/lib/medical/antibodies";

// Shown when a vaccine is about to be given although a current antibody
// check already shows protection. "No" closes it; "Yes" asks for a reason
// before the vaccination is saved.
export function AntibodyOverrideModal({
  animalName,
  antigens,
  saving,
  onCancel,
  onConfirm,
}: {
  animalName: string;
  antigens: string[];
  saving: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, note: string) => void;
}) {
  const [continuing, setContinuing] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const noRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    noRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const valid = Boolean(reason) && (reason !== "Other" || note.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="antibody-override-title"
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-[12px] border border-border bg-surface p-6 shadow-lg"
      >
        <h2 id="antibody-override-title" className="text-lg font-bold text-text">
          {animalName} already has antibodies for this vaccine. Continue?
        </h2>
        <p className="mt-2 text-sm text-text-muted">Current protective antibody check: {antigens.join(", ")}.</p>

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
            <fieldset className="mt-4 flex flex-col gap-1.5 text-sm text-text">
              <legend className="mb-1 text-sm font-semibold text-text">Reason for vaccinating (required)</legend>
              {OVERRIDE_REASONS.map((r) => (
                <label key={r} className="flex items-start gap-2">
                  <input type="radio" name="antibody-override-reason" className="mt-1" checked={reason === r} onChange={() => setReason(r)} />
                  {r}
                </label>
              ))}
            </fieldset>
            {reason === "Other" && (
              <div className="mt-3 flex flex-col gap-1">
                <label htmlFor="antibody-override-note" className="text-xs font-semibold text-text-muted">
                  Describe the reason (required)
                </label>
                <textarea
                  id="antibody-override-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="rounded-[12px] border border-border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
              </div>
            )}
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
                onClick={() => onConfirm(reason, note.trim())}
                className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save vaccination"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
