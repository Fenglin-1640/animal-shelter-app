"use client";

import { useEffect, useMemo, useState } from "react";
import { ANTIBODY_RESULTS, ANTIGENS, type AntibodyCheck, type AntibodyResult } from "@/lib/medical/antibodies";
import {
  listAntibodyChecks,
  listVaccinations,
  listVaccinationTasks,
  recordVaccinationCheck,
  type VaccinationCheckInput,
} from "@/lib/medical/store";
import type { VaccinationRecord } from "@/lib/medical/types";
import {
  applicableVaccineTypes,
  computeCoverage,
  EVIDENCE_VALID_DAYS,
  outcomeLabel,
  type EvidenceRow,
} from "@/lib/medical/vaccination-check";
import { listOptions } from "@/lib/system-administration/store";

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
// report. The required vaccine types not covered are listed as pending
// items, all ticked by default, before anything is saved.
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
  const [required, setRequired] = useState<string[] | null>(null);
  const [storedAntibodies, setStoredAntibodies] = useState<AntibodyCheck[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [alreadyPending, setAlreadyPending] = useState<string[]>([]);
  const [checkDate, setCheckDate] = useState(todayDate());
  const [antibodyRows, setAntibodyRows] = useState<AntibodyRow[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([]);
  const [report, setReport] = useState("");
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [nextKey, setNextKey] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listOptions("Vaccine Type"), listAntibodyChecks(animalId), listVaccinations(animalId), listVaccinationTasks(animalId)]).then(
      ([options, antibodies, given, tasks]) => {
        if (cancelled) return;
        setRequired(applicableVaccineTypes(options, species));
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

  const coverage = useMemo(() => {
    if (!required) return null;
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
    return computeCoverage(required, {
      checkDate,
      antibodyChecks: [...storedAntibodies, ...fresh],
      vaccinations,
      evidence: completeEvidence,
    });
  }, [required, completeAntibodyRows, completeEvidence, storedAntibodies, vaccinations, checkDate, animalId]);

  const newPending = coverage ? coverage.uncovered.filter((t) => !alreadyPending.includes(t)) : [];
  const keptPending = coverage ? coverage.uncovered.filter((t) => !unticked.has(t)) : [];
  const outcome = required && coverage ? outcomeLabel(required.length, keptPending.length) : "";
  const input: VaccinationCheckInput | null =
    coverage && report.trim() && checkDate && checkDate <= todayDate() && rowsValid
      ? {
          checkDate,
          report: report.trim(),
          antibodyRows: completeAntibodyRows.map(({ antigen, result, testDate, expiryDate }) => ({ antigen, result, testDate, expiryDate })),
          evidence: completeEvidence.map(({ vaccineType, dateGiven, source }) => ({ vaccineType, dateGiven, source })),
          pendingVaccineTypes: keptPending,
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
    const result = await recordVaccinationCheck(animalId, input);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? "The vaccination check could not be saved.");
      return;
    }
    onSaved?.();
  };

  const updateAntibody = (key: number, patch: Partial<AntibodyRow>) => setAntibodyRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const updateEvidence = (key: number, patch: Partial<EvidenceDraft>) => setEvidence((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  if (!required) return <p className="mt-2 text-sm text-text-muted">Loading...</p>;

  return (
    <div className="mt-3 flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor={`vc-date-${animalId}`} className="text-xs font-semibold text-text-muted">Check date</label>
        <input id={`vc-date-${animalId}`} type="date" value={checkDate} max={todayDate()} onChange={(e) => setCheckDate(e.target.value)} className={`${inputClass} w-fit`} />
      </div>

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
              <option value="">Antigen / disease</option>
              {ANTIGENS.map((a) => (
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
              {required.map((v) => (
                <option key={v} value={v}>{v}</option>
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

      <section aria-label="Vaccination check result" className="rounded-[12px] border border-border bg-page p-3">
        <p className="font-semibold text-text" data-testid="vaccination-outcome">{outcome}</p>
        {coverage && coverage.covered.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-text-muted">
            {coverage.covered.map((c) => (
              <li key={c.vaccineType}>
                Covered: {c.vaccineType} - {c.reason}
              </li>
            ))}
          </ul>
        )}
        {coverage && coverage.uncovered.length > 0 && (
          <fieldset className="mt-2 flex flex-col gap-1">
            <legend className="text-xs font-semibold text-text">Pending vaccinations to create (untick any that do not apply)</legend>
            {coverage.uncovered.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={!unticked.has(t)}
                  disabled={!newPending.includes(t)}
                  onChange={(e) =>
                    setUnticked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.delete(t);
                      else next.add(t);
                      return next;
                    })
                  }
                />
                {t}
                {!newPending.includes(t) && <span className="text-xs text-text-muted">(already pending)</span>}
              </label>
            ))}
          </fieldset>
        )}
      </section>

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
