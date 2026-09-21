"use client";

import { useEffect, useState, type ReactNode } from "react";

// Per-device UI display preference, not business data - same
// localStorage mechanism already used for the theme preference
// (lib/theme/theme-context.tsx's "asams-theme" key). storageKey must be
// unique per screen/role combination it's used for (callers scope it,
// e.g. `${screen}:${role}`) so dismissing one notice never suppresses a
// different one.
const STORAGE_PREFIX = "asams-readonly-notice-dismissed:";

function isDismissed(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + storageKey) === "1";
  } catch {
    return false;
  }
}

// Replaces the old permanent inline "you have read-only access" banner
// pattern (identical wording across Medical/Behaviour/Photos/Pre-Release
// Check/Follow-Up Visit) with a one-time modal: appears once per screen
// per device, can be dismissed for good via the checkbox. This only
// changes how the explanation is presented - it has no bearing on the
// underlying access control, which stays exactly as it was (buttons
// still hidden/disabled by the screen's own canAct checks).
export function ReadOnlyNoticeModal({
  storageKey,
  title = "Read-only access",
  message,
}: {
  storageKey: string;
  title?: string;
  message: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of client-only localStorage into React state (same pattern as lib/auth/auth-context.tsx's session hydration); reading localStorage during render would mismatch server-rendered output.
    setOpen(!isDismissed(storageKey));
    setDontShowAgain(false);
  }, [storageKey]);

  if (!open) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + storageKey, "1");
      } catch {
        // Private browsing / blocked storage - the notice will just
        // reappear next visit, which is a harmless degradation.
      }
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`readonly-notice-title-${storageKey}`}
        className="w-full max-w-md rounded-[12px] border border-border bg-surface p-6 shadow-lg"
      >
        <h2 id={`readonly-notice-title-${storageKey}`} className="text-lg font-bold text-text">
          {title}
        </h2>
        <div className="mt-2 text-sm text-text-muted">{message}</div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            Don&apos;t show this again
          </label>
          <button
            type="button"
            onClick={handleClose}
            className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
