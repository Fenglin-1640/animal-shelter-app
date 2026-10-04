import { db } from "@/lib/db/client";
import { verifyPhotoImageUrl } from "@/lib/auth/server-session";

// Serves one photo's image bytes, decoded from the stored base64 data
// URL. Photo lists only carry metadata plus this URL (see toPhoto), so
// each image is downloaded once, only where it's shown, and then reused
// from the browser cache. An <img> can't send the Authorization header,
// so this route is authorised by the signed, expiring URL that the
// role-checked photo lists hand out (signedPhotoImageUrl) rather than by
// a session. A photo's image never changes after upload (only its alt
// text and primary flag are ever patched), so the response is cached for
// as long as the URL stays valid.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const validFor = verifyPhotoImageUrl(id, url.searchParams.get("exp"), url.searchParams.get("sig"));
  if (validFor === null) {
    return new Response("Forbidden", { status: 403 });
  }
  const row = await db.orm.Photo.select("id", "imageData").where({ id }).first();
  const match = row?.imageData?.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }
  const [, contentType, base64] = match;
  return new Response(Buffer.from(base64, "base64"), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `private, max-age=${Math.min(validFor, 86400)}`,
    },
  });
}
