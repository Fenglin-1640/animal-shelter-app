// Neutral placeholder per PRD 5.10 (no photo assets until the final
// visual polish stage) - a generic image icon, not species artwork.
export function PlaceholderThumbnail({
  species,
  className = "sm:w-40",
}: {
  species: string;
  className?: string;
}) {
  return (
    <div
      className={`flex aspect-[4/3] w-full shrink-0 items-center justify-center rounded-[12px] border border-border bg-page text-text-muted ${className}`}
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
