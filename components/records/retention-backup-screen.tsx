"use client";

import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { listAllApplications } from "@/lib/applications/store";
import { listAuditLog } from "@/lib/audit/store";
import { listIntakeRecords } from "@/lib/intake-records/store";
import { listAllAgreements } from "@/lib/agreements/store";
import { listAllMedicalClearances } from "@/lib/medical/store";
import { getBackupRuns, getRecoveryTests } from "@/lib/records/backup-data";
import { getAdoptionStatistics } from "@/lib/records/statistics";
import type { Role } from "@/lib/roles/roles";
import { downloadCsv } from "@/lib/shared/export-csv";

// PRD 9's "Audit and Retention" row (查看、导出、配置) is Administrator-only.
const ALLOWED_ROLES: Role[] = ["Administrator"];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function timestampForFilename(): string {
  return new Date().toISOString().slice(0, 10);
}

async function exportAuditLog() {
  const entries = await listAuditLog();
  downloadCsv(
    `audit-log-${timestampForFilename()}.csv`,
    ["auditId", "timestamp", "action", "entityType", "entityId", "oldValue", "newValue", "result", "userName", "userId"],
    entries.map((e) => [e.auditId, e.timestamp, e.action, e.entityType, e.entityId, e.oldValue, e.newValue, e.result, e.userName, e.userId]),
  );
}

async function exportIntakeSummary() {
  const records = await listIntakeRecords();
  downloadCsv(
    `intake-summary-${timestampForFilename()}.csv`,
    ["intakeId", "animalId", "animalName", "arrivalCircumstance", "arrivalDateTime", "intakeSource", "species", "sex", "finalisedAt"],
    records.map((r) => [r.intakeId, r.animalId, r.animalName, r.arrivalCircumstance, r.arrivalDateTime, r.intakeSource, r.species, r.sex, r.finalisedAt ?? ""]),
  );
}

async function exportMedicalClearances() {
  const clearances = await listAllMedicalClearances();
  downloadCsv(
    `medical-clearances-${timestampForFilename()}.csv`,
    ["id", "animalId", "issuedAt", "issuedByName", "issuedByEmail"],
    clearances.map((c) => [c.id, c.animalId, c.issuedAt, c.issuedByName, c.issuedByEmail]),
  );
}

async function exportAdoptionAgreements() {
  const agreements = await listAllAgreements();
  downloadCsv(
    `adoption-agreements-${timestampForFilename()}.csv`,
    ["agreementId", "applicationId", "animalName", "adopterName", "agreementVersion", "templateVersion", "isSigned", "signedDate", "generatedAt"],
    agreements.map((a) => [a.agreementId, a.applicationId, a.animalName, a.adopterName, a.agreementVersion, a.templateVersion, a.isSigned ? "Yes" : "No", a.signedDate ?? "", a.generatedAt]),
  );
}

async function exportAdoptionStatistics() {
  const stats = await getAdoptionStatistics();
  downloadCsv(
    `adoption-statistics-${timestampForFilename()}.csv`,
    ["metric", "value"],
    stats.map((s) => [s.metric, s.value]),
  );
}

function RetentionBackupContent() {
  const backupRuns = getBackupRuns();
  const recoveryTests = getRecoveryTests();

  const [stats, setStats] = useState<Awaited<ReturnType<typeof getAdoptionStatistics>>>([]);
  const [hasApplications, setHasApplications] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAdoptionStatistics().then((result) => {
      if (!cancelled) setStats(result);
    });
    listAllApplications().then((result) => {
      if (!cancelled) setHasApplications(result.length > 0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Retention and Backup Status</h1>
        <p className="mt-1 text-sm text-text-muted">
          Export records for compliance and reporting, and review retention policy and backup job
          status.
        </p>
      </div>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Export Records</h2>
        <p className="mt-1 text-sm text-text-muted">
          Downloads a CSV file built from the current database records.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportAuditLog}
            className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            Export Audit Log
          </button>
          <button
            type="button"
            onClick={exportIntakeSummary}
            className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            Export Intake Summary
          </button>
          <button
            type="button"
            onClick={exportMedicalClearances}
            className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            Export Medical Clearances
          </button>
          <button
            type="button"
            onClick={exportAdoptionAgreements}
            className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            Export Adoption Agreements
          </button>
          <button
            type="button"
            onClick={exportAdoptionStatistics}
            className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            Export Adoption Statistics
          </button>
        </div>
        {!hasApplications && (
          <p className="mt-3 text-xs text-text-muted">
            No adoption applications exist yet - the Adoption Agreements/Statistics exports will
            be empty or near-empty until some do.
          </p>
        )}
      </section>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Adoption Statistics</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {stats.map((s) => (
            <div key={s.metric} className="flex items-center justify-between rounded-[12px] border border-border bg-page px-3 py-2">
              <dt className="text-text-muted">{s.metric}</dt>
              <dd className="font-semibold text-text">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Retention Policy</h2>
        <p className="mt-2 text-sm text-text">
          AuditLog entries are retained indefinitely and are never editable or deletable from this
          application (FR-AUD-01). Permanent deletion of any record is not implemented in this
          prototype: PRD 6.15 requires it to go through two-step confirmation with its own audit
          trail, which this prototype deliberately provides no button for.
        </p>
      </section>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Backup Job Status</h2>
        <p className="mt-1 text-sm text-text-muted">
          Simulated: this prototype has no real backup subsystem (scheduled backups, offsite
          storage, recovery testing) to actually run. Shown for demonstration only.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {backupRuns.map((run) => (
            <li key={run.id} className="rounded-[12px] border border-border bg-page p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-text">
                  {run.type} backup &middot; {formatDateTime(run.ranAt)}
                </span>
                <StatusChip label={run.status} category={run.status === "Success" ? "success" : "attention"} />
              </div>
              {run.notes && <p className="mt-1 text-text-muted">{run.notes}</p>}
            </li>
          ))}
        </ul>

        <h3 className="mt-4 text-sm font-bold text-text">Recovery Tests</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {recoveryTests.map((test) => (
            <li key={test.id} className="rounded-[12px] border border-border bg-page p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-text">{formatDateTime(test.testedAt)}</span>
                <StatusChip label={test.result} category={test.result === "Passed" ? "success" : "attention"} />
              </div>
              {test.notes && <p className="mt-1 text-text-muted">{test.notes}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function RetentionBackupScreen() {
  const { user } = useAuth();
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <RetentionBackupContent />
    </AppShell>
  );
}
