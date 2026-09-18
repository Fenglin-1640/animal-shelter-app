"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAnimalById } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import {
  confirmCustodyTransfer,
  getLatestHold,
  recordOwnerReclamation,
} from "@/lib/statutory-hold/store";
import { HOLD_STATUS_CATEGORY } from "@/lib/statutory-hold/status";
import type { StatutoryHold } from "@/lib/statutory-hold/types";
import { getSystemSettings } from "@/lib/system-administration/settings-store";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Animal not found.</p>
      <Link
        href="/animals"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to Animals
      </Link>
    </div>
  );
}

function OwnerContactCard({ hold }: { hold: StatutoryHold }) {
  return (
    <div className="flex flex-col gap-1 rounded-[12px] border border-border bg-page p-4 text-sm text-text">
      <p className="font-semibold">{hold.ownerContact.name}</p>
      <p className="text-text-muted">{hold.ownerContact.phone}</p>
      <p className="text-text-muted">{hold.ownerContact.address}</p>
    </div>
  );
}

function StatutoryHoldContent({
  animalId,
  email,
  displayName,
}: {
  animalId: string;
  email: string;
  displayName: string;
}) {
  const [animal, setAnimal] = useState<Animal | null | undefined>(undefined);
  const [hold, setHold] = useState<StatutoryHold | undefined>(undefined);
  const [reminderLeadDays, setReminderLeadDays] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAnimalById(animalId).then((result) => {
      if (cancelled) return;
      setAnimal(result ?? null);
      if (result) {
        getLatestHold(animalId).then((h) => {
          if (!cancelled) setHold(h);
        });
      }
    });
    getSystemSettings().then((settings) => {
      if (!cancelled) setReminderLeadDays(settings.reminderLeadDays);
    });
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  if (animal === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!animal) return <NotFound />;

  const refresh = async () => {
    setHold(await getLatestHold(animalId));
    setAnimal((await getAnimalById(animalId)) ?? null);
  };

  const handleReclamation = async () => {
    setIsSubmitting(true);
    const result = await recordOwnerReclamation(animalId, email, displayName);
    setIsSubmitting(false);
    if (result.ok) refresh();
  };

  const handleCustodyTransfer = async () => {
    setIsSubmitting(true);
    const result = await confirmCustodyTransfer(animalId, email, displayName);
    setIsSubmitting(false);
    if (result.ok) refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/animals/${animalId}`}
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to {animal.name}&apos;s Profile
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text">Statutory Hold</h1>
        <p className="mt-1 text-sm text-text-muted">
          {animal.name} &middot; {animal.shelterId}
        </p>
      </div>

      {!hold ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-text">
            No Statutory Hold has been recorded for this animal.
          </p>
          <p className="mt-1 text-sm text-text-muted">
            A hold is created automatically when Scan Microchip returns Owner Match.
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-4 rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-text">Hold Details</h2>
            <StatusChip label={hold.status} category={HOLD_STATUS_CATEGORY[hold.status]} />
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Hold Start
              </dt>
              <dd className="text-sm text-text">{formatDate(hold.holdStartAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Hold End
              </dt>
              <dd className="text-sm text-text">{formatDate(hold.holdEndAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Holding Period
              </dt>
              <dd className="text-sm text-text">
                {hold.holdingPeriodDays} days (Administrator-configurable in System
                Administration)
              </dd>
            </div>
            {hold.status === "Active" && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Status
                </dt>
                <dd className="text-sm text-text">
                  {daysUntil(hold.holdEndAt) >= 0
                    ? `${daysUntil(hold.holdEndAt)} day(s) remaining`
                    : "Overdue - will be marked Expired next time this hold is viewed"}
                </dd>
              </div>
            )}
          </dl>

          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Registered Owner
            </p>
            <OwnerContactCard hold={hold} />
          </div>

          {hold.status === "Active" && (
            <>
              {daysUntil(hold.holdEndAt) <= reminderLeadDays && (
                <p className="rounded-[12px] border border-gold bg-gold/10 px-3 py-2 text-sm text-text">
                  This hold is within the reminder window - it also appears on Notifications for
                  Shelter Staff Member and Administrator.
                </p>
              )}
              <div>
                <button
                  type="button"
                  onClick={handleReclamation}
                  disabled={isSubmitting}
                  className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Recording..." : "Record Owner Reclamation"}
                </button>
                <p className="mt-1 text-xs text-text-muted">
                  If the hold period expires with nobody having reclaimed the animal, the system
                  automatically returns it to Under Assessment.
                </p>
              </div>
            </>
          )}

          {hold.status === "Reclaimed By Owner" && (
            <div className="flex flex-col gap-2 rounded-[12px] border border-border bg-page p-4">
              <p className="text-sm text-text">
                Owner reclamation recorded by {hold.reclaimedByName} on{" "}
                {formatDateTime(hold.reclaimedAt ?? "")}.
              </p>
              {hold.custodyTransferCompletedAt ? (
                <p className="text-sm text-text">
                  Custody transfer confirmed by {hold.custodyTransferByName} on{" "}
                  {formatDateTime(hold.custodyTransferCompletedAt)}. This animal&apos;s record is
                  now archived as ReturnedToOwner.
                </p>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={handleCustodyTransfer}
                    disabled={isSubmitting}
                    className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Confirming..." : "Confirm Custody Transfer Completed"}
                  </button>
                </div>
              )}
            </div>
          )}

          {hold.status === "Expired" && (
            <p className="rounded-[12px] border border-border bg-page px-3 py-2 text-sm text-text">
              The hold period expired on {formatDateTime(hold.expiredAt ?? "")} without
              reclamation. The animal was returned to Under Assessment.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export function StatutoryHoldScreen() {
  const { user } = useAuth();
  const params = useParams<{ animalId: string }>();
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
      <StatutoryHoldContent
        animalId={params.animalId}
        email={user.email}
        displayName={user.displayName}
      />
    </AppShell>
  );
}
