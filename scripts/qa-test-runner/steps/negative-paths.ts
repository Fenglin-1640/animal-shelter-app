// Isolated negative-path runs, kept entirely separate from the 60
// standard/health-recheck/behaviour-blocked Test Case IDs per the Guide
// sheet's own instruction ("Use this only in a separate test. Do not use
// it for the full adoption route." / "Do not force Compatible."). Each
// creates its own fresh animal (via a real Council Transfer -> Intake ->
// Finalise, never writing final-state data directly) using a TC row only
// as a data template - never reusing or mutating that TC's own AnimalId.
import { createDraft, submitTransfer } from "@/lib/council-transfers/store";
import { createIntakeRecord, finaliseIntake, getIntakeRecord } from "@/lib/intake-records/store";
import { getAnimalById } from "@/lib/animals/animal-store";
import { performScan } from "@/lib/microchip/store";
import { hasUnresolvedHold, getLatestHold } from "@/lib/statutory-hold/store";
import { getPublishBlockers } from "@/lib/adoption-listings/publish";
import {
  startOrContinueDraft,
  updateDraft,
  submitApplication,
  markUnderReview,
  approveApplication,
} from "@/lib/applications/store";
import { createChecksForApplication, listChecksForApplication, completeCheck } from "@/lib/checks/store";
import { proposeSlots, selectSlot, confirmAttendance, recordOutcome, getMeetAndGreetForApplication } from "@/lib/meet-and-greets/store";
import { getActiveAgreementForApplication } from "@/lib/agreements/store";
import { getApplication } from "@/lib/applications/store";
import {
  recordVaccination,
  scheduleDesexing,
  completeDesexing,
  issueMedicalClearance,
} from "@/lib/medical/store";
import { publishAdoptionProfile } from "@/lib/adoption-listings/publish";
import { evaluatePreListingEligibility } from "@/lib/adoption-listings/pre-listing";

import type { TestCaseBundle } from "./animal-workflow";
import { getNegative, setAnimalId, setId, getId } from "../lib/runlog";
import { step, pass, fail } from "../lib/step";
import { generatePlaceholderPhoto } from "../lib/placeholder-image";
import { COUNCIL, QA_ADOPTER_PASSWORD, STAFF, VET } from "../lib/actors";
import { actAs } from "../lib/fetch-shim";
import { getAdopter } from "../lib/runlog";

const OWNER_MATCH_CHIP = "985141000111111";

function ok<T extends { ok: boolean }>(result: T): boolean {
  return result.ok === true;
}

async function intakeFreshAnimal(
  negKey: string,
  label: string,
  bundle: TestCaseBundle,
): Promise<string | undefined> {
  const entry = getNegative(negKey);
  if (entry.animalId) return entry.animalId;

  const { intake } = bundle;
  const photo = await generatePlaceholderPhoto(`${negKey.toLowerCase()}_${label}.jpg`, label, intake.species);
  await actAs(COUNCIL.email);
  const transferId = await createDraft(COUNCIL.email, COUNCIL.name, {
    source: intake.transferSource,
    arrivalCircumstance: `[Negative-path test: ${negKey}] ${intake.arrivalCircumstance}`,
    foundLocation: intake.foundLocation,
    animalDescription: `[Negative-path test: ${negKey}] ${intake.preliminaryDescription}`,
    attachments: [
      {
        id: `ATT-${negKey}`,
        documentType: "Found Animal Report",
        fileName: `${negKey.toLowerCase()}_transfer.jpg`,
        fileSizeKB: photo.fileSizeKB,
        uploadedAt: new Date().toISOString(),
      },
    ],
  });
  setId(entry, "transferId", transferId);
  const submitResult = await submitTransfer(transferId);
  if (!ok(submitResult)) return undefined;

  await actAs(STAFF.email);
  const intakeId = await createIntakeRecord(STAFF.email, STAFF.name, {
    animalName: label,
    arrivalCircumstance: intake.arrivalCircumstance,
    arrivalDateTime: new Date().toISOString(),
    intakeSource: "Council Transfer",
    surrenderingPartyName: "",
    councilTransferSubmissionId: transferId,
    species: intake.species as "Cat" | "Dog" | "Bird" | "Reptile",
    estimatedAge: `${intake.estimatedAgeYears} years`,
    dateOfBirth: "",
    sex: intake.sex as "Male" | "Female",
    coatColour: intake.coatColour,
    coatMarkings: intake.coatMarkings,
    breed: intake.breed,
    adoptionFee: 150,
    temperaments: ["Calm"],
    generalDescription: `Negative-path test animal (${label}).`,
    photos: [{ id: `PH-${negKey}`, fileName: `${negKey.toLowerCase()}_main.jpg`, fileSizeKB: photo.fileSizeKB, uploadedAt: new Date().toISOString(), altText: `${label} - negative-path test photo` }],
  });
  setId(entry, "intakeId", intakeId);

  const finaliseResult = await finaliseIntake(intakeId);
  if (!ok(finaliseResult)) return undefined;
  const record = await getIntakeRecord(intakeId);
  if (!record) return undefined;
  const animal = await getAnimalById(record.animalId);
  if (!animal) return undefined;
  setAnimalId(entry, animal.animalId, animal.shelterId);
  return animal.animalId;
}

