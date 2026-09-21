import { closeApplicationIncompatible, getApplication } from "@/lib/applications/store";
import type { MeetAndGreet } from "@/lib/meet-and-greets/types";

// FR-MG-01: MeetAndGreet now lives in the database (see
// prisma/contract.prisma) behind /api/meet-and-greets - see
// prisma/README.md for this Prisma toolchain's quirks.

async function fetchAll(): Promise<MeetAndGreet[]> {
  const response = await fetch("/api/meet-and-greets");
  const result = await response.json();
  return result.items as MeetAndGreet[];
}

async function patchMeetAndGreet(meetAndGreetId: string, patch: Partial<MeetAndGreet>): Promise<MutationResult> {
  const response = await fetch(`/api/meet-and-greets/${meetAndGreetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const result = await response.json();
  if (!result.ok) return { ok: false, reason: result.reason ?? "not_found" };
  return { ok: true };
}

function generateId(): string {
  return `MG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function getMeetAndGreetForApplication(applicationId: string): Promise<MeetAndGreet | undefined> {
  return (await fetchAll()).find((m) => m.applicationId === applicationId);
}

export async function listMyMeetAndGreets(email: string): Promise<MeetAndGreet[]> {
  const normalized = email.trim().toLowerCase();
  return (await fetchAll())
    .filter((m) => m.adopterEmail.toLowerCase() === normalized)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getMeetAndGreet(meetAndGreetId: string): Promise<MeetAndGreet | undefined> {
  return (await fetchAll()).find((m) => m.meetAndGreetId === meetAndGreetId);
}

// For the Adopter "My Meet and Greets" nav badge
// (lib/pending-actions/registry.ts) - a slot the Adopter still needs to
// pick (Proposed), or a scheduled visit they haven't yet confirmed
// attendance for (Scheduled, attendanceConfirmed false). Matches the two
// action states meet-and-greet-detail-screen.tsx actually renders a
// button for.
export async function countPendingForAdopter(email: string): Promise<number> {
  const mine = await listMyMeetAndGreets(email);
  return mine.filter(
    (m) => m.status === "Proposed" || (m.status === "Scheduled" && !m.attendanceConfirmed),
  ).length;
}

// FR-NOT-01 "Meet and Greet scheduled": every Meet and Greet with a
// confirmed date (Adopter has picked a slot), across all applicants.
export async function listScheduledMeetAndGreets(): Promise<MeetAndGreet[]> {
  return (await fetchAll()).filter((m) => m.status === "Scheduled");
}

export type MutationResult = { ok: true } | { ok: false; reason: string };

// PRD: "只有 Approved Application 可安排 Meet and Greet。Staff 创建可选时段".
export async function proposeSlots(
  applicationId: string,
  slots: { dateTime: string; location: string }[],
  participants: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const application = await getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };
  if (application.applicationStatus !== "Approved") return { ok: false, reason: "not_approved" };
  if (slots.length === 0) return { ok: false, reason: "no_slots" };
  if (await getMeetAndGreetForApplication(applicationId)) return { ok: false, reason: "already_exists" };

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
  await fetch("/api/meet-and-greets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meetAndGreet),
  });
  return { ok: true };
}

// PRD: "Adopter 可选择或确认其中一个时段".
export async function selectSlot(meetAndGreetId: string, slotId: string): Promise<MutationResult> {
  const meetAndGreet = await getMeetAndGreet(meetAndGreetId);
  if (!meetAndGreet) return { ok: false, reason: "not_found" };
  if (meetAndGreet.status !== "Proposed") return { ok: false, reason: "not_proposed" };
  const slot = meetAndGreet.slotOptions.find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: "slot_not_found" };

  return patchMeetAndGreet(meetAndGreetId, {
    selectedSlotId: slotId,
    scheduledDate: slot.dateTime,
    location: slot.location,
    status: "Scheduled",
    updatedAt: new Date().toISOString(),
  });
}

// PRD: "Adopter 可查看预约并记录出席状态".
export async function confirmAttendance(meetAndGreetId: string): Promise<MutationResult> {
  const meetAndGreet = await getMeetAndGreet(meetAndGreetId);
  if (!meetAndGreet) return { ok: false, reason: "not_found" };
  if (meetAndGreet.status !== "Scheduled") return { ok: false, reason: "not_scheduled" };

  return patchMeetAndGreet(meetAndGreetId, {
    attendanceConfirmed: true,
    updatedAt: new Date().toISOString(),
  });
}

// PRD: Compatible enters Agreement/Payment (no Animal or Application
// status change of its own - Approved already covers "proceeding").
// Incompatible closes the Application and returns the Animal to
// Available For Adoption via lib/applications/store.ts's
// closeApplicationIncompatible().
export async function recordOutcome(
  meetAndGreetId: string,
  outcome: "Compatible" | "Incompatible",
  reason: string,
  staffNotes: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const meetAndGreet = await getMeetAndGreet(meetAndGreetId);
  if (!meetAndGreet) return { ok: false, reason: "not_found" };
  if (meetAndGreet.status !== "Scheduled") return { ok: false, reason: "not_scheduled" };
  if (outcome === "Incompatible" && !reason.trim()) return { ok: false, reason: "reason_required" };

  const result = await patchMeetAndGreet(meetAndGreetId, {
    status: outcome,
    outcome,
    outcomeReason: outcome === "Incompatible" ? reason.trim() : undefined,
    staffNotes,
    updatedAt: new Date().toISOString(),
  });
  if (!result.ok) return result;

  if (outcome === "Incompatible") {
    await closeApplicationIncompatible(meetAndGreet.applicationId, reason, email, name);
  }

  return { ok: true };
}
