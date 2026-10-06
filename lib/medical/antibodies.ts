// Antibody (titre) checks and the antibody question asked before a vaccine
// is given. Which antigens a vaccine covers comes from the vaccine model
// (lib/medical/vaccine-model.ts); this module handles the results.

import { antigenKey, type ResolvedVaccineType } from "@/lib/medical/vaccine-model";

export const ANTIBODY_RESULTS = ["Protective", "Insufficient", "None", "Invalid"] as const;
export type AntibodyResult = (typeof ANTIBODY_RESULTS)[number];

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

// Antigen keys with a current Protective result: only the newest check
// per antigen counts, and it must not have expired (no expiry date means
// it stands until a newer check replaces it).
export function protectiveAntigens(checks: AntibodyCheck[], now = Date.now()): Set<string> {
  const latest = new Map<string, AntibodyCheck>();
  for (const c of checks) {
    const key = antigenKey(c.antigen);
    const prev = latest.get(key);
    if (!prev || new Date(c.testDate).getTime() > new Date(prev.testDate).getTime()) latest.set(key, c);
  }
  const result = new Set<string>();
  for (const [key, c] of latest) {
    if (c.result === "Protective" && (!c.expiryDate || new Date(c.expiryDate).getTime() >= now)) result.add(key);
  }
  return result;
}

// The antigen labels of this vaccine the animal already has current
// antibodies for (empty when the antibody question does not apply).
export function flaggedAntigens(type: ResolvedVaccineType, checks: AntibodyCheck[], now = Date.now()): string[] {
  const protective = protectiveAntigens(checks, now);
  return type.antigens.map((a, i) => (protective.has(a) ? type.antigenLabels[i] : null)).filter((a): a is string => Boolean(a));
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
