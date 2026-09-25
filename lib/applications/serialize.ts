import type { AdoptionApplication, ApplicationStatus } from "@/lib/applications/types";
import type { Species } from "@/lib/animals/types";

// Server-side row shape returned by the Prisma 8 contract client (see
// prisma/contract.prisma). documents/profileSnapshot are JSON-encoded
// String columns; applicationStatus/animalSpecies are generic String
// columns, not narrowed to their domain union types.
export interface AdoptionApplicationRow
  extends Omit<
    AdoptionApplication,
    | "animalSpecies"
    | "adoptionFee"
    | "documents"
    | "profileSnapshot"
    | "applicationStatus"
    | "submissionDate"
    | "decisionDate"
    | "decisionByEmail"
    | "decisionByName"
    | "rejectionReason"
    | "createdAt"
    | "updatedAt"
  > {
  animalSpecies: string;
  adoptionFee: number | null;
  documents: string;
  profileSnapshot: string | null;
  applicationStatus: string;
  submissionDate: string | null;
  decisionDate: string | null;
  decisionByEmail: string | null;
  decisionByName: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toAdoptionApplication(row: AdoptionApplicationRow): AdoptionApplication {
  return {
    ...row,
    animalSpecies: row.animalSpecies as Species,
    adoptionFee: row.adoptionFee ?? undefined,
    documents: JSON.parse(row.documents),
    profileSnapshot: row.profileSnapshot ? JSON.parse(row.profileSnapshot) : undefined,
    applicationStatus: row.applicationStatus as ApplicationStatus,
    submissionDate: row.submissionDate ?? undefined,
    decisionDate: row.decisionDate ?? undefined,
    decisionByEmail: row.decisionByEmail ?? undefined,
    decisionByName: row.decisionByName ?? undefined,
    rejectionReason: row.rejectionReason ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Translates a client-supplied Partial<AdoptionApplication> patch (same
// field names as the domain type) into the DB column shape - mirrors
// lib/animals/serialize.ts's toAnimalRowPatch.
export function toApplicationRowPatch(patch: Partial<AdoptionApplication>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "documents" || key === "profileSnapshot") {
      row[key] = value === undefined ? null : JSON.stringify(value);
    } else {
      row[key] = value;
    }
  }
  return row;
}
