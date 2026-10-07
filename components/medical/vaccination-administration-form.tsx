"use client";

import { useState } from "react";
import { AntibodyOverrideModal, type OverrideChoice } from "@/components/medical/antibody-override-modal";
import { recordVaccinations, type FlaggedVaccine, type VaccinationBatchItem } from "@/lib/medical/store";
import type { VaccinationTask } from "@/lib/medical/vaccination-check";
import { findType, NO_VACCINES_MESSAGE, overlaps, type VaccineModel } from "@/lib/medical/vaccine-model";
import { todayISO } from "@/lib/shared/dates";
import { DateField } from "@/components/shared/date-field";

const inputClass =
  "h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

interface PerVaccine {
  doseOrChipId: string;
  nextBoosterDueDate: string;
}

// Record one or more vaccines given together: one shared administration
// date, a dose / batch ID and next booster date per vaccine. Only vaccine
// types that apply to the animal's species are offered. Vaccines with a
// pending item complete it. Saved all together or not at all.
export function VaccinationAdministrationForm({
  animalId,
  animalName,
  model,
  pendingTasks,
  preselected,
  onSaved,
  onCancel,
}: {
  animalId: string;
  animalName: string;
  model: VaccineModel;
  pendingTasks: VaccinationTask[];
  preselected: string[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [selected, setSelected] = useState<string[]>(() => preselected.filter((v) => findType(v, model.types)).map((v) => findType(v, model.types)!.value));
  const [details, setDetails] = useState<Record<string, PerVaccine>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<FlaggedVaccine[] | null>(null);

  if (model.types.length === 0) {
    return (
      <div className="mt-3 rounded-[12px] border border-border bg-page p-3 text-sm text-text-muted">
        <p>{NO_VACCINES_MESSAGE}</p>
        <button type="button" onClick={onCancel} className="mt-2 text-xs font-semibold text-secondary underline underline-offset-2">
          Close
        </button>
      </div>
    );
  }

  const detail = (v: string) => details[v] ?? { doseOrChipId: "", nextBoosterDueDate: "" };
  const setDetail = (v: string, patch: Partial<PerVaccine>) => setDetails((d) => ({ ...d, [v]: { ...detail(v), ...patch } }));
  const selectedTypes = selected.map((v) => findType(v, model.types)!).filter(Boolean);
  const overlapList = overlaps(selectedTypes, model.antigenLabels);
  const valid = selected.length > 0 && date && date <= todayISO() && selected.every((v) => detail(v).doseOrChipId.trim());
  const pendingFor = (v: string) => pendingTasks.find((t) => t.status === "Pending" && findType(t.vaccineType, model.all)?.id === findType(v, model.types)?.id);

  const submit = async (choices?: Record<string, OverrideChoice>) => {
    setSaving(true);
    setError(null);
    const items: VaccinationBatchItem[] = selected.map((v) => ({
      vaccineType: v,
      doseOrChipId: detail(v).doseOrChipId.trim(),
      nextBoosterDueDate: detail(v).nextBoosterDueDate,
      vaccinationTaskId: pendingFor(v)?.id,
      antibodyOverrideReason: choices?.[v]?.reason,
      antibodyOverrideNote: choices?.[v]?.note,
    }));
    const result = await recordVaccinations(animalId, date, items);
    setSaving(false);
    if (result.ok) {
      setFlagged(null);
      onSaved();
      return;
    }
    if (result.reason === "antibodies_present" && "flagged" in result) {
      setFlagged(result.flagged);
      return;
    }
    setFlagged(null);
    setError(("message" in result && result.message) || "The vaccinations could not be saved. Nothing was recorded.");
  };

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-border bg-page p-4 text-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor={`adm-date-${animalId}`} className="text-xs font-semibold text-text-muted">Administration date (all selected vaccines)</label>
        <DateField id={`adm-date-${animalId}`} value={date} max={todayISO()} onChange={(value) => setDate(value)} className={inputClass} wrapperClassName="w-fit" />
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs font-semibold text-text-muted">Vaccines given</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {model.types.map((t) => (
            <label key={t.id} className="flex items-center gap-1.5 text-sm text-text">
              <input
                type="checkbox"
                checked={selected.includes(t.value)}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, t.value] : s.filter((x) => x !== t.value)))}
              />
              {t.value}
              {pendingFor(t.value) && <span className="text-xs text-text-muted">(pending)</span>}
            </label>
          ))}
        </div>
      </fieldset>

      {overlapList.length > 0 && (
        <div role="status" className="rounded-[12px] border border-gold bg-gold/10 px-3 py-2 text-xs text-text">
          <p className="font-semibold">These vaccines overlap:</p>
          <ul className="list-inside list-disc">
            {overlapList.map((o) => (
              <li key={o.antigen}>
                {o.antigen}: {o.types.join(", ")}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-text-muted">Check this is intended, or untick a vaccine.</p>
        </div>
      )}

      {selected.map((v, i) => (
        <div key={v} className="grid grid-cols-1 gap-2 rounded-[12px] border border-border bg-surface p-2 sm:grid-cols-[1fr_1fr_1fr]">
          <p className="self-center font-semibold text-text">{v}</p>
          <div className="flex flex-col gap-1">
            <label htmlFor={`adm-dose-${i}`} className="text-xs font-semibold text-text-muted">Dose / batch ID</label>
            <input id={`adm-dose-${i}`} aria-label={`Dose or batch ID for ${v}`} type="text" value={detail(v).doseOrChipId} onChange={(e) => setDetail(v, { doseOrChipId: e.target.value })} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`adm-booster-${i}`} className="text-xs font-semibold text-text-muted">Next booster due</label>
            <DateField id={`adm-booster-${i}`} aria-label={`Next booster for ${v}`} value={detail(v).nextBoosterDueDate} onChange={(value) => setDetail(v, { nextBoosterDueDate: value })} className={inputClass} />
          </div>
        </div>
      ))}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!valid || saving}
          onClick={() => void submit()}
          className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : selected.length > 1 ? `Save ${selected.length} Vaccinations` : "Save Vaccination"}
        </button>
        <button type="button" onClick={onCancel} className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active">
          Cancel
        </button>
      </div>

      {flagged && (
        <AntibodyOverrideModal animalName={animalName} flagged={flagged} saving={saving} onCancel={() => setFlagged(null)} onConfirm={(choices) => void submit(choices)} />
      )}
    </div>
  );
}
