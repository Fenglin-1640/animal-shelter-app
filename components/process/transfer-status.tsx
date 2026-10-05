"use client";

import { useEffect, useState } from "react";
import { ProcessRail, RAIL_DOT, type RailStep } from "@/components/process/process-rail";
import type { StepState } from "@/lib/process/engine";
import { useWorklist } from "@/lib/process/worklist-client";
import { getJson } from "@/lib/shared/http";

export type TransferStep = { label: string; state: StepState; detail: string; waitingOn?: string };

// A Council Officer's own transfers' status steps (GET /api/process/transfers),
// refreshed with the shared worklist.
export function useTransferStatuses(enabled = true): Record<string, TransferStep[]> | null {
  const [statuses, setStatuses] = useState<Record<string, TransferStep[]> | null>(null);
  const worklist = useWorklist();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getJson<{ ok?: boolean; transfers?: Record<string, TransferStep[]> }>("/api/process/transfers").then((result) => {
      if (!cancelled) setStatuses(result.ok !== false && result.transfers ? result.transfers : {});
    });
    return () => {
      cancelled = true;
    };
  }, [worklist, enabled]);
  return statuses;
}

function toRail(steps: TransferStep[]): RailStep[] {
  return steps.map((step) => ({
    key: step.label.replace(/\W+/g, "-"),
    label: step.label,
    state: step.state,
    tooltip: [...(step.waitingOn ? [`Waiting on: ${step.waitingOn}`] : []), step.detail],
  }));
}

// The transfer's status steps as a rail beside the transfer page (the
// Council Officer who submitted it).
export function TransferStatusRail({ transferId }: { transferId: string }) {
  const statuses = useTransferStatuses();
  const steps = statuses ? statuses[transferId] : null;
  if (statuses && !steps) return null;
  return <ProcessRail title="Transfer status" steps={steps ? toRail(steps) : null} idPrefix={`transfer-${transferId}`} showActionLegend={false} />;
}

// One line on a transfer card: the step it is at now and who it's with.
// The full status is on the transfer page.
export function TransferStatusSummary({ steps }: { steps: TransferStep[] }) {
  const current = steps.find((s) => s.state !== "done") ?? steps[steps.length - 1];
  if (!current) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-text-muted">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${RAIL_DOT[current.state]}`} aria-hidden="true" />
      <span>
        <span className="font-semibold text-text">{current.state === "done" ? "Complete" : `Now: ${current.label}`}</span>
        {current.state !== "done" && current.waitingOn ? ` - with ${current.waitingOn}` : ""}
      </span>
    </p>
  );
}
