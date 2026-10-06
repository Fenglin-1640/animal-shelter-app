"use client";

import { useEffect, useState } from "react";
import type { ApplicationDocument } from "@/lib/applications/types";
import { downloadFile, getAttachmentRules, removeFile, uploadFile } from "@/lib/files/client";
import { describeRules, FILE_FORMATS, type AttachmentRules } from "@/lib/files/rules";

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

// An application's supporting documents. Stored files can be downloaded;
// the owning Adopter can add and remove them while the application is a
// Draft (onChanged reloads the application afterwards).
export function ApplicationDocuments({
  applicationId,
  documents,
  canEdit,
  canRemove = canEdit,
  onChanged,
}: {
  applicationId: string;
  documents: ApplicationDocument[];
  // Add documents.
  canEdit: boolean;
  // Remove documents (only while the application is a Draft).
  canRemove?: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const [rules, setRules] = useState<AttachmentRules | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    getAttachmentRules().then((r) => {
      if (!cancelled) setRules(r);
    });
    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  const accept = rules ? rules.formats.flatMap((f) => [...FILE_FORMATS[f].extensions, FILE_FORMATS[f].contentType]).join(",") : undefined;

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setProgress(0);
    const result = await uploadFile("application", applicationId, file, rules, setProgress);
    setProgress(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setFile(null);
    setInputKey((k) => k + 1);
    await onChanged?.();
  };

  const handleRemove = async (id: string) => {
    setError(null);
    if (!(await removeFile(id))) setError("The document could not be removed.");
    await onChanged?.();
  };

  const handleDownload = async (id: string) => {
    setError(null);
    setDownloading(id);
    const ok = await downloadFile(id);
    setDownloading(null);
    if (!ok) setError("The document could not be downloaded.");
  };

  return (
    <div>
      {documents.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No documents uploaded.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-page px-3 py-2 text-sm"
            >
              <span className="min-w-0 break-all text-text">
                {d.fileName} ({formatSize(d.fileSizeKB)})
              </span>
              <span className="flex items-center gap-3">
                {d.stored ? (
                  <button
                    type="button"
                    onClick={() => void handleDownload(d.id)}
                    disabled={downloading === d.id}
                    className="text-xs font-semibold text-secondary underline underline-offset-2 hover:no-underline disabled:opacity-60"
                  >
                    {downloading === d.id ? "Downloading..." : `Download ${d.fileName}`}
                  </button>
                ) : (
                  <span className="text-xs text-text-muted">File name only</span>
                )}
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(d.id)}
                    className="text-xs font-semibold text-danger underline underline-offset-2 hover:no-underline"
                    aria-label={`Remove ${d.fileName}`}
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs text-text-muted">{rules ? `Accepted: ${describeRules(rules)}.` : "Accepted: PDF, JPG, PNG."}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor={`doc-upload-${applicationId}`} className="sr-only">
              Choose a document
            </label>
            <input
              id={`doc-upload-${applicationId}`}
              key={inputKey}
              type="file"
              accept={accept}
              onChange={(e) => {
                setError(null);
                setFile(e.target.files?.[0] ?? null);
              }}
              className="max-w-full text-sm text-text file:mr-2 file:h-9 file:rounded-[12px] file:border file:border-border file:bg-page file:px-3 file:text-sm file:font-semibold file:text-text"
            />
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={!file || progress !== null}
              className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-60"
            >
              {progress !== null ? `Uploading... ${Math.round(progress * 100)}%` : "Upload Document"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
