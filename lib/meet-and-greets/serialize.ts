import type { Species } from "@/lib/animals/types";
import type { MeetAndGreet, MeetAndGreetSlotOption, MeetAndGreetStatus } from "@/lib/meet-and-greets/types";

export interface MeetAndGreetRow
  extends Omit<
    MeetAndGreet,
    | "animalSpecies"
    | "slotOptions"
    | "selectedSlotId"
    | "scheduledDate"
    | "location"
    | "status"
    | "attendanceConfirmed"
    | "outcome"
    | "outcomeReason"
    | "createdAt"
    | "updatedAt"
  > {
  animalSpecies: string;
  slotOptions: string;
  selectedSlotId: string | null;
  scheduledDate: string | null;
  location: string | null;
  status: string;
  attendanceConfirmed: number;
  outcome: string | null;
  outcomeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toMeetAndGreet(row: MeetAndGreetRow): MeetAndGreet {
  return {
    ...row,
    animalSpecies: row.animalSpecies as Species,
    slotOptions: JSON.parse(row.slotOptions) as MeetAndGreetSlotOption[],
    selectedSlotId: row.selectedSlotId ?? undefined,
    scheduledDate: row.scheduledDate ?? undefined,
    location: row.location ?? undefined,
    status: row.status as MeetAndGreetStatus,
    attendanceConfirmed: row.attendanceConfirmed === 1,
    outcome: (row.outcome as "Compatible" | "Incompatible" | null) ?? undefined,
    outcomeReason: row.outcomeReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMeetAndGreetRowPatch(patch: Partial<MeetAndGreet>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "slotOptions") {
      row[key] = JSON.stringify(value);
    } else if (key === "attendanceConfirmed") {
      row[key] = value ? 1 : 0;
    } else if (key === "createdAt" || key === "updatedAt") {
      row[key] = typeof value === "string" ? new Date(value) : value;
    } else {
      row[key] = value;
    }
  }
  return row;
}
