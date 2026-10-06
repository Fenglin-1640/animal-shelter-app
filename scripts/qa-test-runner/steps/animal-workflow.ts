// Runs one Test Case ID's full ASAMS workflow (Council Transfer -> Intake
// -> Assessments -> Adoption Fitness -> Medical -> Publish -> Application
// -> Meet and Greet -> Agreement -> Payment -> Finalise -> Release ->
// Follow-Up -> Audit), acting as the correct role at each step and
// calling the app's own lib/*/store.ts functions - never writing
// final-state data directly to the DB. Each step is idempotent via
// runlog.ts: already-passed/blocked-expected/skipped steps are skipped
// on a re-run.
import { createDraft, submitTransfer } from "@/lib/council-transfers/store";
import { createIntakeRecord, finaliseIntake, getIntakeRecord } from "@/lib/intake-records/store";
import { performScan } from "@/lib/microchip/store";
import { recordHealthAssessment } from "@/lib/medical/store";
import { recordTemperamentAssessment } from "@/lib/behaviour/store";
import { confirmAsStaff, getFitnessReview, listTasksForAnimal } from "@/lib/adoption-fitness/store";
import { getFitnessBlockers } from "@/lib/adoption-fitness/types";
import { getAnimalById } from "@/lib/animals/animal-store";
import {
  recordVaccination,
  scheduleDesexing,
  completeDesexing,
  recordDesexingExemption,
  issueMedicalClearance,
  getMedicalClearanceBlockers,
  recordPreReleaseCheck,
} from "@/lib/medical/store";
import { publishAdoptionProfile, getPublishBlockers } from "@/lib/adoption-listings/publish";
import {
  startOrContinueDraft,
  updateDraft,
  submitApplication,
  markUnderReview,
  approveApplication,
} from "@/lib/applications/store";
import { createChecksForApplication, listChecksForApplication, completeCheck } from "@/lib/checks/store";
import { proposeSlots, selectSlot, confirmAttendance, recordOutcome, getMeetAndGreetForApplication } from "@/lib/meet-and-greets/store";
import { generateAgreement, signAgreement, getActiveAgreementForApplication } from "@/lib/agreements/store";
import { initiatePayment, verifyPayment, getLatestPaymentForAgreement } from "@/lib/payments/store";
import { finaliseAdoption } from "@/lib/adoptions/finalise";
import { releaseAnimal, completeFollowUpVisit, getLatestFollowUpVisitForAnimal } from "@/lib/follow-up-visits/store";
import { listAuditLog } from "@/lib/audit/store";
import { getActiveValues } from "@/lib/system-administration/store";
import { evaluatePreListingEligibility } from "@/lib/adoption-listings/pre-listing";

import type { AdoptionRow, AssessmentRow, IntakeRow, ReleaseRow } from "../lib/sheet";
import { getAdopter, getCase, getId, setAnimalId, setId } from "../lib/runlog";
import { step, pass, fail, blockedExpected, type StepOutcome } from "../lib/step";
import { generatePlaceholderPhoto } from "../lib/placeholder-image";
import { ADMIN, COUNCIL, QA_ADOPTER_PASSWORD, STAFF, VET } from "../lib/actors";
import { actAs } from "../lib/fetch-shim";

export interface TestCaseBundle {
  intake: IntakeRow;
  assessment: AssessmentRow;
  adoption: AdoptionRow;
  release: ReleaseRow;
}

function ok<T extends { ok: boolean }>(result: T): boolean {
  return result.ok === true;
}

export interface RunAnimalWorkflowOptions {
  // When true, every TC that reaches Publish stops there (currentStatus
  // = Available For Adoption, listingStatus = Current) instead of
  // continuing into Application/Meet-and-Greet/Agreement/Payment/
  // Finalise/Pre-Release/Release/Follow-Up/Audit. Vaccination/desexing/
  // Medical Clearance still run in full either way - only steps AFTER
  // Publish are cut. The 8 "Behaviour blocked before listing" TCs are
  // unaffected by this flag - they already stop before reaching Publish
  // via the adoption_fitness_confirm block below.
  stopAfterPublish?: boolean;
}

