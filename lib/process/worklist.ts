import { toCouncilTransferSubmission } from "@/lib/council-transfers/serialize";
import { db } from "@/lib/db/client";
import {
  actingRole,
  computeJourney,
  needsRole,
  pickActiveApplication,
  type AnimalRecords,
  type ProcessStep,
  type StepKey,
} from "@/lib/process/engine";
import { loadAnimalRecords } from "@/lib/process/load";
import { countUnlinkedSubmittedTransfers } from "@/lib/pending-actions/counts";
import type { Role } from "@/lib/roles/roles";

// Everything role-specific the UI needs about pending work, computed in
// one pass over the process engine: list flags and ordering, the "Needs
// my action" panel, sidebar badge counts and payments awaiting
// confirmation. Served by GET /api/worklist (one batch request per tab,
// polled every 20 s).

export interface WorkItem {
  key: string;
  animalId?: string;
  applicationId?: string;
  title: string;
  nextAction: string;
  stepKey?: StepKey;
  href: string;
}

export interface ListFlag {
  needsMyAction: boolean;
  nextAction?: string;
  // Lower sorts first; needs-my-action items come before everything else.
  priority: number;
}

export interface PaymentToConfirm {
  paymentId: string;
  applicationId: string;
  adopterName: string;
  animalName: string;
}

export type WorkbenchSectionKey = "implant" | "vaccination_desexing" | "clearance" | "pre_release";

export interface WorkbenchRow {
  animalId: string;
  title: string;
  shelterId: string;
  detail: string;
  href: string;
}

export interface Worklist {
  role: Role;
  counts: Record<string, number>;
  animals: Record<string, ListFlag>;
  applications: Record<string, ListFlag>;
  items: WorkItem[];
  paymentsToConfirm: PaymentToConfirm[];
  // Veterinarian only: the Vet Workbench sections.
  workbench?: Record<WorkbenchSectionKey, WorkbenchRow[]>;
}

// Animals that have left the shelter's care get no vaccination or
// desexing reminders.
const OUT_OF_CARE = new Set(["ReturnedToOwner", "Archived", "Rehomed", "inFollowUpPeriod"]);
const BOOSTER_WINDOW_MS = 14 * 86400000;

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// Which Vet Workbench section an animal belongs in (at most one), from
// the engine's steps plus appointments and boosters coming due.
function workbenchRow(records: AnimalRecords, steps: ProcessStep[], now: number): [WorkbenchSectionKey, WorkbenchRow] | null {
  const { animal } = records;
  const a = animal.animalId;
  const base = { animalId: a, title: animal.name, shelterId: animal.shelterId };
  const vetStep = (key: StepKey) => steps.find((s) => s.key === key && needsRole(s, "Veterinarian"));

  if (records.implant?.status === "Pending") {
    return ["implant", { ...base, detail: `Implant microchip ${records.implant.assignedNumber}`, href: `/animals/${a}/microchip-implant` }];
  }
  const preRelease = vetStep("pre_release_check");
  if (preRelease) return ["pre_release", { ...base, detail: preRelease.nextAction ?? "Conduct pre-release check", href: `/animals/${a}/pre-release-check` }];

  const due: string[] = [];
  const vacc = vetStep("implant_vaccination_desexing");
  const pending = records.pendingVaccinations?.length ?? 0;
  // Pending vaccinations are listed with their count whatever step the
  // animal is at; otherwise the step's own next action is shown.
  if (vacc && !vacc.nextAction?.startsWith("Give or waive")) due.push(vacc.nextAction ?? vacc.detail);
  if (pending > 0) due.push(`${pending} pending vaccination${pending === 1 ? "" : "s"}: ${records.pendingVaccinations!.join(", ")}`);
  if (!OUT_OF_CARE.has(animal.currentStatus)) {
    const d = records.desexing;
    if (d?.status === "Scheduled" && new Date(d.scheduledDate).getTime() <= now) due.push(`Desexing appointment due ${formatDay(d.scheduledDate)}`);
    const latestByType = new Map<string, (typeof records.vaccinations)[number]>();
    for (const v of records.vaccinations) {
      const prev = latestByType.get(v.vaccineType);
      if (!prev || new Date(v.administrationDate).getTime() > new Date(prev.administrationDate).getTime()) latestByType.set(v.vaccineType, v);
    }
    for (const v of latestByType.values()) {
      if (v.nextBoosterDueDate && new Date(v.nextBoosterDueDate).getTime() <= now + BOOSTER_WINDOW_MS) {
        due.push(`${v.vaccineType} booster due ${formatDay(v.nextBoosterDueDate)}`);
      }
    }
  }
  if (due.length > 0) return ["vaccination_desexing", { ...base, detail: due.join(" · "), href: `/animals/${a}/medical` }];

  const clearance = vetStep("health_clearance");
  if (clearance) return ["clearance", { ...base, detail: clearance.nextAction ?? clearance.detail, href: `/animals/${a}/medical` }];
  // The clearance stands but its fitness confirmation was withdrawn (e.g.
  // by a new Statutory Hold) and the animal is still on its way to listing.
  if (records.clearances.length > 0 && !records.fitnessReview?.vetConfirmedAt && (animal.listingStatus === "Not Fit" || animal.listingStatus === "Pre-Listing")) {
    return ["clearance", { ...base, detail: "Issue Medical Clearance again to re-confirm fitness", href: `/animals/${a}/medical` }];
  }
  return null;
}

