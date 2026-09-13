import type { FunctionEntry } from "@/lib/roles/roles";

export function FunctionCard({ label, description }: FunctionEntry) {
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] transition-colors duration-150 hover:bg-surface-active">
      <h3 className="text-base font-semibold text-text">{label}</h3>
      <p className="text-sm text-text-muted">{description}</p>
    </div>
  );
}

export function FunctionCardGroup({
  heading,
  items,
}: {
  heading: string;
  items: FunctionEntry[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-text">{heading}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <FunctionCard key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}
