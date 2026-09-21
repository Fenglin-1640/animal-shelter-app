"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { ReadOnlyNoticeModal } from "@/components/shared/read-only-notice-modal";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAnimalById } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import { evaluatePreListingEligibility } from "@/lib/adoption-listings/pre-listing";
import {
  addTreatmentEvent,
  completeDesexing,
  getActiveTreatmentTrigger,
  getDesexingSchedule,
  getMedicalClearance,
  getMedicalClearanceBlockers,
  issueMedicalClearance,
  listHealthAssessments,
  listTreatmentEvents,
  listVaccinations,
  recordDesexingExemption,
  recordHealthAssessment,
  recordVaccination,
  scheduleDesexing,
  updateDesexingScheduledDate,
  type HealthAssessmentInput,
  type TreatmentEventInput,
  type VaccinationInput,
} from "@/lib/medical/store";
import { DESEXING_STATUS_CATEGORY } from "@/lib/medical/status";
import type {
  DesexingSchedule,
  HealthAssessment,
  MedicalClearance,
  TreatmentEvent,
  VaccinationRecord,
} from "@/lib/medical/types";
import { getActiveValues } from "@/lib/system-administration/store";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];
// PRD 9 permission matrix: MedicalRecord is 只读 (read-only) for BOTH
// Administrator and Shelter Staff Member - only Veterinarian may
// create/edit/finalise (BR-005: "只有 Veterinarian 可编辑医疗记录和签发 Medical
// Clearance"). Administrator's "全部 Staff 操作" (PRD 9's Animal General
// Profile row) means it inherits Staff's permissions specifically, not a
// blanket "can do everything any role can" - this is the one place in
// this prototype where that distinction actually matters.
const CAN_ACT_ROLES: Role[] = ["Veterinarian"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Animal not found.</p>
      <Link
        href="/animals"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to Animals
      </Link>
    </div>
  );
}

function SectionCard({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 className="text-lg font-bold text-text">
        {title} {required && <span aria-hidden="true">*</span>}
      </h2>
      {children}
    </section>
  );
}

function HealthAssessmentForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: HealthAssessmentInput) => void;
  onCancel: () => void;
}) {
  const [examinationObservations, setExaminationObservations] = useState("");
  const [sampleTestResults, setSampleTestResults] = useState("");
  const [diagnosedConditions, setDiagnosedConditions] = useState("");
  const [bodyCondition, setBodyCondition] = useState("");
  const [urgentTreatmentRequired, setUrgentTreatmentRequired] = useState(false);
  const [urgentTreatmentNotes, setUrgentTreatmentNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(todayDate());

  const canSubmit = examinationObservations.trim() && bodyCondition.trim() && assessmentDate;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-border bg-page p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="ha-observations" className="text-xs font-semibold text-text-muted">Examination Observations</label>
        <textarea
          id="ha-observations"
          rows={2}
          value={examinationObservations}
          onChange={(e) => setExaminationObservations(e.target.value)}
          className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ha-sample-results" className="text-xs font-semibold text-text-muted">Sample Test Results</label>
        <textarea
          id="ha-sample-results"
          rows={2}
          value={sampleTestResults}
          onChange={(e) => setSampleTestResults(e.target.value)}
          className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ha-diagnosed" className="text-xs font-semibold text-text-muted">Diagnosed Conditions</label>
        <textarea
          id="ha-diagnosed"
          rows={2}
          value={diagnosedConditions}
          onChange={(e) => setDiagnosedConditions(e.target.value)}
          className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="ha-body-condition" className="text-xs font-semibold text-text-muted">Body Condition</label>
          <input
            id="ha-body-condition"
            type="text"
            value={bodyCondition}
            onChange={(e) => setBodyCondition(e.target.value)}
            placeholder="e.g. Underweight, healthy coat"
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ha-assessment-date" className="text-xs font-semibold text-text-muted">Assessment Date</label>
          <input
            id="ha-assessment-date"
            type="date"
            value={assessmentDate}
            max={todayDate()}
            onChange={(e) => setAssessmentDate(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-text">
        <input
          id="ha-urgent"
          type="checkbox"
          checked={urgentTreatmentRequired}
          onChange={(e) => setUrgentTreatmentRequired(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        Urgent treatment required
      </label>
      {urgentTreatmentRequired && (
        <div className="flex flex-col gap-1">
          <label htmlFor="ha-urgent-notes" className="text-xs font-semibold text-text-muted">
            Urgent Treatment Requirements
          </label>
          <textarea
            id="ha-urgent-notes"
            rows={2}
            value={urgentTreatmentNotes}
            onChange={(e) => setUrgentTreatmentNotes(e.target.value)}
            placeholder="Describe what urgent treatment is needed"
            className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
      )}
      {urgentTreatmentRequired && (
        <p className="text-xs text-text-muted">
          Submitting will set this animal&apos;s status to Under Treatment.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              examinationObservations,
              sampleTestResults,
              diagnosedConditions,
              bodyCondition,
              urgentTreatmentRequired,
              urgentTreatmentNotes,
              assessmentDate,
            })
          }
          className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Health Assessment
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TreatmentEventForm({
  medicationOptions,
  onSubmit,
  onCancel,
}: {
  medicationOptions: string[];
  onSubmit: (input: TreatmentEventInput) => void;
  onCancel: () => void;
}) {
  const [medication, setMedication] = useState("");
  const [dose, setDose] = useState("");
  const [date, setDate] = useState(todayDate());
  const [outcome, setOutcome] = useState("");
  const [furtherTreatmentRequired, setFurtherTreatmentRequired] = useState(true);

  const canSubmit = medication && dose.trim() && date && outcome.trim();

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-border bg-page p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="te-medication" className="text-xs font-semibold text-text-muted">Medication</label>
          <select
            id="te-medication"
            value={medication}
            onChange={(e) => setMedication(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <option value="">Select</option>
            {medicationOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="te-dose" className="text-xs font-semibold text-text-muted">Dose</label>
          <input
            id="te-dose"
            type="text"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="te-date" className="text-xs font-semibold text-text-muted">Date</label>
          <input
            id="te-date"
            type="date"
            value={date}
            max={todayDate()}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="te-outcome" className="text-xs font-semibold text-text-muted">Outcome</label>
        <textarea
          id="te-outcome"
          rows={2}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-text">
        <input
          id="te-further-required"
          type="checkbox"
          checked={furtherTreatmentRequired}
          onChange={(e) => setFurtherTreatmentRequired(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        Further treatment required
      </label>
      {!furtherTreatmentRequired && (
        <p className="text-xs text-text-muted">
          Submitting will mark recovery complete and return this animal to its prior status.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit({ medication, dose, date, outcome, furtherTreatmentRequired })}
          className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Treatment Event
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function VaccinationForm({
  vaccineTypeOptions,
  onSubmit,
  onCancel,
}: {
  vaccineTypeOptions: string[];
  onSubmit: (input: VaccinationInput) => void;
  onCancel: () => void;
}) {
  const [vaccineType, setVaccineType] = useState("");
  const [administrationDate, setAdministrationDate] = useState(todayDate());
  const [doseOrChipId, setDoseOrChipId] = useState("");
  const [nextBoosterDueDate, setNextBoosterDueDate] = useState("");

  const canSubmit = vaccineType && administrationDate && doseOrChipId.trim();

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-border bg-page p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="vac-type" className="text-xs font-semibold text-text-muted">Vaccine Type</label>
          <select
            id="vac-type"
            value={vaccineType}
            onChange={(e) => setVaccineType(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <option value="">Select</option>
            {vaccineTypeOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="vac-admin-date" className="text-xs font-semibold text-text-muted">Administration Date</label>
          <input
            id="vac-admin-date"
            type="date"
            value={administrationDate}
            max={todayDate()}
            onChange={(e) => setAdministrationDate(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="vac-dose-chip" className="text-xs font-semibold text-text-muted">Dose or Chip ID</label>
          <input
            id="vac-dose-chip"
            type="text"
            value={doseOrChipId}
            onChange={(e) => setDoseOrChipId(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="vac-next-booster" className="text-xs font-semibold text-text-muted">Next Booster Due Date</label>
          <input
            id="vac-next-booster"
            type="date"
            value={nextBoosterDueDate}
            onChange={(e) => setNextBoosterDueDate(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({ vaccineType, administrationDate, doseOrChipId, nextBoosterDueDate })
          }
          className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Vaccination
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function MedicalContent({
  animalId,
  email,
  displayName,
  role,
}: {
  animalId: string;
  email: string;
  displayName: string;
  role: Role;
}) {
  const [animal, setAnimal] = useState<Animal | null | undefined>(undefined);
  const [healthAssessments, setHealthAssessments] = useState<HealthAssessment[]>([]);
  const [treatmentEvents, setTreatmentEvents] = useState<TreatmentEvent[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [desexing, setDesexing] = useState<DesexingSchedule | undefined>(undefined);
  const [clearance, setClearance] = useState<MedicalClearance | undefined>(undefined);
  const [underTreatment, setUnderTreatment] = useState(false);

  const [showHealthForm, setShowHealthForm] = useState(false);
  const [showTreatmentForm, setShowTreatmentForm] = useState(false);
  const [showVaccinationForm, setShowVaccinationForm] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(todayDate());
  const [showEditScheduledDate, setShowEditScheduledDate] = useState(false);
  const [editedScheduledDate, setEditedScheduledDate] = useState(todayDate());

  const [medicationOptions, setMedicationOptions] = useState<string[]>([]);
  const [vaccineTypeOptions, setVaccineTypeOptions] = useState<string[]>([]);
  const canAct = CAN_ACT_ROLES.includes(role);

  const [clearanceBlockers, setClearanceBlockers] = useState<string[]>([]);

  const reloadMedical = async () => {
    const [healthAssessmentsResult, treatmentEventsResult, vaccinationsResult, desexingResult, clearanceResult, triggerResult, blockersResult] =
      await Promise.all([
        listHealthAssessments(animalId),
        listTreatmentEvents(animalId),
        listVaccinations(animalId),
        getDesexingSchedule(animalId),
        getMedicalClearance(animalId),
        getActiveTreatmentTrigger(animalId),
        getMedicalClearanceBlockers(animalId),
      ]);
    setHealthAssessments(healthAssessmentsResult);
    setTreatmentEvents(treatmentEventsResult);
    setVaccinations(vaccinationsResult);
    setDesexing(desexingResult);
    setClearance(clearanceResult);
    setUnderTreatment(Boolean(triggerResult));
    setClearanceBlockers(blockersResult);
  };

  useEffect(() => {
    let cancelled = false;
    getAnimalById(animalId).then(async (result) => {
      if (cancelled) return;
      setAnimal(result ?? null);
      if (result) await reloadMedical();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadMedical is recreated every render but only reads animalId, which is already a dependency.
  }, [animalId]);

  useEffect(() => {
    let cancelled = false;
    getActiveValues("Medication").then((result) => {
      if (!cancelled) setMedicationOptions(result);
    });
    getActiveValues("Vaccine Type").then((result) => {
      if (!cancelled) setVaccineTypeOptions(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (animal === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!animal) return <NotFound />;

  const refresh = async () => {
    await reloadMedical();
    await evaluatePreListingEligibility(animalId);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/animals/${animalId}`}
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to {animal.name}&apos;s Profile
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text">Medical Record</h1>
        <p className="mt-1 text-sm text-text-muted">
          {animal.name} &middot; {animal.shelterId}
        </p>
      </div>

      {!canAct && (
        <ReadOnlyNoticeModal
          storageKey={`medical:${role}`}
          title="Read-only access"
          message="Shelter Staff Member and Administrator can read the full Medical History but cannot create, edit or finalise medical content - only Veterinarian can."
        />
      )}

      <SectionCard title="Health Assessments" required>
        {healthAssessments.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No health assessments recorded yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {healthAssessments.map((h) => (
              <li key={h.id} className="rounded-[12px] border border-border bg-page p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-text">{formatDate(h.assessmentDate)}</span>
                  {h.urgentTreatmentRequired && (
                    <StatusChip label="Urgent Treatment Required" category="attention" />
                  )}
                </div>
                <p className="mt-1 text-text-muted">Body condition: {h.bodyCondition}</p>
                {h.examinationObservations && <p className="mt-1 text-text">{h.examinationObservations}</p>}
                {h.diagnosedConditions && (
                  <p className="mt-1 text-text-muted">Diagnosed: {h.diagnosedConditions}</p>
                )}
                <p className="mt-1 text-xs text-text-muted">
                  {h.veterinarianName} &middot; {formatDateTime(h.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {canAct && !showHealthForm && (
          <button
            type="button"
            onClick={() => setShowHealthForm(true)}
            className="mt-4 h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            Record Health Assessment
          </button>
        )}
        {canAct && showHealthForm && (
          <HealthAssessmentForm
            onCancel={() => setShowHealthForm(false)}
            onSubmit={async (input) => {
              await recordHealthAssessment(animalId, input, email, displayName);
              setShowHealthForm(false);
              refresh();
            }}
          />
        )}
      </SectionCard>

      {(treatmentEvents.length > 0 || underTreatment) && (
        <SectionCard title="Treatment and Recovery">
          {treatmentEvents.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No treatment events recorded yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {treatmentEvents.map((t) => (
                <li key={t.id} className="rounded-[12px] border border-border bg-page p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-text">
                      {t.medication} &middot; {t.dose}
                    </span>
                    <StatusChip
                      label={t.furtherTreatmentRequired ? "Further Treatment Required" : "Recovery Complete"}
                      category={t.furtherTreatmentRequired ? "caution" : "success"}
                    />
                  </div>
                  <p className="mt-1 text-text">{t.outcome}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {formatDate(t.date)} &middot; {t.veterinarianName}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {canAct && underTreatment && !showTreatmentForm && (
            <button
              type="button"
              onClick={() => setShowTreatmentForm(true)}
              className="mt-4 h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
            >
              Add Treatment Event
            </button>
          )}
          {canAct && showTreatmentForm && (
            <TreatmentEventForm
              medicationOptions={medicationOptions}
              onCancel={() => setShowTreatmentForm(false)}
              onSubmit={async (input) => {
                await addTreatmentEvent(animalId, input, email, displayName);
                setShowTreatmentForm(false);
                refresh();
              }}
            />
          )}
          {!underTreatment && treatmentEvents.length > 0 && (
            <p className="mt-4 text-xs text-text-muted">
              This treatment episode is resolved. A new Health Assessment marking urgent
              treatment required would start another.
            </p>
          )}
        </SectionCard>
      )}

      <SectionCard title="Vaccinations" required>
        {vaccinations.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No vaccinations recorded yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {vaccinations.map((v) => (
              <li key={v.id} className="rounded-[12px] border border-border bg-page p-3 text-sm">
                <p className="font-semibold text-text">{v.vaccineType}</p>
                <p className="text-text-muted">
                  Administered {formatDate(v.administrationDate)} &middot; Dose/Chip ID:{" "}
                  {v.doseOrChipId}
                </p>
                {v.nextBoosterDueDate && (
                  <p className="text-text-muted">
                    Next booster due {formatDate(v.nextBoosterDueDate)}
                  </p>
                )}
                <p className="mt-1 text-xs text-text-muted">
                  {v.veterinarianName} &middot; {formatDateTime(v.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {canAct && !showVaccinationForm && (
          <button
            type="button"
            onClick={() => setShowVaccinationForm(true)}
            className="mt-4 h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            Record Vaccination
          </button>
        )}
        {canAct && showVaccinationForm && (
          <VaccinationForm
            vaccineTypeOptions={vaccineTypeOptions}
            onCancel={() => setShowVaccinationForm(false)}
            onSubmit={async (input) => {
              await recordVaccination(animalId, input, email, displayName);
              setShowVaccinationForm(false);
              refresh();
            }}
          />
        )}
      </SectionCard>

      <SectionCard title="Desexing" required>
        {desexing ? (
          <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-border bg-page p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <StatusChip label={desexing.status} category={DESEXING_STATUS_CATEGORY[desexing.status]} />
                {(desexing.status === "Scheduled" || desexing.status === "Completed") && (
                  <p className="mt-1 text-text">Scheduled for {formatDate(desexing.scheduledDate)}</p>
                )}
                {desexing.status === "Completed" && desexing.completedAt && (
                  <p className="text-text-muted">
                    Completed {formatDateTime(desexing.completedAt)} by {desexing.completedByName}
                  </p>
                )}
                {desexing.status === "Exempt (Species)" && (
                  <p className="mt-1 text-text-muted">
                    Recorded by {desexing.veterinarianName} - this species is exempt from the desexing
                    requirement.
                  </p>
                )}
                {desexing.status === "Already Desexed (Pre-Intake)" && (
                  <p className="mt-1 text-text-muted">
                    Recorded by {desexing.veterinarianName} - this animal arrived already desexed.
                  </p>
                )}
              </div>
              {canAct && desexing.status === "Scheduled" && !showEditScheduledDate && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditedScheduledDate(desexing.scheduledDate);
                      setShowEditScheduledDate(true);
                    }}
                    className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
                  >
                    Edit Scheduled Date
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await completeDesexing(animalId, email, displayName);
                      refresh();
                    }}
                    className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
                  >
                    Mark Desexing Completed
                  </button>
                </div>
              )}
            </div>
            {canAct && desexing.status === "Scheduled" && showEditScheduledDate && (
              <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="desexing-edit-date" className="text-xs font-semibold text-text-muted">Scheduled Date</label>
                  <input
                    id="desexing-edit-date"
                    type="date"
                    value={editedScheduledDate}
                    onChange={(e) => setEditedScheduledDate(e.target.value)}
                    className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  />
                </div>
                <button
                  type="button"
                  disabled={!editedScheduledDate}
                  onClick={async () => {
                    await updateDesexingScheduledDate(animalId, editedScheduledDate);
                    setShowEditScheduledDate(false);
                    refresh();
                  }}
                  className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditScheduledDate(false)}
                  className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-text-muted">Desexing has not been scheduled yet.</p>
            {canAct && (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="desexing-date" className="text-xs font-semibold text-text-muted">Scheduled Date</label>
                  <input
                    id="desexing-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  />
                </div>
                <button
                  type="button"
                  disabled={!scheduledDate}
                  onClick={async () => {
                    await scheduleDesexing(animalId, scheduledDate, email, displayName);
                    refresh();
                  }}
                  className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Schedule Desexing
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await recordDesexingExemption(animalId, "Exempt (Species)", email, displayName);
                    refresh();
                  }}
                  className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
                  title="For species this prototype's desexing flow doesn't apply to (e.g. birds, reptiles)"
                >
                  Record Exempt (Species)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await recordDesexingExemption(animalId, "Already Desexed (Pre-Intake)", email, displayName);
                    refresh();
                  }}
                  className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
                  title="For an animal that arrived already desexed, e.g. a surrendered pet"
                >
                  Record Already Desexed (Pre-Intake)
                </button>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="Medical Clearance">
        {clearance ? (
          <div className="mt-4 rounded-[12px] border border-border bg-page p-3 text-sm">
            <StatusChip label="Issued" category="success" />
            <p className="mt-1 text-text">
              Issued by {clearance.issuedByName} on {formatDateTime(clearance.issuedAt)}
            </p>
          </div>
        ) : (
          <>
            {clearanceBlockers.length > 0 && (
              <div className="mt-2 flex flex-col gap-1 rounded-[12px] border border-gold bg-gold/10 px-3 py-3 text-sm text-text">
                <p className="font-semibold">Not ready to issue:</p>
                <ul className="list-inside list-disc">
                  {clearanceBlockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-text-muted">
                  This prototype treats at least one recorded vaccination as satisfying
                  &quot;required vaccines complete&quot;, since System Administration has no
                  configurable list of required vaccine types.
                </p>
              </div>
            )}
            {canAct && (
              <button
                type="button"
                disabled={clearanceBlockers.length > 0}
                title={
                  clearanceBlockers.length > 0
                    ? "Resolve the items listed above before issuing."
                    : undefined
                }
                onClick={() => {
                  issueMedicalClearance(animalId, email, displayName);
                  refresh();
                }}
                className="mt-4 h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Issue Medical Clearance
              </button>
            )}
            <p className="mt-2 text-xs text-text-muted">
              Once issued, if there is no unresolved Statutory Hold and the latest Behavioural
              Assessment is Suitable for Adoption, this animal&apos;s listing moves to
              Pre-Listing automatically.
            </p>
          </>
        )}
      </SectionCard>
    </div>
  );
}

export function MedicalScreen() {
  const { user } = useAuth();
  const params = useParams<{ animalId: string }>();
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <MedicalContent
        animalId={params.animalId}
        email={user.email}
        displayName={user.displayName}
        role={user.role}
      />
    </AppShell>
  );
}
