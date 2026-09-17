"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FilterGroup, FilterPanel, type ActiveFilterChip } from "@/components/layout/filter-panel";
import { ListingCard } from "@/components/adoption-listings/listing-card";
import { useAuth } from "@/lib/auth/auth-context";
import { getPublicListings } from "@/lib/adoption-listings/mock-listings";
import type { PublicListing } from "@/lib/adoption-listings/types";
import type { Sex, Species } from "@/lib/animals/types";

const PAGE_SIZE = 5;
type SortOrder = "name-asc" | "fee-asc";

function FiltersBody({
  availableSpecies,
  availableBreeds,
  availableSexes,
  availableTemperaments,
  speciesSelection,
  breedSelection,
  sexSelection,
  temperamentSelection,
  sortOrder,
  onToggleSpecies,
  onToggleBreed,
  onToggleSex,
  onToggleTemperament,
  onSortChange,
  onClearAll,
}: {
  availableSpecies: Species[];
  availableBreeds: string[];
  availableSexes: Sex[];
  availableTemperaments: string[];
  speciesSelection: Set<Species>;
  breedSelection: Set<string>;
  sexSelection: Set<Sex>;
  temperamentSelection: Set<string>;
  sortOrder: SortOrder;
  onToggleSpecies: (value: Species) => void;
  onToggleBreed: (value: string) => void;
  onToggleSex: (value: Sex) => void;
  onToggleTemperament: (value: string) => void;
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
    ...Array.from(sexSelection).map((value) => ({
      key: `sex-${value}`,
      label: value,
      onRemove: () => onToggleSex(value),
    })),
    ...Array.from(temperamentSelection).map((value) => ({
      key: `temperament-${value}`,
      label: value,
      onRemove: () => onToggleTemperament(value),
    })),
  ];

  return (
    <FilterPanel activeChips={chips} onClearAll={onClearAll}>
      <FilterGroup heading="Species">
        {availableSpecies.map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={speciesSelection.has(value)}
              onChange={() => onToggleSpecies(value)}
              className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            {value}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup heading="Breed">
        {availableBreeds.map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={breedSelection.has(value)}
              onChange={() => onToggleBreed(value)}
              className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            {value}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup heading="Sex">
        {availableSexes.map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={sexSelection.has(value)}
              onChange={() => onToggleSex(value)}
              className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            {value}
          </label>
        ))}
      </FilterGroup>

      {availableTemperaments.length > 0 && (
        <FilterGroup heading="Temperament">
          {availableTemperaments.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={temperamentSelection.has(value)}
                onChange={() => onToggleTemperament(value)}
                className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
              {value}
            </label>
          ))}
        </FilterGroup>
      )}

      <FilterGroup heading="Sort">
        <select
          value={sortOrder}
          onChange={(event) => onSortChange(event.target.value as SortOrder)}
          className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <option value="name-asc">Name (A-Z)</option>
          <option value="fee-asc">Adoption Fee (Low to High)</option>
        </select>
      </FilterGroup>
    </FilterPanel>
  );
}

export function AdoptionListingsScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [speciesSelection, setSpeciesSelection] = useState<Set<Species>>(new Set());
  const [breedSelection, setBreedSelection] = useState<Set<string>>(new Set());
  const [sexSelection, setSexSelection] = useState<Set<Sex>>(new Set());
  const [temperamentSelection, setTemperamentSelection] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>("name-asc");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [allListings, setAllListings] = useState<PublicListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPublicListings()
      .then((result) => {
        if (cancelled) return;
        setAllListings(result);
        setLoadError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Unable to load adoption listings. Try again.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const availableSpecies = useMemo(
    () => Array.from(new Set(allListings.map((l) => l.species))),
    [allListings],
  );
  const availableBreeds = useMemo(
    () => Array.from(new Set(allListings.map((l) => l.breed))),
    [allListings],
  );
  const availableSexes = useMemo(
    () => Array.from(new Set(allListings.map((l) => l.sex))),
    [allListings],
  );
  const availableTemperaments = useMemo(
    () => Array.from(new Set(allListings.flatMap((l) => l.temperaments))),
    [allListings],
  );

  const makeToggle = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>) => (value: T) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
    setPage(1);
  };

  const toggleSpecies = makeToggle(setSpeciesSelection);
  const toggleBreed = makeToggle(setBreedSelection);
  const toggleSex = makeToggle(setSexSelection);
  const toggleTemperament = makeToggle(setTemperamentSelection);

  const clearAll = () => {
    setSpeciesSelection(new Set());
    setBreedSelection(new Set());
    setSexSelection(new Set());
    setTemperamentSelection(new Set());
    setPage(1);
  };

  const filtered = allListings
    .filter((listing) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const haystack = `${listing.name} ${listing.shelterId}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (speciesSelection.size > 0 && !speciesSelection.has(listing.species)) return false;
      if (breedSelection.size > 0 && !breedSelection.has(listing.breed)) return false;
      if (sexSelection.size > 0 && !sexSelection.has(listing.sex)) return false;
      if (
        temperamentSelection.size > 0 &&
        !listing.temperaments.some((t) => temperamentSelection.has(t))
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === "fee-asc") {
        const aFee = a.adoptionFee ?? Infinity;
        const bFee = b.adoptionFee ?? Infinity;
        return aFee - bFee;
      }
      return a.name.localeCompare(b.name);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filtersBody = (
    <FiltersBody
      availableSpecies={availableSpecies}
      availableBreeds={availableBreeds}
      availableSexes={availableSexes}
      availableTemperaments={availableTemperaments}
      speciesSelection={speciesSelection}
      breedSelection={breedSelection}
      sexSelection={sexSelection}
      temperamentSelection={temperamentSelection}
      sortOrder={sortOrder}
      onToggleSpecies={toggleSpecies}
      onToggleBreed={toggleBreed}
      onToggleSex={toggleSex}
      onToggleTemperament={toggleTemperament}
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
          <h1 className="text-2xl font-bold text-text">Adoption Listings</h1>
          <p className="mt-1 text-sm text-text-muted">
            Animals currently available for adoption. Submitting an
            application is a future step; PRD sample data (docs/PRD.md
            12.1) is shown here.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="listing-search" className="sr-only">
            Search adoption listings
          </label>
          <input
            id="listing-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or Shelter ID"
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
            Loading adoption listings...
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
              Try a different search term or clear your filters to see all
              current listings.
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
            {pageItems.map((listing) => (
              <ListingCard
                key={listing.animalId}
                listing={listing}
                canApply={user?.role === "Adopter"}
                adopterEmail={user?.email}
                adopterName={user?.displayName}
              />
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
