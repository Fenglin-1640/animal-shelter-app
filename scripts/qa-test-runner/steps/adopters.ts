// Prerequisite phase: create a real ASAMS Adopter account + saved
// AdopterProfile for each of the Adopters sheet's 8 synthetic rows.
// Application submission (lib/applications/store.ts's submitApplication)
// requires a complete profile via getAdopterProfileSubmissionBlockers,
// so this must run before any per-animal Adoption phase.
import { saveAdopterProfile } from "@/lib/adopter-profile/store";
import type { AdopterProfile } from "@/lib/adopter-profile/types";
import { HOUSEHOLD_TYPES, HOME_OWNERSHIP_OPTIONS, HOURS_ALONE_OPTIONS } from "@/lib/adopter-profile/options";
import type { Species } from "@/lib/animals/types";
import { getAdopterRows, type AdopterRow } from "../lib/sheet";
import { getAdopter, setAdopter } from "../lib/runlog";
import { installFetchShim } from "../lib/fetch-shim";

const SIGNUP_PASSWORD = "QaTest123!";

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? fullName, lastName: parts.slice(1).join(" ") || parts[0] };
}

function pickHouseholdType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("apartment")) return "Apartment/Unit";
  if (t.includes("townhouse")) return "Townhouse";
  if (t.includes("rural")) return "Rural Property";
  return HOUSEHOLD_TYPES[0]; // "House"
}

// "Rent" appears in the Household column ("...rent townhouse"), not
// Ownership (which just says whether landlord permission was supplied,
// not own-vs-rent).
function pickHomeOwnership(household: string): string {
  return /rent/i.test(household) ? "Rent" : HOME_OWNERSHIP_OPTIONS[0]; // "Own"
}

function pickHoursAlone(hours: number): string {
  if (hours < 2) return HOURS_ALONE_OPTIONS[0];
  if (hours <= 4) return HOURS_ALONE_OPTIONS[1];
  if (hours <= 8) return HOURS_ALONE_OPTIONS[2];
  return HOURS_ALONE_OPTIONS[3];
}

function parseAdultsChildren(household: string): { adults: string; children: string } {
  const adultsMatch = household.match(/(\d+)\s*adults?/i);
  const adults = adultsMatch ? adultsMatch[1] : "1";
  if (/no children/i.test(household)) return { adults, children: "0" };
  const childCountMatch = household.match(/(\d+)\s*child/i);
  if (childCountMatch) return { adults, children: childCountMatch[1] };
  if (/\bone (child|teenager)/i.test(household)) return { adults, children: "1" };
  return { adults, children: "0" };
}

function parseRefereeContact(contact: string): { phone: string; email: string } {
  const [phonePart, emailPart] = contact.split("/").map((s) => s.trim());
  return { phone: phonePart ?? "", email: emailPart ?? "" };
}

function buildProfile(row: AdopterRow, index: number): AdopterProfile {
  const { adults, children } = parseAdultsChildren(row.household);
  const { phone: refereePhone, email: refereeEmail } = parseRefereeContact(row.refereeContact);
  const hasExistingPets = !/no current pets/i.test(row.pets);

  return {
    // The sheet has no street-address column for adopters - synthesised
    // deterministically per Adopter ID since one is required to submit
    // an application (getAdopterProfileSubmissionBlockers).
    residentialAddress: `${10 + index} Example Street, Brisbane QLD 4000`,
    householdType: pickHouseholdType(row.household),
    homeOwnership: pickHomeOwnership(row.household),
    // Only actually gates submission when renting (see
    // getAdopterProfileSubmissionBlockers) - an owner's row reads "no
    // landlord permission required", not "permission denied", so that
    // phrase means the opposite of what a naive "no...permission" match
    // would suggest.
    landlordPermission: pickHomeOwnership(row.household) === "Own" || /permission supplied/i.test(row.ownership),
    adultsInHousehold: adults,
    childrenInHousehold: children,
    hasExistingPets,
    existingPetDetails: hasExistingPets ? row.pets : "",
    environmentDetails: row.environment,
    hoursAlone: pickHoursAlone(row.hoursAlonePerWeekday),
    preferredSpecies: [row.preferredSpecies as Species],
    refereeName: row.refereeName,
    // Not a separate sheet column - the sheet only names/contacts the
    // referee, not their relationship to the adopter.
    refereeRelationship: "Friend",
    refereePhone,
    refereeEmail,
    refereeConsent: row.consent,
    refereeConsentAt: row.consent ? new Date().toISOString() : undefined,
  };
}

async function signUp(row: AdopterRow): Promise<{ ok: boolean; reason?: string }> {
  const { firstName, lastName } = splitName(row.fullName);
  const res = await fetch("/api/auth/sign-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Mx",
      firstName,
      lastName,
      email: row.email,
      phone: row.phone,
      password: SIGNUP_PASSWORD,
    }),
  });
  const result = await res.json();
  if (result.ok) return { ok: true };
  if (result.reason === "duplicate") return { ok: true, reason: "already existed" };
  return { ok: false, reason: result.reason ?? "unknown" };
}

export async function runAdoptersPhase(force = false): Promise<void> {
  installFetchShim();
  const rows = getAdopterRows();
  console.log(`\n=== Adopters phase (${rows.length} synthetic accounts) ===`);

  for (const row of rows) {
    const existing = getAdopter(row.adopterId);
    if (!force && existing?.signedUp && existing?.profileSaved) {
      console.log(`  ${row.adopterId} (${row.email}): already done, skipping`);
      continue;
    }

    const signupResult = await signUp(row);
    if (!signupResult.ok) {
      console.error(`  ${row.adopterId} (${row.email}): SIGN-UP FAILED - ${signupResult.reason}`);
      setAdopter(row.adopterId, { email: row.email, fullName: row.fullName, signedUp: false, profileSaved: false });
      continue;
    }

    const profile = buildProfile(row, rows.indexOf(row));
    await saveAdopterProfile(row.email, profile);

    setAdopter(row.adopterId, { email: row.email, fullName: row.fullName, signedUp: true, profileSaved: true });
    console.log(`  ${row.adopterId} (${row.email}): ready${signupResult.reason ? ` (${signupResult.reason})` : ""}`);
  }
}
