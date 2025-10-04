// src/lib/url.ts
export function normalizeExternalUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let s = String(raw).trim();
  if (!s) return undefined;

  // Si on a des liens du type "/events/brconditionnement.fr" → extraire le segment final
  const eventsMatch = s.match(/\/events\/([^/?#]+)/i);
  if (eventsMatch && eventsMatch[1]) {
    s = eventsMatch[1];
  }

  // Retirer tout préfixe "http(s)://" en double accidentel
  s = s.replace(/^https?:\/\//i, '').replace(/^\/+/, '');

  // Si c'est un domaine ou "www.xxx", on préfixe en https://
  // (garde tel/mailto intacts si jamais ils arrivent ici)
  const isLikelyDomain = /\./.test(s) && !/^mailto:|^tel:/i.test(s);
  const startsWithProtocol = /^https?:\/\//i.test(raw);
  if (startsWithProtocol) {
    return raw.trim();
  }
  if (isLikelyDomain) {
    return `https://${s}`;
  }

  // Dernier recours : si on nous a déjà donné une URL absolue avec protocole exotique, on la renvoie brute
  try {
    const u = new URL(raw);
    return u.toString();
  } catch {
    // Sinon, on abandonne (évite de créer un href relatif)
    return undefined;
  }
}
