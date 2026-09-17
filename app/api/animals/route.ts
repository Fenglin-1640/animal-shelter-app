import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAnimal } from "@/lib/animals/serialize";
import type { Animal } from "@/lib/animals/types";

// FR-AN-01: the Animals list (and every screen that reads all animals -
// Adoption Listings, Archive Search, Work Queues, statistics, ...).
export async function GET() {
  const rows = await db.orm.Animal.where({}).all();
  return NextResponse.json({ animals: rows.map(toAnimal) });
}

// FR-INT-03: Finalise Intake creates the Animal record. The client
// (lib/animals/animal-store.ts's addAnimal()) already builds the full
// Animal object, including animalId/shelterId - this is a thin insert.
export async function POST(request: Request) {
  const body = (await request.json()) as Animal;
  const created = await db.orm.Animal.create({
    animalId: body.animalId,
    shelterId: body.shelterId,
    name: body.name,
    species: body.species,
    breed: body.breed,
    breedDescription: body.breedDescription,
    sex: body.sex,
    dateOfBirth: body.dateOfBirth ?? null,
    estimatedAge: body.estimatedAge ?? null,
    coatColour: body.coatColour,
    coatMarkings: body.coatMarkings,
    microchipNumber: body.microchipNumber ?? null,
    generalDescription: body.generalDescription,
    temperaments: JSON.stringify(body.temperaments),
    adoptionFee: body.adoptionFee ?? null,
    currentStatus: body.currentStatus,
    listingStatus: body.listingStatus,
    statusUpdatedAt: new Date(body.statusUpdatedAt),
    enteredAt: new Date(body.enteredAt),
    lastModifiedAt: new Date(body.lastModifiedAt),
    intakeSource: body.intakeSource,
    linkedPersonRole: body.linkedPerson?.role ?? null,
    linkedPersonName: body.linkedPerson?.name ?? null,
  });
  return NextResponse.json({ ok: true, animal: toAnimal(created) });
}
