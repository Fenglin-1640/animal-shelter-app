import { ROLE_FUNCTIONS, type Role } from "@/lib/roles/roles";

function NavItem({
  label,
  current = false,
}: {
  label: string;
  current?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={current ? "page" : undefined}
        className={`flex w-full items-center rounded-[12px] border px-3 py-2 text-left text-sm transition-colors duration-150 ${
          current
            ? "border-border-strong bg-surface-active font-semibold text-text"
            : "border-transparent text-text hover:border-border hover:bg-surface-active"
        }`}
      >
        {label}
      </button>
    </li>
  );
}

function NavGroup({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {heading}
      </h2>
      <ul className="flex flex-col gap-1">
        {items.map((label) => (
          <NavItem key={label} label={label} />
        ))}
      </ul>
    </div>
  );
}

export function RoleSidebar({
  role,
  displayName,
  mobileOpen,
  onClose,
}: {
  role: Role;
  displayName: string;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const functions = ROLE_FUNCTIONS[role];

  const content = (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="rounded-[12px] border border-border bg-surface px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Signed in as
        </p>
        <p className="truncate text-sm font-semibold text-text">
          {displayName}
        </p>
        <p className="text-xs text-text-muted">{role}</p>
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-4">
        <div className="border-t border-border pt-4">
          <ul className="flex flex-col gap-1">
            <NavItem label="Home" current />
          </ul>
        </div>
        <NavGroup
          heading="Administration Functions"
          items={functions.administration.map((f) => f.label)}
        />
        <NavGroup
          heading="User Functions"
          items={functions.user.map((f) => f.label)}
        />
      </nav>
    </div>
  );

  return (
    <>
      <aside
        className="sticky top-14 hidden h-[calc(100vh-56px)] shrink-0 border-r border-border bg-page lg:block"
        style={{ width: "clamp(180px, 18vw, 240px)" }}
      >
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 w-[260px] max-w-[80vw] border-r border-border bg-page shadow-lg">
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="text-sm font-semibold text-text">Menu</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text hover:bg-surface-active"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
