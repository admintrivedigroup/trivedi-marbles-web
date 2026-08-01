"use server";

// Downloads a Cloudinary slab image server-side and returns a base64 data URL.
// This bypasses browser canvas CORS restrictions entirely — the download
// happens on the server, never touches the client's Same-Origin policy.

const ALLOWED_HOSTNAMES = ["res.cloudinary.com", "images.unsplash.com"];

function isAllowed(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTNAMES.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function fetchTextureBase64(imageUrl: string): Promise<string | null> {
  if (!isAllowed(imageUrl)) {
    console.error("[fetchTextureBase64] URL not in allowlist:", imageUrl);
    return null;
  }

  try {
    const res = await fetch(imageUrl, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf  = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    const b64  = buf.toString("base64");

    console.log(
      `[fetchTextureBase64] ${Math.round(buf.length / 1024)} KB · ${mime} · ${imageUrl.slice(0, 60)}`,
    );

    return `data:${mime};base64,${b64}`;
  } catch (e) {
    console.error("[fetchTextureBase64] fetch failed:", e);
    return null;
  }
}
