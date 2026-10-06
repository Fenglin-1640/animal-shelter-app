"use client";

import { useEffect, useMemo, useState } from "react";
import { ANTIBODY_RESULTS, type AntibodyCheck, type AntibodyResult } from "@/lib/medical/antibodies";
import {
  getVaccineModel,
  listAntibodyChecks,
  listVaccinations,
  listVaccinationTasks,
  recordVaccinationCheck,
  type VaccinationCheckInput,
} from "@/lib/medical/store";
import type { VaccinationRecord } from "@/lib/medical/types";
import { computeGap, EVIDENCE_VALID_DAYS, outcomeLabel, type EvidenceRow } from "@/lib/medical/vaccination-check";
import { NO_VACCINES_MESSAGE, type VaccineModel } from "@/lib/medical/vaccine-model";

const inputClass =
  "h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

// The local calendar date (YYYY-MM-DD).
function todayDate(): string {
  return new Date().toLocaleDateString("en-CA");
}

interface AntibodyRow {
  key: number;
  antigen: string;
  result: string;
  testDate: string;
  expiryDate: string;
}

interface EvidenceDraft extends EvidenceRow {
  key: number;
}

export interface VaccinationCheckDraft {
  // Null while something required is missing.
  input: VaccinationCheckInput | null;
  outcome: string;
}

