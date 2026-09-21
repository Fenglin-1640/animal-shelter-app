"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FUNCTION_HREFS } from "@/lib/roles/function-links";
import { usePendingCount } from "@/lib/pending-actions/use-pending-count";
import { ROLE_FUNCTIONS, type Role } from "@/lib/roles/roles";

// Small badge next to a nav item's label for whatever that role has
// concretely actionable right now (lib/pending-actions/registry.ts) - a
// submitted Payment awaiting verification, an Application awaiting
// decision, and so on. Renders nothing when the label has no registered
// fetcher or its count is 0.
function PendingBadge({ label }: { label: string }) {
  const count = usePendingCount(label);
  if (count <= 0) return null;
  return (
    <span
      className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-page"
      aria-label={`${count} item${count === 1 ? "" : "s"} awaiting your action`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavItem({
  label,
  href,
  current = false,
  onNavigate,
}: {
  label: string;
  href?: string;
  current?: boolean;
  onNavigate?: () => void;
}) {
  const className = `flex w-full items-center rounded-[12px] border px-3 py-2 text-left text-sm transition-colors duration-150 ${
    current
      ? "border-border-strong bg-surface-active font-semibold text-text"
      : "border-transparent text-text hover:border-border hover:bg-surface-active"
  }`;

  return (
    <li>
      {href ? (
        <Link
          href={href}
          aria-current={current ? "page" : undefined}
          onClick={onNavigate}
          className={className}
        >
          {label}
          <PendingBadge label={label} />
        </Link>
      ) : (
        <button
          type="button"
          aria-current={current ? "page" : undefined}
          className={className}
        >
          {label}
          <PendingBadge label={label} />
        </button>
      )}
    </li>
  );
}

function NavGroup({
  heading,
  items,
  pathname,
  onNavigate,
}: {
  heading: string;
  items: string[];
  pathname: string;
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {heading}
      </h2>
      <ul className="flex flex-col gap-1">
        {items.map((label) => {
          const href = FUNCTION_HREFS[label];
          return (
            <NavItem
              key={label}
              label={label}
              href={href}
              current={Boolean(href) && href === pathname}
              onNavigate={onNavigate}
            />
          );
        })}
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
  const pathname = usePathname();

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
            <NavItem
              label="Home"
              href="/"
              current={pathname === "/"}
              onNavigate={onClose}
            />
          </ul>
        </div>
        <NavGroup
          heading="Administration Functions"
          items={functions.administration.map((f) => f.label)}
          pathname={pathname}
          onNavigate={onClose}
        />
        <NavGroup
          heading="User Functions"
          items={functions.user.map((f) => f.label)}
          pathname={pathname}
          onNavigate={onClose}
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
