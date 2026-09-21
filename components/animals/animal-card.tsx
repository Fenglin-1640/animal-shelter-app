import Link from "next/link";
import { AnimalThumbnail } from "@/components/shared/animal-thumbnail";
import { AttributeChip } from "@/components/shared/attribute-chip";
import { StatusChip } from "@/components/shared/status-chip";
import { getDisplayAge } from "@/lib/animals/age";
import { CURRENT_STATUS_CATEGORY } from "@/lib/animals/status";
import type { Animal } from "@/lib/animals/types";

export function AnimalCard({ animal }: { animal: Animal }) {
  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
      <Link
        href={`/animals/${animal.animalId}`}
        aria-label={`Open ${animal.name}'s profile`}
        className="shrink-0 rounded-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <AnimalThumbnail animalId={animal.animalId} species={animal.species} />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h3 className="text-base font-semibold text-text">
            <Link href={`/animals/${animal.animalId}`} className="hover:underline">
              {animal.name}
            </Link>
          </h3>
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
