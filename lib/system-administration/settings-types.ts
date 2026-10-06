// FR-SA-02 / PRD 6.3: "Administrator 可配置 Statutory Holding Period 天数、
// 到期提醒提前天数、允许的附件类型、最大附件大小和默认 Adoption Agreement 条款版本。"
export interface SystemSettings {
  holdingPeriodDays: number;
  reminderLeadDays: number;
  allowedAttachmentTypes: string[];
  maxAttachmentSizeMB: number;
  agreementTemplateVersion: string;
}

// Matches the values FR-MC-02 hardcoded before this FR existed
// (lib/statutory-hold/types.ts's former DEFAULT_HOLDING_PERIOD_DAYS/
// DEFAULT_REMINDER_LEAD_DAYS), so wiring this in changes no existing
// behaviour until an Administrator actually edits it.
// Uploads are stored in the database in chunks; 5 MB is the most the
// system accepts, so the setting can only narrow it.
export const MAX_ATTACHMENT_SIZE_MB = 5;

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  holdingPeriodDays: 7,
  reminderLeadDays: 2,
  allowedAttachmentTypes: ["PDF", "JPG", "PNG"],
  maxAttachmentSizeMB: 5,
  agreementTemplateVersion: "v1.0",
};
