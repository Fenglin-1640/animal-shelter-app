import { AttributeChip } from "@/components/shared/attribute-chip";
import { PlaceholderThumbnail } from "@/components/shared/placeholder-thumbnail";
import type { PublicListing } from "@/lib/adoption-listings/types";

export function ListingCard({ listing }: { listing: PublicListing }) {
  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
      <PlaceholderThumbnail species={listing.species} altText={listing.photoAltText} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h3 className="text-base font-semibold text-text">{listing.name}</h3>
          <p className="text-sm text-text-muted">
            {listing.species} &middot; {listing.breed} &middot; {listing.sex} &middot; {listing.age}
          </p>
        </div>
        <p className="text-sm text-text">{listing.generalDescription}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {listing.temperaments.map((temperament) => (
            <AttributeChip key={temperament} label={temperament} />
          ))}
        </div>
        <p className="text-sm font-semibold text-text">
          {listing.adoptionFee != null
            ? `Adoption Fee: $${listing.adoptionFee}`
            : "Adoption Fee: Contact shelter"}
        </p>
        {!listing.acceptingApplications && (
          <p className="text-xs font-semibold text-gold">
            Not currently accepting new applications
          </p>
        )}
      </div>

      <div className="flex items-start sm:items-center">
        <button
          type="button"
          disabled
          title="Adoption Applications are not built yet"
          className="h-9 whitespace-nowrap rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          Apply Now
        </button>
      </div>
    </article>
  );
}
