const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Returns true for absolute http(s)/mailto/tel URLs, root-relative internal
 * paths ("/collection/..."), and wa.me WhatsApp links. Rejects javascript:,
 * data:, and any other scheme that could be used for script injection.
 */
export function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return true;
  if (trimmed.startsWith("#")) return true;

  try {
    const url = new URL(trimmed);
    return SAFE_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export function isSafeWhatsAppUrl(value: string): boolean {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      (url.hostname === "wa.me" || url.hostname === "api.whatsapp.com")
    );
  } catch {
    return /^\+?[0-9][0-9\s-]{6,}$/.test(trimmed);
  }
}

export type ParsedVideoEmbed = { provider: "youtube" | "vimeo"; embedUrl: string } | null;

/**
 * Only approved providers (YouTube, Vimeo) are accepted; the raw video ID is
 * extracted from a validated URL shape rather than trusting arbitrary embed
 * HTML/iframes from the admin.
 */
export function parseVideoEmbedUrl(value: string): ParsedVideoEmbed {
  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v");
    if (id && /^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
      return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` };
    }
    return null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    if (id && /^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
      return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` };
    }
    return null;
  }
  if (host === "vimeo.com") {
    const id = url.pathname.slice(1);
    if (id && /^[0-9]{6,15}$/.test(id)) {
      return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
    }
    return null;
  }
  return null;
}
