// Neutral placeholder per PRD 5.10 (no photo assets until the final
// visual polish stage) - a generic image icon, not species artwork. When
// a real Photo (FR-AN-02) has been selected as the public listing photo,
// pass its altText so the accessible description reflects it - this
// still renders the same placeholder graphic (no real file bytes are
// stored in this prototype), just with a truthful screen-reader label
// instead of "no photo available".
// `className` must supply the full width behaviour (including a mobile
// fallback, e.g. "w-full sm:w-40") - it used to be appended after a
// hardcoded `w-full` base class, but a caller wanting a small width on
// every breakpoint (e.g. "w-20") would then have two same-specificity,
// unprefixed width utilities in the compiled class list, and Tailwind's
// stylesheet order (not attribute order) silently decided which one
// won - it was `w-full`, collapsing the sibling content to 0 width.
export function PlaceholderThumbnail({
  species,
  altText,
  className = "w-full sm:w-40",
}: {
  species: string;
  altText?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex aspect-[4/3] shrink-0 items-center justify-center rounded-[12px] border border-border bg-page text-text-muted ${className}`}
      aria-hidden={!altText}
    >
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-5-5L5 21" />
      </svg>
      <span className="sr-only">{altText || `No photo available for this ${species}`}</span>
    </div>
  );
}
