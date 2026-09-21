// Browser-only helpers for turning an uploaded File into the base64
// data URL Photo.imageData stores. Runs entirely client-side - there is
// no server-side file handling (see prisma/contract.prisma's Photo
// model comment for why: this app deploys to Vercel, which has no
// writable/persistent filesystem for uploads).

// Origin file size ceiling, checked before any decode work - rejects
// outright rather than trying to downscale something unreasonably
// large for a prototype whose photos live as base64 text in a SQLite
// row (see MAX_ENCODED_BYTES below for the actual stored-size guard).
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Ceiling on the base64 string itself, checked after downscaling.
// Downscaling below always keeps normal photos well under this, but a
// very high-detail source image compressed at MAX_QUALITY can still
// come in over it - reject rather than silently truncate.
const MAX_ENCODED_BYTES = 5 * 1024 * 1024;

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export type FileToDataUrlResult =
  | { ok: true; dataUrl: string }
  | { ok: false; reason: "too_large" | "unreadable" };

// Downscales to at most MAX_DIMENSION on the long edge and re-encodes
// as JPEG, so a multi-megabyte phone photo doesn't get stored verbatim
// in a SQLite text column. Non-raster sources (e.g. SVG) still rasterise
// fine through the same <img> + <canvas> path.
export async function fileToDataUrl(file: File): Promise<FileToDataUrlResult> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = objectUrl;
    });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, reason: "unreadable" };
    ctx.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (dataUrl.length > MAX_ENCODED_BYTES) return { ok: false, reason: "too_large" };
    return { ok: true, dataUrl };
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
