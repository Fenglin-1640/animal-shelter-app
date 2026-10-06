import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toAnimal } from "@/lib/animals/serialize";
import type { Animal } from "@/lib/animals/types";
import { requireRole } from "@/lib/auth/server-session";
import { toPublicAnimal } from "@/lib/animals/public";
import { ALL_ROLES, STAFF, seesAllRecords } from "@/lib/auth/api-roles";

// FR-AN-01: the Animals list (and every screen that reads all animals -
// Adoption Listings, Archive Search, Work Queues, statistics, ...).
export async function GET() {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.Animal.where({}).all();
  const animals = rows.map(toAnimal);
  // Adopters and Council Officers get public fields only (PRD 9.1).
  return NextResponse.json({ animals: seesAllRecords(auth.role) ? animals : animals.map(toPublicAnimal) });
}

// FR-INT-03: Finalise Intake creates the Animal record. The client
// (app/api/intake-records/finalise) already builds the full
// Animal object, including animalId/shelterId - this is a thin insert.
export async function POST(request: Request) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
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
    statusUpdatedAt: toTimestamptz(body.statusUpdatedAt),
    enteredAt: toTimestamptz(body.enteredAt),
    lastModifiedAt: toTimestamptz(body.lastModifiedAt),
    intakeSource: body.intakeSource,
    linkedPersonRole: body.linkedPerson?.role ?? null,
    linkedPersonName: body.linkedPerson?.name ?? null,
  });
  return NextResponse.json({ ok: true, animal: toAnimal(created) });
}
