// Generates simple placeholder photos for the workbook's ~120 photo
// filenames (60 main + 60 council-transfer-attachment images) - the
// real image files were never supplied. Each is a solid-colour
// rectangle (colour picked deterministically per species) with the
// animal's name printed on it, saved to test-data/photos/<filename> for
// traceability and also returned as a base64 JPEG data URL for
// Photo.imageData (the Council Transfer attachment only needs the file
// on disk - TransferAttachment doesn't persist image bytes, same
// metadata-only pattern as every other attachment in this prototype).
import fs from "node:fs";
import path from "node:path";
import { Jimp, loadFont, JimpMime } from "jimp";
import { SANS_32_BLACK } from "jimp/fonts";

const PHOTOS_DIR = path.join(__dirname, "..", "..", "..", "test-data", "photos");

const SPECIES_COLOR: Record<string, number> = {
  Cat: 0xe8c9a0ff,
  Dog: 0xc9d8b8ff,
  Bird: 0xa9d3e0ff,
  Reptile: 0xcbe0a9ff,
};

let fontPromise: ReturnType<typeof loadFont> | null = null;
function font() {
  if (!fontPromise) fontPromise = loadFont(SANS_32_BLACK);
  return fontPromise;
}

export async function generatePlaceholderPhoto(
  filename: string,
  label: string,
  species: string,
): Promise<{ dataUrl: string; fileSizeKB: number; filePath: string }> {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  const filePath = path.join(PHOTOS_DIR, filename);

  const color = SPECIES_COLOR[species] ?? 0xd8c3a5ff;
  const img = new Jimp({ width: 480, height: 360, color });
  const f = await font();
  img.print({ font: f, x: 16, y: 150, text: label, maxWidth: 448 });

  const buf = await img.getBuffer(JimpMime.jpeg);
  fs.writeFileSync(filePath, buf);

  return {
    dataUrl: `data:image/jpeg;base64,${buf.toString("base64")}`,
    fileSizeKB: Math.max(1, Math.round(buf.length / 1024)),
    filePath,
  };
}
