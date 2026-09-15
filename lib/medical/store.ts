import { changeAnimalStatus, getAnimalById } from "@/lib/animals/animal-store";
import { completeTaskByType } from "@/lib/adoption-fitness/store";
import { writeAuditLog } from "@/lib/audit/store";
import type {
  DesexingSchedule,
  HealthAssessment,
  MedicalClearance,
  PreReleaseCheck,
  PreReleaseFitnessResult,
  TreatmentEvent,
  VaccinationRecord,
} from "@/lib/medical/types";

// FR-MED-01/02/03/FR-REL-01: persisted to localStorage since there is no backend.
const HEALTH_KEY = "asams-health-assessments";
const TREATMENT_KEY = "asams-treatment-events";
const VACCINATION_KEY = "asams-vaccination-records";
const DESEXING_KEY = "asams-desexing-schedules";
const CLEARANCE_KEY = "asams-medical-clearances";
const PRE_RELEASE_KEY = "asams-pre-release-checks";

function loadList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function saveList<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// --- Health Assessment (FR-MED-01) ---

export function listHealthAssessments(animalId: string): HealthAssessment[] {
  return loadList<HealthAssessment>(HEALTH_KEY)
    .filter((h) => h.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// The triggering assessment of the CURRENT (unresolved) treatment
// episode, if any - the most recent urgent-treatment assessment that has
// no later treatment event marking recovery complete.
export function getActiveTreatmentTrigger(animalId: string): HealthAssessment | undefined {
  const triggers = loadList<HealthAssessment>(HEALTH_KEY)
    .filter((h) => h.animalId === animalId && h.urgentTreatmentRequired)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latest = triggers[0];
  if (!latest) return undefined;

  const resolved = loadList<TreatmentEvent>(TREATMENT_KEY).some(
    (e) => e.linkedHealthAssessmentId === latest.id && !e.furtherTreatmentRequired,
  );
  return resolved ? undefined : latest;
}

export interface HealthAssessmentInput {
  examinationObservations: string;
  sampleTestResults: string;
  diagnosedConditions: string;
  bodyCondition: string;
  urgentTreatmentRequired: boolean;
  urgentTreatmentNotes: string;
  assessmentDate: string;
}

export type MutationResult = { ok: true } | { ok: false; reason: string };

// Veterinarian "创建和最终确认" in one action - each Health Assessment is a
// single immutable event, not a draft that gets separately finalised.
export function recordHealthAssessment(
  animalId: string,
  input: HealthAssessmentInput,
  email: string,
  name: string,
): MutationResult {
  const animal = getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };

  const now = new Date().toISOString();
  const assessment: HealthAssessment = {
    id: generateId("HA"),
    animalId,
    ...input,
    treatmentPathway: input.urgentTreatmentRequired
      ? animal.currentStatus === "Awaiting Release"
        ? "pre-release"
        : "intake"
      : undefined,
    veterinarianEmail: email,
    veterinarianName: name,
    createdAt: now,
  };
  saveList(HEALTH_KEY, [...loadList<HealthAssessment>(HEALTH_KEY), assessment]);

  if (input.urgentTreatmentRequired) {
    changeAnimalStatus(
      animalId,
      { currentStatus: "Under Treatment", statusUpdatedAt: now },
      { email, name },
      "Health Assessment - Urgent Treatment Required",
    );
  } else {
    completeTaskByType(animalId, "Health Assessment", email, name);
  }

  return { ok: true };
}

// --- Treatment and Recovery (FR-MED-02) ---

export function listTreatmentEvents(animalId: string): TreatmentEvent[] {
  return loadList<TreatmentEvent>(TREATMENT_KEY)
    .filter((e) => e.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export interface TreatmentEventInput {
  medication: string;
  dose: string;
  date: string;
  outcome: string;
  furtherTreatmentRequired: boolean;
}

export function addTreatmentEvent(
  animalId: string,
  input: TreatmentEventInput,
  email: string,
  name: string,
): MutationResult {
  const trigger = getActiveTreatmentTrigger(animalId);
  if (!trigger) return { ok: false, reason: "not_under_treatment" };

  const now = new Date().toISOString();
  const event: TreatmentEvent = {
    id: generateId("TE"),
    animalId,
    linkedHealthAssessmentId: trigger.id,
    ...input,
    veterinarianEmail: email,
    veterinarianName: name,
    createdAt: now,
  };
  saveList(TREATMENT_KEY, [...loadList<TreatmentEvent>(TREATMENT_KEY), event]);

  if (!input.furtherTreatmentRequired) {
    const pathway = trigger.treatmentPathway ?? "intake";
    const nextStatus = pathway === "pre-release" ? "Awaiting Release" : "Under Assessment";
    changeAnimalStatus(
      animalId,
      { currentStatus: nextStatus, statusUpdatedAt: now },
      { email, name },
      "Treatment Recovery Complete",
    );
    if (pathway === "intake") completeTaskByType(animalId, "Health Assessment", email, name);
  }

  return { ok: true };
}

// --- Vaccination, Desexing and Medical Clearance (FR-MED-03) ---

export function listVaccinations(animalId: string): VaccinationRecord[] {
  return loadList<VaccinationRecord>(VACCINATION_KEY)
    .filter((v) => v.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// FR-NOT-01 "Vaccine booster due": every recorded vaccination across all
// animals, so notifications can find the ones whose nextBoosterDueDate
// is approaching.
export function listAllVaccinations(): VaccinationRecord[] {
  return loadList<VaccinationRecord>(VACCINATION_KEY);
}

export interface VaccinationInput {
  vaccineType: string;
  administrationDate: string;
  doseOrChipId: string;
  nextBoosterDueDate: string;
}

export function recordVaccination(
  animalId: string,
  input: VaccinationInput,
  email: string,
  name: string,
): MutationResult {
  if (!getAnimalById(animalId)) return { ok: false, reason: "not_found" };
  const record: VaccinationRecord = {
    id: generateId("VAC"),
    animalId,
    ...input,
    veterinarianEmail: email,
    veterinarianName: name,
    createdAt: new Date().toISOString(),
  };
  saveList(VACCINATION_KEY, [...loadList<VaccinationRecord>(VACCINATION_KEY), record]);
  return { ok: true };
}

export function getDesexingSchedule(animalId: string): DesexingSchedule | undefined {
  return loadList<DesexingSchedule>(DESEXING_KEY).find((d) => d.animalId === animalId);
}

// FR-NOT-01 "Desexing appointment due": every Scheduled (not yet
// Completed) desexing appointment across all animals.
export function listScheduledDesexing(): DesexingSchedule[] {
  return loadList<DesexingSchedule>(DESEXING_KEY).filter((d) => d.status === "Scheduled");
}

export function scheduleDesexing(
  animalId: string,
  scheduledDate: string,
  email: string,
  name: string,
): MutationResult {
  if (!getAnimalById(animalId)) return { ok: false, reason: "not_found" };
  if (getDesexingSchedule(animalId)) return { ok: false, reason: "already_scheduled" };

  const schedule: DesexingSchedule = {
    id: generateId("DX"),
    animalId,
    scheduledDate,
    status: "Scheduled",
    veterinarianEmail: email,
    veterinarianName: name,
    createdAt: new Date().toISOString(),
  };
  saveList(DESEXING_KEY, [...loadList<DesexingSchedule>(DESEXING_KEY), schedule]);
  return { ok: true };
}

export function completeDesexing(animalId: string, email: string, name: string): MutationResult {
  const all = loadList<DesexingSchedule>(DESEXING_KEY);
  const index = all.findIndex((d) => d.animalId === animalId);
  if (index === -1) return { ok: false, reason: "not_found" };
  if (all[index].status === "Completed") return { ok: false, reason: "already_completed" };

  all[index] = {
    ...all[index],
    status: "Completed",
    completedAt: new Date().toISOString(),
    completedByEmail: email,
    completedByName: name,
  };
  saveList(DESEXING_KEY, all);
  return { ok: true };
}

export function getMedicalClearance(animalId: string): MedicalClearance | undefined {
  return loadList<MedicalClearance>(CLEARANCE_KEY).find((c) => c.animalId === animalId);
}

// PRD: "系统只有在必需疫苗完成且绝育已经完成或排期后，才允许 issueMedicalClearance()". There
// is no System Administration category defining "required" vaccine
// types (only 13 categories exist and none is vaccine-specific), so
// this prototype treats "at least one vaccination recorded" as
// satisfying "必需疫苗完成" - disclosed in the UI and BUILD-PROGRESS.md.
export function getMedicalClearanceBlockers(animalId: string): string[] {
  const blockers: string[] = [];
  if (listVaccinations(animalId).length === 0) {
    blockers.push("At least one vaccination must be recorded.");
  }
  if (!getDesexingSchedule(animalId)) {
    blockers.push("Desexing must be scheduled or completed.");
  }
  return blockers;
}

export function issueMedicalClearance(
  animalId: string,
  email: string,
  name: string,
): MutationResult {
  if (getMedicalClearance(animalId)) return { ok: false, reason: "already_issued" };
  const blockers = getMedicalClearanceBlockers(animalId);
  if (blockers.length > 0) return { ok: false, reason: "blocked" };

  const clearance: MedicalClearance = {
    id: generateId("MC"),
    animalId,
    issuedByEmail: email,
    issuedByName: name,
    issuedAt: new Date().toISOString(),
  };
  saveList(CLEARANCE_KEY, [...loadList<MedicalClearance>(CLEARANCE_KEY), clearance]);

  // Doesn't itself change currentStatus/listingStatus (that's a separate
  // evaluatePreListingEligibility() call from the UI layer, see
  // lib/adoption-listings/pre-listing.ts), but PRD BR-014 still wants
  // this significant action in the AuditLog.
  writeAuditLog({
    userId: email,
    userName: name,
    action: "Issue Medical Clearance",
    entityType: "MedicalRecord",
    entityId: animalId,
    oldValue: "Not issued",
    newValue: `Issued by ${name}`,
    result: "Success",
  });

  return { ok: true };
}

// --- Pre-Release Check (FR-REL-01) ---

export function listPreReleaseChecks(animalId: string): PreReleaseCheck[] {
  return loadList<PreReleaseCheck>(PRE_RELEASE_KEY)
    .filter((c) => c.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getLatestPreReleaseCheck(animalId: string): PreReleaseCheck | undefined {
  return listPreReleaseChecks(animalId)[0];
}

// "Fit for Release 允许 Staff Release Animal to Adopter" - the most recent
// check on file must be the Fit for Release outcome. If a later Health
// Concern sent the Animal back into the Under Treatment loop, the most
// recent check stays "Health Concern" until a fresh one is recorded once
// the Animal is Awaiting Release again, correctly blocking release in
// the meantime ("要求再次检查").
export function isFitForRelease(animalId: string): boolean {
  const animal = getAnimalById(animalId);
  if (!animal || animal.currentStatus !== "Awaiting Release") return false;
  return getLatestPreReleaseCheck(animalId)?.fitnessResult === "Fit for Release";
}

export interface PreReleaseCheckInput {
  checkDate: string;
  fitnessResult: PreReleaseFitnessResult;
  healthFindings: string;
  medicationGuidance: string;
  careInstructions: string;
}

// PRD 6.14: "只有 Veterinarian 可完成放行前检查... Health Concern 将 currentStatus
// 更新为 Under Treatment，并进入治疗循环." Reuses recordHealthAssessment()
// directly rather than duplicating the Under Treatment loop: the Animal
// is already Awaiting Release at this point, so that function's existing
// pathway classification resolves this to "pre-release" automatically,
// giving Fit-for-Release-blocking-until-recheck for free.
export function recordPreReleaseCheck(
  animalId: string,
  input: PreReleaseCheckInput,
  email: string,
  name: string,
): MutationResult {
  const animal = getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };
  if (animal.currentStatus !== "Awaiting Release") return { ok: false, reason: "not_awaiting_release" };

  const now = new Date().toISOString();
  const check: PreReleaseCheck = {
    id: generateId("PRC"),
    animalId,
    ...input,
    veterinarianEmail: email,
    veterinarianName: name,
    createdAt: now,
  };
  saveList(PRE_RELEASE_KEY, [...loadList<PreReleaseCheck>(PRE_RELEASE_KEY), check]);

  if (input.fitnessResult === "Health Concern") {
    recordHealthAssessment(
      animalId,
      {
        examinationObservations: input.healthFindings,
        sampleTestResults: "",
        diagnosedConditions: "",
        bodyCondition: "",
        urgentTreatmentRequired: true,
        urgentTreatmentNotes: input.medicationGuidance,
        assessmentDate: input.checkDate,
      },
      email,
      name,
    );
  }

  writeAuditLog({
    userId: email,
    userName: name,
    action: "Conduct Pre-Release Check",
    entityType: "MedicalRecord",
    entityId: animalId,
    oldValue: "",
    newValue: `fitnessResult=${input.fitnessResult}`,
    result: "Success",
  });

  return { ok: true };
}
