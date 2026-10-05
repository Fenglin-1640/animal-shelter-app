"use client";

import type { ProcessStep, StepState } from "@/lib/process/engine";
import type { Role } from "@/lib/roles/roles";

export type TrackerStep = ProcessStep & { needsMe?: boolean };

export const STATE_COLOUR: Record<StepState, string> = {
  not_started: "bg-process-not-started",
  waiting: "bg-process-waiting",
  in_progress: "bg-process-in-progress",
  done: "bg-process-done",
  blocked: "bg-process-blocked",
};

const STATE_LABEL: Record<StepState, string> = {
  not_started: "Not started",
  waiting: "Waiting on a role",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked / detour",
};

export function roleName(role: Role): string {
  if (role === "Shelter Staff Member") return "Shelter Staff";
  if (role === "Council Animal Control Officer") return "Council Officer";
  return role;
}

// Who a waiting / in-progress / blocked step is with: whoever must act
// now, otherwise whoever owns the step.
function withRoles(step: TrackerStep): Role[] {
  return step.needsActionFromRoles.length > 0 ? step.needsActionFromRoles : step.responsibleRoles;
}

export function ProcessLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted" aria-label="Process colour legend">
      {(Object.keys(STATE_LABEL) as StepState[]).map((state) => (
        <li key={state} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-full ${STATE_COLOUR[state]}`} aria-hidden="true" />
          {STATE_LABEL[state]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
        Needs your action
      </li>
    </ul>
  );
}

function tooltipText(step: TrackerStep): string[] {
  const lines: string[] = [];
  if (step.state === "waiting" || step.state === "in_progress" || step.state === "blocked") {
    const prefix = step.state === "blocked" ? "Blocked - with" : step.state === "in_progress" ? "In progress - with" : "Waiting on";
    lines.push(`${prefix}: ${withRoles(step).map(roleName).join(" and ")}`);
  } else {
    lines.push(STATE_LABEL[step.state]);
  }
  if (step.halves) {
    for (const half of step.halves) lines.push(`${roleName(half.role)}: ${half.done ? "done" : "waiting"} (${half.label})`);
  } else if (step.detail) {
    lines.push(step.detail);
  }
  if (step.needsMe && step.nextAction) lines.push(`Your next action: ${step.nextAction}`);
  return lines;
}

// Staff/Vet/Administrator tracker: coloured nodes, legend, a keyboard-
// accessible tooltip per node naming the role it's with, and a red dot on
// nodes that need the viewer.
export function ProcessTracker({ steps, idPrefix }: { steps: TrackerStep[]; idPrefix: string }) {
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-wrap gap-2" aria-label="Process steps">
        {steps.map((step) => {
          const tipId = `${idPrefix}-${step.key}-tip`;
          return (
            <li key={step.key} className="group relative">
              <span
                tabIndex={0}
                aria-describedby={tipId}
                className="flex items-center gap-1.5 rounded-full border border-border bg-page px-2.5 py-1 text-xs font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${STATE_COLOUR[step.state]}`} aria-hidden="true" />
                {step.label}
                {step.needsMe && (
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-danger" aria-label="Needs your action" />
                )}
              </span>
              <span
                id={tipId}
                role="tooltip"
                className="pointer-events-none invisible absolute left-0 top-full z-20 mt-1 w-64 rounded-[8px] border border-border bg-surface p-2 text-xs text-text opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
              >
                {tooltipText(step).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      <ProcessLegend />
    </div>
  );
}

// Adopter-friendly wording: who it's with, and where it's at.
function adopterWording(step: TrackerStep): string {
  if (step.state === "done") return "Done";
  if (step.state === "not_started") {
    const roles = step.responsibleRoles.filter((r) => r !== "Adopter");
    return roles.length > 0 ? `With ${roles.map(roleName).join(" and ")} - not started` : "Not started";
  }
  const roles = withRoles(step);
  if (roles.includes("Adopter")) return step.nextAction ? `With you - ${step.nextAction}` : "With you - action needed";
  const where = step.state === "blocked" ? "on hold" : step.state === "in_progress" ? "in progress" : "waiting";
  return `With ${roles.map(roleName).join(" and ")} - ${where}`;
}

// The Adopter's application journey: the same steps, in a list with
// plain-language status.
export function ApplicationJourney({ steps }: { steps: TrackerStep[] }) {
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.key} className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-page px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-text">
              <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${STATE_COLOUR[step.state]}`} aria-hidden="true" />
              {step.label}
              {step.needsMe && <span className="inline-block h-2 w-2 rounded-full bg-danger" aria-label="Needs your action" />}
            </span>
            <span className="text-xs text-text-muted">{adopterWording(step)}</span>
          </li>
        ))}
      </ol>
      <ProcessLegend />
    </div>
  );
}