export async function runAnimalWorkflow(
  bundle: TestCaseBundle,
  options: RunAnimalWorkflowOptions = {},
): Promise<void> {
  const { intake, assessment, adoption, release } = bundle;
  const tcId = intake.testCaseId;
  const entry = getCase(tcId);
  console.log(`\n--- ${tcId} (${intake.animalName}, ${intake.species}, ${intake.executionRoute}) ---`);

  // 1. Council Officer submits the transfer.
  await step(entry, "council_transfer_submit", "Transfer status is Submitted.", async () => {
    await actAs(COUNCIL.email);
    let transferId = getId(entry, "transferId");
    if (!transferId) {
      const transferPhoto = await generatePlaceholderPhoto(
        intake.transferAttachment,
        `${intake.animalName} - transfer doc`,
        intake.species,
      );
      transferId = await createDraft(COUNCIL.email, COUNCIL.name, {
        source: intake.transferSource,
        arrivalCircumstance: intake.arrivalCircumstance,
        foundLocation: intake.foundLocation,
        animalDescription: intake.preliminaryDescription,
        attachments: [
          {
            id: `ATT-${tcId}`,
            documentType: "Found Animal Report",
            fileName: intake.transferAttachment,
            fileSizeKB: Math.round(transferPhoto.fileSizeKB),
            uploadedAt: new Date().toISOString(),
          },
        ],
      });
      setId(entry, "transferId", transferId);
    }
    const result = await submitTransfer(transferId);
    if (!ok(result)) return fail(`submitTransfer failed: ${(result as { reason: string }).reason}`);
    return pass("Submitted");
  });

  // 2. Staff creates the Intake Record, uploads the photo, finalises -
  // this is what actually creates the real Animal row and AnimalId.
  await step(
    entry,
    "intake_finalise",
    `${intake.expectedCurrentStatus} / ${intake.expectedListingStatus}`,
    async () => {
      await actAs(STAFF.email);
      if (entry.animalId) return pass(`already have AnimalId ${entry.animalId}`);

      const transferId = getId(entry, "transferId");
      if (!transferId) return fail("no transferId recorded - council step must have failed");

      let intakeId = getId(entry, "intakeId");
      if (!intakeId) {
        const photo = await generatePlaceholderPhoto(intake.photoFilename, intake.animalName, intake.species);
        intakeId = await createIntakeRecord(STAFF.email, STAFF.name, {
          animalName: intake.animalName,
          arrivalCircumstance: intake.arrivalCircumstance,
          arrivalDateTime: intake.arrivalDateTime,
          intakeSource: intake.intakeSource,
          surrenderingPartyName: "",
          councilTransferSubmissionId: transferId,
          species: intake.species as "Cat" | "Dog" | "Bird" | "Reptile",
          estimatedAge: `${intake.estimatedAgeYears} years`,
          dateOfBirth: "",
          sex: intake.sex as "Male" | "Female",
          coatColour: intake.coatColour,
          coatMarkings: intake.coatMarkings,
          breed: intake.breed,
          adoptionFee: adoption.adoptionFee,
          temperaments: adoption.temperaments.split(",").map((t) => t.trim()).filter(Boolean),
          generalDescription: adoption.generalDescription,
          photos: [
            {
              id: `PH-${tcId}`,
              fileName: intake.photoFilename,
              fileSizeKB: photo.fileSizeKB,
              uploadedAt: new Date().toISOString(),
              altText: intake.photoAltText,
            },
          ],
        });
        setId(entry, "intakeId", intakeId);
      }

      const result = await finaliseIntake(intakeId);
      if (!ok(result)) {
        const blockers = (result as { blockers?: string[] }).blockers;
        return fail(`finaliseIntake failed: ${(result as { reason: string }).reason}`, blockers?.join("; "));
      }

      const record = await getIntakeRecord(intakeId);
      if (!record) return fail("finalised but getIntakeRecord returned nothing");
      const animal = await getAnimalById(record.animalId);
      if (!animal) return fail("finalised but Animal row not found");

      setAnimalId(entry, animal.animalId, animal.shelterId);

      const currentMatch = animal.currentStatus === intake.expectedCurrentStatus;
      const listingMatch = animal.listingStatus === intake.expectedListingStatus;
      return {
        status: currentMatch && listingMatch ? "pass" : "fail",
        actual: `AnimalId=${animal.animalId}, ShelterId=${animal.shelterId}, currentStatus=${animal.currentStatus}, listingStatus=${animal.listingStatus}`,
      } satisfies StepOutcome;
    },
  );

  if (!entry.animalId) {
    console.log(`    ABORTED ${tcId}: no AnimalId - cannot continue.`);
    return;
  }
  const animalId = entry.animalId;

  // 3. Staff scans the microchip (a Staff/Administrator action - PRD 9
  // gives the Veterinarian read-only microchip access) - all 60 sheet rows use a
  // synthetic number that isn't the hardcoded Owner Match test number,
  // so every one of these is expected to resolve No Match by design
  // (see mock-registry.ts) - Owner Match is exercised only by the
  // separate negative-path run.
  await step(entry, "microchip_scan", assessment.expectedResult, async () => {
    await actAs(STAFF.email);
    const result = await performScan(animalId, assessment.microchipNumber, STAFF.email, STAFF.name);
    if (!ok(result)) return fail("performScan returned not_found");
    const actualResult = (result as { lookup: { result: string } }).lookup.result;
    return actualResult === assessment.expectedResult
      ? pass(actualResult)
      : fail(actualResult, "Result did not match sheet's Expected Result");
  });

  // 4. Veterinarian records the Health Assessment (+ recheck if flagged).
  await step(entry, "health_assessment", assessment.finalHealthTask, async () => {
    await actAs(VET.email);
    const result = await recordHealthAssessment(
      animalId,
      {
        examinationObservations: assessment.examinationObservations,
        sampleTestResults: assessment.sampleTestResults,
        diagnosedConditions: assessment.diagnosedConditions,
        bodyCondition: assessment.bodyCondition,
        urgentTreatmentRequired: assessment.urgentTreatmentRequired,
        urgentTreatmentNotes: assessment.urgentTreatmentRequired ? assessment.healthNotes : "",
        healthRecheckRequired: assessment.healthRecheckRequired,
        assessmentDate: assessment.assessmentDate,
      },
      VET.email,
      VET.name,
    );
    if (!ok(result)) return fail(`recordHealthAssessment failed: ${(result as { reason: string }).reason}`);
    return pass("Recorded");
  });

  if (assessment.healthRecheckRequired) {
    await step(entry, "health_recheck", "Recheck findings recorded, task remains/becomes Continuable.", async () => {
      await actAs(VET.email);
      const result = await recordHealthAssessment(
        animalId,
        {
          examinationObservations: assessment.recheckFindings,
          sampleTestResults: "",
          diagnosedConditions: "",
          bodyCondition: assessment.bodyCondition,
          urgentTreatmentRequired: false,
          urgentTreatmentNotes: "",
          // This is what actually resolves the recheck gate - a later
          // assessment recorded with this false (getMedicalClearanceBlockers
          // only looks at the MOST RECENT HealthAssessment).
          healthRecheckRequired: false,
          assessmentDate: assessment.healthRecheckDate,
        },
        VET.email,
        VET.name,
      );
      if (!ok(result)) return fail(`recheck recordHealthAssessment failed: ${(result as { reason: string }).reason}`);
      return pass(
        "Recorded",
        "Note: getMedicalClearanceBlockers has no dedicated 'recheck pending' gate in the app - it only checks that >=1 vaccination and a desexing row exist. The Guide's 'remains unavailable until recheck resolves' is procedural intent here, not an enforced blocker.",
      );
    });
  }

  // 5. Staff records the Temperament Assessment.
  await step(entry, "temperament_assessment", assessment.expectedStopOrNextStep, async () => {
    await actAs(STAFF.email);
    const result = await recordTemperamentAssessment(
      animalId,
      {
        handlingResponse: assessment.handlingResponse,
        reactionToStrangers: assessment.reactionToStrangers,
        foodBehaviour: assessment.foodBehaviour,
        interactionWithOtherAnimals: assessment.interactionWithOtherAnimals,
        socialisationScore: assessment.socialisationScore,
        observations: assessment.behaviourObservations,
        recommendations: assessment.recommendations,
        assessmentDate: assessment.behaviourAssessmentDate,
        followUpRequired: assessment.followUpRequired,
        outcome: assessment.outcome as "Suitable for Adoption" | "Requires Behaviour Modification" | "Unsuitable for Public Adoption",
      },
      STAFF.email,
      STAFF.name,
    );
    if (!ok(result)) return fail(`recordTemperamentAssessment failed: ${(result as { reason: string }).reason}`);
    return pass(assessment.outcome);
  });

  // 6. Staff + Veterinarian confirm Adoption Fitness once all 3 tasks
  // are Continuable. For "Behaviour blocked before listing" TCs this is
  // EXPECTED to stay blocked - that's the terminal state for those 8,
  // not a script failure.
  const fitnessOutcome = await step(
    entry,
    "adoption_fitness_confirm",
    adoption.executionRoute === "Behaviour blocked before listing"
      ? "Blocked - cannot complete (expected)."
      : "Staff confirmation recorded; the Veterinarian half follows with the Medical Clearance.",
    async () => {
      await actAs(STAFF.email);
      const animal = await getAnimalById(animalId);
      const tasks = await listTasksForAnimal(animalId);
      const blockers = animal ? getFitnessBlockers(animal, tasks) : ["animal not found"];
      if (blockers.length > 0) {
        const isExpectedBlock = adoption.executionRoute === "Behaviour blocked before listing";
        return isExpectedBlock
          ? blockedExpected(`Blocked: ${blockers.join("; ")}`)
          : fail(`Blocked: ${blockers.join("; ")}`);
      }
      // The Veterinarian half is confirmed by issuing the Medical Clearance.
      const staffResult = await confirmAsStaff(animalId, STAFF.email, STAFF.name);
      if (!ok(staffResult)) return fail("staff confirmation rejected after blockers were empty");
      const review = await getFitnessReview(animalId);
      return review?.staffConfirmedAt ? pass("Staff confirmed") : fail("Confirmed but review missing the Staff side");
    },
  );

  if (adoption.executionRoute === "Behaviour blocked before listing") {
    console.log(`    STOP ${tcId}: behaviour-blocked route - terminal state reached as expected.`);
    return;
  }
  if (fitnessOutcome && fitnessOutcome.status === "fail") {
    console.log(`    ABORTED ${tcId}: Adoption Fitness did not clear when it was expected to.`);
    return;
  }

  // 7. Veterinarian records vaccination.
  await step(entry, "vaccination", "listingStatus = Pre-Listing (after clearance).", async () => {
    await actAs(VET.email);
    const result = await recordVaccination(
      animalId,
      {
        vaccineType: adoption.vaccineType,
        administrationDate: adoption.administrationDate,
        doseOrChipId: adoption.doseOrChipId,
        nextBoosterDueDate: adoption.nextBoosterDue,
      },
      VET.email,
      VET.name,
    );
    if (!ok(result)) return fail(`recordVaccination failed: ${(result as { reason: string }).reason}`);
    return pass("Recorded");
  });

  // 8. Desexing - mammals get Schedule+Complete, birds/reptiles get the
  // new species Exemption path (see lib/medical/types.ts DesexingStatus).
  await step(entry, "desexing", adoption.desexingStatus, async () => {
    await actAs(VET.email);
    const isExempt = intake.species === "Bird" || intake.species === "Reptile";
    if (isExempt) {
      const result = await recordDesexingExemption(animalId, "Exempt (Species)", VET.email, VET.name);
      if (!ok(result)) return fail(`recordDesexingExemption failed: ${(result as { reason: string }).reason}`);
      return pass("Exempt (Species)");
    }
    const scheduleResult = await scheduleDesexing(
      animalId,
      adoption.desexingScheduledDate || new Date().toISOString(),
      VET.email,
      VET.name,
    );
    if (!ok(scheduleResult)) return fail(`scheduleDesexing failed: ${(scheduleResult as { reason: string }).reason}`);
    const completeResult = await completeDesexing(animalId, VET.email, VET.name);
    if (!ok(completeResult)) return fail(`completeDesexing failed: ${(completeResult as { reason: string }).reason}`);
    return pass("Completed");
  });

  // 9. Medical Clearance.
  const clearanceOutcome = await step(entry, "medical_clearance", adoption.clearanceExpected, async () => {
    await actAs(VET.email);
    const blockers = await getMedicalClearanceBlockers(animalId);
    if (blockers.length > 0) return fail(`Blocked: ${blockers.join("; ")}`);
    const result = await issueMedicalClearance(animalId);
    if (!ok(result)) return fail(`issueMedicalClearance failed: ${(result as { reason: string }).reason}`);
    // Same call the Medical screen makes after issuing clearance - moves
    // the animal to Pre-Listing, which Publish requires (BR-007).
    await evaluatePreListingEligibility(animalId, VET);
    return pass("Issued");
  });
  if (clearanceOutcome && clearanceOutcome.status === "fail") {
    console.log(`    ABORTED ${tcId}: Medical Clearance blocked unexpectedly.`);
    return;
  }

  // 10. Staff publishes. Breed/Adoption Fee/Temperaments/General
  // Description were already captured at Intake (step 2).
  await step(entry, "publish", `${adoption.currentStatusAfterPublish} / ${adoption.listingStatusAfterPublish}`, async () => {
    await actAs(STAFF.email);
    const blockers = await getPublishBlockers(animalId);
    if (blockers.length > 0) return fail(`Blocked: ${blockers.join("; ")}`);
    const result = await publishAdoptionProfile(animalId, STAFF.email, STAFF.name);
    if (!ok(result)) return fail(`publishAdoptionProfile failed: ${(result as { reason: string }).reason}`);
    const animal = await getAnimalById(animalId);
    const actual = `${animal?.currentStatus} / ${animal?.listingStatus}`;
    return animal?.currentStatus === adoption.currentStatusAfterPublish &&
      animal?.listingStatus === adoption.listingStatusAfterPublish
      ? pass(actual)
      : fail(actual);
  });

  if (options.stopAfterPublish) {
    console.log(`    STOP ${tcId}: stopAfterPublish - terminal state is Publish, not continuing into the adoption pipeline.`);
    return;
  }

  // 11. Adopter applies.
  const adopterEntry = getAdopter(adoption.adopterId);
  if (!adopterEntry) {
    console.log(`    ABORTED ${tcId}: no adopter mapping for ${adoption.adopterId} - run the adopters phase first.`);
    return;
  }
  const adopterEmail = adopterEntry.email;

  await step(entry, "application_submit", "Application is submitted.", async () => {
    await actAs(adopterEmail, QA_ADOPTER_PASSWORD);
    let applicationId = getId(entry, "applicationId");
    if (!applicationId) {
      const draftResult = await startOrContinueDraft(animalId, adopterEmail, adopterEntry.fullName);
      if (!ok(draftResult)) return fail(`startOrContinueDraft failed: ${(draftResult as { reason: string }).reason}`);
      applicationId = (draftResult as { applicationId: string }).applicationId;
      setId(entry, "applicationId", applicationId);
    }
    await updateDraft(applicationId, { motivationStatement: adoption.motivationStatement, documents: [] });
    const submitResult = await submitApplication(applicationId);
    if (!ok(submitResult)) {
      const blockers = (submitResult as { blockers?: string[] }).blockers;
      return fail(`submitApplication failed: ${(submitResult as { reason: string }).reason}`, blockers?.join("; "));
    }
    await createChecksForApplication(applicationId);
    return pass("Submitted");
  });

  const applicationId = getId(entry, "applicationId");
  if (!applicationId) {
    console.log(`    ABORTED ${tcId}: no applicationId recorded.`);
    return;
  }

  // 12. Staff runs the 3 suitability checks (all Pass, matching the
  // sheet's "Identity: Pass; Housing: Pass; Referee: Pass" - the app's
  // actual check types are Reference/Home Suitability/Pet Compatibility,
  // a different taxonomy than the sheet's labels, so this maps the
  // sheet's "all pass" intent onto all 3 real check types rather than
  // trying to align individual labels 1:1), then approves.
  await step(entry, "application_approve", adoption.currentStatusAfterApproval, async () => {
    await actAs(STAFF.email);
    await markUnderReview(applicationId);
    const checks = await listChecksForApplication(applicationId);
    for (const check of checks) {
      if (check.outcome === "Pending") {
        await completeCheck(check.checkId, "Pass", "Recorded per QA test data.", new Date().toISOString(), STAFF.email, STAFF.name);
      }
    }
    const result = await approveApplication(applicationId, STAFF.email, STAFF.name);
    if (!ok(result)) return fail(`approveApplication failed: ${(result as { reason: string }).reason}`);
    const animal = await getAnimalById(animalId);
    return animal?.currentStatus === adoption.currentStatusAfterApproval
      ? pass(animal.currentStatus)
      : fail(String(animal?.currentStatus));
  });

  // 13. Staff proposes 2 slots; Adopter confirms; Staff records the
  // outcome from the sheet (Compatible for all 60 standard rows -
  // Incompatible is exercised only by the isolated negative-path run).
  await step(entry, "meet_and_greet", "Meet and Greet prerequisite is complete.", async () => {
    await actAs(STAFF.email);
    let mgId = getId(entry, "meetAndGreetId");
    if (!mgId) {
      const proposeResult = await proposeSlots(
        applicationId,
        [
          { dateTime: adoption.meetSlot1 || new Date(Date.now() + 86400000).toISOString(), location: "Shelter Meeting Room 1" },
          { dateTime: adoption.meetSlot2 || new Date(Date.now() + 172800000).toISOString(), location: "Shelter Meeting Room 1" },
        ],
        `${STAFF.name}, ${adopterEntry.email}`,
        STAFF.email,
        STAFF.name,
      );
      if (!ok(proposeResult)) return fail(`proposeSlots failed: ${(proposeResult as { reason: string }).reason}`);
      const mg = await getMeetAndGreetForApplication(applicationId);
      if (!mg) return fail("proposeSlots ok but meet-and-greet not found");
      mgId = mg.meetAndGreetId;
      setId(entry, "meetAndGreetId", mgId);
    }
    const mg = await getMeetAndGreetForApplication(applicationId);
    if (!mg) return fail("meet-and-greet disappeared");

    await actAs(adopterEmail, QA_ADOPTER_PASSWORD);
    if (mg.status === "Proposed") {
      const slotId = mg.slotOptions[0]?.id;
      if (!slotId) return fail("no slot options to select");
      const selectResult = await selectSlot(mgId, slotId);
      if (!ok(selectResult)) return fail(`selectSlot failed: ${(selectResult as { reason: string }).reason}`);
    }
    const afterSelect = await getMeetAndGreetForApplication(applicationId);
    if (afterSelect?.status === "Scheduled" && !afterSelect.attendanceConfirmed) {
      const confirmResult = await confirmAttendance(mgId);
      if (!ok(confirmResult)) return fail(`confirmAttendance failed: ${(confirmResult as { reason: string }).reason}`);
    }
    await actAs(STAFF.email);
    const afterConfirm = await getMeetAndGreetForApplication(applicationId);
    if (afterConfirm?.status === "Scheduled") {
      const outcomeResult = await recordOutcome(mgId, "Compatible", "", "Recorded per QA test data.", STAFF.email, STAFF.name);
      if (!ok(outcomeResult)) return fail(`recordOutcome failed: ${(outcomeResult as { reason: string }).reason}`);
    }
    const final = await getMeetAndGreetForApplication(applicationId);
    return final?.status === "Compatible" ? pass("Compatible") : fail(String(final?.status));
  });

  // 14. Staff + Adopter: generate and sign the Agreement.
  await step(entry, "agreement", "Agreement status = Signed.", async () => {
    await actAs(STAFF.email);
    let agreement = await getActiveAgreementForApplication(applicationId);
    if (!agreement) {
      const genResult = await generateAgreement(applicationId, STAFF.email, STAFF.name);
      if (!ok(genResult)) return fail(`generateAgreement failed: ${(genResult as { reason: string }).reason}`);
      agreement = await getActiveAgreementForApplication(applicationId);
    }
    if (!agreement) return fail("agreement not found after generation");
    setId(entry, "agreementId", agreement.agreementId);
    if (!agreement.isSigned) {
      await actAs(adopterEmail, QA_ADOPTER_PASSWORD);
      const signResult = await signAgreement(agreement.agreementId, adopterEmail, adopterEntry.fullName);
      if (!ok(signResult)) return fail(`signAgreement failed: ${(signResult as { reason: string }).reason}`);
    }
    const final = await getActiveAgreementForApplication(applicationId);
    return final?.isSigned ? pass("Signed") : fail("Not signed");
  });

  // 15. Adopter initiates payment; Staff verifies Cleared.
  await step(entry, "payment", "Payment status = Cleared.", async () => {
    await actAs(adopterEmail, QA_ADOPTER_PASSWORD);
    const agreementId = getId(entry, "agreementId");
    if (!agreementId) return fail("no agreementId recorded");
    let payment = await getLatestPaymentForAgreement(agreementId);
    if (!payment || payment.paymentStatus === "Failed") {
      const methods = await getActiveValues("Payment Method");
      const method = methods[0] ?? "Credit Card";
      const initResult = await initiatePayment(agreementId, method, adopterEmail, adopterEntry.fullName);
      if (!ok(initResult)) return fail(`initiatePayment failed: ${(initResult as { reason: string }).reason}`);
      payment = await getLatestPaymentForAgreement(agreementId);
    }
    if (!payment) return fail("payment not found after initiation");
    if (payment.paymentStatus === "Pending") {
      await actAs(STAFF.email);
      const verifyResult = await verifyPayment(payment.paymentId, "Cleared", STAFF.email, STAFF.name);
      if (!ok(verifyResult)) return fail(`verifyPayment failed: ${(verifyResult as { reason: string }).reason}`);
    }
    const final = await getLatestPaymentForAgreement(agreementId);
    const amountMatch = final?.amount === adoption.paymentAmount;
    return final?.paymentStatus === "Cleared"
      ? pass(`Cleared, amount=${final.amount}`, amountMatch ? undefined : `Expected amount ${adoption.paymentAmount}`)
      : fail(String(final?.paymentStatus));
  });

  // 16. Staff finalises the adoption record.
  await step(entry, "finalise_adoption", adoption.expectedStatusAfterFinalise, async () => {
    await actAs(STAFF.email);
    const result = await finaliseAdoption(applicationId, STAFF.email, STAFF.name);
    if (!ok(result)) return fail(`finaliseAdoption failed: ${(result as { reason: string; blockers: string[] }).blockers.join("; ")}`);
    const animal = await getAnimalById(animalId);
    return pass(String(animal?.currentStatus));
  });

  // 17. Veterinarian Pre-Release Check.
  await step(entry, "pre_release_check", release.preReleaseCheckStatus, async () => {
    await actAs(VET.email);
    const result = await recordPreReleaseCheck(
      animalId,
      {
        checkDate: release.releaseDate || new Date().toISOString(),
        fitnessResult: release.preReleaseOutcome as "Fit for Release" | "Health Concern",
        healthFindings: release.healthFindings,
        medicationGuidance: release.medicationGuidance,
        careInstructions: release.careInstructions,
      },
      VET.email,
      VET.name,
    );
    if (!ok(result)) return fail(`recordPreReleaseCheck failed: ${(result as { reason: string }).reason}`);
    return pass(release.preReleaseOutcome);
  });

  // 18. Staff releases the animal to the (same, per sheet) adopter.
  await step(entry, "release", "currentStatus = inFollowUpPeriod. Follow-Up Visit is created.", async () => {
    await actAs(STAFF.email);
    const result = await releaseAnimal(
      animalId,
      {
        careInstructionsProvided: true,
        releaseDate: release.releaseDate || new Date().toISOString(),
        receivingAdopter: adopterEntry.fullName,
        targetDate: release.followUpTargetDate || new Date(Date.now() + 14 * 86400000).toISOString(),
        followUpType: (release.followUpType || "Phone Call") as "Phone Call" | "Home Visit",
      },
      STAFF.email,
      STAFF.name,
    );
    if (!ok(result)) return fail(`releaseAnimal failed: ${(result as { reason: string }).reason}`);
    const animal = await getAnimalById(animalId);
    return animal?.currentStatus === "inFollowUpPeriod" ? pass(animal.currentStatus) : fail(String(animal?.currentStatus));
  });

  // 19. Staff completes the Follow-Up Visit.
  await step(entry, "follow_up_visit", release.expectedTerminalStatus, async () => {
    await actAs(STAFF.email);
    const visit = await getLatestFollowUpVisitForAnimal(animalId);
    if (!visit) return fail("no follow-up visit found");
    const result = await completeFollowUpVisit(visit.followUpVisitId, release.welfareOutcome as "Settling Well" | "Concerns Noted" | "Unable to Contact Adopter", release.followUpNotes, STAFF.email, STAFF.name);
    if (!ok(result)) return fail(`completeFollowUpVisit failed: ${(result as { reason: string }).reason}`);
    const animal = await getAnimalById(animalId);
    return animal?.currentStatus === release.expectedTerminalStatus
      ? pass(animal.currentStatus)
      : fail(String(animal?.currentStatus));
  });

  // 20. Administrator checks the Audit Log for the expected key events.
  await step(entry, "audit_log_check", release.expectedAuditEvents, async () => {
    await actAs(ADMIN.email);
    // Matches components/audit/audit-log-screen.tsx's own search exactly
    // (a free-text filter over action/entityId/userName/userId/oldValue/
    // newValue, lowercased). Some actions (e.g. Release, Follow-Up) also
    // write a second, differently-entityType-keyed audit entry from
    // inside their own module (e.g. FollowUpVisit/followUpVisitId) - but
    // every status-changing action also goes through
    // changeAnimalStatus(), which always writes its own Animal/AnimalId
    // entry first, so searching by AnimalId alone (one of the Guide's 3
    // suggested terms) empirically does surface every category, even
    // where a second, animal-agnostic entry also exists alongside it.
    const all = await listAuditLog();
    const term = animalId.toLowerCase();
    const matched = all.filter((e) =>
      `${e.action} ${e.entityId} ${e.userName} ${e.userId} ${e.oldValue} ${e.newValue}`.toLowerCase().includes(term),
    );
    const actions = new Set(matched.map((e) => e.action));
    const expectedKeywords = ["Finalise Intake", "Medical Clearance", "Publish", "Approve", "Agreement", "Payment", "Release", "Follow Up"];
    const present = expectedKeywords.filter((kw) => [...actions].some((a) => a.includes(kw)));
    const missing = expectedKeywords.filter((kw) => !present.includes(kw));
    return missing.length === 0
      ? pass(`All key event categories present (searched by AnimalId, ${matched.length} matching entries): ${present.join(", ")}`)
      : fail(`Present: ${present.join(", ")}`, `Missing via AnimalId search: ${missing.join(", ")}`);
  });

  console.log(`    DONE ${tcId} -> AnimalId ${animalId}`);
}
