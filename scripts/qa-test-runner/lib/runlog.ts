// Idempotent run/result log for the QA test runner. Test Case ID is
// only ever used here (and in the console/report output) as a
// spreadsheet join key - the real AnimalId, once Finalise Intake
// returns one, is what every later step and the final report key off.
// Nothing here is written to ASAMS's own database.
import fs from "node:fs";
import path from "node:path";

const LOG_PATH = path.join(__dirname, "..", "..", "..", "test-data", "results", "runlog.json");

export type StepStatus = "pass" | "fail" | "blocked_expected" | "skipped";

export interface StepResult {
  status: StepStatus;
  expected: string;
  actual: string;
  note?: string;
  timestamp: string;
}

export interface CaseEntry {
  animalId?: string;
  shelterId?: string;
  // Intermediate app-generated ids (transferId, intakeId, applicationId,
  // agreementId, paymentId, meetAndGreetId, followUpVisitId, ...) a
  // later step needs but can't re-derive cheaply - keeps a resumed run
  // from having to re-query the app for "the transfer I created 3 runs
  // ago".
  ids: Record<string, string>;
  steps: Record<string, StepResult>;
}

export interface AdopterEntry {
  email: string;
  signedUp: boolean;
  profileSaved: boolean;
}

export interface RunLog {
  adopters: Record<string, AdopterEntry>;
  cases: Record<string, CaseEntry>;
  negatives: Record<string, CaseEntry>;
}

function emptyLog(): RunLog {
  return { adopters: {}, cases: {}, negatives: {} };
}

let cached: RunLog | null = null;

export function loadLog(): RunLog {
  if (cached) return cached;
  if (fs.existsSync(LOG_PATH)) {
    cached = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as RunLog;
  } else {
    cached = emptyLog();
  }
  return cached;
}

export function saveLog(): void {
  if (!cached) return;
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(cached, null, 2), "utf-8");
}

function bucket(namespace: "cases" | "negatives", key: string): CaseEntry {
  const log = loadLog();
  if (!log[namespace][key]) log[namespace][key] = { ids: {}, steps: {} };
  return log[namespace][key];
}

export function setId(entry: CaseEntry, key: string, value: string): void {
  entry.ids[key] = value;
  saveLog();
}

export function getId(entry: CaseEntry, key: string): string | undefined {
  return entry.ids[key];
}

export function getCase(tcId: string): CaseEntry {
  return bucket("cases", tcId);
}

export function getNegative(key: string): CaseEntry {
  return bucket("negatives", key);
}

export function isStepDone(entry: CaseEntry, step: string): boolean {
  const s = entry.steps[step];
  return Boolean(s && (s.status === "pass" || s.status === "blocked_expected" || s.status === "skipped"));
}

export function recordStep(
  entry: CaseEntry,
  step: string,
  result: Omit<StepResult, "timestamp">,
): void {
  entry.steps[step] = { ...result, timestamp: new Date().toISOString() };
  saveLog();
}

export function setAnimalId(entry: CaseEntry, animalId: string, shelterId: string): void {
  entry.animalId = animalId;
  entry.shelterId = shelterId;
  saveLog();
}

export function getAdopter(adopterId: string): AdopterEntry | undefined {
  return loadLog().adopters[adopterId];
}

export function setAdopter(adopterId: string, entry: AdopterEntry): void {
  loadLog().adopters[adopterId] = entry;
  saveLog();
}
