// Honest placeholder for an Animal Profile subscreen whose underlying
// feature (Intake photos, Medical, Behaviour, Applications) isn't built
// yet, previewing the record types that will populate it later.
export function EmptySubscreen({
  description,
  upcoming,
  action,
}: {
  description: string;
  upcoming?: string[];
  action?: { label: string; disabledReason: string };
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-page p-6">
      <p className="text-sm text-text-muted">{description}</p>

      {upcoming && upcoming.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {upcoming.map((item) => (
            <li
              key={item}
              className="flex items-center justify-between rounded-[12px] border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="text-text">{item}</span>
              <span className="text-xs text-text-muted">No records yet</span>
            </li>
          ))}
        </ul>
      )}

      {action && (
        <div>
          <button
            type="button"
            disabled
            title={action.disabledReason}
            className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}