// Where each step's action is taken, per acting role.
function hrefFor(step: StepKey, role: Role, records: AnimalRecords, applicationId?: string): string {
  const a = records.animal.animalId;
  if (role === "Adopter") {
    if (step === "meet_and_greet") {
      const mg = records.meetAndGreets.find((m) => m.applicationId === applicationId);
      return mg ? `/my-meet-and-greets/${mg.meetAndGreetId}` : "/my-meet-and-greets";
    }
    if (step === "agreement" || step === "payment") return `/my-agreements/${applicationId}`;
    return `/my-applications/${applicationId}`;
  }
  switch (step) {
    case "microchip":
      return role === "Veterinarian" ? `/animals/${a}/microchip-implant` : `/animals/${a}/scan-microchip`;
    case "implant_vaccination_desexing":
      return records.implant?.status === "Pending" ? `/animals/${a}/microchip-implant` : `/animals/${a}/medical`;
    case "health_clearance":
      return `/animals/${a}/medical`;
    case "behaviour":
      return `/animals/${a}/behaviour`;
    case "fitness_review":
      return role === "Veterinarian" ? `/animals/${a}/medical` : `/animals/${a}/adoption-fitness`;
    case "publish":
      return `/animals/${a}/adoption-fitness`;
    case "suitability_checks":
    case "application_review":
    case "meet_and_greet":
      return `/adoption-applications/${applicationId}`;
    case "agreement":
    case "payment_confirmation":
      return `/adoptions/${applicationId}`;
    case "pre_release_check":
    case "release":
      return `/animals/${a}/pre-release-check`;
    case "follow_up":
      return `/animals/${a}/follow-up-visit`;
    default:
      return `/animals/${a}`;
  }
}

// Sidebar label that each pending step counts towards, per acting role.
function navLabelFor(step: StepKey, role: Role): string | null {
  if (role === "Adopter") {
    if (step === "application" || step === "documents") return "My Applications";
    if (step === "meet_and_greet") return "My Meet and Greets";
    if (step === "agreement" || step === "payment") return "My Agreements";
    return null;
  }
  if (role === "Veterinarian") {
    if (step === "pre_release_check") return "Pre-Release Checks";
    return "Animals";
  }
  if (step === "suitability_checks" || step === "application_review" || step === "meet_and_greet") return "Adoption Applications";
  if (step === "agreement" || step === "payment_confirmation") return "Adoptions";
  if (step === "follow_up") return "Follow Up Visits";
  return "Animals";
}

const APPLICATION_STAGE: StepKey[] = [
  "application",
  "documents",
  "suitability_checks",
  "application_review",
  "meet_and_greet",
  "agreement",
  "payment",
  "payment_confirmation",
];

