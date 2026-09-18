// Relative imports (not the "@/..." alias) - this script runs standalone
// via tsx, outside Next.js's bundler, which is what resolves that alias.
import { db } from "../lib/db/client";
import { DEMO_ACCOUNTS } from "../lib/auth/demo-accounts";
import { MOCK_ANIMALS } from "../lib/animals/mock-animals";
import type { AdopterProfile } from "../lib/adopter-profile/types";
import { buildSeedOptions } from "../lib/system-administration/seed-options";
import { DEFAULT_SYSTEM_SETTINGS } from "../lib/system-administration/settings-types";

// The demo Adopter (Jordan Taylor) already has applications and an
// upcoming Meet and Greet seeded elsewhere, so a completed profile here
// continues that story. Any other Adopter starts from
// EMPTY_ADOPTER_PROFILE (lib/adopter-profile/store.ts's runtime
// fallback for a row that doesn't exist here).
const DEMO_ADOPTER_PROFILE: AdopterProfile = {
  residentialAddress: "12 Wattle Street, Brisbane QLD 4000",
  householdType: "House",
  homeOwnership: "Own",
  landlordPermission: false,
  adultsInHousehold: "2",
  childrenInHousehold: "0",
  hasExistingPets: true,
  existingPetDetails: "One desexed male cat, aged 5, fully vaccinated.",
  environmentDetails:
    "Fully fenced backyard with secure gates; pets are kept indoors overnight.",
  hoursAlone: "2-4 hours",
  preferredSpecies: ["Cat", "Dog"],
  refereeName: "Alex Morgan",
  refereeRelationship: "Neighbour",
  refereePhone: "+61 4 1234 5678",
  refereeEmail: "alex.morgan@example.com",
  refereeConsent: true,
  refereeConsentAt: "2023-11-20T09:00:00.000Z",
};

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

  const adopterProfileRow = {
    email: "adopter@asams.demo",
    residentialAddress: DEMO_ADOPTER_PROFILE.residentialAddress,
    householdType: DEMO_ADOPTER_PROFILE.householdType,
    homeOwnership: DEMO_ADOPTER_PROFILE.homeOwnership,
    landlordPermission: DEMO_ADOPTER_PROFILE.landlordPermission ? 1 : 0,
    adultsInHousehold: DEMO_ADOPTER_PROFILE.adultsInHousehold,
    childrenInHousehold: DEMO_ADOPTER_PROFILE.childrenInHousehold,
    hasExistingPets: DEMO_ADOPTER_PROFILE.hasExistingPets ? 1 : 0,
    existingPetDetails: DEMO_ADOPTER_PROFILE.existingPetDetails,
    environmentDetails: DEMO_ADOPTER_PROFILE.environmentDetails,
    hoursAlone: DEMO_ADOPTER_PROFILE.hoursAlone,
    preferredSpecies: JSON.stringify(DEMO_ADOPTER_PROFILE.preferredSpecies),
    refereeName: DEMO_ADOPTER_PROFILE.refereeName,
    refereeRelationship: DEMO_ADOPTER_PROFILE.refereeRelationship,
    refereePhone: DEMO_ADOPTER_PROFILE.refereePhone,
    refereeEmail: DEMO_ADOPTER_PROFILE.refereeEmail,
    refereeConsent: DEMO_ADOPTER_PROFILE.refereeConsent ? 1 : 0,
    refereeConsentAt: DEMO_ADOPTER_PROFILE.refereeConsentAt ? new Date(DEMO_ADOPTER_PROFILE.refereeConsentAt) : null,
  };
  await db.orm.AdopterProfile.upsert({
    create: adopterProfileRow,
    update: adopterProfileRow,
  });
  console.log(`Seeded adopter profile: ${adopterProfileRow.email}`);

  for (const option of buildSeedOptions()) {
    const row = {
      id: option.id,
      category: option.category,
      value: option.value,
      description: option.description,
      speciesId: option.speciesId ?? null,
      isRetired: option.isRetired ? 1 : 0,
      systemLocked: option.systemLocked ? 1 : 0,
      createdAt: new Date(option.createdAt),
      updatedAt: new Date(option.updatedAt),
    };
    await db.orm.DropdownOption.upsert({ create: row, update: row });
  }
  console.log(`Seeded ${buildSeedOptions().length} dropdown options`);

  const systemSettingsRow = {
    id: "system-settings",
    holdingPeriodDays: DEFAULT_SYSTEM_SETTINGS.holdingPeriodDays,
    reminderLeadDays: DEFAULT_SYSTEM_SETTINGS.reminderLeadDays,
    allowedAttachmentTypes: JSON.stringify(DEFAULT_SYSTEM_SETTINGS.allowedAttachmentTypes),
    maxAttachmentSizeMB: DEFAULT_SYSTEM_SETTINGS.maxAttachmentSizeMB,
    agreementTemplateVersion: DEFAULT_SYSTEM_SETTINGS.agreementTemplateVersion,
  };
  await db.orm.SystemSettings.upsert({ create: systemSettingsRow, update: systemSettingsRow });
  console.log("Seeded default system settings");

  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
