// src/lib/images.ts
export const EVENT_PLACEHOLDER = "/placeholder.svg";

export function coalesceImageUrl(row: any): string | null {
  // Champs possibles côté DB/API
  const candidates = [
    row?.image_url,
    row?.url_image,
    row?.imageUrl,
    row?.image,
    row?.cover_url,
    row?.coverUrl,
  ].filter(Boolean) as string[];

  const first = candidates.find((u) => typeof u === "string" && u.trim().length > 0) ?? null;
  return first;
}