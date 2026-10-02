import { db } from "@/lib/db/client";

// Serves one photo's image bytes, decoded from the stored base64 data
// URL. Photo lists only carry metadata plus this URL (see toPhoto), so
// each image is downloaded once, only where it's shown, and then reused
// from the browser cache. A photo's image never changes after upload
// (only its alt text and primary flag are ever patched), so the
// response can be cached.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await db.orm.Photo.select("id", "imageData").where({ id }).first();
  const match = row?.imageData?.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }
  const [, contentType, base64] = match;
  return new Response(Buffer.from(base64, "base64"), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
