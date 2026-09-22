import type { AnimalPhoto, Sex, Species } from "@/lib/animals/types";
import type { IntakeRecord } from "@/lib/intake-records/types";

export interface IntakeRecordRow
  extends Omit<
    IntakeRecord,
    | "councilTransferSubmissionId"
    | "species"
    | "sex"
    | "photos"
    | "createdAt"
    | "updatedAt"
    | "finalisedAt"
    | "registeredOwnerContact"
  > {
  councilTransferSubmissionId: string | null;
  species: string;
  sex: string;
  photos: string;
  createdAt: string;
  updatedAt: string;
  finalisedAt: string | null;
  registeredOwnerContactName: string | null;
  registeredOwnerContactPhone: string | null;
  registeredOwnerContactAddress: string | null;
}

export function toIntakeRecord(row: IntakeRecordRow): IntakeRecord {
  return {
    ...row,
    councilTransferSubmissionId: row.councilTransferSubmissionId ?? undefined,
    species: row.species as Species | "",
    sex: row.sex as Sex | "",
    photos: JSON.parse(row.photos) as AnimalPhoto[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finalisedAt: row.finalisedAt ?? undefined,
    registeredOwnerContact: row.registeredOwnerContactName
      ? {
          name: row.registeredOwnerContactName,
          phone: row.registeredOwnerContactPhone ?? "",
          address: row.registeredOwnerContactAddress ?? "",
        }
      : undefined,
  };
}

export function toIntakeRecordRowPatch(patch: Partial<IntakeRecord>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "photos") {
      row[key] = JSON.stringify(value);
    } else if (key === "registeredOwnerContact") {
      const contact = value as IntakeRecord["registeredOwnerContact"];
      row.registeredOwnerContactName = contact?.name ?? null;
      row.registeredOwnerContactPhone = contact?.phone ?? null;
      row.registeredOwnerContactAddress = contact?.address ?? null;
    } else {
      row[key] = value;
    }
  }
  return row;
}
