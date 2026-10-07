"use client";

import type { RailStep } from "@/components/process/process-rail";
import type { ProcessStep, StepState } from "@/lib/process/engine";
import type { Role } from "@/lib/roles/roles";

export type TrackerStep = ProcessStep & { needsMe?: boolean };

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

function tooltipText(step: TrackerStep): string[] {
  const lines: string[] = [];
  if ((step.state === "waiting" || step.state === "in_progress" || step.state === "blocked") && withRoles(step).length > 0) {
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

// Staff/Vet/Administrator rail: a tooltip per node naming the role it's
// with, and a red dot on nodes that need the viewer.
export function toRailSteps(steps: TrackerStep[]): RailStep[] {
  return steps.map((step) => ({ key: step.key, label: step.label, state: step.state, needsMe: step.needsMe, tooltip: tooltipText(step) }));
}

// Adopter-friendly wording: who it's with, and where it's at.
function adopterWording(step: TrackerStep): string {
  if (step.state === "done") return "Done";
  if (step.state === "not_started") {
    const roles = step.responsibleRoles.filter((r) => r !== "Adopter");
    return roles.length > 0 ? `With ${roles.map(roleName).join(" and ")} - not started` : "Not started";
  }
  const roles = withRoles(step);
  // Nobody to wait on (e.g. an application that was not successful).
  if (roles.length === 0) return step.detail;
  if (roles.includes("Adopter")) return step.nextAction ? `With you - ${step.nextAction}` : "With you - action needed";
  const where = step.state === "blocked" ? "on hold" : step.state === "in_progress" ? "in progress" : "waiting";
  return `With ${roles.map(roleName).join(" and ")} - ${where}`;
}

// The Adopter's application journey: the same steps, with the plain-
// language status as a second line under each label.
export function toAdopterRailSteps(steps: TrackerStep[]): RailStep[] {
  return steps.map((step) => ({ key: step.key, label: step.label, state: step.state, needsMe: step.needsMe, subtext: adopterWording(step) }));
}
