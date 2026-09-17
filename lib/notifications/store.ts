import { getAllAnimals, getAnimalById } from "@/lib/animals/animal-store";
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
import { listHoldsNeedingReminder } from "@/lib/statutory-hold/store";

// FR-NOT-01: 8 of the 9 event types are now dynamically computed from
// real feature data, following the FR-MC-02 "Statutory Hold approaching
// end date" precedent below. Only "Backup Job failure" stays simulated
// (lib/mock-notifications.ts) - PRD 8.3 itself frames BackupRun /
// RecoveryTest as "原型中的备份状态与恢复测试证据" (prototype evidence of backup
// status), not a real subsystem this client-side/localStorage prototype
// has anything to actually back up or fail for real.
const REMINDER_LEAD_DAYS = 7;
const RECENT_DECISION_WINDOW_DAYS = 14;

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

// FR-MC-02 step 4 / FR-NOT-01 "Statutory Hold approaching end date".
// Computed live from StatutoryHold records rather than persisted as its
// own record, since it's fully derived from data that already exists.
async function getStatutoryHoldNotifications(): Promise<NotificationItem[]> {
  const holds = await listHoldsNeedingReminder();
  const items: NotificationItem[] = [];
  for (const hold of holds) {
    const animal = await getAnimalById(hold.animalId);
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
  const assessments = await listAssessmentsNeedingReassessment();
  const items: NotificationItem[] = [];
  for (const assessment of assessments) {
    if (!assessment.reassessmentDate || daysUntil(assessment.reassessmentDate) > REMINDER_LEAD_DAYS) continue;
    const animal = await getAnimalById(assessment.animalId);
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
  const latestByAnimalAndType = new Map<string, VaccinationRecord>();
  for (const v of await listAllVaccinations()) {
    const key = `${v.animalId}::${v.vaccineType}`;
    const existing = latestByAnimalAndType.get(key);
    if (!existing || new Date(v.administrationDate) > new Date(existing.administrationDate)) {
      latestByAnimalAndType.set(key, v);
    }
  }

  const items: NotificationItem[] = [];
  for (const v of latestByAnimalAndType.values()) {
    if (daysUntil(v.nextBoosterDueDate) > REMINDER_LEAD_DAYS) continue;
    const animal = await getAnimalById(v.animalId);
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
  const items: NotificationItem[] = [];
  for (const d of await listScheduledDesexing()) {
    if (daysUntil(d.scheduledDate) > REMINDER_LEAD_DAYS) continue;
    const animal = await getAnimalById(d.animalId);
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
function getMeetAndGreetNotifications(): NotificationItem[] {
  return listScheduledMeetAndGreets().flatMap((meetAndGreet) => {
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
  const animals = await getAllAnimals();
  const items: NotificationItem[] = [];
  for (const animal of animals) {
    if (animal.currentStatus !== "Awaiting Release" || (await isFitForRelease(animal.animalId))) continue;
    const latest = await getLatestPreReleaseCheck(animal.animalId);
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
function getFollowUpVisitNotifications(): NotificationItem[] {
  return listActiveFollowUpVisits().flatMap((visit) => {
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

export async function getAllNotifications(): Promise<NotificationItem[]> {
  const [statutoryHold, behaviourReassessment, vaccineBooster, desexingAppointment, preReleaseCheck, applicationDecision] =
    await Promise.all([
      getStatutoryHoldNotifications(),
      getBehaviourReassessmentNotifications(),
      getVaccineBoosterNotifications(),
      getDesexingAppointmentNotifications(),
      getPreReleaseCheckNotifications(),
      getApplicationDecisionNotifications(),
    ]);
  return [
    ...statutoryHold,
    ...behaviourReassessment,
    ...vaccineBooster,
    ...desexingAppointment,
    ...applicationDecision,
    ...getMeetAndGreetNotifications(),
    ...preReleaseCheck,
    ...getFollowUpVisitNotifications(),
    ...getMockNotifications(),
  ];
}
