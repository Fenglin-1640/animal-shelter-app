import { getAllAnimals } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import { listAllApplications } from "@/lib/applications/store";
import { listAssessmentsNeedingReassessment } from "@/lib/behaviour/store";
import { listActiveFollowUpVisits } from "@/lib/follow-up-visits/store";
import { listScheduledMeetAndGreets } from "@/lib/meet-and-greets/store";
import {
  getLatestPreReleaseCheck,
  isFitForRelease,
  listAllVaccinations,
  listScheduledDesexing,
} from "@/lib/medical/store";
import type { VaccinationRecord } from "@/lib/medical/types";
import { getMockNotifications } from "@/lib/notifications/mock-notifications";
import type { NotificationItem } from "@/lib/notifications/types";
import type { Role } from "@/lib/roles/roles";
import { listHoldsNeedingReminder } from "@/lib/statutory-hold/store";

// FR-NOT-01: 8 of the 9 event types are now dynamically computed from
// real feature data, following the FR-MC-02 "Statutory Hold approaching
// end date" precedent below. Only "Backup Job failure" stays simulated
// (lib/mock-notifications.ts) - PRD 8.3 itself frames BackupRun /
// RecoveryTest as "原型中的备份状态与恢复测试证据" (prototype evidence of backup
// status), not a real subsystem this database-backed prototype has
// anything to actually back up or fail for real.
const REMINDER_LEAD_DAYS = 7;
const RECENT_DECISION_WINDOW_DAYS = 14;

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

// Each notification type below names the animal it is about. Look them
// up from one shared all-animals request rather than awaiting
// getAnimalById() once per item, which made the Notifications screen a
// long chain of sequential requests.
async function getAnimalsById(): Promise<Map<string, Animal>> {
  return new Map((await getAllAnimals()).map((animal) => [animal.animalId, animal]));
}

// FR-MC-02 step 4 / FR-NOT-01 "Statutory Hold approaching end date".
// Computed live from StatutoryHold records rather than persisted as its
// own record, since it's fully derived from data that already exists.
async function getStatutoryHoldNotifications(): Promise<NotificationItem[]> {
  const [holds, animalsById] = await Promise.all([listHoldsNeedingReminder(), getAnimalsById()]);
  const items: NotificationItem[] = [];
  for (const hold of holds) {
    const animal = animalsById.get(hold.animalId);
    if (!animal) continue;
    const remaining = daysUntil(hold.holdEndAt);
    items.push({
      id: `hold-reminder-${hold.id}`,
      type: "Statutory Hold",
      title: "Statutory hold ending soon",
      detail: `${animal.name}'s statutory hold ends in ${remaining} day(s). Confirm owner reclamation or wait for it to expire back to Under Assessment.`,
      createdAt: hold.createdAt,
      dueDate: hold.holdEndAt,
      roles: ["Shelter Staff Member", "Administrator"],
      defaultRead: false,
    });
  }
  return items;
}

// FR-NOT-01 "Behaviour reassessment due".
async function getBehaviourReassessmentNotifications(): Promise<NotificationItem[]> {
  const [assessments, animalsById] = await Promise.all([listAssessmentsNeedingReassessment(), getAnimalsById()]);
  const items: NotificationItem[] = [];
  for (const assessment of assessments) {
    if (!assessment.reassessmentDate || daysUntil(assessment.reassessmentDate) > REMINDER_LEAD_DAYS) continue;
    const animal = animalsById.get(assessment.animalId);
    if (!animal) continue;
    items.push({
      id: `behaviour-reassessment-${assessment.id}`,
      type: "Behaviour Reassessment",
      title: "Behaviour reassessment due",
      detail: `${animal.name} is due for a behaviour reassessment following their Behaviour Program.`,
      createdAt: assessment.createdAt,
      dueDate: assessment.reassessmentDate,
      roles: ["Shelter Staff Member", "Administrator"],
      defaultRead: false,
    });
  }
  return items;
}

