import type { Species } from "@/lib/animals/types";
import type { AdoptionAgreement } from "@/lib/agreements/types";

export interface AdoptionAgreementRow
  extends Omit<AdoptionAgreement, "animalSpecies" | "generatedAt" | "isSigned" | "signedDate" | "createdAt" | "updatedAt"> {
  animalSpecies: string;
  generatedAt: string;
  isSigned: number;
  signedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toAdoptionAgreement(row: AdoptionAgreementRow): AdoptionAgreement {
  return {
    ...row,
    animalSpecies: row.animalSpecies as Species,
    generatedAt: row.generatedAt,
    isSigned: row.isSigned === 1,
    signedDate: row.signedDate ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toAgreementRowPatch(patch: Partial<AdoptionAgreement>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "isSigned") {
      row[key] = value ? 1 : 0;
    } else {
      row[key] = value;
    }
  }
  return row;
}
