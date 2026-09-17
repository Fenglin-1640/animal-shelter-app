import type { Species } from "@/lib/animals/types";
import type { AdoptionAgreement } from "@/lib/agreements/types";

export interface AdoptionAgreementRow
  extends Omit<AdoptionAgreement, "animalSpecies" | "generatedAt" | "isSigned" | "signedDate" | "createdAt" | "updatedAt"> {
  animalSpecies: string;
  generatedAt: Date;
  isSigned: number;
  signedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toAdoptionAgreement(row: AdoptionAgreementRow): AdoptionAgreement {
  return {
    ...row,
    animalSpecies: row.animalSpecies as Species,
    generatedAt: row.generatedAt.toISOString(),
    isSigned: row.isSigned === 1,
    signedDate: row.signedDate?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAgreementRowPatch(patch: Partial<AdoptionAgreement>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "isSigned") {
      row[key] = value ? 1 : 0;
    } else if (key === "generatedAt" || key === "signedDate" || key === "createdAt" || key === "updatedAt") {
      row[key] = typeof value === "string" ? new Date(value) : value;
    } else {
      row[key] = value;
    }
  }
  return row;
}
