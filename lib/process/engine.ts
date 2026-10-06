import { hasNewAdopterResponse, isWaitingOnAdopter } from "@/lib/applications/types";
import type { AssessmentTask, FitnessReview } from "@/lib/adoption-fitness/types";
import type { AdoptionAgreement } from "@/lib/agreements/types";
import type { Animal, CurrentStatus } from "@/lib/animals/types";
import type { AdoptionApplication, ApplicationStatus } from "@/lib/applications/types";
import type { BehaviourProgram, TemperamentAssessment } from "@/lib/behaviour/types";
import type { SuitabilityCheck } from "@/lib/checks/types";
import type { FollowUpVisit } from "@/lib/follow-up-visits/types";
import type {
  DesexingSchedule,
  HealthAssessment,
  MedicalClearance,
  PreReleaseCheck,
  VaccinationRecord,
} from "@/lib/medical/types";
import type { MeetAndGreet } from "@/lib/meet-and-greets/types";
import type { MicrochipLookup } from "@/lib/microchip/types";
import type { AdoptionPayment } from "@/lib/payments/types";
import type { Role } from "@/lib/roles/roles";
import type { StatutoryHold } from "@/lib/statutory-hold/types";

// The shared process engine: one animal's journey from intake to
// rehoming, computed purely from the records that already exist (no
// process table of its own). Used server-side by /api/process/* and
// /api/worklist, so trackers, "needs my action" lists, sidebar badges and
// the Vet workbench all agree on what is done and who acts next.
//
// Where an animal's own status shows it is already past a step whose
// records don't exist (e.g. the seeded sample animals, placed straight
// into later states), that step counts as done - an animal that is
// already listed has, by definition, been through intake, medical
// clearance and publishing.

export type StepState = "not_started" | "waiting" | "in_progress" | "done" | "blocked";

export type StepKey =
  | "intake"
  | "microchip"
  | "implant_vaccination_desexing"
  | "health_clearance"
  | "behaviour"
  | "fitness_review"
  | "publish"
  | "application"
  | "documents"
  | "suitability_checks"
  | "application_review"
  | "meet_and_greet"
  | "agreement"
  | "payment"
  | "payment_confirmation"
  | "pre_release_check"
  | "release"
  | "follow_up"
  | "rehomed";

// Steps from Application onwards make up an adopter's application journey.
export const APPLICATION_STEPS: StepKey[] = [
  "application",
  "documents",
  "suitability_checks",
  "application_review",
  "meet_and_greet",
  "agreement",
  "payment",
  "payment_confirmation",
  "pre_release_check",
  "release",
  "follow_up",
  "rehomed",
];

export interface StepHalf {
  role: Role;
  done: boolean;
  label: string;
}

export interface ProcessStep {
  key: StepKey;
  label: string;
  state: StepState;
  // Who owns this step.
  responsibleRoles: Role[];
  // Who has to act on it right now (empty when done, not started, or
  // waiting on nobody in particular).
  needsActionFromRoles: Role[];
  detail: string;
  // Short imperative for whoever must act ("Confirm payment").
  nextAction?: string;
  // Two-party steps (Review Adoption Fitness) report each half.
  halves?: StepHalf[];
}

export interface AnimalRecords {
  animal: Animal;
  tasks: AssessmentTask[];
  lookups: MicrochipLookup[];
  implant?: { status: "Pending" | "Completed"; assignedNumber: string } | null;
  vaccinations: VaccinationRecord[];
  // A Vaccination Check has been recorded, and the vaccine types it left
  // pending (not yet given or waived).
  vaccinationCheckDone?: boolean;
  pendingVaccinations?: string[];
  desexing?: DesexingSchedule | null;
  healthAssessments: HealthAssessment[];
  clearances: MedicalClearance[];
  temperamentAssessments: TemperamentAssessment[];
  behaviourPrograms: BehaviourProgram[];
  fitnessReview?: FitnessReview | null;
  holds: StatutoryHold[];
  hasPrimaryPhoto: boolean;
  applications: AdoptionApplication[];
  checks: SuitabilityCheck[];
  meetAndGreets: MeetAndGreet[];
  agreements: AdoptionAgreement[];
  payments: AdoptionPayment[];
  documentCounts: Record<string, number>;
  preReleaseChecks: PreReleaseCheck[];
  followUpVisits: FollowUpVisit[];
}