// Negative path 1: Owner Match microchip -> Statutory Hold created,
// publish blocked. Stops there - never proceeds into the adoption
// pipeline.
export async function runOwnerMatchNegative(template: TestCaseBundle): Promise<void> {
  const negKey = "NEG-OWNER-MATCH";
  console.log(`\n--- ${negKey} (isolated negative-path run) ---`);
  const entry = getNegative(negKey);

  const animalId = await step(entry, "intake", "A fresh animal is created for this isolated test.", async () => {
    const id = await intakeFreshAnimal(negKey, "Owner Match Test Subject", template);
    return id ? pass(`AnimalId=${id}`) : fail("Could not create/finalise intake");
  }).then(() => entry.animalId);

  if (!animalId) {
    console.log(`    ABORTED ${negKey}: intake failed.`);
    return;
  }

  await step(entry, "microchip_scan_owner_match", "A Statutory Hold is created and publishing is blocked.", async () => {
    // Scan Microchip is a Staff/Administrator action (PRD 9).
    await actAs(STAFF.email);
    const scanResult = await performScan(animalId, OWNER_MATCH_CHIP, STAFF.email, STAFF.name);
    if (!ok(scanResult)) return fail("performScan returned not_found");
    const lookupResult = (scanResult as { lookup: { result: string } }).lookup.result;
    if (lookupResult !== "Owner Match") return fail(`Expected Owner Match, got ${lookupResult}`);

    const holdActive = await hasUnresolvedHold(animalId);
    const hold = await getLatestHold(animalId);
    const animal = await getAnimalById(animalId);
    const publishBlockers = await getPublishBlockers(animalId);

    const holdCreated = holdActive && hold?.status === "Active";
    const publishBlocked = publishBlockers.length > 0;
    const statusCorrect = animal?.currentStatus === "On Statutory Hold";

    return holdCreated && publishBlocked && statusCorrect
      ? pass(`Hold ${hold?.id} created, currentStatus=On Statutory Hold, publish blocked (${publishBlockers.join("; ")})`)
      : fail(
          `holdCreated=${holdCreated}, publishBlocked=${publishBlocked}, statusCorrect=${statusCorrect} (currentStatus=${animal?.currentStatus})`,
        );
  });

  console.log(`    STOP ${negKey}: terminal state reached as expected - not continuing into the adoption pipeline.`);
}

