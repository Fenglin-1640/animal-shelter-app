import { getAllAnimals } from "@/lib/animals/animal-store";
import { getDisplayAge } from "@/lib/animals/age";
import { getPrimaryPhoto } from "@/lib/photos/store";
import type { PublicListing } from "@/lib/adoption-listings/types";

// FR-LIST-02: only listingStatus = Current animals are publicly listed.
// BR-008: only Available For Adoption animals accept new applications;
// an Application In Progress animal stays listed but stops accepting them.
export async function getPublicListings(): Promise<PublicListing[]> {
  const animals = await getAllAnimals();
  const listed = animals.filter((animal) => animal.listingStatus === "Current");
  return Promise.all(
    listed.map(async (animal) => {
      const photo = await getPrimaryPhoto(animal.animalId);
      return {
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
        photoAltText: photo?.altText,
        photoDataUrl: photo?.imageData,
      };
    }),
  );
}
