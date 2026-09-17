"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAllAnimals } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import { getLatestPreReleaseCheck, isFitForRelease } from "@/lib/medical/store";
import type { PreReleaseCheck } from "@/lib/medical/types";
import type { Role } from "@/lib/roles/roles";

interface QueueRow {
  animal: Animal;
  latest: PreReleaseCheck | undefined;
  fitForRelease: boolean;
}

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

// The queue is every Animal whose Pre-Release Check work isn't finished:
// currently Awaiting Release (needs a check, or a Fit for Release result
// unlocking Release), or Under Treatment as a result of an earlier
// Health Concern outcome from this same screen.
function isInQueue(currentStatus: string): boolean {
  return currentStatus === "Awaiting Release" || currentStatus === "Under Treatment";
}

function PreReleaseChecksContent() {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAllAnimals().then(async (animals) => {
      const queued = animals.filter((a) => isInQueue(a.currentStatus));
      const withFitness = await Promise.all(
        queued.map(async (animal) => ({
          animal,
          latest: getLatestPreReleaseCheck(animal.animalId),
          fitForRelease: await isFitForRelease(animal.animalId),
        })),
      );
      if (cancelled) return;
      setRows(
        withFitness.sort(
          (a, b) => new Date(b.animal.statusUpdatedAt).getTime() - new Date(a.animal.statusUpdatedAt).getTime(),
        ),
      );
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = rows.filter((row) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${row.animal.name} ${row.animal.shelterId}`.toLowerCase().includes(query);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Pre-Release Checks</h1>
        <p className="mt-1 text-sm text-text-muted">
          Confirm animals are fit for release to an adopter.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="pre-release-search" className="sr-only">
          Search animals
        </label>
        <input
          id="pre-release-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by animal name or Shelter ID"
          className="h-10 min-w-[220px] flex-1 rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>

      {isLoading ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-text">No animals need a Pre-Release Check right now.</p>
          <p className="mt-1 text-sm text-text-muted">
            An animal enters this queue once its Adoption Record is finalised (Awaiting Release).
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map(({ animal, latest, fitForRelease }) => (
            <li key={animal.animalId}>
              <Link
                href={`/animals/${animal.animalId}/pre-release-check`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] hover:bg-surface-active"
              >
                <div>
                  <p className="text-sm font-semibold text-text">
                    {animal.name} &middot; {animal.shelterId}
                  </p>
                  <p className="text-xs text-text-muted">
                    {animal.currentStatus}
                    {latest ? ` · Last checked ${new Date(latest.checkDate).toLocaleDateString("en-US", { dateStyle: "medium" })}` : " · Not yet checked"}
                  </p>
                </div>
                <StatusChip
                  label={fitForRelease ? "Fit for Release" : animal.currentStatus === "Under Treatment" ? "Under Treatment" : "Check Needed"}
                  category={fitForRelease ? "success" : animal.currentStatus === "Under Treatment" ? "caution" : "attention"}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PreReleaseChecksQueueScreen() {
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
      <PreReleaseChecksContent />
    </AppShell>
  );
}
