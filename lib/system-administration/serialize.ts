import type { Species } from "@/lib/animals/types";
import type { DropdownCategory, DropdownOption } from "@/lib/system-administration/types";
import type { SystemSettings } from "@/lib/system-administration/settings-types";

export interface DropdownOptionRow
  extends Omit<DropdownOption, "category" | "speciesId" | "isRetired" | "systemLocked" | "createdAt" | "updatedAt"> {
  category: string;
  speciesId: string | null;
  isRetired: number;
  systemLocked: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toDropdownOption(row: DropdownOptionRow): DropdownOption {
  return {
    ...row,
    category: row.category as DropdownCategory,
    speciesId: (row.speciesId as Species | null) ?? undefined,
    isRetired: row.isRetired === 1,
    systemLocked: row.systemLocked === 1,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface SystemSettingsRow extends Omit<SystemSettings, "allowedAttachmentTypes"> {
  id: string;
  allowedAttachmentTypes: string;
}

export function toSystemSettings(row: SystemSettingsRow): SystemSettings {
  return {
    holdingPeriodDays: row.holdingPeriodDays,
    reminderLeadDays: row.reminderLeadDays,
    allowedAttachmentTypes: JSON.parse(row.allowedAttachmentTypes) as string[],
    maxAttachmentSizeMB: row.maxAttachmentSizeMB,
    agreementTemplateVersion: row.agreementTemplateVersion,
  };
}
