// Red dot plus a short next-action label for list rows that need the
// viewer's action.
export function NeedsActionLabel({ label }: { label?: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
      <span className="inline-block h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
      <span>
        <span className="sr-only">Needs your action: </span>
        {label ?? "Needs your action"}
      </span>
    </p>
  );
}