// FR-NOT-01 "Vaccine booster due" - only the latest vaccination per
// (animal, vaccine type) is checked, so a booster already given doesn't
// leave a stale reminder pointing at the superseded record.
async function getVaccineBoosterNotifications(): Promise<NotificationItem[]> {
  const [vaccinations, animalsById] = await Promise.all([listAllVaccinations(), getAnimalsById()]);
  const latestByAnimalAndType = new Map<string, VaccinationRecord>();
  for (const v of vaccinations) {
    const key = `${v.animalId}::${v.vaccineType}`;
    const existing = latestByAnimalAndType.get(key);
    if (!existing || new Date(v.administrationDate) > new Date(existing.administrationDate)) {
      latestByAnimalAndType.set(key, v);
    }
  }

  const items: NotificationItem[] = [];
  for (const v of latestByAnimalAndType.values()) {
    if (daysUntil(v.nextBoosterDueDate) > REMINDER_LEAD_DAYS) continue;
    const animal = animalsById.get(v.animalId);
    if (!animal) continue;
    items.push({
      id: `vaccine-booster-${v.id}`,
      type: "Vaccine Booster",
      title: "Vaccine booster due",
      detail: `${animal.name}'s ${v.vaccineType} booster is due.`,
      createdAt: v.createdAt,
      dueDate: v.nextBoosterDueDate,
      roles: ["Veterinarian", "Administrator"],
      defaultRead: false,
    });
  }
  return items;
}

// FR-NOT-01 "Desexing appointment due".
async function getDesexingAppointmentNotifications(): Promise<NotificationItem[]> {
  const [scheduled, animalsById] = await Promise.all([listScheduledDesexing(), getAnimalsById()]);
  const items: NotificationItem[] = [];
  for (const d of scheduled) {
    if (daysUntil(d.scheduledDate) > REMINDER_LEAD_DAYS) continue;
    const animal = animalsById.get(d.animalId);
    if (!animal) continue;
    items.push({
      id: `desexing-${d.id}`,
      type: "Desexing Appointment",
      title: "Desexing appointment due",
      detail: `${animal.name}'s desexing appointment is coming up.`,
      createdAt: d.createdAt,
      dueDate: d.scheduledDate,
      roles: ["Veterinarian", "Administrator"],
      defaultRead: false,
    });
  }
  return items;
}

// FR-NOT-01 "Application decision" - personal to the Adopter who applied
// (recipientEmail), scoped to a recent window so a decision made months
// ago doesn't linger in the list forever (there is no other event that
// naturally retires it, unlike e.g. a Statutory Hold expiring).
async function getApplicationDecisionNotifications(): Promise<NotificationItem[]> {
  const applications = await listAllApplications();
  return applications.flatMap((application) => {
    if (!application.decisionDate) return [];
    if (daysSince(application.decisionDate) > RECENT_DECISION_WINDOW_DAYS) return [];
    const approved = application.applicationStatus === "Approved";
    const rejected = application.applicationStatus === "Rejected";
    if (!approved && !rejected) return [];

    const item: NotificationItem = {
      id: `application-decision-${application.applicationId}`,
      type: "Application Decision",
      title: approved ? "Your application was approved" : "Update on your application",
      detail: approved
        ? `Your adoption application for ${application.animalName} has been approved. Next step: a Meet and Greet.`
        : `Your adoption application for ${application.animalName} was not successful. View details for more information.`,
      createdAt: application.decisionDate,
      roles: ["Adopter"],
      recipientEmail: application.adopterEmail,
      defaultRead: false,
    };
    return [item];
  });
}

// FR-NOT-01 "Meet and Greet scheduled" - one entry each for Staff
// (informational) and the specific Adopter (recipientEmail), matching
// the two-audience shape the mock data already modelled.
async function getMeetAndGreetNotifications(): Promise<NotificationItem[]> {
  return (await listScheduledMeetAndGreets()).flatMap((meetAndGreet) => {
    if (!meetAndGreet.scheduledDate) return [];
    const staffItem: NotificationItem = {
      id: `meet-and-greet-staff-${meetAndGreet.meetAndGreetId}`,
      type: "Meet and Greet",
      title: "Meet and Greet scheduled",
      detail: `Meet and Greet with ${meetAndGreet.adopterName} for ${meetAndGreet.animalName} is scheduled.`,
      createdAt: meetAndGreet.updatedAt,
      dueDate: meetAndGreet.scheduledDate,
      roles: ["Shelter Staff Member", "Administrator"],
      defaultRead: false,
    };
    const adopterItem: NotificationItem = {
      id: `meet-and-greet-adopter-${meetAndGreet.meetAndGreetId}`,
      type: "Meet and Greet",
      title: "Your Meet and Greet is scheduled",
      detail: `Your Meet and Greet for ${meetAndGreet.animalName} is scheduled.`,
      createdAt: meetAndGreet.updatedAt,
      dueDate: meetAndGreet.scheduledDate,
      roles: ["Adopter"],
      recipientEmail: meetAndGreet.adopterEmail,
      defaultRead: false,
    };
    return [staffItem, adopterItem];
  });
}

