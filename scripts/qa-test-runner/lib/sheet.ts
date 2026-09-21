// Parses test-data/ASAMS_60_Animal_Test_Data.xlsx into typed row maps.
// Every sheet's real header is row index 4 (0-based) - rows 0-3 are a
// title/description block, data starts at row 5. Test Case ID (column A
// on Intake/Assessments/Adoption/Release) is a spreadsheet-only join key
// used here to correlate rows across sheets before the animal exists in
// ASAMS - it is never written to the app's database (see runlog.ts,
// which maps it to the real AnimalId once Finalise Intake returns one).
import path from "node:path";
import XLSX from "xlsx";

const WORKBOOK_PATH = path.join(__dirname, "..", "..", "..", "test-data", "ASAMS_60_Animal_Test_Data.xlsx");

function sheetRows(sheetName: string): Record<string, string | number>[] {
  const wb = XLSX.readFile(WORKBOOK_PATH);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet not found: ${sheetName}`);
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: "" });
  const header = raw[4].map((h) => String(h));
  const rows: Record<string, string | number>[] = [];
  for (let i = 5; i < raw.length; i++) {
    const r = raw[i];
    if (!r[0]) continue;
    const obj: Record<string, string | number> = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

// Excel serial date (1900 system) -> ISO date string (date-only, no time
// component needed for any field these sheets feed).
export function excelDateToISO(value: string | number): string {
  if (value === "" || value == null) return "";
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return value;
  }
  // Excel epoch is 1899-12-30 (accounts for the 1900 leap year bug).
  const ms = Math.round((value - 25569) * 86400 * 1000);
  return new Date(ms).toISOString();
}

export interface IntakeRow {
  testCaseId: string;
  species: string;
  breed: string;
  animalName: string;
  sex: string;
  estimatedAgeYears: number;
  transferSource: string;
  arrivalCircumstance: string;
  foundLocation: string;
  preliminaryDescription: string;
  transferAttachment: string;
  arrivalDateTime: string;
  intakeSource: string;
  councilReference: string;
  coatColour: string;
  coatMarkings: string;
  photoFilename: string;
  photoAltText: string;
  expectedCurrentStatus: string;
  expectedListingStatus: string;
  executionRoute: string;
}

export function getIntakeRows(): IntakeRow[] {
  return sheetRows("Intake").map((r) => ({
    testCaseId: String(r["Test Case ID"]),
    species: String(r["Species"]),
    breed: String(r["Breed"]),
    animalName: String(r["Animal Name"]),
    sex: String(r["Sex"]),
    estimatedAgeYears: Number(r["Estimated Age (years)"]) || 0,
    transferSource: String(r["Transfer Source"]),
    arrivalCircumstance: String(r["Arrival Circumstance"]),
    foundLocation: String(r["Found Location"]),
    preliminaryDescription: String(r["Preliminary Animal Description"]),
    transferAttachment: String(r["Transfer Attachment"]),
    arrivalDateTime: excelDateToISO(r["Arrival Date/Time"]),
    intakeSource: String(r["Intake Source"]),
    councilReference: String(r["Council Reference"]),
    coatColour: String(r["Coat Colour"]),
    coatMarkings: String(r["Coat Markings"]),
    photoFilename: String(r["Photo Filename"]),
    photoAltText: String(r["Photo Alt Text"]),
    expectedCurrentStatus: String(r["Expected currentStatus"]),
    expectedListingStatus: String(r["Expected listingStatus"]),
    executionRoute: String(r["Execution Route"]),
  }));
}

export interface AssessmentRow {
  testCaseId: string;
  animalName: string;
  species: string;
  breed: string;
  microchipNumber: string;
  expectedResult: string;
  examinationObservations: string;
  sampleTestResults: string;
  diagnosedConditions: string;
  bodyCondition: string;
  assessmentDate: string;
  urgentTreatmentRequired: boolean;
  healthNotes: string;
  healthRecheckRequired: boolean;
  healthRecheckDate: string;
  recheckFindings: string;
  finalHealthTask: string;
  handlingResponse: string;
  reactionToStrangers: string;
  foodBehaviour: string;
  interactionWithOtherAnimals: string;
  socialisationScore: number;
  behaviourObservations: string;
  recommendations: string;
  behaviourAssessmentDate: string;
  followUpRequired: boolean;
  outcome: string;
  adoptionFitnessAction: string;
  expectedStopOrNextStep: string;
}

export function getAssessmentRows(): AssessmentRow[] {
  return sheetRows("Assessments").map((r) => ({
    testCaseId: String(r["Test Case ID"]),
    animalName: String(r["Animal Name"]),
    species: String(r["Species"]),
    breed: String(r["Breed"]),
    microchipNumber: String(r["Microchip Number"]),
    expectedResult: String(r["Expected Result"]),
    examinationObservations: String(r["Examination Observations"]),
    sampleTestResults: String(r["Sample Test Results"]),
    diagnosedConditions: String(r["Diagnosed Conditions"]),
    bodyCondition: String(r["Body Condition"]),
    assessmentDate: excelDateToISO(r["Assessment Date"]),
    urgentTreatmentRequired: String(r["Urgent Treatment Required"]).toLowerCase() === "yes",
    healthNotes: String(r["Health Notes"]),
    healthRecheckRequired: String(r["Health Recheck Required"]).toLowerCase() === "yes",
    healthRecheckDate: excelDateToISO(r["Health Recheck Date"]),
    recheckFindings: String(r["Recheck Findings"]),
    finalHealthTask: String(r["Final Health Task"]),
    handlingResponse: String(r["Handling Response"]),
    reactionToStrangers: String(r["Reaction to Strangers"]),
    foodBehaviour: String(r["Food Behaviour"]),
    interactionWithOtherAnimals: String(r["Interaction with Other Animals"]),
    socialisationScore: Number(r["Socialisation Score"]) || 0,
    behaviourObservations: String(r["Behaviour Observations"]),
    recommendations: String(r["Recommendations"]),
    behaviourAssessmentDate: excelDateToISO(r["Behaviour Assessment Date"]),
    followUpRequired: String(r["Follow Up Required"]).toLowerCase() === "yes",
    outcome: String(r["Outcome"]),
    adoptionFitnessAction: String(r["Adoption Fitness Action"]),
    expectedStopOrNextStep: String(r["Expected Stop or Next Step"]),
  }));
}

export interface AdoptionRow {
  testCaseId: string;
  animalName: string;
  species: string;
  breed: string;
  executionRoute: string;
  vaccineType: string;
  administrationDate: string;
  doseOrChipId: string;
  nextBoosterDue: string;
  desexingTestAction: string;
  desexingScheduledDate: string;
  desexingStatus: string;
  medicalClearanceNotes: string;
  clearanceExpected: string;
  listingStatusAfterClearance: string;
  adoptionFee: number;
  temperaments: string;
  generalDescription: string;
  publishExpected: string;
  currentStatusAfterPublish: string;
  listingStatusAfterPublish: string;
  adopterId: string;
  motivationStatement: string;
  supportingDocument: string;
  suitabilityChecks: string;
  applicationDecision: string;
  currentStatusAfterApproval: string;
  meetSlot1: string;
  meetSlot2: string;
  selectedSlot: string;
  meetAndGreetOutcome: string;
  ifIncompatible: string;
  adoptionAgreement: string;
  paymentMethod: string;
  paymentAmount: number;
  paymentVerification: string;
  expectedStatusAfterFinalise: string;
}

export function getAdoptionRows(): AdoptionRow[] {
  return sheetRows("Adoption").map((r) => ({
    testCaseId: String(r["Test Case ID"]),
    animalName: String(r["Animal Name"]),
    species: String(r["Species"]),
    breed: String(r["Breed"]),
    executionRoute: String(r["Execution Route"]),
    vaccineType: String(r["Vaccine Type"]),
    administrationDate: excelDateToISO(r["Administration Date"]),
    doseOrChipId: String(r["Dose / Chip ID"]),
    nextBoosterDue: excelDateToISO(r["Next Booster Due"]),
    desexingTestAction: String(r["Desexing Test Action"]),
    desexingScheduledDate: excelDateToISO(r["Desexing Scheduled Date"]),
    desexingStatus: String(r["Desexing Status"]),
    medicalClearanceNotes: String(r["Medical Clearance Notes"]),
    clearanceExpected: String(r["Clearance Expected"]),
    listingStatusAfterClearance: String(r["listingStatus after Clearance"]),
    adoptionFee: Number(r["Adoption Fee (AUD)"]) || 0,
    temperaments: String(r["Temperaments"]),
    generalDescription: String(r["General Description"]),
    publishExpected: String(r["Publish Expected"]),
    currentStatusAfterPublish: String(r["currentStatus after Publish"]),
    listingStatusAfterPublish: String(r["listingStatus after Publish"]),
    adopterId: String(r["Adopter ID"]),
    motivationStatement: String(r["Motivation Statement"]),
    supportingDocument: String(r["Supporting Document"]),
    suitabilityChecks: String(r["Suitability Checks"]),
    applicationDecision: String(r["Application Decision"]),
    currentStatusAfterApproval: String(r["currentStatus after Approval"]),
    meetSlot1: excelDateToISO(r["Meet Slot 1"]),
    meetSlot2: excelDateToISO(r["Meet Slot 2"]),
    selectedSlot: String(r["Selected Slot"]),
    meetAndGreetOutcome: String(r["Meet and Greet Outcome"]),
    ifIncompatible: String(r["If Incompatible"]),
    adoptionAgreement: String(r["Adoption Agreement"]),
    paymentMethod: String(r["Payment Method"]),
    paymentAmount: Number(r["Payment Amount (AUD)"]) || 0,
    paymentVerification: String(r["Payment Verification"]),
    expectedStatusAfterFinalise: String(r["Expected Status after Finalise"]),
  }));
}

export interface ReleaseRow {
  testCaseId: string;
  animalName: string;
  species: string;
  breed: string;
  executionRoute: string;
  preReleaseOutcome: string;
  healthFindings: string;
  medicationGuidance: string;
  preReleaseCheckStatus: string;
  releaseDate: string;
  careInstructions: string;
  receivingAdopterId: string;
  followUpType: string;
  followUpTargetDate: string;
  welfareOutcome: string;
  followUpNotes: string;
  expectedTerminalStatus: string;
  auditSearchTerm: string;
  expectedAuditEvents: string;
}

export function getReleaseRows(): ReleaseRow[] {
  return sheetRows("Release").map((r) => ({
    testCaseId: String(r["Test Case ID"]),
    animalName: String(r["Animal Name"]),
    species: String(r["Species"]),
    breed: String(r["Breed"]),
    executionRoute: String(r["Execution Route"]),
    preReleaseOutcome: String(r["Pre-Release Outcome"]),
    healthFindings: String(r["Health Findings"]),
    medicationGuidance: String(r["Medication Guidance"]),
    preReleaseCheckStatus: String(r["Pre-Release Check Status"]),
    releaseDate: excelDateToISO(r["Release Date"]),
    careInstructions: String(r["Care Instructions"]),
    receivingAdopterId: String(r["Receiving Adopter ID"]),
    followUpType: String(r["Follow Up Type"]),
    followUpTargetDate: excelDateToISO(r["Follow-Up Target Date"]),
    welfareOutcome: String(r["Welfare Outcome"]),
    followUpNotes: String(r["Follow-Up Notes"]),
    expectedTerminalStatus: String(r["Expected Terminal Status"]),
    auditSearchTerm: String(r["Audit Search Term"]),
    expectedAuditEvents: String(r["Expected Audit Events"]),
  }));
}

export interface AdopterRow {
  adopterId: string;
  fullName: string;
  email: string;
  phone: string;
  household: string;
  ownership: string;
  pets: string;
  environment: string;
  hoursAlonePerWeekday: number;
  preferredSpecies: string;
  refereeName: string;
  refereeContact: string;
  consent: boolean;
}

export function getAdopterRows(): AdopterRow[] {
  return sheetRows("Adopters").map((r) => ({
    adopterId: String(r["Adopter ID"]),
    fullName: String(r["Full Name"]),
    email: String(r["Email"]),
    phone: String(r["Phone"]),
    household: String(r["Household"]),
    ownership: String(r["Ownership / Landlord Permission"]),
    pets: String(r["Pets"]),
    environment: String(r["Environment"]),
    hoursAlonePerWeekday: Number(r["Hours Alone per Weekday"]) || 0,
    preferredSpecies: String(r["Preferred Species"]),
    refereeName: String(r["Referee Name"]),
    refereeContact: String(r["Referee Contact"]),
    consent: String(r["Consent"]).toLowerCase() === "yes",
  }));
}
