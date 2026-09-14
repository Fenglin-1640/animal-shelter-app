import type { AdopterApplication } from "@/lib/applications/types";

// Sample data only: Submit Adoption Application (FR-APP-01) isn't built
// yet. These continue the story already seeded in lib/animals/mock-animals
// (Charlie is Application In Progress; Daisy's linked adopter is Jordan
// Taylor, the demo Adopter account) rather than inventing unrelated data.
const MOCK_APPLICATIONS: AdopterApplication[] = [
  {
    applicationId: "APP-1001",
    adopterEmail: "adopter@asams.demo",
    animalId: "A-0001",
    animalName: "Luna",
    animalSpecies: "Cat",
    animalBreed: "Ragdoll",
    applicationStatus: "Draft",
    nextStep: "Finish and submit your application to proceed.",
  },
  {
    applicationId: "APP-1002",
    adopterEmail: "adopter@asams.demo",
    animalId: "A-0007",
    animalName: "Charlie",
    animalSpecies: "Dog",
    animalBreed: "Golden Retriever",
    submissionDate: "2024-01-28T09:00:00.000Z",
    decisionDate: "2024-02-05T09:00:00.000Z",
    applicationStatus: "Approved",
    nextStep: "Schedule a Meet and Greet to continue.",
  },
  {
    applicationId: "APP-1003",
    adopterEmail: "adopter@asams.demo",
    animalId: "A-0008",
    animalName: "Daisy",
    animalSpecies: "Cat",
    animalBreed: "Siamese",
    submissionDate: "2023-12-10T09:00:00.000Z",
    decisionDate: "2023-12-20T09:00:00.000Z",
    applicationStatus: "Finalised",
    nextStep: "Daisy's adoption is finalised; she is awaiting her pre-release check.",
  },
];

export function getMyApplications(email: string): AdopterApplication[] {
  const normalized = email.trim().toLowerCase();
  return MOCK_APPLICATIONS.filter(
    (application) => application.adopterEmail.toLowerCase() === normalized,
  );
}
