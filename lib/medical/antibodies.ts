// Antibody (titre) checks and the antibody check made before a vaccine is
// given. Shared by the client screens and the vaccination route, so both
// apply the same rule.

export const ANTIBODY_RESULTS = ["Protective", "Insufficient", "None", "Invalid"] as const;
export type AntibodyResult = (typeof ANTIBODY_RESULTS)[number];

export const ANTIGENS = [
  "Canine parvovirus",
  "Canine distemper",
  "Canine adenovirus (hepatitis)",
  "Canine parainfluenza",
  "Bordetella",
  "Leptospirosis",
  "Feline panleukopenia (enteritis)",
  "Feline herpesvirus",
  "Feline calicivirus",
  "Feline leukaemia (FeLV)",
  "Chlamydia",
  "Rabies",
] as const;

export interface AntibodyCheck {
  id: string;
  animalId: string;
  antigen: string;
  result: AntibodyResult;
  testDate: string;
  expiryDate?: string;
  notes: string;
  recordedByEmail: string;
  recordedByName: string;
  createdAt: string;
}

export interface AntibodyCheckRow extends Omit<AntibodyCheck, "result" | "expiryDate"> {
  result: string;
  expiryDate: string | null;
}

export function toAntibodyCheck(row: AntibodyCheckRow): AntibodyCheck {
  return { ...row, result: row.result as AntibodyResult, expiryDate: row.expiryDate ?? undefined };
}

// The antigens each seeded Vaccine Type protects against. A Vaccine Type
// added later in System Administration with no entry here is matched by
// its own name, so a titre recorded under that name still counts.
const VACCINE_ANTIGENS: Record<string, string[]> = {
  F3: ["Feline panleukopenia (enteritis)", "Feline herpesvirus", "Feline calicivirus"],
  F4: ["Feline panleukopenia (enteritis)", "Feline herpesvirus", "Feline calicivirus", "Feline leukaemia (FeLV)"],
  F5: ["Feline panleukopenia (enteritis)", "Feline herpesvirus", "Feline calicivirus", "Chlamydia", "Feline leukaemia (FeLV)"],
  C3: ["Canine parvovirus", "Canine distemper", "Canine adenovirus (hepatitis)"],
  C4: ["Canine parvovirus", "Canine distemper", "Canine adenovirus (hepatitis)", "Canine parainfluenza"],
  C5: ["Canine parvovirus", "Canine distemper", "Canine adenovirus (hepatitis)", "Canine parainfluenza", "Bordetella"],
  C7: ["Canine parvovirus", "Canine distemper", "Canine adenovirus (hepatitis)", "Canine parainfluenza", "Bordetella", "Leptospirosis"],
  "Kennel Cough (Bordetella)": ["Bordetella", "Canine parainfluenza"],
};

export function antigensForVaccine(vaccineType: string): string[] {
  return VACCINE_ANTIGENS[vaccineType] ?? [vaccineType];
}

// A Protective result that has not expired (no expiry date means it
// stands until a newer check replaces it). Only the newest check per
// antigen counts.
export function protectiveAntigens(checks: AntibodyCheck[], now = Date.now()): Set<string> {
  const latest = new Map<string, AntibodyCheck>();
  for (const c of checks) {
    const prev = latest.get(c.antigen);
    if (!prev || new Date(c.testDate).getTime() > new Date(prev.testDate).getTime()) latest.set(c.antigen, c);
  }
  const result = new Set<string>();
  for (const c of latest.values()) {
    if (c.result === "Protective" && (!c.expiryDate || new Date(c.expiryDate).getTime() >= now)) result.add(c.antigen);
  }
  return result;
}

// The antigens of this vaccine the animal already has current antibodies for.
export function existingAntibodiesFor(vaccineType: string, checks: AntibodyCheck[], now = Date.now()): string[] {
  const protective = protectiveAntigens(checks, now);
  return antigensForVaccine(vaccineType).filter((a) => protective.has(a));
}

export const OVERRIDE_REASONS = [
  "Antibodies insufficient",
  "Antibodies expired",
  "Maternal antibody interference (juvenile, per protocol)",
  "Immunisation history unverifiable",
  "Booster due per protocol",
  "Different strain/valency",
  "Immunocompromised or recent illness",
  "Outbreak/exposure risk",
  "Boarding/transport/regulatory requirement",
  "Titre test inconclusive/invalid",
  "Other",
] as const;
export type OverrideReason = (typeof OVERRIDE_REASONS)[number];

export function isValidOverride(reason: string | undefined, note: string | undefined): boolean {
  if (!reason || !(OVERRIDE_REASONS as readonly string[]).includes(reason)) return false;
  return reason !== "Other" || Boolean(note?.trim());
}
