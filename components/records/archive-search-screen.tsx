"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAllAnimals } from "@/lib/animals/animal-store";
import { CURRENT_STATUS_CATEGORY } from "@/lib/animals/status";
import type { Animal } from "@/lib/animals/types";
import type { Role } from "@/lib/roles/roles";

// PRD 6.15: "授权 Staff 可搜索 Archived 记录，但不可修改" - Administrator and
// Shelter Staff Member, read-only (this screen has no action buttons at
// all; the linked Animal Profile enforces its own edit permissions).
const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function ArchiveSearchContent() {
  const [search, setSearch] = useState("");
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAllAnimals().then((result) => {
      if (cancelled) return;
      setAllAnimals(result);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const archived = useMemo(
    () => allAnimals.filter((a) => a.currentStatus === "Archived"),
    [allAnimals],
  );

  const filtered = archived.filter((animal) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${animal.name} ${animal.shelterId}`.toLowerCase().includes(query);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Archive Search</h1>
        <p className="mt-1 text-sm text-text-muted">
          Search Archived animal records. Records here are read-only and cannot be permanently
          deleted from the application.
        </p>
      </div>

      <label htmlFor="archive-search" className="sr-only">
        Search archived animals
      </label>
      <input
        id="archive-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by animal name or Shelter ID"
        className="h-10 min-w-[220px] rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />

      {isLoading ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-text">
            {archived.length === 0 ? "No animal records are archived." : "No archived records match your search."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((animal) => (
            <li key={animal.animalId}>
              <Link
                href={`/animals/${animal.animalId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] hover:bg-surface-active"
              >
                <div>
                  <p className="text-sm font-semibold text-text">
                    {animal.name} &middot; {animal.shelterId}
                  </p>
                  <p className="text-xs text-text-muted">
                    {animal.species} &middot; Archived {formatDate(animal.statusUpdatedAt)}
                  </p>
                </div>
                <StatusChip label={animal.currentStatus} category={CURRENT_STATUS_CATEGORY[animal.currentStatus]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ArchiveSearchScreen() {
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
      <ArchiveSearchContent />
    </AppShell>
  );
}
