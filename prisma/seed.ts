// Relative imports (not the "@/..." alias) - this script runs standalone
// via tsx, outside Next.js's bundler, which is what resolves that alias.
import { db } from "../lib/db/client";
import { toTimestamptz } from "../lib/db/temporal";
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

function demoActor(role: string): { email: string; name: string } {
  const account = DEMO_ACCOUNTS.find((a) => a.role === role);
  if (!account) throw new Error(`No demo account for role ${role}`);
  return { email: account.email, name: `${account.title} ${account.firstName} ${account.lastName}` };
}

// Ruby (A-0006) is PRD 12.1's "Vet cleared, waiting for Staff to publish"
// scenario, and the one seed animal meant to be actionable in the demo
// (Staff can actually publish her). So unlike the other PRD 12.1 animals,
// she gets the full history a real animal would have to reach
// Pre-Listing: the 3 FR-INT-04 assessment tasks completed (backed by a
// No Chip microchip lookup - she has no chip - a Health Assessment and a
// Suitable Temperament Assessment), the Review Adoption Fitness Staff +
// Veterinarian confirmation, Medical Clearance backed by a vaccination
// and a species desexing exemption (the same "Exempt (Species)" record
// the Medical screen writes for reptiles), and a public photo with alt
// text. Her fee comes from lib/animals/mock-animals.ts. Dates sit between
// her enteredAt (2024-06-18) and statusUpdatedAt (2024-06-25).
async function seedRubyPrerequisites() {
  const animalId = "A-0006";
  const staff = demoActor("Shelter Staff Member");
  const vet = demoActor("Veterinarian");
  const at = (day: string, time = "10:00:00") => toTimestamptz(`2024-06-${day}T${time}.000Z`);

  const microchip = {
    id: "ML-SEED-A-0006",
    animalId,
    microchipNumber: "",
    result: "No Chip",
    ownerContactName: null,
    ownerContactPhone: null,
    ownerContactAddress: null,
    performedByEmail: staff.email,
    performedByName: staff.name,
    performedAt: at("18", "11:00:00"),
  };
  await db.orm.MicrochipLookup.upsert({ create: microchip, update: microchip });

  const health = {
    id: "HA-SEED-A-0006",
    animalId,
    examinationObservations: "Alert and responsive; clear eyes; healthy skin and shed.",
    sampleTestResults: "Faecal float negative for parasites.",
    diagnosedConditions: "None",
    bodyCondition: "Ideal",
    urgentTreatmentRequired: 0,
    urgentTreatmentNotes: "",
    treatmentPathway: null,
    healthRecheckRequired: 0,
    assessmentDate: "2024-06-19T10:00:00.000Z",
    veterinarianEmail: vet.email,
    veterinarianName: vet.name,
    createdAt: at("19"),
  };
  await db.orm.HealthAssessment.upsert({ create: health, update: health });

  const temperament = {
    id: "TA-SEED-A-0006",
    animalId,
    handlingResponse: "Calm when picked up; tolerates handling well.",
    reactionToStrangers: "Curious and relaxed with new people.",
    foodBehaviour: "Eats readily; no defensive behaviour at feeding.",
    interactionWithOtherAnimals: "Not applicable - housed alone.",
    socialisationScore: 4,
    observations: "Docile and settled in her enclosure.",
    recommendations: "Suitable for a first-time reptile owner with a correctly set-up enclosure.",
    assessmentDate: "2024-06-20T10:00:00.000Z",
    assessorEmail: staff.email,
    assessorName: staff.name,
    followUpRequired: 0,
    reassessmentDate: null,
    outcome: "Suitable for Adoption",
    createdAt: at("20"),
    programReassessmentOf: null,
  };
  await db.orm.TemperamentAssessment.upsert({ create: temperament, update: temperament });

  const tasks = [
    { id: "AT-SEED-A-0006-MC", taskType: "Microchip Check", actor: staff, markedAt: at("18", "11:00:00") },
    { id: "AT-SEED-A-0006-HA", taskType: "Health Assessment", actor: vet, markedAt: at("19") },
    { id: "AT-SEED-A-0006-TA", taskType: "Temperament Assessment", actor: staff, markedAt: at("20") },
  ];
  for (const task of tasks) {
    const row = {
      id: task.id,
      animalId,
      taskType: task.taskType,
      status: "Continuable",
      markedByEmail: task.actor.email,
      markedByName: task.actor.name,
      markedAt: task.markedAt,
    };
    await db.orm.AssessmentTask.upsert({ create: row, update: row });
  }

  const fitnessReview = {
    animalId,
    staffConfirmedByEmail: staff.email,
    staffConfirmedByName: staff.name,
    staffConfirmedAt: at("21", "09:00:00"),
    vetConfirmedByEmail: vet.email,
    vetConfirmedByName: vet.name,
    vetConfirmedAt: at("21", "11:00:00"),
  };
  await db.orm.FitnessReview.upsert({ create: fitnessReview, update: fitnessReview });

  const vaccination = {
    id: "VX-SEED-A-0006",
    animalId,
    // Same species-appropriate value the test data uses for birds and
    // reptiles, which have no core vaccine in the Vaccine Type list.
    vaccineType: "Other / Species-appropriate preventive record",
    administrationDate: "2024-06-22T10:00:00.000Z",
    doseOrChipId: "N/A",
    nextBoosterDueDate: "2025-06-22T10:00:00.000Z",
    veterinarianEmail: vet.email,
    veterinarianName: vet.name,
    createdAt: at("22"),
  };
  await db.orm.VaccinationRecord.upsert({ create: vaccination, update: vaccination });

  const desexing = {
    id: "DX-SEED-A-0006",
    animalId,
    scheduledDate: "2024-06-22T10:00:00.000Z",
    status: "Exempt (Species)",
    completedAt: null,
    completedByEmail: null,
    completedByName: null,
    veterinarianEmail: vet.email,
    veterinarianName: vet.name,
    createdAt: at("22"),
  };
  await db.orm.DesexingSchedule.upsert({ create: desexing, update: desexing });

  const clearance = {
    id: "MC-SEED-A-0006",
    animalId,
    issuedByEmail: vet.email,
    issuedByName: vet.name,
    issuedAt: at("25", "09:00:00"),
  };
  await db.orm.MedicalClearance.upsert({ create: clearance, update: clearance });

  const photo = {
    id: "PH-SEED-A-0006",
    animalId,
    fileName: "ruby_main.jpg",
    fileSizeKB: 240,
    dateTaken: "2024-06-18T10:00:00.000Z",
    takenByEmail: staff.email,
    takenByName: staff.name,
    useOnAdoptionListing: 1,
    altText: "Ruby, a tan bearded dragon with darker stripes, resting on a branch",
    uploadedAt: at("18"),
    imageData: null,
  };
  await db.orm.Photo.upsert({ create: photo, update: photo });

  console.log("Seeded Ruby's (A-0006) Pre-Listing prerequisite history");
}

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
        signUpAt: toTimestamptz(account.signUpAt),
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

  // The PRD 12.1 animals are written straight into the lifecycle state
  // each one demonstrates (Pre-Listing, Current, Adopted, Removed...). For
  // Luna, Charlie, Daisy, Rocky and Oliver that is a status-only snapshot:
  // none of the history a real animal would have passed through to reach
  // that state (assessment tasks, Review Adoption Fitness sign-off,
  // Medical Clearance, and so on) is seeded, so they don't satisfy every
  // gate that state implies. Ruby is the exception - see
  // seedRubyPrerequisites().
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
      statusUpdatedAt: toTimestamptz(animal.statusUpdatedAt),
      enteredAt: toTimestamptz(animal.enteredAt),
      lastModifiedAt: toTimestamptz(animal.lastModifiedAt),
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
  await seedRubyPrerequisites();

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
    refereeConsentAt: toTimestamptz(DEMO_ADOPTER_PROFILE.refereeConsentAt ?? null),
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
      createdAt: toTimestamptz(option.createdAt),
      updatedAt: toTimestamptz(option.updatedAt),
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
