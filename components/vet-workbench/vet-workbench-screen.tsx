"use client";

import Link from "next/link";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { NeedsActionLabel } from "@/components/process/needs-action-label";
import { useAuth } from "@/lib/auth/auth-context";
import type { WorkbenchRow, WorkbenchSectionKey } from "@/lib/process/worklist";
import { refreshWorklist, useWorklist, useWorklistFailed } from "@/lib/process/worklist-client";

const SECTIONS: { key: WorkbenchSectionKey; title: string; empty: string }[] = [
  { key: "implant", title: "Awaiting microchip implant", empty: "No animals are waiting for a microchip implant." },
  { key: "vaccination_desexing", title: "Vaccination and desexing due", empty: "No vaccinations, boosters or desexing appointments are due." },
  { key: "clearance", title: "Awaiting medical clearance", empty: "No animals are waiting for a medical clearance." },
  { key: "pre_release", title: "Pre-Release checks", empty: "No animals need a pre-release check." },
];

function Section({ title, empty, rows }: { title: string; empty: string; rows: WorkbenchRow[] }) {
  const headingId = `wb-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 id={headingId} className="flex items-center gap-2 text-lg font-bold text-text">
        {title}
        <span className="rounded-full bg-page px-2 text-sm font-semibold text-text-muted">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.animalId}>
              <Link
                href={row.href}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-page px-4 py-3 hover:bg-surface-active"
              >
                <div>
                  <p className="text-sm font-semibold text-text">
                    {row.title} &middot; {row.shelterId}
                  </p>
                  <p className="text-xs text-text-muted">{row.detail}</p>
                </div>
                <NeedsActionLabel label="Needs your action" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// The Veterinarian's work queue, from the same worklist batch as the
// sidebar badges (refreshed every 20 s and after every change).
function VetWorkbenchContent() {
  const worklist = useWorklist({ eager: true });
  const failed = useWorklistFailed();
  const workbench = worklist?.workbench;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Vet Workbench</h1>
        <p className="mt-1 text-sm text-text-muted">Everything currently waiting on a Veterinarian, by kind of work.</p>
      </div>
      {!workbench ? (
        failed ? (
          <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text">
            <p>The workbench could not be loaded.</p>
            <button
              type="button"
              onClick={() => void refreshWorklist()}
              className="mt-3 h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">Loading...</div>
        )
      ) : (
        SECTIONS.map((s) => <Section key={s.key} title={s.title} empty={s.empty} rows={workbench[s.key]} />)
      )}
    </div>
  );
}

export function VetWorkbenchScreen() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role !== "Veterinarian") {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <VetWorkbenchContent />
    </AppShell>
  );
}
