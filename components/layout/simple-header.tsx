import { ThemeToggle } from "@/components/theme/theme-toggle";

export function SimpleHeader() {
  return (
    <header className="flex h-14 items-center border-b border-border bg-surface px-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] sm:px-6">
      <span className="text-lg font-bold tracking-tight text-text">
        ASAMS
      </span>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
