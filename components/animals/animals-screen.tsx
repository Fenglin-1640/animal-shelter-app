"use client";

import { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { FilterGroup, FilterPanel, type ActiveFilterChip } from "@/components/layout/filter-panel";
import { AnimalCard } from "@/components/animals/animal-card";
import { useAuth } from "@/lib/auth/auth-context";
import { getAllAnimals } from "@/lib/animals/animal-store";
import type { Animal, CurrentStatus, Species } from "@/lib/animals/types";
import { getBreedSpeciesList, getBreedsForSpecies, type BreedOption } from "@/lib/options/breeds";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];
const PAGE_SIZE = 5;
type SortOrder = "name-asc" | "recently-entered";

function breedKey(species: Species, breed: string): string {
  return `${species}:${breed}`;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SpeciesBreedFilter({
  species,
  breeds,
  count,
  isSelected,
  isExpanded,
  breedSelection,
  breedCounts,
  onToggleSpecies,
  onToggleExpand,
  onToggleBreed,
}: {
  species: Species;
  breeds: BreedOption[];
  count: number;
  isSelected: boolean;
  isExpanded: boolean;
  breedSelection: Set<string>;
  breedCounts: Map<string, number>;
  onToggleSpecies: (value: Species) => void;
  onToggleExpand: (value: Species) => void;
  onToggleBreed: (value: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSpecies(species)}
            className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          {species} ({count})
        </label>
        <button
          type="button"
          onClick={() => onToggleExpand(species)}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${species} breeds`}
          className="flex h-6 w-6 items-center justify-center rounded-full text-text-muted hover:bg-surface-active hover:text-text"
        >
          <ChevronIcon expanded={isExpanded} />
        </button>
      </div>

      {isExpanded && (
        <div className="mt-1 ml-6 flex flex-col gap-1 border-l border-border pl-3">
          {breeds.map((breed) => {
            const key = breedKey(species, breed.name);
            return (
              <label key={key} className="flex items-center gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={breedSelection.has(breed.name)}
                  onChange={() => onToggleBreed(breed.name)}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
                {breed.name} ({breedCounts.get(key) ?? 0})
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FiltersBody({
  availableStatuses,
  speciesList,
  breedsBySpecies,
  speciesSelection,
  breedSelection,
  statusSelection,
  expandedSpecies,
  speciesCounts,
  breedCounts,
  sortOrder,
  onToggleSpecies,
  onToggleBreed,
  onToggleExpand,
  onToggleStatus,
  onSortChange,
  onClearAll,
}: {
  availableStatuses: CurrentStatus[];
  speciesList: Species[];
  breedsBySpecies: Partial<Record<Species, BreedOption[]>>;
  speciesSelection: Set<Species>;
  breedSelection: Set<string>;
  statusSelection: Set<CurrentStatus>;
  expandedSpecies: Set<Species>;
  speciesCounts: Map<Species, number>;
  breedCounts: Map<string, number>;
  sortOrder: SortOrder;
  onToggleSpecies: (value: Species) => void;
  onToggleBreed: (value: string) => void;
  onToggleExpand: (value: Species) => void;
  onToggleStatus: (value: CurrentStatus) => void;
  onSortChange: (value: SortOrder) => void;
  onClearAll: () => void;
}) {
  const chips: ActiveFilterChip[] = [
    ...Array.from(speciesSelection).map((value) => ({
      key: `species-${value}`,
      label: value,
      onRemove: () => onToggleSpecies(value),
    })),
    ...Array.from(breedSelection).map((value) => ({
      key: `breed-${value}`,
      label: value,
      onRemove: () => onToggleBreed(value),
    })),
    ...Array.from(statusSelection).map((value) => ({
      key: `status-${value}`,
      label: value,
      onRemove: () => onToggleStatus(value),
    })),
  ];

  return (
    <FilterPanel activeChips={chips} onClearAll={onClearAll}>
      <FilterGroup heading="Species">
        <div className="flex flex-col gap-2">
          {speciesList.map((species) => (
            <SpeciesBreedFilter
              key={species}
              species={species}
              breeds={breedsBySpecies[species] ?? []}
              count={speciesCounts.get(species) ?? 0}
              isSelected={speciesSelection.has(species)}
              isExpanded={expandedSpecies.has(species)}
              breedSelection={breedSelection}
              breedCounts={breedCounts}
              onToggleSpecies={onToggleSpecies}
              onToggleExpand={onToggleExpand}
              onToggleBreed={onToggleBreed}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup heading="Status">
        {availableStatuses.map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={statusSelection.has(value)}
              onChange={() => onToggleStatus(value)}
              className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            {value}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup heading="Sort">
        <select
          value={sortOrder}
          onChange={(event) => onSortChange(event.target.value as SortOrder)}
          className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <option value="name-asc">Name (A-Z)</option>
          <option value="recently-entered">Recently entered</option>
        </select>
      </FilterGroup>
    </FilterPanel>
  );
}

function AnimalsContent() {
  const [search, setSearch] = useState("");
  const [speciesSelection, setSpeciesSelection] = useState<Set<Species>>(new Set());
  const [breedSelection, setBreedSelection] = useState<Set<string>>(new Set());
  const [statusSelection, setStatusSelection] = useState<Set<CurrentStatus>>(new Set());
  const [expandedSpecies, setExpandedSpecies] = useState<Set<Species>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>("name-asc");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [breedsBySpecies, setBreedsBySpecies] = useState<Partial<Record<Species, BreedOption[]>>>({});

  useEffect(() => {
    let cancelled = false;
    getBreedSpeciesList().then(async (list) => {
      if (cancelled) return;
      setSpeciesList(list);
      const entries = await Promise.all(
        list.map(async (species) => [species, await getBreedsForSpecies(species)] as const),
      );
      if (!cancelled) setBreedsBySpecies(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAllAnimals()
      .then((result) => {
        if (cancelled) return;
        setAllAnimals(result);
        setLoadError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Unable to load animals. Try again.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const availableStatuses = useMemo(
    () => Array.from(new Set(allAnimals.map((a) => a.currentStatus))),
    [allAnimals],
  );

  // Matches search + Status only, deliberately excluding the Species and
  // Breed selections themselves, so the counts shown next to each
  // Species/Breed checkbox reflect "how many would match if I also
  // picked this one" rather than shrinking as more boxes are checked.
  const baseFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allAnimals.filter((animal) => {
      if (query) {
        const haystack = `${animal.name} ${animal.shelterId} ${animal.breed}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusSelection.size > 0 && !statusSelection.has(animal.currentStatus)) {
        return false;
      }
      return true;
    });
  }, [allAnimals, search, statusSelection]);

  const speciesCounts = useMemo(() => {
    const counts = new Map<Species, number>();
    for (const animal of baseFiltered) {
      counts.set(animal.species, (counts.get(animal.species) ?? 0) + 1);
    }
    return counts;
  }, [baseFiltered]);

  const breedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const animal of baseFiltered) {
      const key = breedKey(animal.species, animal.breed);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [baseFiltered]);

  const toggleSpecies = (value: Species) => {
    setSpeciesSelection((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
    setPage(1);
  };

  const toggleBreed = (value: string) => {
    setBreedSelection((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
    setPage(1);
  };

  const toggleExpand = (value: Species) => {
    setExpandedSpecies((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleStatus = (value: CurrentStatus) => {
    setStatusSelection((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
    setPage(1);
  };

  const clearAll = () => {
    setSpeciesSelection(new Set());
    setBreedSelection(new Set());
    setStatusSelection(new Set());
    setPage(1);
  };

  const filtered = baseFiltered
    .filter((animal) => {
      if (speciesSelection.size > 0 && !speciesSelection.has(animal.species)) {
        return false;
      }
      if (breedSelection.size > 0 && !breedSelection.has(animal.breed)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === "recently-entered") {
        return new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime();
      }
      return a.name.localeCompare(b.name);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const filtersBody = (
    <FiltersBody
      availableStatuses={availableStatuses}
      speciesList={speciesList}
      breedsBySpecies={breedsBySpecies}
      speciesSelection={speciesSelection}
      breedSelection={breedSelection}
      statusSelection={statusSelection}
      expandedSpecies={expandedSpecies}
      speciesCounts={speciesCounts}
      breedCounts={breedCounts}
      sortOrder={sortOrder}
      onToggleSpecies={toggleSpecies}
      onToggleBreed={toggleBreed}
      onToggleExpand={toggleExpand}
      onToggleStatus={toggleStatus}
      onSortChange={setSortOrder}
      onClearAll={clearAll}
    />
  );

  return (
    <AppShell
      rightPanel={
        <aside className="sticky top-14 hidden h-[calc(100vh-56px)] w-[280px] shrink-0 overflow-y-auto border-l border-border bg-page p-4 xl:block">
          {filtersBody}
        </aside>
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Animals</h1>
          <p className="mt-1 text-sm text-text-muted">
            Showing PRD sample records (docs/PRD.md 12.1). Intake, Photos,
            Medical History and Behavioural Assessment are built in later
            steps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="animal-search" className="sr-only">
            Search animals
          </label>
          <input
            id="animal-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, Shelter ID or breed"
            className="h-10 min-w-[200px] flex-1 rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="h-10 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active xl:hidden"
          >
            Filters
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
            Loading animals...
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
        ) : pageItems.length === 0 ? (
          <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
            <p className="text-sm font-semibold text-text">
              No animals match your filters.
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Try a different search term or clear your filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                clearAll();
              }}
              className="mt-4 h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
            >
              Clear search and filters
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pageItems.map((animal) => (
              <AnimalCard key={animal.animalId} animal={animal} />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-9 rounded-[12px] border border-border bg-surface px-3 font-semibold text-text hover:bg-surface-active disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-9 rounded-[12px] border border-border bg-surface px-3 font-semibold text-text hover:bg-surface-active disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setMobileFiltersOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 right-0 w-[300px] max-w-[85vw] overflow-y-auto border-l border-border bg-page p-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-semibold text-text">Filters</span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text hover:bg-surface-active"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="pt-4">{filtersBody}</div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export function AnimalsScreen() {
  const { user } = useAuth();
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return <AnimalsContent />;
}
