"use client";

import { useState } from "react";
import { VaccinationAdministrationForm } from "@/components/medical/vaccination-administration-form";
import { StatusChip } from "@/components/shared/status-chip";
import { waiveVaccinationTask } from "@/lib/medical/store";
import type { VaccinationTask } from "@/lib/medical/vaccination-check";
import type { VaccineModel } from "@/lib/medical/vaccine-model";

// Pending vaccinations from a Vaccination Check: tick one or more and
// record them as given together, record one, or waive one with a reason.
// Completed and waived items are listed below.
export function PendingVaccinationsPanel({
  animalId,
  animalName,
  model,
  tasks,
  canAct,
  onChanged,
}: {
  animalId: string;
  animalName: string;
  model: VaccineModel;
  tasks: VaccinationTask[];
  canAct: boolean;
  onChanged: () => void;
}) {
  const pending = tasks.filter((t) => t.status === "Pending");
  const resolved = tasks.filter((t) => t.status !== "Pending");
  const [ticked, setTicked] = useState<string[]>([]);
  const [administering, setAdministering] = useState<string[] | null>(null);
  const [waiving, setWaiving] = useState<{ taskId: string; reason: string; error?: string } | null>(null);

  const handleWaive = async () => {
    if (!waiving) return;
    if (!waiving.reason.trim()) {
      setWaiving({ ...waiving, error: "A reason is required." });
      return;
    }
    const result = await waiveVaccinationTask(waiving.taskId, waiving.reason.trim());
    if (!result.ok) {
      setWaiving({ ...waiving, error: "The vaccination could not be waived." });
      return;
    }
    setWaiving(null);
    onChanged();
  };

  if (pending.length === 0 && resolved.length === 0) return null;

  return (
    <div className="mt-4">
      {pending.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text">Pending vaccinations</h3>
            {canAct && !administering && (
              <button
                type="button"
                disabled={ticked.length === 0}
                onClick={() => {
                  setWaiving(null);
                  setAdministering(ticked);
                }}
                className="h-8 rounded-[12px] bg-primary px-3 text-xs font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Record administration for selected{ticked.length ? ` (${ticked.length})` : ""}
              </button>
            )}
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {pending.map((t) => (
              <li key={t.id} className="rounded-[12px] border border-gold bg-gold/10 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 font-semibold text-text">
                    {canAct && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${t.vaccineType}`}
                        checked={ticked.includes(t.vaccineType)}
                        onChange={(e) => setTicked((s) => (e.target.checked ? [...s, t.vaccineType] : s.filter((x) => x !== t.vaccineType)))}
                      />
                    )}
                    {t.vaccineType}
                    <StatusChip label="Pending" category="attention" />
                  </label>
                  {canAct && !administering && waiving?.taskId !== t.id && (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWaiving(null);
                          setAdministering([t.vaccineType]);
                        }}
                        className="h-8 rounded-[12px] border border-border bg-surface px-3 text-xs font-semibold text-text hover:bg-surface-active"
                      >
                        Record administration
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdministering(null);
                          setWaiving({ taskId: t.id, reason: "" });
                        }}
                        className="h-8 rounded-[12px] border border-border bg-surface px-3 text-xs font-semibold text-text hover:bg-surface-active"
                      >
                        Waive
                      </button>
                    </span>
                  )}
                </div>
                {canAct && waiving?.taskId === t.id && (
                  <div className="mt-2 flex flex-col gap-2">
                    <label htmlFor={`waive-${t.id}`} className="text-xs font-semibold text-text-muted">
                      Reason for waiving (required)
                    </label>
                    <textarea
                      id={`waive-${t.id}`}
                      rows={2}
                      value={waiving.reason}
                      onChange={(e) => setWaiving({ taskId: t.id, reason: e.target.value })}
                      className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    />
                    {waiving.error && <p role="alert" className="text-xs text-danger">{waiving.error}</p>}
                    <span className="flex gap-2">
                      <button type="button" onClick={() => void handleWaive()} className="h-8 rounded-[12px] bg-primary px-3 text-xs font-semibold text-page hover:opacity-90">
                        Confirm waive
                      </button>
                      <button type="button" onClick={() => setWaiving(null)} className="h-8 rounded-[12px] border border-border bg-surface px-3 text-xs font-semibold text-text hover:bg-surface-active">
                        Cancel
                      </button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {canAct && administering && (
            <VaccinationAdministrationForm
              animalId={animalId}
              animalName={animalName}
              model={model}
              pendingTasks={tasks}
              preselected={administering}
              onCancel={() => setAdministering(null)}
              onSaved={() => {
                setAdministering(null);
                setTicked([]);
                onChanged();
              }}
            />
          )}
        </>
      )}
      {resolved.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-text-muted">
          {resolved.map((t) => (
            <li key={t.id}>
              {t.vaccineType}: {t.status === "Waived" ? `waived - ${t.waivedReason}` : "given"}
              {t.resolvedByName ? ` (${t.resolvedByName})` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
