import type { Animal } from "@/lib/animals/types";

// PRD 9.1: Adopters (and Council Officers, who see public listing
// information only) get an animal's public fields. Microchip number,
// owner/linked-person history and intake source are internal and are
// blanked out; everything the listing, application, agreement and Meet
// and Greet screens show stays.
export function toPublicAnimal(animal: Animal): Animal {
  return {
    ...animal,
    microchipNumber: undefined,
    linkedPerson: undefined,
    intakeSource: "",
  };
}
