import type { Species } from "@/lib/animals/types";

// FR-MG-01 / PRD 8.3 MeetAndGreet. "Staff 创建可选时段，Adopter 可选择或确认其中一个
// 时段" describes a two-phase flow (Staff proposes slot options, Adopter
// picks one) not captured by a single scheduledDate field alone, so
// "Proposed" is added as a status ahead of the PRD-named "Scheduled" one.
export type MeetAndGreetStatus = "Proposed" | "Scheduled" | "Compatible" | "Incompatible";

export interface MeetAndGreetSlotOption {
  id: string;
  dateTime: string;
  location: string;
}

export interface MeetAndGreet {
  meetAndGreetId: string;
  applicationId: string;
  animalId: string;
  animalName: string;
  animalSpecies: Species;
  adopterEmail: string;
  adopterName: string;
  slotOptions: MeetAndGreetSlotOption[];
  selectedSlotId?: string;
  scheduledDate?: string;
  location?: string;
  participants: string;
  staffNotes: string;
  status: MeetAndGreetStatus;
  attendanceConfirmed: boolean;
  outcome?: "Compatible" | "Incompatible";
  outcomeReason?: string;
  createdByEmail: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
