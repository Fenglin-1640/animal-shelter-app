"use client";

import { checkFile, type AttachmentRules, type StoredFileMeta } from "@/lib/files/rules";
import { authedFetch, getJson, send } from "@/lib/shared/http";

// Upload and download for files stored through /api/files. Content moves
// in chunks (each request well under the hosting body-size limit) and
// every request carries this tab's bearer token, so downloads are
// assembled here and saved from a local object URL rather than linked.

export async function getAttachmentRules(): Promise<AttachmentRules | null> {
  const result = await getJson<{ ok?: boolean; rules?: AttachmentRules }>("/api/files/rules");
  return result.rules ?? null;
}

export type UploadResult = { ok: true; file: StoredFileMeta } | { ok: false; message: string };

export async function uploadFile(
  ownerType: string,
  ownerId: string,
  file: File,
  rules: AttachmentRules | null,
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  if (rules) {
    const problem = checkFile(file.name, file.size, rules);
    if (problem) return { ok: false, message: problem };
  }
  const startResponse = await send("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerType, ownerId, fileName: file.name, sizeBytes: file.size }),
  });
  const start = await startResponse.json();
  if (!start.ok) return { ok: false, message: start.message ?? "The file could not be uploaded." };
  const meta = start.item as StoredFileMeta;
  const chunkBytes = start.chunkBytes as number;
  for (let i = 0; i < meta.chunkCount; i++) {
    const body = file.slice(i * chunkBytes, Math.min(file.size, (i + 1) * chunkBytes));
    const response = await send(`/api/files/${encodeURIComponent(meta.id)}/chunks/${i}`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body,
    });
    const result = await response.json().catch(() => ({ ok: false }));
    if (!result.ok) {
      // Drop the unfinished upload (already gone if its content was refused).
      if (result.reason !== "rejected") await removeFile(meta.id);
      return { ok: false, message: result.message ?? "The file could not be uploaded." };
    }
    onProgress?.((i + 1) / meta.chunkCount);
  }
  return { ok: true, file: meta };
}

export async function removeFile(fileId: string): Promise<boolean> {
  const response = await send(`/api/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  const result = await response.json().catch(() => ({ ok: false }));
  return Boolean(result.ok);
}

// Fetches every chunk, then saves the file under its own name.
export async function downloadFile(fileId: string): Promise<boolean> {
  const metaResult = await getJson<{ ok?: boolean; item?: StoredFileMeta }>(`/api/files/${encodeURIComponent(fileId)}`);
  const meta = metaResult.item;
  if (!meta) return false;
  const parts: ArrayBuffer[] = [];
  for (let i = 0; i < meta.chunkCount; i++) {
    const response = await authedFetch(`/api/files/${encodeURIComponent(fileId)}/chunks/${i}`);
    if (!response.ok) return false;
    parts.push(await response.arrayBuffer());
  }
  const url = URL.createObjectURL(new Blob(parts, { type: meta.contentType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = meta.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