// Negative path 2: a Meet and Greet marked Incompatible -> no Agreement
// generated, application does not finalise. Stops there.
export async function runIncompatibleNegative(template: TestCaseBundle): Promise<void> {
  const negKey = "NEG-INCOMPATIBLE";
  console.log(`\n--- ${negKey} (isolated negative-path run) ---`);
  const entry = getNegative(negKey);

  const animalId = await step(entry, "intake", "A fresh animal is created for this isolated test.", async () => {
    const id = await intakeFreshAnimal(negKey, "Incompatible Test Subject", template);
    return id ? pass(`AnimalId=${id}`) : fail("Could not create/finalise intake");
  }).then(() => entry.animalId);

  if (!animalId) {
    console.log(`    ABORTED ${negKey}: intake failed.`);
    return;
  }

  // Fast-track to a publishable state - No Match microchip, minimal
  // health/temperament/vaccination/desexing, clearance, publish. Not
  // logged step-by-step in as much detail as the main workflow since
  // this run's purpose is only to reach a Meet and Greet, not to
  // re-verify steps the 60 standard TCs already cover.
  await step(entry, "fast_track_to_meet_and_greet_ready", "Animal reaches Available For Adoption / Current.", async () => {
    const { getFitnessBlockers } = await import("@/lib/adoption-fitness/types");
    const { listTasksForAnimal, confirmAsStaff } = await import("@/lib/adoption-fitness/store");
    const { recordHealthAssessment } = await import("@/lib/medical/store");
    const { recordTemperamentAssessment } = await import("@/lib/behaviour/store");

    await actAs(STAFF.email);
    await performScan(animalId, `985141${Math.floor(Math.random() * 900000 + 100000)}`, STAFF.email, STAFF.name);
    await actAs(VET.email);
    await recordHealthAssessment(
      animalId,
      { examinationObservations: "Healthy.", sampleTestResults: "Normal.", diagnosedConditions: "None", bodyCondition: "Ideal", urgentTreatmentRequired: false, urgentTreatmentNotes: "", healthRecheckRequired: false, assessmentDate: new Date().toISOString() },
      VET.email,
      VET.name,
    );
    await actAs(STAFF.email);
    await recordTemperamentAssessment(
      animalId,
      { handlingResponse: "Calm.", reactionToStrangers: "Approaches calmly.", foodBehaviour: "No guarding.", interactionWithOtherAnimals: "Neutral.", socialisationScore: 4, observations: "Well-socialised.", recommendations: "Standard home.", assessmentDate: new Date().toISOString(), followUpRequired: false, outcome: "Suitable for Adoption" },
      STAFF.email,
      STAFF.name,
    );
    const animal = await getAnimalById(animalId);
    const tasks = await listTasksForAnimal(animalId);
    if (animal && getFitnessBlockers(animal, tasks).length === 0) {
      await confirmAsStaff(animalId, STAFF.email, STAFF.name);
    }
    await actAs(VET.email);
    await recordVaccination(animalId, { vaccineType: template.adoption.vaccineType || "Core Vaccination", administrationDate: new Date().toISOString(), doseOrChipId: "1.0 mL", nextBoosterDueDate: new Date(Date.now() + 365 * 86400000).toISOString() }, VET.email, VET.name);
    if (template.intake.species === "Bird" || template.intake.species === "Reptile") {
      const { recordDesexingExemption } = await import("@/lib/medical/store");
      await recordDesexingExemption(animalId, "Exempt (Species)", VET.email, VET.name);
    } else {
      await scheduleDesexing(animalId, new Date().toISOString(), VET.email, VET.name);
      await completeDesexing(animalId, VET.email, VET.name);
    }
    await issueMedicalClearance(animalId);
    await evaluatePreListingEligibility(animalId, VET);
    await actAs(STAFF.email);
    const publishResult = await publishAdoptionProfile(animalId, STAFF.email, STAFF.name);
    if (!ok(publishResult)) return fail(`publishAdoptionProfile failed: ${(publishResult as { reason: string }).reason}`);
    const final = await getAnimalById(animalId);
    return final?.currentStatus === "Available For Adoption" && final?.listingStatus === "Current"
      ? pass(`${final.currentStatus} / ${final.listingStatus}`)
      : fail(`${final?.currentStatus} / ${final?.listingStatus}`);
  });

  const adopterEntry = getAdopter(template.adoption.adopterId);
  if (!adopterEntry) {
    console.log(`    ABORTED ${negKey}: no adopter mapping - run the adopters phase first.`);
    return;
  }

  const applicationId = await step(entry, "application_and_approval", "Application approved, currentStatus = Application In Progress.", async () => {
    await actAs(adopterEntry.email, QA_ADOPTER_PASSWORD);
    let appId = getId(entry, "applicationId");
    if (!appId) {
      const draftResult = await startOrContinueDraft(animalId, adopterEntry.email, adopterEntry.fullName);
      if (!ok(draftResult)) return fail(`startOrContinueDraft failed: ${(draftResult as { reason: string }).reason}`);
      appId = (draftResult as { applicationId: string }).applicationId;
      setId(entry, "applicationId", appId);
    }
    await updateDraft(appId, { motivationStatement: "Negative-path test application (Incompatible Meet and Greet).", documents: [] });
    const submitResult = await submitApplication(appId);
    if (!ok(submitResult)) return fail(`submitApplication failed: ${(submitResult as { reason: string }).reason}`, (submitResult as { blockers?: string[] }).blockers?.join("; "));
    await createChecksForApplication(appId);
    await actAs(STAFF.email);
    await markUnderReview(appId);
    for (const check of await listChecksForApplication(appId)) {
      if (check.outcome === "Pending") await completeCheck(check.checkId, "Pass", "Recorded per QA test data.", new Date().toISOString(), STAFF.email, STAFF.name);
    }
    const approveResult = await approveApplication(appId, STAFF.email, STAFF.name);
    if (!ok(approveResult)) return fail(`approveApplication failed: ${(approveResult as { reason: string }).reason}`);
    return pass("Approved");
  }).then(() => getId(entry, "applicationId"));

  if (!applicationId) {
    console.log(`    ABORTED ${negKey}: application did not reach Approved.`);
    return;
  }

  await step(
    entry,
    "meet_and_greet_incompatible",
    "Agreement generation and finalisation remain blocked.",
    async () => {
      await actAs(STAFF.email);
      let mgId = getId(entry, "meetAndGreetId");
      if (!mgId) {
        const proposeResult = await proposeSlots(
          applicationId,
          [
            { dateTime: new Date(Date.now() + 86400000).toISOString(), location: "Shelter Meeting Room 1" },
            { dateTime: new Date(Date.now() + 172800000).toISOString(), location: "Shelter Meeting Room 1" },
          ],
          `${STAFF.name}, ${adopterEntry.email}`,
          STAFF.email,
          STAFF.name,
        );
        if (!ok(proposeResult)) return fail(`proposeSlots failed: ${(proposeResult as { reason: string }).reason}`);
        const mg = await getMeetAndGreetForApplication(applicationId);
        if (!mg) return fail("meet-and-greet not found after proposeSlots");
        mgId = mg.meetAndGreetId;
        setId(entry, "meetAndGreetId", mgId);
      }
      await actAs(adopterEntry.email, QA_ADOPTER_PASSWORD);
      let mg = await getMeetAndGreetForApplication(applicationId);
      if (mg?.status === "Proposed") {
        const slotId = mg.slotOptions[0]?.id;
        if (slotId) await selectSlot(mgId, slotId);
      }
      mg = await getMeetAndGreetForApplication(applicationId);
      if (mg?.status === "Scheduled" && !mg.attendanceConfirmed) {
        await confirmAttendance(mgId);
      }
      await actAs(STAFF.email);
      mg = await getMeetAndGreetForApplication(applicationId);
      if (mg?.status === "Scheduled") {
        const outcomeResult = await recordOutcome(
          mgId,
          "Incompatible",
          "Recorded per QA negative-path test data: animal and adopter household assessed as incompatible.",
          "Negative-path test - deliberately marked Incompatible.",
          STAFF.email,
          STAFF.name,
        );
        if (!ok(outcomeResult)) return fail(`recordOutcome failed: ${(outcomeResult as { reason: string }).reason}`);
      }

      const finalMg = await getMeetAndGreetForApplication(applicationId);
      const agreement = await getActiveAgreementForApplication(applicationId);
      const application = await getApplication(applicationId);

      const outcomeCorrect = finalMg?.status === "Incompatible";
      const noAgreement = !agreement;
      const notFinalised = application?.applicationStatus !== "Finalised";

      return outcomeCorrect && noAgreement && notFinalised
        ? pass(`outcome=Incompatible, no agreement generated, applicationStatus=${application?.applicationStatus}`)
        : fail(
            `outcomeCorrect=${outcomeCorrect}, noAgreement=${noAgreement}, notFinalised=${notFinalised} (applicationStatus=${application?.applicationStatus})`,
          );
    },
  );

  console.log(`    STOP ${negKey}: terminal state reached as expected - not continuing to Agreement/Payment/Finalise.`);
}
