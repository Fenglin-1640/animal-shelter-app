import { writeAuditLog } from "@/lib/audit/store";
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from "@/lib/system-administration/settings-types";

// FR-SA-02: a single configuration record, persisted to localStorage
// since there is no backend. Unlike the FR-SA-01 dropdown options (many
// records, one per value), rule configuration is one record covering
// the whole shelter.
const STORAGE_KEY = "asams-system-settings";

export function getSystemSettings(): SystemSettings {
  if (typeof window === "undefined") return DEFAULT_SYSTEM_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SYSTEM_SETTINGS;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...DEFAULT_SYSTEM_SETTINGS, ...parsed } : DEFAULT_SYSTEM_SETTINGS;
  } catch {
    return DEFAULT_SYSTEM_SETTINGS;
  }
}

function formatSettings(settings: SystemSettings): string {
  return `holdingPeriodDays=${settings.holdingPeriodDays}, reminderLeadDays=${settings.reminderLeadDays}, allowedAttachmentTypes=${settings.allowedAttachmentTypes.join("/")}, maxAttachmentSizeMB=${settings.maxAttachmentSizeMB}, agreementTemplateVersion=${settings.agreementTemplateVersion}`;
}

// PRD: "所有配置变化写入 AuditLog."
export async function updateSystemSettings(next: SystemSettings, email: string, name: string): Promise<void> {
  const previous = getSystemSettings();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  await writeAuditLog({
    userId: email,
    userName: name,
    action: "Update System Rule Configuration",
    entityType: "SystemSetting",
    entityId: "system-settings",
    oldValue: formatSettings(previous),
    newValue: formatSettings(next),
    result: "Success",
  });
}
