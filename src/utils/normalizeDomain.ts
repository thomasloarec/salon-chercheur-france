/**
 * Normalise les domaines pour comparaison cohérente
 */
export function normalizeDomain(input: string): string {
  try {
    let s = input.trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
    s = s.split('/')[0].split('#')[0].split('?')[0];
    // TODO: convertir IDN → punycode si nécessaire (ex: via 'punycode' lib)
    return s;
  } catch {
    return input.trim().toLowerCase();
  }
}