export async function buildWorklist(role: Role, email: string): Promise<Worklist> {
  const acting = actingRole(role);
  const counts: Record<string, number> = {};
  const bump = (label: string | null) => {
    if (label) counts[label] = (counts[label] ?? 0) + 1;
  };
  const animals: Record<string, ListFlag> = {};
  const applications: Record<string, ListFlag> = {};
  const items: WorkItem[] = [];
  const paymentsToConfirm: PaymentToConfirm[] = [];

  if (role === "Council Animal Control Officer") {
    const own = (await db.orm.CouncilTransferSubmission.where({ submittedByEmail: email }).all()).map(toCouncilTransferSubmission);
    for (const t of own.filter((t) => t.status === "Draft")) {
      items.push({ key: `transfer-${t.id}`, title: t.animalDescription.slice(0, 60) || "Council transfer", nextAction: "Submit transfer", href: `/council-transfers/${t.id}` });
      bump("My Transfers");
    }
    return { role, counts, animals, applications, items, paymentsToConfirm };
  }

  // Council-transfer counts (Staff/Administrator) load alongside the
  // animal records rather than after them.
  const staffSide = acting === "Shelter Staff Member";
  const [all, transferRows, intakeRows] = await Promise.all([
    loadAnimalRecords(),
    staffSide ? db.orm.CouncilTransferSubmission.where({ status: "Submitted" }).all() : Promise.resolve([]),
    staffSide ? db.orm.IntakeRecord.select("intakeId", "councilTransferSubmissionId").all() : Promise.resolve([]),
  ]);
  const normalizedEmail = email.trim().toLowerCase();
  let scheduledVisits = 0;
  const workbench: Record<WorkbenchSectionKey, WorkbenchRow[]> | undefined =
    role === "Veterinarian" ? { implant: [], vaccination_desexing: [], clearance: [], pre_release: [] } : undefined;
  const now = Date.now();

  for (const records of all.values()) {
    const { animal } = records;
    if (role === "Adopter") {
      // An Adopter's journeys: one per own application.
      for (const app of records.applications.filter((a) => a.adopterEmail.toLowerCase() === normalizedEmail)) {
        const steps = computeJourney(records, app);
        const next = steps.find((s) => APPLICATION_STAGE.includes(s.key) && needsRole(s, role));
        applications[app.applicationId] = { needsMyAction: Boolean(next), nextAction: next?.nextAction, priority: next ? 0 : 1 };
        if (next) {
          items.push({ key: `app-${app.applicationId}`, applicationId: app.applicationId, animalId: animal.animalId, title: animal.name, nextAction: next.nextAction ?? next.label, stepKey: next.key, href: hrefFor(next.key, role, records, app.applicationId) });
          bump(navLabelFor(next.key, role));
        }
      }
      continue;
    }

    const steps = computeJourney(records);
    const active = pickActiveApplication(records.applications);
    const next = steps.find((s) => needsRole(s, role));
    animals[animal.animalId] = { needsMyAction: Boolean(next), nextAction: next?.nextAction, priority: next ? 0 : 1 };
    if (workbench) {
      const row = workbenchRow(records, steps, now);
      if (row) {
        workbench[row[0]].push(row[1]);
        if (row[0] !== "pre_release") bump("Vet Workbench");
      }
    }
    if (next) {
      const appId = APPLICATION_STAGE.includes(next.key) ? active?.applicationId : undefined;
      items.push({ key: `animal-${animal.animalId}`, animalId: animal.animalId, applicationId: appId, title: animal.name, nextAction: next.nextAction ?? next.label, stepKey: next.key, href: hrefFor(next.key, acting, records, active?.applicationId) });
      // Staff badges are counted from the lists below; Adoptions has no
      // per-row flags, so it keeps counting animals at that stage.
      if (!workbench && (!staffSide || navLabelFor(next.key, acting) === "Adoptions")) bump(navLabelFor(next.key, acting));
    }
    // Application list flags (Staff/Admin/Vet views of applications).
    for (const app of records.applications) {
      const appStep: ProcessStep | undefined =
        app.applicationId === active?.applicationId ? steps.find((s) => APPLICATION_STAGE.includes(s.key) && needsRole(s, role)) : undefined;
      applications[app.applicationId] = { needsMyAction: Boolean(appStep), nextAction: appStep?.nextAction, priority: appStep ? 0 : 1 };
    }
    if (staffSide) scheduledVisits += records.followUpVisits.filter((v) => v.status === "Scheduled").length;
    if (acting === "Shelter Staff Member") {
      for (const p of records.payments.filter((p) => p.paymentStatus === "Pending")) {
        paymentsToConfirm.push({ paymentId: p.paymentId, applicationId: p.applicationId, adopterName: p.adopterName, animalName: p.animalName });
      }
    }
  }

  // Each Staff badge counts exactly the rows its page flags: animals and
  // (non-draft) applications with a red dot, and the scheduled visits the
  // Follow Up Visits page lists.
  if (staffSide) {
    const set = (label: string, n: number) => {
      if (n > 0) counts[label] = n;
    };
    set("Animals", Object.values(animals).filter((f) => f.needsMyAction).length);
    set("Adoption Applications", [...all.values()].flatMap((r) => r.applications).filter((a) => a.applicationStatus !== "Draft" && applications[a.applicationId]?.needsMyAction).length);
    set("Follow Up Visits", scheduledVisits);
  }

  if (staffSide) {
    const linked = new Set(intakeRows.map((r) => r.councilTransferSubmissionId).filter((id): id is string => Boolean(id)));
    const unlinked = countUnlinkedSubmittedTransfers(transferRows.map(toCouncilTransferSubmission), linked);
    if (unlinked > 0) {
      counts["Animal Intake"] = unlinked;
      items.push({ key: "intake-transfers", title: `${unlinked} council transfer${unlinked === 1 ? "" : "s"}`, nextAction: "Create intake record", href: "/animal-intake" });
    }
  }

  if (workbench) {
    counts["Pre-Release Checks"] = workbench.pre_release.length;
    if (!counts["Pre-Release Checks"]) delete counts["Pre-Release Checks"];
  }
  return { role, counts, animals, applications, items, paymentsToConfirm, workbench };
}
