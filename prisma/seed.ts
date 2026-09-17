// Relative imports (not the "@/..." alias) - this script runs standalone
// via tsx, outside Next.js's bundler, which is what resolves that alias.
import { db } from "../lib/db/client";
import { DEMO_ACCOUNTS } from "../lib/auth/demo-accounts";
import { MOCK_ANIMALS } from "../lib/animals/mock-animals";

// Recreates the PRD 4.2 demo accounts and PRD 12.1 seed animals in the
// database. Run with `npm run db:seed`. Safe to re-run: existing rows are
// replaced.
async function main() {
  for (const account of DEMO_ACCOUNTS) {
    await db.orm.User.upsert({
      // No conflictOn: the primary key (id) is the conflict target.
      create: {
        id: account.userId,
        email: account.email.toLowerCase(),
        password: account.password,
        role: account.role,
        status: account.status,
        title: account.title,
        firstName: account.firstName,
        lastName: account.lastName,
        phone: account.phone,
        signUpAt: new Date(account.signUpAt),
        failedLoginAttempts: 0,
      },
      update: {
        email: account.email.toLowerCase(),
        password: account.password,
        role: account.role,
        status: account.status,
        title: account.title,
        firstName: account.firstName,
        lastName: account.lastName,
        phone: account.phone,
      },
    });
    console.log(`Seeded ${account.role}: ${account.email}`);
  }

  for (const animal of MOCK_ANIMALS) {
    const row = {
      animalId: animal.animalId,
      shelterId: animal.shelterId,
      name: animal.name,
      species: animal.species,
      breed: animal.breed,
      breedDescription: animal.breedDescription,
      sex: animal.sex,
      dateOfBirth: animal.dateOfBirth ?? null,
      estimatedAge: animal.estimatedAge ?? null,
      coatColour: animal.coatColour,
      coatMarkings: animal.coatMarkings,
      microchipNumber: animal.microchipNumber ?? null,
      generalDescription: animal.generalDescription,
      temperaments: JSON.stringify(animal.temperaments),
      adoptionFee: animal.adoptionFee ?? null,
      currentStatus: animal.currentStatus,
      listingStatus: animal.listingStatus,
      statusUpdatedAt: new Date(animal.statusUpdatedAt),
      enteredAt: new Date(animal.enteredAt),
      lastModifiedAt: new Date(animal.lastModifiedAt),
      intakeSource: animal.intakeSource,
      linkedPersonRole: animal.linkedPerson?.role ?? null,
      linkedPersonName: animal.linkedPerson?.name ?? null,
    };
    await db.orm.Animal.upsert({
      // No conflictOn: the primary key (animalId) is the conflict target.
      create: row,
      update: row,
    });
    console.log(`Seeded animal: ${animal.name} (${animal.animalId})`);
  }

  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
