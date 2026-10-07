"use client";

import { useState } from "react";
import { StatusChip } from "@/components/shared/status-chip";
import { ANTIBODY_RESULTS, type AntibodyCheck, type AntibodyResult } from "@/lib/medical/antibodies";
import { NO_VACCINES_MESSAGE } from "@/lib/medical/vaccine-model";
import { recordAntibodyCheck } from "@/lib/medical/store";
import { formatDate, todayISO } from "@/lib/shared/dates";
import { DateField } from "@/components/shared/date-field";

const RESULT_CATEGORY: Record<AntibodyResult, "success" | "caution" | "attention" | "neutral"> = {
  Protective: "success",
  Insufficient: "caution",
  None: "attention",
  Invalid: "neutral",
};

const inputClass =
  "h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function isExpired(check: AntibodyCheck): boolean {
  return Boolean(check.expiryDate) && new Date(check.expiryDate!).getTime() < Date.now();
}

function AntibodyCheckForm({ animalId, antigens, onSaved, onCancel }: { animalId: string; antigens: string[]; onSaved: () => void; onCancel: () => void }) {
  const [antigen, setAntigen] = useState("");
  const [result, setResult] = useState("");
  const [testDate, setTestDate] = useState(todayISO());
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expiryInvalid = Boolean(expiryDate) && expiryDate < testDate;
  const canSubmit = antigen && result && testDate && !expiryInvalid && !saving;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-border bg-page p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="ab-antigen" className="text-xs font-semibold text-text-muted">Antigen</label>
          <select id="ab-antigen" value={antigen} onChange={(e) => setAntigen(e.target.value)} className={inputClass}>
            <option value="">Select</option>
            {antigens.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ab-result" className="text-xs font-semibold text-text-muted">Result</label>
          <select id="ab-result" value={result} onChange={(e) => setResult(e.target.value)} className={inputClass}>
            <option value="">Select</option>
            {ANTIBODY_RESULTS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ab-test-date" className="text-xs font-semibold text-text-muted">Test Date</label>
          <DateField id="ab-test-date" value={testDate} max={todayISO()} onChange={(value) => setTestDate(value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ab-expiry-date" className="text-xs font-semibold text-text-muted">Expiry Date (optional)</label>
          <DateField id="ab-expiry-date" value={expiryDate} min={testDate} onChange={(value) => setExpiryDate(value)} className={inputClass} />
          {expiryInvalid && <p className="text-xs text-danger">The expiry date must be on or after the test date.</p>}
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="ab-notes" className="text-xs font-semibold text-text-muted">Notes (optional)</label>
          <textarea id="ab-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={async () => {
            setSaving(true);
            setError(null);
            const saved = await recordAntibodyCheck(animalId, { antigen, result, testDate, expiryDate, notes });
            setSaving(false);
            if (saved.ok) onSaved();
            else setError("The antibody check could not be saved. Please try again.");
          }}
          className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Antibody Check"}
        </button>
        <button type="button" onClick={onCancel} className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active">
          Cancel
        </button>
      </div>
    </div>
  );
}

// Antibody (titre) checks for one animal, newest first; a Veterinarian can
// record a new one.
export function AntibodyChecksSection({
  animalId,
  checks,
  canAct,
  antigens,
  onSaved,
}: {
  animalId: string;
  checks: AntibodyCheck[];
  canAct: boolean;
  // The antigens of the vaccine types that apply to the animal species.
  antigens: string[];
  onSaved: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const sorted = [...checks].sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime());
  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 className="text-lg font-bold text-text">Antibody Checks</h2>
      <p className="mt-1 text-sm text-text-muted">
        Titre test results. A current Protective result is flagged before a vaccine covering the same antigen is given.
      </p>
      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No antibody checks recorded yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {sorted.map((c) => (
            <li key={c.id} className="rounded-[12px] border border-border bg-page p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-text">{c.antigen}</p>
                <StatusChip label={c.result} category={RESULT_CATEGORY[c.result]} />
                {isExpired(c) && <StatusChip label="Expired" category="neutral" />}
              </div>
              <p className="text-text-muted">
                Tested {formatDate(c.testDate)}
                {c.expiryDate ? ` · Expires ${formatDate(c.expiryDate)}` : ""}
              </p>
              {c.notes && <p className="text-text">{c.notes}</p>}
              <p className="mt-1 text-xs text-text-muted">Recorded by {c.recordedByName}</p>
            </li>
          ))}
        </ul>
      )}
      {canAct && antigens.length === 0 && <p className="mt-3 text-sm text-text-muted">{NO_VACCINES_MESSAGE}</p>}
      {canAct && antigens.length > 0 && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-4 h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
        >
          Record Antibody Check
        </button>
      )}
      {canAct && antigens.length > 0 && showForm && (
        <AntibodyCheckForm
          animalId={animalId}
          antigens={antigens}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            onSaved();
          }}
        />
      )}
    </section>
  );
}
