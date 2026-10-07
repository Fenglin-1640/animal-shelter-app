"use client";

import { useRef, useState } from "react";

// A file picker with English text: a "Choose file" button and the chosen
// file's name (or "No file chosen"). The browser's own file input, whose
// text follows the browser language, stays hidden but keeps the id, so
// <label htmlFor> and file uploads work as before. The button is what
// keyboard and screen-reader users reach; it is named "Choose file -
// <label>" and described by the status and any hint.
export function FileField({
  id,
  label,
  accept,
  disabled,
  onFile,
  describedBy,
  className = "",
}: {
  id: string;
  // The field's visible label, for the button's accessible name.
  label: string;
  accept?: string;
  disabled?: boolean;
  onFile: (file: File | null) => void;
  describedBy?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 ${className}`}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          setFileName(file?.name ?? null);
          onFile(file);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={`Choose file - ${label}`}
        aria-describedby={[`${id}-status`, describedBy].filter(Boolean).join(" ")}
        onClick={() => inputRef.current?.click()}
        className="h-9 shrink-0 rounded-[12px] border border-border bg-page px-3 text-sm font-semibold text-text hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
      >
        Choose file
      </button>
      <span id={`${id}-status`} className="min-w-0 max-w-[16rem] truncate text-sm text-text-muted" title={fileName ?? undefined}>
        {fileName ?? "No file chosen"}
      </span>
    </div>
  );
}
