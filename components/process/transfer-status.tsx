"use client";

import { useEffect, useState } from "react";
import { ProcessLegend, STATE_COLOUR } from "@/components/process/process-tracker";
import type { StepState } from "@/lib/process/engine";
import { useWorklist } from "@/lib/process/worklist-client";
import { getJson } from "@/lib/shared/http";

export type TransferStep = { label: string; state: StepState; detail: string; waitingOn?: string };

// A Council Officer's own transfers' status steps (GET /api/process/transfers),
// refreshed with the shared worklist.
export function useTransferStatuses(): Record<string, TransferStep[]> {
  const [statuses, setStatuses] = useState<Record<string, TransferStep[]>>({});
  const worklist = useWorklist();
  useEffect(() => {
    let cancelled = false;
    getJson<{ ok?: boolean; transfers?: Record<string, TransferStep[]> }>("/api/process/transfers").then((result) => {
      if (!cancelled && result.ok !== false && result.transfers) setStatuses(result.transfers);
    });
    return () => {
      cancelled = true;
    };
  }, [worklist]);
  return statuses;
}

export function TransferStatusSteps({ transferId, steps }: { transferId: string; steps: TransferStep[] }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Transfer status">
      {steps.map((step) => {
        const tipId = `transfer-${transferId}-${step.label.replace(/\W+/g, "-")}`;
        return (
          <li key={step.label} className="group relative">
            <span tabIndex={0} aria-describedby={tipId} className="flex items-center gap-1.5 rounded-full border border-border bg-page px-2.5 py-1 text-xs font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <span className={`inline-block h-3 w-3 rounded-full ${STATE_COLOUR[step.state]}`} aria-hidden="true" />
              {step.label}
            </span>
            <span id={tipId} role="tooltip" className="pointer-events-none invisible absolute left-0 top-full z-20 mt-1 w-56 rounded-[8px] border border-border bg-surface p-2 text-xs text-text opacity-0 shadow-lg group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              {step.waitingOn ? <span className="block">Waiting on: {step.waitingOn}</span> : null}
              <span className="block">{step.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export { ProcessLegend };
