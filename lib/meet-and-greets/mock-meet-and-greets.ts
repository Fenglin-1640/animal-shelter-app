import type { AdopterMeetAndGreet } from "@/lib/meet-and-greets/types";

// Sample data only: Schedule/Conduct Meet and Greet (FR-MG-01) isn't
// built yet. Continues the story already seeded in
// lib/applications/mock-applications: Charlie's application is Approved
// (Meet and Greet upcoming) and Daisy's outcome was Compatible, which is
// why her application later reached Finalised.
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

const MOCK_MEET_AND_GREETS: AdopterMeetAndGreet[] = [
  {
    meetAndGreetId: "MG-2001",
    adopterEmail: "adopter@asams.demo",
    applicationId: "APP-1002",
    animalId: "A-0007",
    animalName: "Charlie",
    animalSpecies: "Dog",
    scheduledDate: daysFromNow(3),
    location: "ASAMS Shelter - Meet and Greet Room",
    participants: "Jordan Taylor (Adopter), Daniel Lee (Staff)",
    status: "Scheduled",
    nextStep: "Confirm your attendance ahead of the visit.",
  },
  {
    meetAndGreetId: "MG-1998",
    adopterEmail: "adopter@asams.demo",
    applicationId: "APP-1003",
    animalId: "A-0008",
    animalName: "Daisy",
    animalSpecies: "Cat",
    scheduledDate: "2023-12-18T10:00:00.000Z",
    location: "ASAMS Shelter - Meet and Greet Room",
    participants: "Jordan Taylor (Adopter), Daniel Lee (Staff)",
    status: "Compatible",
    outcomeNotes: "Daisy was relaxed and social during the visit; a good match.",
    nextStep: "Your adoption agreement and payment were completed next.",
  },
];

export function getMyMeetAndGreets(email: string): AdopterMeetAndGreet[] {
  const normalized = email.trim().toLowerCase();
  return MOCK_MEET_AND_GREETS.filter(
    (meetAndGreet) => meetAndGreet.adopterEmail.toLowerCase() === normalized,
  );
}
