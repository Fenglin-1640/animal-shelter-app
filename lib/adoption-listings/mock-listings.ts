import { getAllAnimals } from "@/lib/animals/animal-store";
import { getDisplayAge } from "@/lib/animals/age";
import type { PublicListing } from "@/lib/adoption-listings/types";

// FR-LIST-02: only listingStatus = Current animals are publicly listed.
// BR-008: only Available For Adoption animals accept new applications;
// an Application In Progress animal stays listed but stops accepting them.
export function getPublicListings(): PublicListing[] {
  return getAllAnimals().filter((animal) => animal.listingStatus === "Current").map(
    (animal) => ({
      animalId: animal.animalId,
      shelterId: animal.shelterId,
      name: animal.name,
      species: animal.species,
      breed: animal.breed,
      sex: animal.sex,
      age: getDisplayAge(animal),
      temperaments: animal.temperaments,
      adoptionFee: animal.adoptionFee,
      generalDescription: animal.generalDescription,
      acceptingApplications: animal.currentStatus === "Available For Adoption",
    }),
  );
}
