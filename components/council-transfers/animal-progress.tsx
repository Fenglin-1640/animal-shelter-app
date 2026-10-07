"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusChip } from "@/components/shared/status-chip";
import { CURRENT_STATUS_CATEGORY, LISTING_STATUS_CATEGORY } from "@/lib/animals/status";
import { animalStatusLabel, type TransferAnimalSummary, type TransferProgress } from "@/lib/council-transfers/progress";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";
import { getJson } from "@/lib/shared/http";

function formatDate(value: string): string {
  // Date-only values are local calendar dates, not UTC midnight.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString("en-US", { dateStyle: "medium" });
}

export type TransferProgressResult = TransferProgress & { transfer: CouncilTransferSubmission };

// One of the signed-in Council Officer's transfers with its animal progress
// (undefined while loading, null when it can't be read).
export function useTransferProgress(transferId: string): TransferProgressResult | null | undefined {
  const [result, setResult] = useState<TransferProgressResult | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getJson<{ ok?: boolean } & Partial<TransferProgressResult>>(`/api/council-transfers/${encodeURIComponent(transferId)}/progress`).then((r) => {
      if (!cancelled) setResult(r.ok && r.transfer ? (r as TransferProgressResult) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [transferId]);
  return result;
}

// The animal's photo from its signed, cached image URL; a neutral tile when
// there is none (or it fails to load).
export function AnimalThumb({ animal, size }: { animal: TransferAnimalSummary; size: "sm" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const box = size === "sm" ? "h-12 w-12" : "h-40 w-40";
  if (!animal.thumbnailUrl || failed) {
    return (
      <div className={`${box} flex shrink-0 items-center justify-center rounded-[10px] border border-border bg-page text-xs text-text-muted`} aria-hidden="true">
        No photo
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL served by our own image route.
    <img
      src={animal.thumbnailUrl}
      alt={animal.thumbnailAlt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${box} shrink-0 rounded-[10px] border border-border object-cover`}
    />
  );
}

export function AnimalStatusChips({ animal }: { animal: TransferAnimalSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusChip label={animalStatusLabel(animal.currentStatus)} category={CURRENT_STATUS_CATEGORY[animal.currentStatus]} />
      <StatusChip label={`Listing: ${animal.listingStatus}`} category={LISTING_STATUS_CATEGORY[animal.listingStatus]} />
    </div>
  );
}

export function MilestoneList({ progress }: { progress: TransferProgress }) {
  return (
    <>
      <ol className="mt-3 flex flex-col gap-2">
        {progress.milestones.map((m) => (
          <li key={m.key} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${m.reached ? "bg-primary" : "border border-border bg-page"}`}
            />
            <span className={m.reached ? "font-semibold text-text" : "text-text-muted"}>{m.label}</span>
            <span className="text-text-muted">
              {m.reached ? (m.date ? `· ${formatDate(m.date)}` : "") : "· not yet"}
            </span>
            <span className="sr-only">{m.reached ? "reached" : "not reached"}</span>
          </li>
        ))}
      </ol>
      {progress.outcome && (
        <p className="mt-3 text-sm text-text">
          <span className="font-semibold">Outcome:</span> {progress.outcome.label}
          {progress.outcome.date ? ` · ${formatDate(progress.outcome.date)}` : ""}
        </p>
      )}
    </>
  );
}

// "Animal Progress" on the Council Officer's transfer page.
export function AnimalProgressSection({ transferId }: { transferId: string }) {
  const progress = useTransferProgress(transferId);
  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 className="text-lg font-bold text-text">Animal Progress</h2>
      {progress === undefined ? (
        <p className="mt-2 text-sm text-text-muted">Loading...</p>
      ) : !progress ? (
        <p className="mt-2 text-sm text-text-muted">Progress is not available right now.</p>
      ) : !progress.animal ? (
        <p className="mt-2 text-sm text-text-muted">Awaiting intake by the shelter.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <AnimalThumb animal={progress.animal} size="sm" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-base font-semibold text-text">{progress.animal.name}</p>
              <p className="text-sm text-text-muted">
                {progress.animal.species} &middot; {progress.animal.breed} &middot; Shelter ID {progress.animal.shelterId}
              </p>
              <AnimalStatusChips animal={progress.animal} />
            </div>
            <Link
              href={`/council-transfers/${encodeURIComponent(transferId)}/animal`}
              className="inline-flex h-9 items-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
            >
              View animal
            </Link>
          </div>
          <MilestoneList progress={progress} />
        </>
      )}
    </section>
  );
}
