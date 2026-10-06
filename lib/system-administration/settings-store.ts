import { writeAuditLog } from "@/lib/audit/store";
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from "@/lib/system-administration/settings-types";
import { getJson, send } from "@/lib/shared/http";

// FR-SA-02: the single shelter-wide configuration record now lives in
// the database (see prisma/contract.prisma) behind /api/system-settings
// - see prisma/README.md for this Prisma toolchain's quirks. Unlike the
// FR-SA-01 dropdown options (many records, one per value), rule
// configuration is one singleton record covering the whole shelter.

export async function getSystemSettings(): Promise<SystemSettings> {
  const result = await getJson("/api/system-settings");
  return (result.item as SystemSettings | null) ?? DEFAULT_SYSTEM_SETTINGS;
}

function formatSettings(settings: SystemSettings): string {
  return `holdingPeriodDays=${settings.holdingPeriodDays}, reminderLeadDays=${settings.reminderLeadDays}, allowedAttachmentTypes=${settings.allowedAttachmentTypes.join("/")}, maxAttachmentSizeMB=${settings.maxAttachmentSizeMB}, agreementTemplateVersion=${settings.agreementTemplateVersion}`;
}

// PRD: "所有配置变化写入 AuditLog."
// Refused settings (e.g. a size outside 1-5 MB) are not saved or audited.
export async function updateSystemSettings(
  next: SystemSettings,
  email: string,
  name: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const previous = await getSystemSettings();
  const response = await send("/api/system-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  const result = await response.json().catch(() => ({ ok: false }));
  if (!result.ok) return { ok: false, message: result.message ?? "The configuration could not be saved." };

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
  return { ok: true };
}