const STAFF: Role = "Shelter Staff Member";
const VET: Role = "Veterinarian";
const ADOPTER: Role = "Adopter";

const LABELS: Record<StepKey, string> = {
  intake: "Intake",
  microchip: "Microchip",
  implant_vaccination_desexing: "Implant / Vaccination / Desexing",
  health_clearance: "Health & Medical Clearance",
  behaviour: "Behaviour",
  fitness_review: "Fitness Review",
  publish: "Publish",
  application: "Application",
  documents: "Documents",
  suitability_checks: "Suitability Checks",
  application_review: "Application Review",
  meet_and_greet: "Meet and Greet",
  agreement: "Agreement",
  payment: "Payment",
  payment_confirmation: "Payment Confirmation",
  pre_release_check: "Pre-Release Check",
  release: "Release",
  follow_up: "Follow-Up",
  rehomed: "Rehomed",
};

function step(
  key: StepKey,
  state: StepState,
  responsibleRoles: Role[],
  detail: string,
  extra: Partial<Pick<ProcessStep, "needsActionFromRoles" | "nextAction" | "halves">> = {},
): ProcessStep {
  return {
    key,
    label: LABELS[key],
    state,
    responsibleRoles,
    needsActionFromRoles: extra.needsActionFromRoles ?? [],
    detail,
    nextAction: extra.nextAction,
    halves: extra.halves,
  };
}
const act = (role: Role, nextAction: string) => ({ needsActionFromRoles: [role], nextAction });