// The Vaccination Check: check date, antibody results (stored ones plus
// rows added here), vaccinations the animal is known to have had, and a
// report. Antigens and vaccine types are limited to the animal's species.
// The antigens not yet covered are turned into proposed vaccine types,
// all ticked by default; the Veterinarian can untick them or add other
// types before anything is saved.
//   embedded: part of the implant session; reports its state through
//             onChange and is saved with the session.
//   standalone: has its own save button (Medical Record page).
export function VaccinationCheckForm({
  animalId,
  species,
  mode,
  onChange,
  onSaved,
  onCancel,
}: {
  animalId: string;
  species: string;
  mode: "embedded" | "standalone";
  onChange?: (draft: VaccinationCheckDraft) => void;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [model, setModel] = useState<VaccineModel | null>(null);
  const [storedAntibodies, setStoredAntibodies] = useState<AntibodyCheck[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [alreadyPending, setAlreadyPending] = useState<string[]>([]);
  const [checkDate, setCheckDate] = useState(todayDate());
  const [antibodyRows, setAntibodyRows] = useState<AntibodyRow[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([]);
  const [report, setReport] = useState("");
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<string[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getVaccineModel(species), listAntibodyChecks(animalId), listVaccinations(animalId), listVaccinationTasks(animalId)]).then(
      ([m, antibodies, given, tasks]) => {
        if (cancelled) return;
        setModel(m);
        setStoredAntibodies(antibodies);
        setVaccinations(given);
        setAlreadyPending(tasks.filter((t) => t.status === "Pending").map((t) => t.vaccineType));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [animalId, species]);

  const completeAntibodyRows = antibodyRows.filter((r) => r.antigen && r.result && r.testDate);
  const completeEvidence = evidence.filter((e) => e.vaccineType && e.dateGiven);
  const rowsValid =
    antibodyRows.every((r) => (r.antigen && r.result && r.testDate && (!r.expiryDate || r.expiryDate >= r.testDate)) || (!r.antigen && !r.result)) &&
    evidence.every((e) => (e.vaccineType && e.dateGiven && e.dateGiven <= todayDate()) || (!e.vaccineType && !e.dateGiven && !e.source));

  const result = useMemo(() => {
    if (!model) return null;
    const fresh: AntibodyCheck[] = completeAntibodyRows.map((r, i) => ({
      id: `new-${i}`,
      animalId,
      antigen: r.antigen,
      result: r.result as AntibodyResult,
      testDate: r.testDate,
      expiryDate: r.expiryDate || undefined,
      notes: "",
      recordedByEmail: "",
      recordedByName: "",
      createdAt: new Date().toISOString(),
    }));
    return computeGap(model, { checkDate, antibodyChecks: [...storedAntibodies, ...fresh], vaccinations, evidence: completeEvidence });
  }, [model, completeAntibodyRows, completeEvidence, storedAntibodies, vaccinations, checkDate, animalId]);

  const proposed = result?.proposed.map((t) => t.value) ?? [];
  const selection = [...proposed.filter((v) => !unticked.has(v)), ...added.filter((v) => !proposed.includes(v))];
  const outcome = result ? outcomeLabel(result, selection.length) : "";
  const input: VaccinationCheckInput | null =
    result && report.trim() && checkDate && checkDate <= todayDate() && rowsValid
      ? {
          checkDate,
          report: report.trim(),
          antibodyRows: completeAntibodyRows.map(({ antigen, result: r, testDate, expiryDate }) => ({ antigen, result: r, testDate, expiryDate })),
          evidence: completeEvidence.map(({ vaccineType, dateGiven, source }) => ({ vaccineType, dateGiven, source })),
          pendingVaccineTypes: selection,
        }
      : null;

  const inputKey = JSON.stringify(input);
  useEffect(() => {
    onChange?.({ input, outcome });
    // Report only when the content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, outcome]);

  const handleSave = async () => {
    if (!input) return;
    setSaving(true);
    setError(null);
    const saved = await recordVaccinationCheck(animalId, input);
    setSaving(false);
    if (!saved.ok) {
      setError(saved.message ?? "The vaccination check could not be saved.");
      return;
    }
    onSaved?.();
  };

  const updateAntibody = (key: number, patch: Partial<AntibodyRow>) => setAntibodyRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const updateEvidence = (key: number, patch: Partial<EvidenceDraft>) => setEvidence((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  if (!model || !result) return <p className="mt-2 text-sm text-text-muted">Loading...</p>;
  const noTypes = model.types.length === 0;
  const antigenOptions = [...model.antigenLabels.values()].sort((a, b) => a.localeCompare(b));
  const addable = model.types.filter((t) => !selection.includes(t.value) && !proposed.includes(t.value));

  return (
    <div className="mt-3 flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor={`vc-date-${animalId}`} className="text-xs font-semibold text-text-muted">Check date</label>
        <input id={`vc-date-${animalId}`} type="date" value={checkDate} max={todayDate()} onChange={(e) => setCheckDate(e.target.value)} className={`${inputClass} w-fit`} />
      </div>

      {noTypes ? (
        <p role="status" className="rounded-[12px] border border-border bg-page p-3 text-text-muted">
          {NO_VACCINES_MESSAGE}
        </p>
      ) : (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-text-muted">Antibody / titre results</legend>
            {storedAntibodies.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-xs text-text-muted">
                {storedAntibodies.map((a) => (
                  <li key={a.id}>
                    On record: {a.antigen} - {a.result}, tested {a.testDate}
                    {a.expiryDate ? `, expires ${a.expiryDate}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {antibodyRows.map((r, i) => (
              <div key={r.key} className="grid grid-cols-1 gap-2 rounded-[12px] border border-border bg-page p-2 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
                <select aria-label={`Antigen ${i + 1}`} value={r.antigen} onChange={(e) => updateAntibody(r.key, { antigen: e.target.value })} className={inputClass}>
                  <option value="">Antigen</option>
                  {antigenOptions.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <select aria-label={`Result ${i + 1}`} value={r.result} onChange={(e) => updateAntibody(r.key, { result: e.target.value })} className={inputClass}>
                  <option value="">Result</option>
                  {ANTIBODY_RESULTS.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
                <input aria-label={`Test date ${i + 1}`} type="date" value={r.testDate} max={todayDate()} onChange={(e) => updateAntibody(r.key, { testDate: e.target.value })} className={inputClass} />
                <input aria-label={`Expiry date ${i + 1}`} type="date" value={r.expiryDate} min={r.testDate} onChange={(e) => updateAntibody(r.key, { expiryDate: e.target.value })} className={inputClass} />
                <button type="button" onClick={() => setAntibodyRows((rows) => rows.filter((x) => x.key !== r.key))} className="text-xs font-semibold text-danger underline underline-offset-2">
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setAntibodyRows((rows) => [...rows, { key: nextKey, antigen: "", result: "", testDate: todayDate(), expiryDate: "" }]);
                setNextKey((k) => k + 1);
              }}
              className="w-fit text-xs font-semibold text-secondary underline underline-offset-2 hover:no-underline"
            >
              Add antibody result
            </button>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-text-muted">Existing vaccination evidence (optional)</legend>
            <p className="text-xs text-text-muted">Vaccines the animal is known to have had, e.g. from a previous owner or clinic. Counts as current for {EVIDENCE_VALID_DAYS} days after the date given.</p>
            {evidence.map((e, i) => (
              <div key={e.key} className="grid grid-cols-1 gap-2 rounded-[12px] border border-border bg-page p-2 sm:grid-cols-[1.2fr_1fr_1.5fr_auto]">
                <select aria-label={`Evidence vaccine type ${i + 1}`} value={e.vaccineType} onChange={(ev) => updateEvidence(e.key, { vaccineType: ev.target.value })} className={inputClass}>
                  <option value="">Vaccine type</option>
                  {model.types.map((t) => (
                    <option key={t.id} value={t.value}>{t.value}</option>
                  ))}
                </select>
                <input aria-label={`Date given ${i + 1}`} type="date" value={e.dateGiven} max={todayDate()} onChange={(ev) => updateEvidence(e.key, { dateGiven: ev.target.value })} className={inputClass} />
                <input aria-label={`Source ${i + 1}`} type="text" placeholder="Source, e.g. vaccination card" value={e.source} onChange={(ev) => updateEvidence(e.key, { source: ev.target.value })} className={inputClass} />
                <button type="button" onClick={() => setEvidence((rows) => rows.filter((x) => x.key !== e.key))} className="text-xs font-semibold text-danger underline underline-offset-2">
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setEvidence((rows) => [...rows, { key: nextKey, vaccineType: "", dateGiven: "", source: "" }]);
                setNextKey((k) => k + 1);
              }}
              className="w-fit text-xs font-semibold text-secondary underline underline-offset-2 hover:no-underline"
            >
              Add vaccination evidence
            </button>
          </fieldset>
        </>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`vc-report-${animalId}`} className="text-xs font-semibold text-text-muted">Report (required)</label>
        <textarea
          id={`vc-report-${animalId}`}
          rows={3}
          value={report}
          onChange={(e) => setReport(e.target.value)}
          className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>

      {!noTypes && (
        <section aria-label="Vaccination check result" className="rounded-[12px] border border-border bg-page p-3">
          <p className="font-semibold text-text" data-testid="vaccination-outcome">{outcome}</p>
          {result.covered.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-text-muted">
              {result.covered.map((c) => (
                <li key={c.antigen}>
                  Covered: {c.antigen} - {c.reason}
                </li>
              ))}
            </ul>
          )}
          {result.gap.length > 0 && <p className="mt-1 text-xs text-text-muted">Not covered: {result.gap.join(", ")}</p>}
          {(proposed.length > 0 || added.length > 0) && (
            <fieldset className="mt-2 flex flex-col gap-1">
              <legend className="text-xs font-semibold text-text">Pending vaccinations to create (untick any that do not apply)</legend>
              {[...proposed, ...added.filter((v) => !proposed.includes(v))].map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={selection.includes(t)}
                    disabled={alreadyPending.includes(t)}
                    onChange={(e) => {
                      if (proposed.includes(t)) {
                        setUnticked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.delete(t);
                          else next.add(t);
                          return next;
                        });
                      } else if (!e.target.checked) {
                        setAdded((a) => a.filter((x) => x !== t));
                      }
                    }}
                  />
                  {t}
                  {alreadyPending.includes(t) && <span className="text-xs text-text-muted">(already pending)</span>}
                </label>
              ))}
            </fieldset>
          )}
          {addable.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label htmlFor={`vc-add-${animalId}`} className="text-xs font-semibold text-text-muted">Add another vaccine type</label>
              <select
                id={`vc-add-${animalId}`}
                value=""
                onChange={(e) => e.target.value && setAdded((a) => [...a, e.target.value])}
                className={inputClass}
              >
                <option value="">Select</option>
                {addable.map((t) => (
                  <option key={t.id} value={t.value}>{t.value}</option>
                ))}
              </select>
            </div>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {mode === "standalone" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!input || saving}
            className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Vaccination Check"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
