"use client";

import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { listMyFollowUpVisits } from "@/lib/follow-up-visits/store";
import { FOLLOW_UP_VISIT_STATUS_CATEGORY, WELFARE_OUTCOME_CATEGORY } from "@/lib/follow-up-visits/status";
import type { FollowUpVisit } from "@/lib/follow-up-visits/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Adopter"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

// PRD 9: Adopter's FollowUpVisit access is "查看本人安排" (view own scheduled
// visit) - read-only, no action. Kept as a plain list rather than the
// filter/pagination scaffolding My Meet and Greets uses, since at most
// one Follow-Up Visit ever exists per animal (a one-directional, terminal
// state transition), so this rarely holds more than a couple of records.
function MyFollowUpVisitsContent({ email }: { email: string }) {
  const [visits, setVisits] = useState<FollowUpVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listMyFollowUpVisits(email)
      .then((result) => {
        if (cancelled) return;
        setVisits(result);
        setLoadError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Unable to load Follow-Up Visits. Try again.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email, refreshKey]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">My Follow-Up Visits</h1>
        <p className="mt-1 text-sm text-text-muted">
          Welfare check-ins scheduled after an animal is released to you.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Loading Follow-Up Visits...
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-[12px] border border-danger bg-danger/10 p-6 text-center">
          <p className="text-sm font-semibold text-text">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setRefreshKey((k) => k + 1);
            }}
            className="mt-2 h-9 rounded-[12px] border border-border bg-surface px-3 text-xs font-semibold text-text hover:bg-surface-active"
          >
            Retry
          </button>
        </div>
      ) : visits.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-text">You don&apos;t have any Follow-Up Visits yet.</p>
          <p className="mt-1 text-sm text-text-muted">
            A visit is scheduled once your adopted animal is released to you.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visits.map((visit) => (
            <li
              key={visit.followUpVisitId}
              className="rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-text">{visit.animalName}</span>
                <StatusChip label={visit.status} category={FOLLOW_UP_VISIT_STATUS_CATEGORY[visit.status]} />
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {visit.followUpType} scheduled for {formatDate(visit.targetDate)}
              </p>
              <p className="mt-1 text-sm text-text-muted">Released on {formatDate(visit.releaseDate)}</p>
              {visit.status === "Completed" && visit.outcome && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-text-muted">Welfare Outcome:</span>
                  <StatusChip label={visit.outcome} category={WELFARE_OUTCOME_CATEGORY[visit.outcome]} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MyFollowUpVisitsScreen() {
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
      <MyFollowUpVisitsContent email={user.email} />
    </AppShell>
  );
}
