import { EMPTY_ADOPTER_PROFILE, type AdopterProfile } from "@/lib/adopter-profile/types";

// Adopter's own maintained profile (FR-ADP-01), persisted to localStorage
// since there is no backend. Keyed by the account's email.
const STORAGE_KEY = "asams-adopter-profiles";

// The demo Adopter (Jordan Taylor) already has applications and an
// upcoming Meet and Greet seeded elsewhere, so a completed profile here
// continues that story. Any other Adopter starts from EMPTY_ADOPTER_PROFILE.
const SEED_PROFILES: Record<string, AdopterProfile> = {
  "adopter@asams.demo": {
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
  },
};

function loadAll(): Record<string, AdopterProfile> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(all: Record<string, AdopterProfile>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getAdopterProfile(email: string): AdopterProfile {
  const normalized = email.trim().toLowerCase();
  const stored = loadAll()[normalized];
  if (stored) return stored;
  return SEED_PROFILES[normalized] ?? EMPTY_ADOPTER_PROFILE;
}

export function saveAdopterProfile(email: string, profile: AdopterProfile) {
  const normalized = email.trim().toLowerCase();
  const all = loadAll();
  all[normalized] = profile;
  saveAll(all);
}
