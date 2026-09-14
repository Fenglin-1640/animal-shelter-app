import type { Species } from "@/lib/animals/types";

// FR-MG-01 / PRD 8.3 MeetAndGreet: appointment, attendance and
// compatibility outcome, scoped to the Adopter's own read-only view.
export type MeetAndGreetStatus = "Scheduled" | "Compatible" | "Incompatible";

export interface AdopterMeetAndGreet {
  meetAndGreetId: string;
  adopterEmail: string;
  applicationId: string;
  animalId: string;
  animalName: string;
  animalSpecies: Species;
  scheduledDate: string;
  location: string;
  participants: string;
  status: MeetAndGreetStatus;
  outcomeNotes?: string;
  nextStep?: string;
}
