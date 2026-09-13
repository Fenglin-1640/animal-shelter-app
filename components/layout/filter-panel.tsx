import type { ReactNode } from "react";

export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

// PRD 5.6: AO3 "Sort and Filter" -> ASAMS FilterPanel. This is just the
// panel body; pages decide how to position it (sticky desktop aside vs.
// a temporary drawer below the xl breakpoint per PRD 5.5.3).
export function FilterPanel({
  activeChips,
  onClearAll,
  children,
}: {
  activeChips: ActiveFilterChip[];
  onClearAll: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-text">Sort and Filter</h2>
        {activeChips.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-semibold text-secondary underline underline-offset-2 hover:no-underline"
          >
            Clear all
          </button>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 text-xs text-text hover:bg-surface-active"
            >
              {chip.label}
              <span aria-hidden="true">&times;</span>
            </button>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

export function FilterGroup({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {heading}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
