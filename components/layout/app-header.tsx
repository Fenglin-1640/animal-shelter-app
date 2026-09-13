"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";

interface HeaderIconButtonProps {
  label: string;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

function HeaderIconButton({ label, href, onClick, children }: HeaderIconButtonProps) {
  const className =
    "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text transition-colors duration-150 hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

  if (href) {
    return (
      <Link href={href} title={label} aria-label={label} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={className}
    >
      {children}
    </button>
  );
}

export function AppHeader({
  onToggleNav,
  onSignOut,
}: {
  onToggleNav: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] sm:px-6">
      <button
        type="button"
        onClick={onToggleNav}
        title="Open navigation menu"
        aria-label="Open navigation menu"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text hover:bg-surface-active lg:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex h-8 w-[180px] max-w-[45vw] shrink-0 items-center">
        <span className="text-lg font-bold tracking-tight text-text">
          ASAMS
        </span>
      </div>

      <div className="hidden flex-1 justify-center md:flex">
        <label htmlFor="global-search" className="sr-only">
          Search by Shelter ID, Animal Name, Microchip Number or Application ID
        </label>
        <input
          id="global-search"
          type="search"
          placeholder="Search Shelter ID, Animal Name, Microchip, Application ID"
          className="h-9 w-full max-w-[360px] min-w-[260px] rounded-full border border-border bg-page px-4 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <HeaderIconButton label="Notifications" href="/notifications">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.5 21a1.5 1.5 0 0 0 3 0" />
          </svg>
        </HeaderIconButton>
        <HeaderIconButton label="My Profile" href="/profile">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c1.5-4 6-6 8-6s6.5 2 8 6" />
          </svg>
        </HeaderIconButton>
        <ThemeToggle />
        <HeaderIconButton label="Sign Out" onClick={onSignOut}>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </HeaderIconButton>
      </div>
    </header>
  );
}
