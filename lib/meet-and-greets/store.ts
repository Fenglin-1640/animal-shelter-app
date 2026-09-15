import { closeApplicationIncompatible, getApplication } from "@/lib/applications/store";
import type { MeetAndGreet } from "@/lib/meet-and-greets/types";

// FR-MG-01: MeetAndGreet records, persisted to localStorage since there
// is no backend.
const STORAGE_KEY = "asams-meet-and-greets";

function loadAll(): MeetAndGreet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MeetAndGreet[]) : [];
  } catch {
    return [];
  }
}

function saveAll(all: MeetAndGreet[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function generateId(): string {
  return `MG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function getMeetAndGreetForApplication(applicationId: string): MeetAndGreet | undefined {
  return loadAll().find((m) => m.applicationId === applicationId);
}

export function listMyMeetAndGreets(email: string): MeetAndGreet[] {
  const normalized = email.trim().toLowerCase();
  return loadAll()
    .filter((m) => m.adopterEmail.toLowerCase() === normalized)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getMeetAndGreet(meetAndGreetId: string): MeetAndGreet | undefined {
  return loadAll().find((m) => m.meetAndGreetId === meetAndGreetId);
}

// FR-NOT-01 "Meet and Greet scheduled": every Meet and Greet with a
// confirmed date (Adopter has picked a slot), across all applicants.
export function listScheduledMeetAndGreets(): MeetAndGreet[] {
  return loadAll().filter((m) => m.status === "Scheduled");
}

export type MutationResult = { ok: true } | { ok: false; reason: string };

// PRD: "只有 Approved Application 可安排 Meet and Greet。Staff 创建可选时段".
export function proposeSlots(
  applicationId: string,
  slots: { dateTime: string; location: string }[],
  participants: string,
  email: string,
  name: string,
): MutationResult {
  const application = getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };
  if (application.applicationStatus !== "Approved") return { ok: false, reason: "not_approved" };
  if (slots.length === 0) return { ok: false, reason: "no_slots" };
  if (getMeetAndGreetForApplication(applicationId)) return { ok: false, reason: "already_exists" };

  const now = new Date().toISOString();
  const meetAndGreet: MeetAndGreet = {
    meetAndGreetId: generateId(),
    applicationId,
    animalId: application.animalId,
    animalName: application.animalName,
    animalSpecies: application.animalSpecies,
    adopterEmail: application.adopterEmail,
    adopterName: application.adopterName,
    slotOptions: slots.map((s) => ({ id: `SLOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, ...s })),
    participants,
    staffNotes: "",
    status: "Proposed",
    attendanceConfirmed: false,
    createdByEmail: email,
    createdByName: name,
    createdAt: now,
    updatedAt: now,
  };
  saveAll([...loadAll(), meetAndGreet]);
  return { ok: true };
}

// PRD: "Adopter 可选择或确认其中一个时段".
export function selectSlot(meetAndGreetId: string, slotId: string): MutationResult {
  const all = loadAll();
  const index = all.findIndex((m) => m.meetAndGreetId === meetAndGreetId);
  if (index === -1) return { ok: false, reason: "not_found" };
  const slot = all[index].slotOptions.find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: "slot_not_found" };

  all[index] = {
    ...all[index],
    selectedSlotId: slotId,
    scheduledDate: slot.dateTime,
    location: slot.location,
    status: "Scheduled",
    updatedAt: new Date().toISOString(),
  };
  saveAll(all);
  return { ok: true };
}

// PRD: "Adopter 可查看预约并记录出席状态".
export function confirmAttendance(meetAndGreetId: string): MutationResult {
  const all = loadAll();
  const index = all.findIndex((m) => m.meetAndGreetId === meetAndGreetId);
  if (index === -1) return { ok: false, reason: "not_found" };
  all[index] = { ...all[index], attendanceConfirmed: true, updatedAt: new Date().toISOString() };
  saveAll(all);
  return { ok: true };
}

// PRD: Compatible enters Agreement/Payment (no Animal or Application
// status change of its own - Approved already covers "proceeding").
// Incompatible closes the Application and returns the Animal to
// Available For Adoption via lib/applications/store.ts's
// closeApplicationIncompatible().
export function recordOutcome(
  meetAndGreetId: string,
  outcome: "Compatible" | "Incompatible",
  reason: string,
  staffNotes: string,
  email: string,
  name: string,
): MutationResult {
  const all = loadAll();
  const index = all.findIndex((m) => m.meetAndGreetId === meetAndGreetId);
  if (index === -1) return { ok: false, reason: "not_found" };
  if (outcome === "Incompatible" && !reason.trim()) return { ok: false, reason: "reason_required" };

  const meetAndGreet = all[index];
  all[index] = {
    ...meetAndGreet,
    status: outcome,
    outcome,
    outcomeReason: outcome === "Incompatible" ? reason.trim() : undefined,
    staffNotes,
    updatedAt: new Date().toISOString(),
  };
  saveAll(all);

  if (outcome === "Incompatible") {
    closeApplicationIncompatible(meetAndGreet.applicationId, reason, email, name);
  }

  return { ok: true };
}
