import type { AdopterAgreement } from "@/lib/agreements/types";

// Sample data only: generating and signing an Adoption Agreement
// (FR-AGR-01) isn't built yet. Continues the story already seeded in
// lib/meet-and-greets/mock-meet-and-greets: Staff can generate an
// agreement in parallel with scheduling Charlie's Meet and Greet (PRD
// 6.13 allows agreement and payment to proceed in parallel), while
// Daisy's was already signed on the way to her Finalised application.
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

const STANDARD_CONDITIONS =
  "Standard adoption conditions apply, including desexing and registration requirements.";
const STANDARD_RETURN_POLICY = "14 days";

const MOCK_AGREEMENTS: AdopterAgreement[] = [
  {
    agreementId: "AGR-3001",
    adopterEmail: "adopter@asams.demo",
    applicationId: "APP-1002",
    animalId: "A-0007",
    animalName: "Charlie",
    animalSpecies: "Dog",
    agreementVersion: "v1.0",
    adoptionConditions: STANDARD_CONDITIONS,
    returnPolicyPeriod: STANDARD_RETURN_POLICY,
    generatedAt: daysFromNow(-1),
    isSigned: false,
    nextStep: "Sign your adoption agreement to continue.",
  },
  {
    agreementId: "AGR-2987",
    adopterEmail: "adopter@asams.demo",
    applicationId: "APP-1003",
    animalId: "A-0008",
    animalName: "Daisy",
    animalSpecies: "Cat",
    agreementVersion: "v1.0",
    adoptionConditions: STANDARD_CONDITIONS,
    returnPolicyPeriod: STANDARD_RETURN_POLICY,
    generatedAt: "2023-12-19T09:00:00.000Z",
    isSigned: true,
    signedDate: "2023-12-19T15:30:00.000Z",
    nextStep: "Your adoption agreement is signed and on file.",
  },
];

export function getMyAgreements(email: string): AdopterAgreement[] {
  const normalized = email.trim().toLowerCase();
  return MOCK_AGREEMENTS.filter(
    (agreement) => agreement.adopterEmail.toLowerCase() === normalized,
  );
}
