import Link from "next/link";

// PRD 5.3/5.8.4: unauthorized direct URL access must show Access Denied
// with a clear reason and a way back to the Landing Screen.
export function AccessDenied() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[12px] border border-danger bg-danger/10 p-8 text-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="32"
        height="32"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-danger"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m4.9 4.9 14.2 14.2" />
      </svg>
      <h1 className="text-xl font-bold text-text">Access Denied</h1>
      <p className="max-w-sm text-sm text-text">
        Your account role does not have permission to view this page.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center justify-center rounded-[12px] bg-primary px-5 text-sm font-semibold text-page transition-opacity duration-150 hover:opacity-90"
      >
        Back to Landing Screen
      </Link>
    </div>
  );
}
