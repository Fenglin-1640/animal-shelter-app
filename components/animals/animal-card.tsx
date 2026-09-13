import Link from "next/link";
import { AttributeChip } from "@/components/shared/attribute-chip";
import { StatusChip } from "@/components/shared/status-chip";
import { getDisplayAge } from "@/lib/animals/age";
import { CURRENT_STATUS_CATEGORY } from "@/lib/animals/status";
import type { Animal } from "@/lib/animals/types";

function PlaceholderThumbnail({ species }: { species: string }) {
  return (
    <div
      className="flex aspect-[4/3] w-full shrink-0 items-center justify-center rounded-[12px] border border-border bg-page text-text-muted sm:w-40"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-5-5L5 21" />
      </svg>
      <span className="sr-only">No photo available for this {species}</span>
    </div>
  );
}

export function AnimalCard({ animal }: { animal: Animal }) {
  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
      <PlaceholderThumbnail species={animal.species} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h3 className="text-base font-semibold text-text">{animal.name}</h3>
          <p className="text-xs text-text-muted">{animal.shelterId}</p>
        </div>
        <p className="text-sm text-text-muted">
          {animal.species} &middot; {animal.breed} &middot; {getDisplayAge(animal)}
        </p>
        <p className="text-sm text-text">{animal.generalDescription}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip
            label={animal.currentStatus}
            category={CURRENT_STATUS_CATEGORY[animal.currentStatus]}
          />
          <AttributeChip label={animal.species} />
          <AttributeChip label={animal.sex} />
          {animal.temperaments.slice(0, 2).map((temperament) => (
            <AttributeChip key={temperament} label={temperament} />
          ))}
        </div>
      </div>

      <div className="flex items-start sm:items-center">
        <Link
          href={`/animals/${animal.animalId}`}
          className="h-9 whitespace-nowrap rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text inline-flex items-center hover:bg-surface-active"
        >
          View
        </Link>
      </div>
    </article>
  );
}
