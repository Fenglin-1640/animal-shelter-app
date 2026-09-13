// PRD 5.6: AO3 Tags -> ASAMS AttributeChip (e.g. "Dog", "Desexed").
// Purely informational, no status semantics or color coding.
export function AttributeChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-page px-2 py-0.5 text-xs text-text-muted">
      {label}
    </span>
  );
}
