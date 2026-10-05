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

export interface Worklist {
  role: Role;
  counts: Record<string, number>;
  animals: Record<string, ListFlag>;
  applications: Record<string, ListFlag>;
  items: WorkItem[];
  paymentsToConfirm: PaymentToConfirm[];
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
      return role === "Veterinarian" ? `/animals/${a}/medical` : `/animals/${a}/scan-microchip`;
    case "implant_vaccination_desexing":
    case "health_clearance":
      return `/animals/${a}/medical`;
    case "behaviour":
      return `/animals/${a}/behaviour`;
    case "fitness_review":
      return role === "Veterinarian" ? `/animals/${a}/medical` : `/animals/${a}/adoption-fitness`;
    case "publish":
      return `/animals/${a}/adoption-fitness`;
    case "suitability_checks":
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
  if (role === "Veterinarian") return step === "pre_release_check" ? "Pre-Release Checks" : "Animals";
  if (step === "suitability_checks" || step === "meet_and_greet") return "Adoption Applications";
  if (step === "agreement" || step === "payment_confirmation") return "Adoptions";
  if (step === "follow_up") return "Follow Up Visits";
  return "Animals";
}

const APPLICATION_STAGE: StepKey[] = [
  "application",
  "documents",
  "suitability_checks",
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
    if (next) {
      const appId = APPLICATION_STAGE.includes(next.key) ? active?.applicationId : undefined;
      items.push({ key: `animal-${animal.animalId}`, animalId: animal.animalId, applicationId: appId, title: animal.name, nextAction: next.nextAction ?? next.label, stepKey: next.key, href: hrefFor(next.key, acting, records, active?.applicationId) });
      bump(navLabelFor(next.key, acting));
    }
    // Application list flags (Staff/Admin/Vet views of applications).
    for (const app of records.applications) {
      const appStep: ProcessStep | undefined =
        app.applicationId === active?.applicationId ? steps.find((s) => APPLICATION_STAGE.includes(s.key) && needsRole(s, role)) : undefined;
      applications[app.applicationId] = { needsMyAction: Boolean(appStep), nextAction: appStep?.nextAction, priority: appStep ? 0 : 1 };
    }
    if (acting === "Shelter Staff Member") {
      for (const p of records.payments.filter((p) => p.paymentStatus === "Pending")) {
        paymentsToConfirm.push({ paymentId: p.paymentId, applicationId: p.applicationId, adopterName: p.adopterName, animalName: p.animalName });
      }
    }
  }

  if (staffSide) {
    const linked = new Set(intakeRows.map((r) => r.councilTransferSubmissionId).filter((id): id is string => Boolean(id)));
    const unlinked = countUnlinkedSubmittedTransfers(transferRows.map(toCouncilTransferSubmission), linked);
    if (unlinked > 0) {
      counts["Animal Intake"] = unlinked;
      items.push({ key: "intake-transfers", title: `${unlinked} council transfer${unlinked === 1 ? "" : "s"}`, nextAction: "Create intake record", href: "/animal-intake" });
    }
  }

  return { role, counts, animals, applications, items, paymentsToConfirm };
}