const newestFirst = <T extends { createdAt: string }>(items: T[]) =>
  [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const APPLICATION_RANK: Record<ApplicationStatus, number> = {
  Finalised: 6,
  Approved: 5,
  "Under Review": 4,
  Submitted: 3,
  "On Hold": 2,
  Draft: 1,
  Rejected: 0,
};

// The application the animal's journey follows: the most advanced one
// (ties: most recently updated).
export function pickActiveApplication(applications: AdoptionApplication[]): AdoptionApplication | undefined {
  return [...applications].sort(
    (a, b) =>
      APPLICATION_RANK[b.applicationStatus] - APPLICATION_RANK[a.applicationStatus] ||
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
}

// The hold that is still in force (an Active hold past its end date is
// treated as expired, matching the lazy expiry the hold store applies).
export function activeHold(holds: StatutoryHold[], now = Date.now()) {
  return holds.find((h) => h.status === "Active" && new Date(h.holdEndAt).getTime() > now);
}

// Whether the Vet half of Review Adoption Fitness stands: a Veterinarian
// confirmation recorded together with (or after) a Medical Clearance.
export function vetFitnessConfirmed(records: Pick<AnimalRecords, "fitnessReview" | "clearances">): boolean {
  return Boolean(records.fitnessReview?.vetConfirmedAt && records.clearances.length > 0);
}

const PAST_PUBLISH: CurrentStatus[] = [
  "Available For Adoption",
  "Application In Progress",
  "Awaiting Release",
  "inFollowUpPeriod",
  "Rehomed",
];
const PAST_FINALISE: CurrentStatus[] = ["Awaiting Release", "inFollowUpPeriod", "Rehomed"];
const PAST_RELEASE: CurrentStatus[] = ["inFollowUpPeriod", "Rehomed"];

export function computeJourney(records: AnimalRecords, application?: AdoptionApplication): ProcessStep[] {
  const { animal } = records;
  const status = animal.currentStatus;
  const published = PAST_PUBLISH.includes(status) || animal.listingStatus === "Current" || animal.listingStatus === "Adopted";
  const finalised = PAST_FINALISE.includes(status);
  const released = PAST_RELEASE.includes(status);
  const returnedToOwner = status === "Reclaimed By Owner" || status === "ReturnedToOwner";
  const closedUnsuitable = status === "Unsuitable For Adoption" || status === "Archived";
  const hold = activeHold(records.holds);
  const task = (type: AssessmentTask["taskType"]) => records.tasks.find((t) => t.taskType === type);
  const steps: ProcessStep[] = [];
  const doneIfPast = (key: StepKey, roles: Role[], computed: () => ProcessStep, past: boolean, detail: string) => {
    const s = computed();
    return s.state !== "done" && past ? step(key, "done", roles, detail) : s;
  };

  // Intake - an Animal record only exists once intake has been finalised.
  steps.push(step("intake", "done", [STAFF], "Intake finalised"));

  // Microchip.
  steps.push(
    doneIfPast("microchip", [STAFF], () => {
      if (returnedToOwner) return step("microchip", "blocked", [STAFF], "Owner found - returned to owner");
      if (hold || status === "On Statutory Hold") {
        return step("microchip", "blocked", [STAFF], "Owner found - statutory hold in place");
      }
      if (records.implant?.status === "Pending") {
        return step("microchip", "waiting", [VET], `No chip found - implant microchip ${records.implant.assignedNumber}`, act(VET, "Implant microchip"));
      }
      if (task("Microchip Check")?.status === "Continuable") return step("microchip", "done", [STAFF], "Microchip checked");
      const lastLookup = [...records.lookups].sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0];
      if (lastLookup?.result === "Timeout") {
        return step("microchip", "in_progress", [STAFF], "Registry did not respond", act(STAFF, "Retry microchip scan"));
      }
      return step("microchip", "waiting", [STAFF], "Microchip not scanned yet", act(STAFF, "Scan microchip"));
    }, published, "Microchip checked"),
  );

  // Implant / Vaccination / Desexing.
  steps.push(
    doneIfPast("implant_vaccination_desexing", [VET], () => {
      const implantPending = records.implant?.status === "Pending";
      // Vaccination is done once a Vaccination Check is recorded (animals
      // from before checks: a vaccination record) and nothing it left
      // pending is still waiting.
      const pending = records.pendingVaccinations?.length ?? 0;
      const checked = Boolean(records.vaccinationCheckDone) || records.vaccinations.length > 0;
      const vaccinated = checked && pending === 0;
      const desexed = Boolean(records.desexing);
      if (!implantPending && vaccinated && desexed) {
        return step("implant_vaccination_desexing", "done", [VET], "Vaccination check and desexing recorded");
      }
      const missing = [
        implantPending && "microchip implant",
        !checked && "vaccination check",
        pending > 0 && `${pending} pending vaccination${pending === 1 ? "" : "s"}`,
        !desexed && "desexing",
      ].filter(Boolean);
      const started = checked || desexed || records.implant?.status === "Completed";
      return step(
        "implant_vaccination_desexing",
        started ? "in_progress" : "waiting",
        [VET],
        `Outstanding: ${missing.join(", ")}`,
        act(
          VET,
          implantPending
            ? "Implant microchip"
            : !checked
              ? "Record vaccination check"
              : pending > 0
                ? `Give or waive ${pending} pending vaccination${pending === 1 ? "" : "s"}`
                : "Schedule desexing",
        ),
      );
    }, published, "Vaccination and desexing recorded"),
  );

  // Health + Medical Clearance.
  const latestHealth = newestFirst(records.healthAssessments)[0];
  steps.push(
    doneIfPast("health_clearance", [VET], () => {
      if (records.clearances.length > 0) return step("health_clearance", "done", [VET], "Medical clearance issued");
      if (status === "Under Treatment") {
        return step("health_clearance", "blocked", [VET], "Under treatment", act(VET, "Record treatment"));
      }
      if (!latestHealth) return step("health_clearance", "waiting", [VET], "No health assessment yet", act(VET, "Record health assessment"));
      const pendingVaccinations = records.pendingVaccinations?.length ?? 0;
      if (pendingVaccinations > 0) {
        return step("health_clearance", "waiting", [VET], `Waiting for ${pendingVaccinations} pending vaccination${pendingVaccinations === 1 ? "" : "s"}`, act(VET, "Give or waive pending vaccinations"));
      }
      if (latestHealth.healthRecheckRequired) {
        return step("health_clearance", "in_progress", [VET], "Health recheck pending", act(VET, "Record health recheck"));
      }
      return step("health_clearance", "in_progress", [VET], "Health assessed - clearance not issued", act(VET, "Issue medical clearance"));
    }, published, "Medical clearance issued"),
  );

  // Behaviour.
  const latestBehaviour = newestFirst(records.temperamentAssessments)[0];
  steps.push(
    doneIfPast("behaviour", [STAFF], () => {
      if (closedUnsuitable) return step("behaviour", "blocked", [STAFF], "Unsuitable for adoption");
      if (status === "In Behaviour Program" || latestBehaviour?.outcome === "Requires Behaviour Modification") {
        return step("behaviour", "blocked", [STAFF], "In behaviour program", act(STAFF, "Reassess behaviour"));
      }
      if (latestBehaviour?.outcome === "Unsuitable for Public Adoption") return step("behaviour", "blocked", [STAFF], "Unsuitable for public adoption");
      if (latestBehaviour?.outcome === "Suitable for Adoption") return step("behaviour", "done", [STAFF], "Suitable for adoption");
      return step("behaviour", "waiting", [STAFF], "No temperament assessment yet", act(STAFF, "Record temperament assessment"));
    }, published, "Suitable for adoption"),
  );

  // Review Adoption Fitness - Staff half, Vet half (= Medical Clearance).
  steps.push(
    doneIfPast("fitness_review", [STAFF, VET], () => {
      const staffDone = Boolean(records.fitnessReview?.staffConfirmedAt);
      const vetDone = vetFitnessConfirmed(records);
      const halves: StepHalf[] = [
        { role: STAFF, done: staffDone, label: staffDone ? "Confirmed by Shelter Staff" : "Waiting on Shelter Staff" },
        { role: VET, done: vetDone, label: vetDone ? "Confirmed with Medical Clearance" : "Waiting on Veterinarian: Medical Clearance" },
      ];
      if (staffDone && vetDone) return step("fitness_review", "done", [STAFF, VET], "Confirmed by Shelter Staff and Veterinarian", { halves });
      const tasksReady = (["Microchip Check", "Health Assessment", "Temperament Assessment"] as const).every(
        (t) => task(t)?.status === "Continuable",
      );
      const needs: Role[] = [];
      if (!staffDone && tasksReady && !hold) needs.push(STAFF);
      if (!vetDone) needs.push(VET);
      const state: StepState = staffDone || vetDone ? "in_progress" : tasksReady ? "waiting" : "not_started";
      return step("fitness_review", state, [STAFF, VET], halves.map((h) => h.label).join("; "), {
        halves,
        needsActionFromRoles: state === "not_started" ? [] : needs,
        nextAction: needs.includes(STAFF) ? "Confirm adoption fitness" : needs.includes(VET) ? "Issue medical clearance" : undefined,
      });
    }, published, "Confirmed by Shelter Staff and Veterinarian"),
  );

  // Publish.
  steps.push(
    (() => {
      if (published) return step("publish", "done", [STAFF], "Listed for adoption");
      if (animal.listingStatus === "Removed") return step("publish", "blocked", [STAFF], "Listing withdrawn");
      if (animal.listingStatus !== "Pre-Listing") return step("publish", "not_started", [STAFF], "Not ready to publish");
      const blockers = publishBlockers(records);
      if (blockers.length === 0) return step("publish", "waiting", [STAFF], "Ready to publish", act(STAFF, "Publish adoption profile"));
      if (hold || !vetFitnessConfirmed(records)) return step("publish", "blocked", [STAFF], blockers.join("; "));
      return step("publish", "in_progress", [STAFF], blockers.join("; "), act(STAFF, "Complete listing details"));
    })(),
  );

  // From here on the journey follows one application.
  const app = application ?? pickActiveApplication(records.applications);
  const appStatus = app?.applicationStatus;
  const live = app && appStatus !== "Rejected";
  const forApp = <T extends { applicationId: string }>(items: T[]) => (app ? items.filter((i) => i.applicationId === app.applicationId) : []);
  const mg = newestFirst(forApp(records.meetAndGreets))[0];
  const agreement = newestFirst(forApp(records.agreements))[0];
  const payment = agreement ? newestFirst(records.payments.filter((p) => p.agreementId === agreement.agreementId))[0] : undefined;
  const checks = forApp(records.checks);
  const docs = app ? (records.documentCounts[app.applicationId] ?? 0) : 0;
  const approved = appStatus === "Approved" || appStatus === "Finalised";

  steps.push(
    (() => {
      if (finalised) return step("application", "done", [ADOPTER], "Application finalised");
      if (!published) return step("application", "not_started", [ADOPTER], "Not listed yet");
      if (!live) return step("application", "waiting", [ADOPTER], app ? "Previous application rejected - open for applications" : "Open for applications");
      if (appStatus === "Draft") return step("application", "in_progress", [ADOPTER], "Application being drafted", act(ADOPTER, "Submit application"));
      return step("application", "done", [ADOPTER], `Application ${appStatus?.toLowerCase()}`);
    })(),
  );

  const waitingOnAdopter = app ? isWaitingOnAdopter(app) : false;
  steps.push(
    (() => {
      if (waitingOnAdopter) return step("documents", "waiting", [ADOPTER], "Shelter Staff asked for more documents", act(ADOPTER, "Upload the requested documents"));
      if (docs > 0) return step("documents", "done", [ADOPTER], `Documents received (${docs})`);
      if (finalised) return step("documents", "done", [ADOPTER], "Application finalised");
      if (!live) return step("documents", "not_started", [ADOPTER], "No application yet");
      if (appStatus === "Draft") return step("documents", "waiting", [ADOPTER], "No documents uploaded yet", act(ADOPTER, "Upload supporting documents"));
      return step("documents", "done", [ADOPTER], "Submitted without supporting documents");
    })(),
  );

  steps.push(
    (() => {
      if (approved || finalised) return step("suitability_checks", "done", [STAFF], "Application approved");
      if (!live || appStatus === "Draft") return step("suitability_checks", "not_started", [STAFF], "Waiting for a submitted application");
      const complete = checks.length > 0 && checks.every((c) => c.outcome !== "Pending");
      if (complete) return step("suitability_checks", "done", [STAFF], checks.every((c) => c.outcome === "Pass") ? "All checks passed" : "All checks complete");
      if (appStatus === "On Hold") return step("suitability_checks", "blocked", [STAFF], "Application on hold");
      return step("suitability_checks", checks.some((c) => c.outcome !== "Pending") ? "in_progress" : "waiting", [STAFF], "Suitability checks outstanding", act(STAFF, "Complete suitability checks"));
    })(),
  );

  // The Staff decision on the application (Start Review, Approve / Reject,
  // On Hold), and any request to the Adopter for more documents.
  steps.push(
    (() => {
      if (approved || finalised) return step("application_review", "done", [STAFF], "Application approved");
      if (!live || appStatus === "Draft") return step("application_review", "not_started", [STAFF], "Waiting for a submitted application");
      if (waitingOnAdopter) return step("application_review", "waiting", [STAFF], "With Adopter – waiting for documents", { needsActionFromRoles: [ADOPTER], nextAction: "Upload the requested documents" });
      const complete = checks.length > 0 && checks.every((c) => c.outcome !== "Pending");
      const responded = app ? hasNewAdopterResponse(app) : false;
      if (appStatus === "On Hold") return step("application_review", "blocked", [STAFF], "Application on hold", act(STAFF, "Review application on hold"));
      if (appStatus === "Submitted") return step("application_review", "waiting", [STAFF], "Review not started", act(STAFF, "Start review"));
      if (responded) return step("application_review", "waiting", [STAFF], "New documents from the Adopter", act(STAFF, "Review new documents"));
      if (complete) return step("application_review", "waiting", [STAFF], "Checks complete - decision pending", act(STAFF, "Approve or reject application"));
      return step("application_review", "in_progress", [STAFF], "Under review - suitability checks outstanding");
    })(),
  );

  steps.push(
    (() => {
      if (finalised || mg?.status === "Compatible") return step("meet_and_greet", "done", [STAFF, ADOPTER], "Compatible");
      if (!approved) return step("meet_and_greet", "not_started", [STAFF, ADOPTER], "Waiting for an approved application");
      if (mg?.status === "Incompatible") return step("meet_and_greet", "blocked", [STAFF], "Not compatible");
      if (!mg) return step("meet_and_greet", "waiting", [STAFF], "No slots proposed yet", act(STAFF, "Propose Meet and Greet slots"));
      if (mg.status === "Proposed") return step("meet_and_greet", "waiting", [ADOPTER], "Slots proposed", act(ADOPTER, "Choose a Meet and Greet slot"));
      if (!mg.attendanceConfirmed) return step("meet_and_greet", "in_progress", [ADOPTER], "Scheduled - attendance not confirmed", act(ADOPTER, "Confirm attendance"));
      return step("meet_and_greet", "in_progress", [STAFF], "Scheduled and confirmed", act(STAFF, "Record Meet and Greet outcome"));
    })(),
  );

  steps.push(
    (() => {
      if (finalised || agreement?.isSigned) return step("agreement", "done", [STAFF, ADOPTER], "Agreement signed");
      if (mg?.status !== "Compatible") return step("agreement", "not_started", [STAFF, ADOPTER], "Waiting for a compatible Meet and Greet");
      if (!agreement) return step("agreement", "waiting", [STAFF], "Agreement not generated", act(STAFF, "Generate agreement"));
      return step("agreement", "waiting", [ADOPTER], "Waiting for signature", act(ADOPTER, "Sign agreement"));
    })(),
  );

  steps.push(
    (() => {
      if (finalised || payment?.paymentStatus === "Pending" || payment?.paymentStatus === "Cleared") {
        return step("payment", "done", [ADOPTER], "Payment made");
      }
      if (!agreement?.isSigned) return step("payment", "not_started", [ADOPTER], "Waiting for a signed agreement");
      if (payment?.paymentStatus === "Failed") return step("payment", "waiting", [ADOPTER], "Payment was not completed", act(ADOPTER, "Pay adoption fee"));
      return step("payment", "waiting", [ADOPTER], "Adoption fee due", act(ADOPTER, "Pay adoption fee"));
    })(),
  );

  steps.push(
    (() => {
      if (finalised) return step("payment_confirmation", "done", [STAFF], "Payment confirmed and adoption finalised");
      if (payment?.paymentStatus === "Pending") return step("payment_confirmation", "waiting", [STAFF], "Payment received - not confirmed yet", act(STAFF, "Confirm payment"));
      if (payment?.paymentStatus === "Cleared") return step("payment_confirmation", "in_progress", [STAFF], "Payment confirmed - adoption not finalised", act(STAFF, "Finalise adoption"));
      return step("payment_confirmation", "not_started", [STAFF], "Waiting for payment");
    })(),
  );

  const latestCheck = newestFirst(records.preReleaseChecks)[0];
  const fitForRelease = status === "Awaiting Release" && latestCheck?.fitnessResult === "Fit for Release";
  steps.push(
    (() => {
      if (released || fitForRelease) return step("pre_release_check", "done", [VET], "Fit for release");
      if (!finalised && status !== "Under Treatment") return step("pre_release_check", "not_started", [VET], "Waiting for the adoption to be finalised");
      if (status === "Under Treatment" && latestCheck?.fitnessResult === "Health Concern") {
        return step("pre_release_check", "blocked", [VET], "Health concern - under treatment", act(VET, "Record treatment"));
      }
      if (status === "Under Treatment") return step("pre_release_check", "not_started", [VET], "Waiting for the adoption to be finalised");
      return step("pre_release_check", "waiting", [VET], "Pre-release check not done", act(VET, "Do pre-release check"));
    })(),
  );

  steps.push(
    released
      ? step("release", "done", [STAFF], "Released to adopter")
      : fitForRelease
        ? step("release", "waiting", [STAFF], "Ready to release", act(STAFF, "Release animal to adopter"))
        : step("release", "not_started", [STAFF], "Waiting for the pre-release check"),
  );

  const visit = [...records.followUpVisits].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  // Staff act on a scheduled visit (what the Follow Up Visits page lists);
  // an animal in its follow-up period without one has nothing to complete.
  const scheduledVisit = records.followUpVisits.some((v) => v.status === "Scheduled");
  steps.push(
    status === "Rehomed" || visit?.status === "Completed"
      ? step("follow_up", "done", [STAFF], "Follow-up completed")
      : status === "inFollowUpPeriod" && scheduledVisit
        ? step("follow_up", "waiting", [STAFF], "Follow-up visit scheduled", act(STAFF, "Complete follow-up visit"))
        : status === "inFollowUpPeriod"
          ? step("follow_up", "in_progress", [STAFF], "In follow-up period - no visit scheduled")
          : step("follow_up", "not_started", [STAFF], "Waiting for release"),
  );

  steps.push(status === "Rehomed" ? step("rehomed", "done", [STAFF], "Rehomed") : step("rehomed", "not_started", [STAFF], "Not rehomed yet"));

  // A closed journey (returned to owner, permanently unsuitable) has
  // nothing left for anyone to do downstream.
  if (returnedToOwner || closedUnsuitable) {
    return steps.map((s) => (s.state === "done" || s.state === "blocked" ? s : { ...s, needsActionFromRoles: [], nextAction: undefined }));
  }
  return steps;
}

// The publish conditions the engine can see from records - mirrors
// getPublishBlockers() in lib/adoption-listings/publish.ts.
export function publishBlockers(records: AnimalRecords): string[] {
  const { animal } = records;
  const blockers: string[] = [];
  if (records.clearances.length === 0) blockers.push("Medical Clearance has not been issued.");
  const latest = newestFirst(records.temperamentAssessments)[0];
  if (latest?.outcome !== "Suitable for Adoption") blockers.push("The latest Behavioural Assessment is not Suitable for Adoption.");
  // Any Active hold, even past its end date, as hasUnresolvedHold() does.
  if (records.holds.some((h) => h.status === "Active")) blockers.push("There is an unresolved Statutory Hold on this animal.");
  if (!records.fitnessReview?.staffConfirmedAt || !vetFitnessConfirmed(records)) {
    blockers.push("Review Adoption Fitness has not been confirmed by both Shelter Staff and Veterinarian.");
  }
  if (animal.adoptionFee == null) blockers.push("Adoption Fee must be filled in.");
  if (!animal.generalDescription.trim()) blockers.push("General Description must be filled in.");
  if (!animal.breed.trim() || animal.breed === "Unknown") blockers.push("Breed must be filled in.");
  if (!animal.sex) blockers.push("Sex must be filled in.");
  if (animal.temperaments.length === 0) blockers.push("At least one Temperament must be filled in.");
  if (!records.hasPrimaryPhoto) blockers.push("A public photo must be selected.");
  return blockers;
}

// Same conditions and messages as getPreListingBlockers()
// (lib/adoption-listings/pre-listing.ts), from already-loaded records.
export function preListingBlockers(records: AnimalRecords): string[] {
  const blockers: string[] = [];
  const hasClearance = records.clearances.length > 0;
  if (!hasClearance) blockers.push("Medical Clearance has not been issued.");
  // Any Active hold, even past its end date, as hasUnresolvedHold() does.
  if (records.holds.some((h) => h.status === "Active")) blockers.push("There is an unresolved Statutory Hold on this animal.");
  const latest = newestFirst(records.temperamentAssessments)[0];
  if (latest?.outcome !== "Suitable for Adoption") blockers.push("The latest Behavioural Assessment is not Suitable for Adoption.");
  if (!records.fitnessReview?.staffConfirmedAt) blockers.push("Review Adoption Fitness has not been confirmed by Shelter Staff.");
  if (hasClearance && !records.fitnessReview?.vetConfirmedAt) {
    blockers.push("The Veterinarian fitness confirmation was withdrawn - the Medical Clearance must be issued again.");
  }
  return blockers;
}

// Administrator acts wherever Shelter Staff does.
export function actingRole(role: Role): Role {
  return role === "Administrator" ? STAFF : role;
}

export function needsRole(s: ProcessStep, role: Role): boolean {
  return s.needsActionFromRoles.includes(actingRole(role));
}

// The first step (in journey order) that needs this role, if any.
export function nextActionFor(steps: ProcessStep[], role: Role): ProcessStep | undefined {
  return steps.find((s) => needsRole(s, role));
}
