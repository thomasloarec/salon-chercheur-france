export const EVENT_PLACEHOLDER = "/placeholder.svg";

export function coalesceImageUrl(row: any): string | null {
  const candidates = [
    row?.image_url,   // déjà normalisé ailleurs ?
    row?.url_image,   // colonne DB
    row?.imageUrl,
    row?.image,
    row?.cover_url,
    row?.coverUrl,
  ].filter((u): u is string => typeof u === "string" && u.trim().length > 0);

  return candidates[0] ?? null;
}