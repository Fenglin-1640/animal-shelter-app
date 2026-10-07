"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { getSystemSettings, updateSystemSettings } from "@/lib/system-administration/settings-store";
import { MAX_ATTACHMENT_SIZE_MB, type SystemSettings } from "@/lib/system-administration/settings-types";
import { formatDateTime } from "@/lib/shared/dates";

// FR-SA-02: "Administrator 可配置 Statutory Holding Period 天数、到期提醒提前天数、
// 允许的附件类型、最大附件大小和默认 Adoption Agreement 条款版本". Holding Period
// and reminder lead days are read live by lib/statutory-hold/store.ts
// (closing the scope boundary FR-MC-02 disclosed) and the Agreement
// template version is stamped onto every new AdoptionAgreement
// (lib/agreements/store.ts). The attachment types and size limit are
// enforced on adoption application document uploads (lib/files) and on
// Council Transfer attachments; the size can only be set from 1 to 5 MB,
// the most the system stores.
export function RuleConfigurationPanel() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | undefined>(undefined);
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);
  const [attachmentTypesInput, setAttachmentTypesInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSystemSettings().then((result) => {
      if (cancelled) return;
      setSettings(result);
      setAttachmentTypesInput(result.allowedAttachmentTypes.join(", "));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (settings === undefined) {
    return (
      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Rule Configuration</h2>
        <p className="mt-2 text-sm text-text-muted">Loading...</p>
      </section>
    );
  }

  const sizeValid =
    Number.isInteger(settings.maxAttachmentSizeMB) && settings.maxAttachmentSizeMB >= 1 && settings.maxAttachmentSizeMB <= MAX_ATTACHMENT_SIZE_MB;

  const handleSave = async () => {
    if (!user || !sizeValid) return;
    setSaveError(null);
    const next: SystemSettings = {
      ...settings,
      allowedAttachmentTypes: attachmentTypesInput
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    };
    const result = await updateSystemSettings(next, user.email, user.displayName);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    setSettings(next);
    setSavedAt(new Date().toISOString());
  };

  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 className="text-lg font-bold text-text">Rule Configuration</h2>
      <p className="mt-1 text-sm text-text-muted">
        Shelter-wide settings used across the application. Every change is written to the Audit
        Log.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="holding-period-days" className="text-xs font-semibold text-text-muted">
            Statutory Holding Period (days)
          </label>
          <input
            id="holding-period-days"
            type="number"
            min={1}
            value={settings.holdingPeriodDays}
            onChange={(e) => setSettings({ ...settings, holdingPeriodDays: Number(e.target.value) })}
            className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="reminder-lead-days" className="text-xs font-semibold text-text-muted">
            Reminder Lead Time (days before expiry)
          </label>
          <input
            id="reminder-lead-days"
            type="number"
            min={0}
            value={settings.reminderLeadDays}
            onChange={(e) => setSettings({ ...settings, reminderLeadDays: Number(e.target.value) })}
            className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="attachment-types" className="text-xs font-semibold text-text-muted">
            Allowed Attachment Types (comma-separated)
          </label>
          <input
            id="attachment-types"
            type="text"
            value={attachmentTypesInput}
            onChange={(e) => setAttachmentTypesInput(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="max-attachment-size" className="text-xs font-semibold text-text-muted">
            Max Attachment Size (MB)
          </label>
          <input
            id="max-attachment-size"
            type="number"
            min={1}
            max={MAX_ATTACHMENT_SIZE_MB}
            step={1}
            value={settings.maxAttachmentSizeMB}
            aria-invalid={!sizeValid}
            aria-describedby="max-attachment-size-help"
            onChange={(e) => setSettings({ ...settings, maxAttachmentSizeMB: Number(e.target.value) })}
            className={`h-9 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${sizeValid ? "border-border" : "border-danger"}`}
          />
          <p id="max-attachment-size-help" className={`text-xs ${sizeValid ? "text-text-muted" : "text-danger"}`}>
            {sizeValid ? `1 to ${MAX_ATTACHMENT_SIZE_MB} MB.` : `Enter a whole number from 1 to ${MAX_ATTACHMENT_SIZE_MB} MB.`}
          </p>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="agreement-template-version" className="text-xs font-semibold text-text-muted">
            Default Adoption Agreement Template Version
          </label>
          <input
            id="agreement-template-version"
            type="text"
            value={settings.agreementTemplateVersion}
            onChange={(e) => setSettings({ ...settings, agreementTemplateVersion: e.target.value })}
            className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-text-muted">
        Allowed types and maximum size are enforced when documents are uploaded.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!sizeValid}
          className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Configuration
        </button>
        {saveError && (
          <span role="alert" className="text-xs text-danger">
            {saveError}
          </span>
        )}
        {savedAt && (
          <span className="text-xs text-text-muted">Saved {formatDateTime(savedAt)}</span>
        )}
      </div>
    </section>
  );
}
