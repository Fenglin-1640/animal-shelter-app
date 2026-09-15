"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { getSystemSettings, updateSystemSettings } from "@/lib/system-administration/settings-store";
import type { SystemSettings } from "@/lib/system-administration/settings-types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

// FR-SA-02: "Administrator 可配置 Statutory Holding Period 天数、到期提醒提前天数、
// 允许的附件类型、最大附件大小和默认 Adoption Agreement 条款版本". Holding Period
// and reminder lead days are read live by lib/statutory-hold/store.ts
// (closing the scope boundary FR-MC-02 disclosed) and the Agreement
// template version is stamped onto every new AdoptionAgreement
// (lib/agreements/store.ts). Attachment type/size rules are stored and
// shown here for real, but not enforced anywhere: every attachment
// upload in this prototype (Council Transfer, Intake, Photos,
// Applications) already discloses that it records file name/size
// metadata only, with no real file content stored to validate against -
// enforcing a byte-level rule against data that doesn't exist would be
// theatre, so these two fields stay informational/for-reference.
export function RuleConfigurationPanel() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>(() => getSystemSettings());
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);
  const [attachmentTypesInput, setAttachmentTypesInput] = useState(() =>
    getSystemSettings().allowedAttachmentTypes.join(", "),
  );

  const handleSave = () => {
    if (!user) return;
    const next: SystemSettings = {
      ...settings,
      allowedAttachmentTypes: attachmentTypesInput
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    };
    updateSystemSettings(next, user.email, user.displayName);
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
            value={settings.maxAttachmentSizeMB}
            onChange={(e) => setSettings({ ...settings, maxAttachmentSizeMB: Number(e.target.value) })}
            className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
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
        Attachment rules are stored for reference only: every attachment in this prototype records
        file name and size metadata, not real file content, so there is nothing to enforce a byte
        limit or file type against.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
        >
          Save Configuration
        </button>
        {savedAt && (
          <span className="text-xs text-text-muted">Saved {formatDateTime(savedAt)}</span>
        )}
      </div>
    </section>
  );
}
