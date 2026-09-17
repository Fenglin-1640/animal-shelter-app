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

// FR-MED-01/02/03/FR-REL-01: these 6 event kinds now live in the
// database (see prisma/contract.prisma) behind /api/medical/** - see
// prisma/README.md for this Prisma toolchain's quirks. Every export here
// that reads or writes one of them is async now; the ~6 that were
// already async (because they call lib/animals/animal-store, itself
// converted in the previous pilot slice) keep the same signature.

async function fetchAll<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const result = await response.json();
  return result.items as T[];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  return result.item as T;
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// --- Health Assessment (FR-MED-01) ---

export async function listHealthAssessments(animalId: string): Promise<HealthAssessment[]> {
  const all = await fetchAll<HealthAssessment>("/api/medical/health-assessments");
  return all
    .filter((h) => h.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// The triggering assessment of the CURRENT (unresolved) treatment
// episode, if any - the most recent urgent-treatment assessment that has
// no later treatment event marking recovery complete.
export async function getActiveTreatmentTrigger(animalId: string): Promise<HealthAssessment | undefined> {
  const [healthAssessments, treatmentEvents] = await Promise.all([
    fetchAll<HealthAssessment>("/api/medical/health-assessments"),
    fetchAll<TreatmentEvent>("/api/medical/treatment-events"),
  ]);
  const triggers = healthAssessments
    .filter((h) => h.animalId === animalId && h.urgentTreatmentRequired)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latest = triggers[0];
  if (!latest) return undefined;

  const resolved = treatmentEvents.some(
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
export async function recordHealthAssessment(
  animalId: string,
  input: HealthAssessmentInput,
  email: string,
  name: string,
): Promise<MutationResult> {
  const animal = await getAnimalById(animalId);
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
  await postJson("/api/medical/health-assessments", assessment);

  if (input.urgentTreatmentRequired) {
    await changeAnimalStatus(
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

export async function listTreatmentEvents(animalId: string): Promise<TreatmentEvent[]> {
  const all = await fetchAll<TreatmentEvent>("/api/medical/treatment-events");
  return all
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

export async function addTreatmentEvent(
  animalId: string,
  input: TreatmentEventInput,
  email: string,
  name: string,
): Promise<MutationResult> {
  const trigger = await getActiveTreatmentTrigger(animalId);
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
  await postJson("/api/medical/treatment-events", event);

  if (!input.furtherTreatmentRequired) {
    const pathway = trigger.treatmentPathway ?? "intake";
    const nextStatus = pathway === "pre-release" ? "Awaiting Release" : "Under Assessment";
    await changeAnimalStatus(
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

export async function listVaccinations(animalId: string): Promise<VaccinationRecord[]> {
  const all = await fetchAll<VaccinationRecord>("/api/medical/vaccinations");
  return all
    .filter((v) => v.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// FR-NOT-01 "Vaccine booster due": every recorded vaccination across all
// animals, so notifications can find the ones whose nextBoosterDueDate
// is approaching.
export async function listAllVaccinations(): Promise<VaccinationRecord[]> {
  return fetchAll<VaccinationRecord>("/api/medical/vaccinations");
}

export interface VaccinationInput {
  vaccineType: string;
  administrationDate: string;
  doseOrChipId: string;
  nextBoosterDueDate: string;
}

export async function recordVaccination(
  animalId: string,
  input: VaccinationInput,
  email: string,
  name: string,
): Promise<MutationResult> {
  if (!(await getAnimalById(animalId))) return { ok: false, reason: "not_found" };
  const record: VaccinationRecord = {
    id: generateId("VAC"),
    animalId,
    ...input,
    veterinarianEmail: email,
    veterinarianName: name,
    createdAt: new Date().toISOString(),
  };
  await postJson("/api/medical/vaccinations", record);
  return { ok: true };
}

export async function getDesexingSchedule(animalId: string): Promise<DesexingSchedule | undefined> {
  const all = await fetchAll<DesexingSchedule>("/api/medical/desexing-schedules");
  return all.find((d) => d.animalId === animalId);
}

// FR-NOT-01 "Desexing appointment due": every Scheduled (not yet
// Completed) desexing appointment across all animals.
export async function listScheduledDesexing(): Promise<DesexingSchedule[]> {
  const all = await fetchAll<DesexingSchedule>("/api/medical/desexing-schedules");
  return all.filter((d) => d.status === "Scheduled");
}

export async function scheduleDesexing(
  animalId: string,
  scheduledDate: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  if (!(await getAnimalById(animalId))) return { ok: false, reason: "not_found" };
  if (await getDesexingSchedule(animalId)) return { ok: false, reason: "already_scheduled" };

  const schedule: DesexingSchedule = {
    id: generateId("DX"),
    animalId,
    scheduledDate,
    status: "Scheduled",
    veterinarianEmail: email,
    veterinarianName: name,
    createdAt: new Date().toISOString(),
  };
  await postJson("/api/medical/desexing-schedules", schedule);
  return { ok: true };
}

export async function completeDesexing(animalId: string, email: string, name: string): Promise<MutationResult> {
  const schedule = await getDesexingSchedule(animalId);
  if (!schedule) return { ok: false, reason: "not_found" };
  if (schedule.status === "Completed") return { ok: false, reason: "already_completed" };

  const response = await fetch(`/api/medical/desexing-schedules/${schedule.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "Completed",
      completedAt: new Date().toISOString(),
      completedByEmail: email,
      completedByName: name,
    }),
  });
  const result = await response.json();
  if (!result.ok) return { ok: false, reason: result.reason ?? "not_found" };
  return { ok: true };
}

export async function getMedicalClearance(animalId: string): Promise<MedicalClearance | undefined> {
  const all = await fetchAll<MedicalClearance>("/api/medical/clearances");
  return all.find((c) => c.animalId === animalId);
}

// FR-REC-01 "导出...medical clearance": every issued clearance across all animals.
export async function listAllMedicalClearances(): Promise<MedicalClearance[]> {
  return fetchAll<MedicalClearance>("/api/medical/clearances");
}

// PRD: "系统只有在必需疫苗完成且绝育已经完成或排期后，才允许 issueMedicalClearance()". There
// is no System Administration category defining "required" vaccine
// types (only 13 categories exist and none is vaccine-specific), so
// this prototype treats "at least one vaccination recorded" as
// satisfying "必需疫苗完成" - disclosed in the UI and BUILD-PROGRESS.md.
export async function getMedicalClearanceBlockers(animalId: string): Promise<string[]> {
  const blockers: string[] = [];
  const [vaccinations, desexing] = await Promise.all([
    listVaccinations(animalId),
    getDesexingSchedule(animalId),
  ]);
  if (vaccinations.length === 0) {
    blockers.push("At least one vaccination must be recorded.");
  }
  if (!desexing) {
    blockers.push("Desexing must be scheduled or completed.");
  }
  return blockers;
}

export async function issueMedicalClearance(
  animalId: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  if (await getMedicalClearance(animalId)) return { ok: false, reason: "already_issued" };
  const blockers = await getMedicalClearanceBlockers(animalId);
  if (blockers.length > 0) return { ok: false, reason: "blocked" };

  const clearance: MedicalClearance = {
    id: generateId("MC"),
    animalId,
    issuedByEmail: email,
    issuedByName: name,
    issuedAt: new Date().toISOString(),
  };
  await postJson("/api/medical/clearances", clearance);

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

export async function listPreReleaseChecks(animalId: string): Promise<PreReleaseCheck[]> {
  const all = await fetchAll<PreReleaseCheck>("/api/medical/pre-release-checks");
  return all
    .filter((c) => c.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getLatestPreReleaseCheck(animalId: string): Promise<PreReleaseCheck | undefined> {
  return (await listPreReleaseChecks(animalId))[0];
}

// "Fit for Release 允许 Staff Release Animal to Adopter" - the most recent
// check on file must be the Fit for Release outcome. If a later Health
// Concern sent the Animal back into the Under Treatment loop, the most
// recent check stays "Health Concern" until a fresh one is recorded once
// the Animal is Awaiting Release again, correctly blocking release in
// the meantime ("要求再次检查").
export async function isFitForRelease(animalId: string): Promise<boolean> {
  const animal = await getAnimalById(animalId);
  if (!animal || animal.currentStatus !== "Awaiting Release") return false;
  return (await getLatestPreReleaseCheck(animalId))?.fitnessResult === "Fit for Release";
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
export async function recordPreReleaseCheck(
  animalId: string,
  input: PreReleaseCheckInput,
  email: string,
  name: string,
): Promise<MutationResult> {
  const animal = await getAnimalById(animalId);
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
  await postJson("/api/medical/pre-release-checks", check);

  if (input.fitnessResult === "Health Concern") {
    await recordHealthAssessment(
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
