/**
 * Utility functions for data normalization in Airtable imports
 */

/**
 * Convertit 'DD/MM/YYYY' ou 'D/M/YY' en 'YYYY-MM-DD'
 */
export function normalizeDate(input: string | null): string | null {
  if (!input || input.trim() === '') return null;
  // Si déjà au format YYYY-MM-DD, on renvoie tel quel
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  // Pattern DD/MM/YYYY
  const m = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null; // format inconnu
  const [, d, mth, y] = m;
  // 2-digit year → 20xx
  const year = y.length === 2 ? `20${y}` : y.padStart(4, '0');
  const month = mth.padStart(2, '0');
  const day = d.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalise les URLs pour comparaison - retire protocole, www, slash final
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';
  return url.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

/**
 * Convertit une description en texte brut (avec sauts de ligne) en HTML
 * afin de préserver les paragraphes lors de l'affichage (rendu via
 * dangerouslySetInnerHTML côté front).
 *
 * - Si le texte contient déjà du HTML de bloc (<p>, <br>, <div>, <ul>, <ol>,
 *   <h1..h6>), on le renvoie tel quel (idempotent, pas de double-encodage).
 * - Sinon : on découpe sur les lignes vides pour créer des <p>, et on
 *   remplace les sauts de ligne simples par <br> à l'intérieur d'un paragraphe.
 */
export function formatDescriptionHtml(input: string | null | undefined): string | null {
  if (input == null) return null;
  const text = String(input);
  if (text.trim() === '') return null;

  // Déjà du HTML de bloc → ne pas retoucher
  if (/<\s*(p|br|div|ul|ol|li|h[1-6])\b/i.test(text)) {
    return text;
  }

  // Normaliser les fins de ligne
  const normalized = text.replace(/\r\n?/g, '\n');

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const paragraphs = normalized
    .split(/\n{2,}/) // lignes vides = séparateur de paragraphe
    .map((p) => p.trim())
    .filter((p) => p !== '');

  if (paragraphs.length === 0) return null;

  return paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Mapping vers les valeurs autorisées par la contrainte CHECK
 */
const EVENT_TYPE_ALLOWED = ['salon', 'conference', 'congres', 'convention', 'ceremonie'];

export function normalizeEventType(raw: string | null): string {
  if (!raw) return 'salon';
  
  const normalized = raw.toLowerCase().trim();
  
  // Mapping des variantes vers les valeurs autorisées
  const mappings: Record<string, string> = {
    'salon': 'salon',
    'salons': 'salon',
    'congrès': 'congres',
    'congrés': 'congres',
    'congres': 'congres',
    'congress': 'congres',
    'conférence': 'conference',
    'conference': 'conference',
    'convention': 'convention',
    'conventions': 'convention',
    'cérémonie': 'ceremonie',
    'ceremonie': 'ceremonie',
    'ceremony': 'ceremonie'
  };
  
  // Chercher d'abord dans les mappings exacts
  if (mappings[normalized]) {
    return mappings[normalized];
  }
  
  // Si pas trouvé, chercher une correspondance partielle
  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  // Par défaut, retourner salon
  return 'salon';
}