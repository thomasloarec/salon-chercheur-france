/** Analyse pure du contenu d'un QR code de badge ou de carte de visite. */
export interface QrParsed {
  kind: 'vcard' | 'mecard' | 'linkedin' | 'company_url' | 'email' | 'unknown';
  name?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  job_title?: string;
  email?: string;
  phone?: string;
  url?: string;
  linkedin_url?: string;
  domain?: string;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const unescapeV = (s: string) => s.replace(/\\n/gi, ' ').replace(/\\([,;:\\])/g, '$1').trim();

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}
const isLinkedIn = (host: string | null) => !!host && (host === 'linkedin.com' || host.endsWith('.linkedin.com') || host === 'lnkd.in');

function finish(r: QrParsed): QrParsed {
  if (!r.name) r.name = [r.first_name, r.last_name].filter(Boolean).join(' ') || undefined;
  if (r.url) {
    const h = hostOf(r.url);
    if (isLinkedIn(h)) r.linkedin_url = r.url;
    else if (h && !r.domain) r.domain = h;
  }
  return r;
}

function parseVCard(text: string): QrParsed {
  // dépliage des lignes (RFC 6350 : une ligne commençant par un espace prolonge la précédente)
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const r: QrParsed = { kind: 'vcard' };
  for (const raw of lines) {
    const idx = raw.indexOf(':');
    if (idx < 0) continue;
    const head = raw.slice(0, idx).toUpperCase();
    const value = raw.slice(idx + 1);
    const prop = head.split(';')[0].replace(/^ITEM\d+\./, '');
    switch (prop) {
      case 'FN':
        r.name = unescapeV(value) || r.name;
        break;
      case 'N': {
        const [last, first] = value.split(';').map(unescapeV);
        r.last_name = last || undefined;
        r.first_name = first || undefined;
        break;
      }
      case 'ORG':
        r.company = unescapeV(value.split(';')[0]) || r.company;
        break;
      case 'TITLE':
        r.job_title = unescapeV(value) || r.job_title;
        break;
      case 'EMAIL':
        if (!r.email) r.email = unescapeV(value).replace(/^mailto:/i, '');
        break;
      case 'TEL':
        if (!r.phone) r.phone = unescapeV(value).replace(/^tel:/i, '');
        break;
      case 'URL':
        if (!r.url) r.url = unescapeV(value);
        break;
    }
  }
  return finish(r);
}

function parseMeCard(text: string): QrParsed {
  const body = text.replace(/^MECARD:/i, '');
  const r: QrParsed = { kind: 'mecard' };
  // champs séparés par ';' non échappés
  const fields = body.split(/(?<!\\);/);
  for (const f of fields) {
    const idx = f.indexOf(':');
    if (idx < 0) continue;
    const k = f.slice(0, idx).toUpperCase();
    const v = unescapeV(f.slice(idx + 1));
    if (!v) continue;
    if (k === 'N') {
      const [last, first] = v.split(',').map((s) => s.trim());
      if (first) {
        r.first_name = first;
        r.last_name = last;
      } else r.name = last;
    } else if (k === 'ORG') r.company = v;
    else if (k === 'EMAIL' && !r.email) r.email = v;
    else if (k === 'TEL' && !r.phone) r.phone = v;
    else if (k === 'URL' && !r.url) r.url = v;
    else if (k === 'TITLE') r.job_title = v;
  }
  return finish(r);
}

export function parseQr(input: string): QrParsed {
  const text = (input ?? '').trim();
  if (!text) return { kind: 'unknown' };
  if (/^BEGIN:VCARD/i.test(text)) return parseVCard(text);
  if (/^MECARD:/i.test(text)) return parseMeCard(text);
  if (/^https?:\/\//i.test(text)) {
    const host = hostOf(text);
    if (isLinkedIn(host)) return { kind: 'linkedin', url: text, linkedin_url: text };
    if (host) return { kind: 'company_url', url: text, domain: host };
  }
  if (/^mailto:/i.test(text)) {
    const m = text.match(EMAIL_RE);
    if (m) return { kind: 'email', email: m[0] };
  }
  const m = text.match(EMAIL_RE);
  if (m) return { kind: 'email', email: m[0] };
  return { kind: 'unknown' };
}

export const hasUsefulData = (p: QrParsed) =>
  p.kind !== 'unknown' && !!(p.name || p.company || p.email || p.phone || p.linkedin_url || p.domain);
