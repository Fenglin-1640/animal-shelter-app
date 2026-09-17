import type { Animal, LinkedPerson } from "@/lib/animals/types";

// Server-side row shape returned by the Prisma 8 contract client for the
// Animal model (see prisma/contract.prisma).
export interface AnimalRow {
  animalId: string;
  shelterId: string;
  name: string;
  species: string;
  breed: string;
  breedDescription: string;
  sex: string;
  dateOfBirth: string | null;
  estimatedAge: string | null;
  coatColour: string;
  coatMarkings: string;
  microchipNumber: string | null;
  generalDescription: string;
  temperaments: string;
  adoptionFee: number | null;
  currentStatus: string;
  listingStatus: string;
  statusUpdatedAt: Date;
  enteredAt: Date;
  lastModifiedAt: Date;
  intakeSource: string;
  linkedPersonRole: string | null;
  linkedPersonName: string | null;
}

export function toAnimal(row: AnimalRow): Animal {
  return {
    animalId: row.animalId,
    shelterId: row.shelterId,
    name: row.name,
    species: row.species as Animal["species"],
    breed: row.breed,
    breedDescription: row.breedDescription,
    sex: row.sex as Animal["sex"],
    dateOfBirth: row.dateOfBirth ?? undefined,
    estimatedAge: row.estimatedAge ?? undefined,
    coatColour: row.coatColour,
    coatMarkings: row.coatMarkings,
    microchipNumber: row.microchipNumber ?? undefined,
    generalDescription: row.generalDescription,
    temperaments: JSON.parse(row.temperaments) as string[],
    adoptionFee: row.adoptionFee ?? undefined,
    currentStatus: row.currentStatus as Animal["currentStatus"],
    listingStatus: row.listingStatus as Animal["listingStatus"],
    statusUpdatedAt: row.statusUpdatedAt.toISOString(),
    enteredAt: row.enteredAt.toISOString(),
    lastModifiedAt: row.lastModifiedAt.toISOString(),
    intakeSource: row.intakeSource,
    linkedPerson:
      row.linkedPersonRole && row.linkedPersonName
        ? ({ role: row.linkedPersonRole, name: row.linkedPersonName } as LinkedPerson)
        : undefined,
  };
}

// Translates a client-supplied Partial<Animal> patch (same field names as
// the Animal type) into the DB column shape - linkedPerson flattens to two
// columns, temperaments is JSON-encoded, the *At fields become Dates.
export function toAnimalRowPatch(patch: Partial<Animal>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "linkedPerson") {
      const linkedPerson = value as Animal["linkedPerson"];
      row.linkedPersonRole = linkedPerson?.role ?? null;
      row.linkedPersonName = linkedPerson?.name ?? null;
    } else if (key === "temperaments") {
      row.temperaments = JSON.stringify(value);
    } else if (key === "statusUpdatedAt" || key === "enteredAt" || key === "lastModifiedAt") {
      row[key] = typeof value === "string" ? new Date(value) : value;
    } else {
      row[key] = value;
    }
  }
  return row;
}