// FR-NOT-01 "Pre-Release Check required" - an Animal Awaiting Release
// with no Fit for Release check on file yet (the same condition the
// Pre-Release Checks queue, FR-REL-01, uses to show "Check Needed").
async function getPreReleaseCheckNotifications(): Promise<NotificationItem[]> {
  const awaiting = (await getAllAnimals()).filter((animal) => animal.currentStatus === "Awaiting Release");
  // Checked in parallel; results keep the animals' original order.
  const checked = await Promise.all(
    awaiting.map(async (animal) => ({
      animal,
      fit: await isFitForRelease(animal.animalId),
      latest: await getLatestPreReleaseCheck(animal.animalId),
    })),
  );
  const items: NotificationItem[] = [];
  for (const { animal, fit, latest } of checked) {
    if (fit) continue;
    items.push({
      id: `pre-release-${animal.animalId}`,
      type: "Pre-Release Check",
      title: "Pre-Release Check required",
      detail: `${animal.name} is awaiting a Pre-Release Check before being released to their adopter.`,
      createdAt: latest?.createdAt ?? animal.statusUpdatedAt,
      roles: ["Veterinarian", "Administrator"],
      defaultRead: false,
    });
  }
  return items;
}

// FR-NOT-01 "Follow Up Visit due".
async function getFollowUpVisitNotifications(): Promise<NotificationItem[]> {
  return (await listActiveFollowUpVisits()).flatMap((visit) => {
    if (daysUntil(visit.targetDate) > REMINDER_LEAD_DAYS) return [];
    const item: NotificationItem = {
      id: `follow-up-${visit.followUpVisitId}`,
      type: "Follow Up Visit",
      title: "Follow up visit due",
      detail: `A ${visit.followUpType.toLowerCase()} follow-up for ${visit.animalName} is due.`,
      createdAt: visit.createdAt,
      dueDate: visit.targetDate,
      roles: ["Shelter Staff Member", "Administrator"],
      defaultRead: false,
    };
    return [item];
  });
}

// The roles each notification type is for (matches the roles each
// generator stamps on its items). getAllNotifications(role) runs only the
// types that role can receive - besides saving work, an Adopter or Council
// Officer then never reads staff-only collections (holds, medical
// records, ...), which the API no longer serves to those roles.
const STAFF_AND_ADMIN: Role[] = ["Shelter Staff Member", "Administrator"];
const VET_AND_ADMIN: Role[] = ["Veterinarian", "Administrator"];
const GENERATORS: { roles: Role[]; run: () => Promise<NotificationItem[]> }[] = [
  { roles: STAFF_AND_ADMIN, run: getStatutoryHoldNotifications },
  { roles: STAFF_AND_ADMIN, run: getBehaviourReassessmentNotifications },
  { roles: VET_AND_ADMIN, run: getVaccineBoosterNotifications },
  { roles: VET_AND_ADMIN, run: getDesexingAppointmentNotifications },
  { roles: ["Adopter"], run: getApplicationDecisionNotifications },
  { roles: [...STAFF_AND_ADMIN, "Adopter"], run: getMeetAndGreetNotifications },
  { roles: VET_AND_ADMIN, run: getPreReleaseCheckNotifications },
  { roles: STAFF_AND_ADMIN, run: getFollowUpVisitNotifications },
];

export async function getAllNotifications(role?: Role): Promise<NotificationItem[]> {
  const generators = GENERATORS.filter((g) => !role || g.roles.includes(role));
  const results = await Promise.all(generators.map((g) => g.run()));
  return [...results.flat(), ...getMockNotifications()];
}
