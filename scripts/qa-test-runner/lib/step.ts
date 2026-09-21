import { type CaseEntry, isStepDone, recordStep, type StepStatus } from "./runlog";

export interface StepOutcome {
  status: StepStatus;
  actual: string;
  note?: string;
}

// Runs one workflow step against one TC's log entry: skips if already
// recorded pass/blocked_expected/skipped (resumability), otherwise runs
// the action, catches any thrown error as a fail, and always logs.
export async function step(
  entry: CaseEntry,
  name: string,
  expected: string,
  action: () => Promise<StepOutcome>,
): Promise<StepOutcome | undefined> {
  if (isStepDone(entry, name)) {
    console.log(`    [skip] ${name}`);
    return undefined;
  }
  let outcome: StepOutcome;
  try {
    outcome = await action();
  } catch (err) {
    outcome = { status: "fail", actual: `EXCEPTION: ${(err as Error).message}` };
  }
  recordStep(entry, name, { status: outcome.status, expected, actual: outcome.actual, note: outcome.note });
  const icon = outcome.status === "pass" ? "OK" : outcome.status === "blocked_expected" ? "BLOCKED(expected)" : "FAIL";
  console.log(`    [${icon}] ${name}: ${outcome.actual}`);
  return outcome;
}

export function pass(actual: string, note?: string): StepOutcome {
  return { status: "pass", actual, note };
}

export function fail(actual: string, note?: string): StepOutcome {
  return { status: "fail", actual, note };
}

export function blockedExpected(actual: string, note?: string): StepOutcome {
  return { status: "blocked_expected", actual, note };
}
