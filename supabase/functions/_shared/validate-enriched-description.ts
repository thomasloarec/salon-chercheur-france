/**
 * Auto-validation des descriptions enrichies générées par IA.
 *
 * Vérifie la cohérence factuelle stricte entre le texte généré et les données
 * source de l'événement. Bloque toute donnée inventée (chiffres, exposants,
 * dates, lieux, prix, programme).
 *
 * Utilisé par enrich-event-meta (au moment de la génération) et par la
 * fonction revalidate-enriched-description (réévaluation a posteriori).
 */

export interface EventSource {
  nom_event: string;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  pays: string | null;
  nom_lieu: string | null;
  code_postal: string | null;
  rue: string | null;
  secteur: unknown; // jsonb array
  affluence: string | null;
  tarif: string | null;
  url_site_officiel: string | null;
  description_event: string | null;
  enrichissement_niveau: string | null;
}

export type CheckStatus = 'pass' | 'warning' | 'fail';

export interface CheckResult {
  code: string;
  label: string;
  status: CheckStatus;
  blocker: boolean;
  penalty: number;
  details?: string;
  evidence?: string[];
}

export interface ValidationResult {
  status: 'passed' | 'warning' | 'failed';
  score: number;
  decision: 'auto_validate' | 'manual_review';
  reason: string;
  checks: CheckResult[];
  blockers: string[];
  warnings: string[];
  stats: {
    char_count: number;
    word_count: number;
    min_words_required: number;
  };
  validated_at: string;
}

// ───────────────────────────── Helpers ─────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function extractYears(text: string): number[] {
  const m = text.match(/\b(19|20)\d{2}\b/g) ?? [];
  return [...new Set(m.map(Number))];
}

/** Tous les nombres "significatifs" : >= 2 chiffres OU collés à une unité chiffrable. */
function extractNumbers(text: string): { value: number; raw: string; context: string }[] {
  const out: { value: number; raw: string; context: string }[] = [];
  // capture nombres avec séparateurs (espaces fines, virgule, point, m²)
  const re = /\b(\d{1,3}(?:[ .  \u202f]\d{3})+|\d{2,})(?:[.,]\d+)?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const clean = raw.replace(/[ .  \u202f]/g, '').replace(',', '.');
    const value = Number(clean);
    if (!Number.isFinite(value)) continue;
    const start = Math.max(0, m.index - 30);
    const end = Math.min(text.length, m.index + raw.length + 30);
    out.push({ value, raw, context: text.slice(start, end) });
  }
  return out;
}

function sectorTokens(secteur: unknown): string[] {
  if (!Array.isArray(secteur)) return [];
  return secteur.flatMap((s) => {
    if (typeof s === 'string') return [normalize(s)];
    if (s && typeof s === 'object' && 'name' in s) return [normalize(String((s as { name: unknown }).name))];
    return [];
  });
}

function getSourceNumbers(src: EventSource): Set<number> {
  const nums = new Set<number>();
  // Années des dates source
  for (const d of [src.date_debut, src.date_fin]) {
    if (d) {
      const y = new Date(d).getFullYear();
      if (Number.isFinite(y)) nums.add(y);
    }
  }
  // Affluence (peut être "50000", "50 000", "~50k")
  if (src.affluence) {
    const m = src.affluence.match(/\d[\d  .\u202f]*/g) ?? [];
    for (const x of m) {
      const v = Number(x.replace(/[ .  \u202f]/g, ''));
      if (Number.isFinite(v)) nums.add(v);
    }
  }
  // Code postal / rue : tolérés (composante d'adresse)
  if (src.code_postal) {
    const cp = Number(src.code_postal.replace(/\s/g, ''));
    if (Number.isFinite(cp)) nums.add(cp);
  }
  return nums;
}

// ───────────────────────────── Checks ─────────────────────────────

function checkLength(text: string, src: EventSource): { check: CheckResult; words: number; min: number } {
  const words = wordCount(text);
  const min = src.enrichissement_niveau === 'premium' ? 250 : 180;
  const status: CheckStatus = words >= min ? 'pass' : 'fail';
  return {
    words,
    min,
    check: {
      code: 'length_min',
      label: 'Longueur minimale',
      status,
      blocker: status === 'fail',
      penalty: status === 'fail' ? 100 : 0,
      details: `${words} mots (min: ${min})`,
    },
  };
}

function checkDates(text: string, src: EventSource): CheckResult {
  const cited = extractYears(text);
  const allowed = new Set<number>();
  for (const d of [src.date_debut, src.date_fin]) {
    if (d) {
      const y = new Date(d).getFullYear();
      if (Number.isFinite(y)) {
        allowed.add(y);
        allowed.add(y + 1); // édition à venir tolérée
      }
    }
  }
  const bad = cited.filter((y) => !allowed.has(y) && y >= 2020 && y <= 2035);
  if (bad.length === 0) {
    return { code: 'date_consistency', label: 'Cohérence des dates', status: 'pass', blocker: false, penalty: 0 };
  }
  return {
    code: 'date_consistency',
    label: 'Cohérence des dates',
    status: 'fail',
    blocker: true,
    penalty: 100,
    details: `Année(s) citée(s) absente(s) des dates source: ${bad.join(', ')}`,
    evidence: bad.map(String),
  };
}

function checkCity(text: string, src: EventSource): CheckResult {
  if (!src.ville) {
    return { code: 'city_consistency', label: 'Cohérence de la ville', status: 'pass', blocker: false, penalty: 0, details: 'pas de ville source' };
  }
  const norm = normalize(text);
  const cityNorm = normalize(src.ville);
  if (!norm.includes(cityNorm)) {
    // ville pas mentionnée — toléré (warning faible)
    return { code: 'city_consistency', label: 'Cohérence de la ville', status: 'pass', blocker: false, penalty: 0, details: 'ville source non citée (toléré)' };
  }
  // Liste blanche des autres villes FR majeures qu'on ne veut pas voir citées à tort
  const otherCities = ['paris', 'lyon', 'marseille', 'toulouse', 'bordeaux', 'lille', 'nantes', 'strasbourg', 'nice', 'montpellier', 'rennes', 'grenoble', 'cannes', 'reims'];
  const wrong = otherCities.filter((c) => c !== cityNorm && new RegExp(`\\b${c}\\b`).test(norm));
  if (wrong.length > 0) {
    return {
      code: 'city_consistency',
      label: 'Cohérence de la ville',
      status: 'fail',
      blocker: true,
      penalty: 100,
      details: `Ville(s) étrangère(s) citée(s): ${wrong.join(', ')} alors que l'événement est à ${src.ville}`,
      evidence: wrong,
    };
  }
  return { code: 'city_consistency', label: 'Cohérence de la ville', status: 'pass', blocker: false, penalty: 0 };
}

function checkVenue(text: string, src: EventSource): CheckResult {
  if (!src.nom_lieu) {
    return { code: 'venue_consistency', label: 'Cohérence du lieu', status: 'pass', blocker: false, penalty: 0, details: 'pas de lieu source' };
  }
  const norm = normalize(text);
  const venueNorm = normalize(src.nom_lieu);
  // Si lieu source pas cité, c'est OK. Si un AUTRE lieu connu est cité, fail.
  const knownVenues = ['parc des expositions', 'palais des congres', 'palais des festivals', 'porte de versailles', 'paris expo', 'eurexpo', 'parc chanot', 'vipark'];
  const venueMentioned = norm.includes(venueNorm);
  const wrong = knownVenues.filter((v) => v !== venueNorm && !venueNorm.includes(v) && !v.includes(venueNorm) && norm.includes(v));
  if (wrong.length > 0 && !venueMentioned) {
    return {
      code: 'venue_consistency',
      label: 'Cohérence du lieu',
      status: 'fail',
      blocker: true,
      penalty: 100,
      details: `Lieu(x) étranger(s) cité(s): ${wrong.join(', ')}, source: ${src.nom_lieu}`,
      evidence: wrong,
    };
  }
  return { code: 'venue_consistency', label: 'Cohérence du lieu', status: 'pass', blocker: false, penalty: 0 };
}

function checkNumbersGrounded(text: string, src: EventSource): CheckResult {
  const sourceNums = getSourceNumbers(src);
  const cited = extractNumbers(text);
  // Contextes "à risque" : visiteurs, exposants, éditions, m², %, milliards
  const riskyRe = /(visiteur|exposant|edition|édition|participant|conferen|m2|m²|%|pourcent|milliard|million|milliers|stand|professionnel)/i;
  const offenders: { value: number; context: string }[] = [];
  for (const n of cited) {
    if (!riskyRe.test(n.context)) continue;
    if (sourceNums.has(n.value)) continue;
    // tolérance ±5% si proche d'une valeur source (arrondi rédactionnel)
    let tolerated = false;
    for (const sv of sourceNums) {
      if (sv > 0 && Math.abs(n.value - sv) / sv <= 0.05) { tolerated = true; break; }
    }
    if (!tolerated) offenders.push({ value: n.value, context: n.context.trim() });
  }
  if (offenders.length === 0) {
    return { code: 'numbers_grounded', label: 'Chiffres sourcés', status: 'pass', blocker: false, penalty: 0 };
  }
  return {
    code: 'numbers_grounded',
    label: 'Chiffres sourcés',
    status: 'fail',
    blocker: true,
    penalty: 100,
    details: `${offenders.length} chiffre(s) non présent(s) en base sur un contexte sensible`,
    evidence: offenders.slice(0, 5).map((o) => `${o.value} → « …${o.context}… »`),
  };
}

function checkExhibitorsGrounded(text: string, exhibitorNames: string[]): CheckResult {
  // On cherche les noms propres en majuscules (TOKEN, ACME, etc.) qui ne sont pas dans la liste
  // Heuristique conservative : ne pas générer de faux positifs.
  const allowed = new Set(exhibitorNames.map(normalize));
  // Repère des chaînes en CAPS de 3+ lettres (hors stop-words)
  const STOPCAPS = new Set(['IFTM', 'IPEM', 'CES', 'AI', 'IA', 'B2B', 'B2C', 'FR', 'EU', 'USA', 'UK', 'PME', 'ETI', 'SAS', 'SARL', 'IT', 'CTO', 'CEO', 'CRM', 'ERP', 'SEO', 'API', 'TGV', 'RER', 'COP']);
  const re = /\b([A-Z][A-Z0-9&.\-]{2,}(?:\s+[A-Z][A-Z0-9&.\-]{2,}){0,3})\b/g;
  const suspects: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const token = m[1];
    if (STOPCAPS.has(token)) continue;
    if (allowed.has(normalize(token))) continue;
    // Tolérer si fragment d'un nom autorisé
    let inAllowed = false;
    for (const a of allowed) {
      if (a.includes(normalize(token)) || normalize(token).includes(a)) { inAllowed = true; break; }
    }
    if (!inAllowed) suspects.push(token);
  }
  // Dédup
  const dedup = [...new Set(suspects)];
  if (dedup.length === 0) {
    return { code: 'exhibitors_grounded', label: 'Exposants sourcés', status: 'pass', blocker: false, penalty: 0 };
  }
  // On reste prudent : warning, pas fail (pour éviter faux positifs sur sigles)
  return {
    code: 'exhibitors_grounded',
    label: 'Exposants sourcés',
    status: 'warning',
    blocker: false,
    penalty: 15,
    details: `${dedup.length} nom(s) en majuscules non trouvé(s) dans la liste des exposants`,
    evidence: dedup.slice(0, 8),
  };
}

function checkPriceInvented(text: string, src: EventSource): CheckResult {
  const re = /(\d+\s*€|euro|gratuit|tarif|billet|inscription\s+payant|prix\s+d['']?entr[ée]e)/i;
  if (!re.test(text)) {
    return { code: 'price_invented', label: 'Tarifs non inventés', status: 'pass', blocker: false, penalty: 0 };
  }
  if (src.tarif && src.tarif.trim().length > 0) {
    return { code: 'price_invented', label: 'Tarifs non inventés', status: 'pass', blocker: false, penalty: 0, details: 'mention tarifaire OK (tarif source présent)' };
  }
  return {
    code: 'price_invented',
    label: 'Tarifs non inventés',
    status: 'fail',
    blocker: true,
    penalty: 100,
    details: 'Mention de tarif/gratuité/billet alors qu\'aucun tarif source n\'existe',
  };
}

function checkProgramInvented(text: string): CheckResult {
  // On bloque seulement les mentions très précises : horaires, jour précis d'une conf, nom d'atelier
  const re = /(\b\d{1,2}h\d{0,2}\b|\bde\s+\d{1,2}h\b|programme\s+complet|conf[ée]rence\s+inaugurale|atelier\s+«|workshop\s+«|keynote\s+de\s+m)/i;
  if (re.test(text)) {
    return {
      code: 'program_invented',
      label: 'Programme non inventé',
      status: 'warning',
      blocker: false,
      penalty: 15,
      details: 'Mention d\'horaires précis ou de programme détaillé — vérifier la source',
    };
  }
  return { code: 'program_invented', label: 'Programme non inventé', status: 'pass', blocker: false, penalty: 0 };
}

function checkSuperlatives(text: string): CheckResult {
  const hits: string[] = [];
  const patterns: [RegExp, string][] = [
    [/le\s+plus\s+grand/i, 'le plus grand'],
    [/n[°o]\s*1\b/i, 'n°1'],
    [/num[ée]ro\s+un/i, 'numéro un'],
    [/leader\s+(mondial|fran[çc]ais|europ[ée]en)/i, 'leader mondial/français/européen'],
    [/unique\s+en\s+france/i, 'unique en France'],
    [/r[ée]f[ée]rence\s+(mondiale|incontournable)/i, 'référence mondiale/incontournable'],
  ];
  for (const [re, label] of patterns) if (re.test(text)) hits.push(label);
  const incontournables = (text.match(/incontournable/gi) ?? []).length;
  if (incontournables >= 2) hits.push(`"incontournable" x${incontournables}`);
  if (hits.length === 0) {
    return { code: 'superlatives', label: 'Superlatifs non sourcés', status: 'pass', blocker: false, penalty: 0 };
  }
  return {
    code: 'superlatives',
    label: 'Superlatifs non sourcés',
    status: 'warning',
    blocker: false,
    penalty: 10,
    details: 'Tournures superlatives détectées (à vérifier)',
    evidence: hits,
  };
}

function checkCommercialPromise(text: string): CheckResult {
  const hits: string[] = [];
  const patterns: [RegExp, string][] = [
    [/garantit/i, 'garantit'],
    [/tous\s+les\s+professionnels/i, 'tous les professionnels'],
    [/\b100\s*%\s*(garanti|satisfait|gratuit)/i, '100% garanti/satisfait/gratuit'],
  ];
  for (const [re, label] of patterns) if (re.test(text)) hits.push(label);
  if (hits.length === 0) {
    return { code: 'commercial_promise', label: 'Promesses commerciales', status: 'pass', blocker: false, penalty: 0 };
  }
  return {
    code: 'commercial_promise',
    label: 'Promesses commerciales',
    status: 'warning',
    blocker: false,
    penalty: 10,
    details: 'Promesses commerciales détectées',
    evidence: hits,
  };
}

function checkGeneric(text: string, src: EventSource): CheckResult {
  // Densité de tokens event-specific (nom_event + secteurs)
  const norm = normalize(text);
  const totalWords = wordCount(norm);
  if (totalWords === 0) {
    return { code: 'generic_text', label: 'Texte non générique', status: 'warning', blocker: false, penalty: 10, details: 'texte vide après normalisation' };
  }
  const tokens = [normalize(src.nom_event), ...sectorTokens(src.secteur)].filter(Boolean);
  let hits = 0;
  for (const t of tokens) {
    if (!t) continue;
    const re = new RegExp(`\\b${t.split(' ').join('\\s+')}\\b`, 'g');
    hits += (norm.match(re) ?? []).length;
  }
  const density = hits / totalWords;
  if (density < 0.005) {
    return { code: 'generic_text', label: 'Texte non générique', status: 'warning', blocker: false, penalty: 10, details: `densité event-specific très faible (${(density * 100).toFixed(2)}%)` };
  }
  return { code: 'generic_text', label: 'Texte non générique', status: 'pass', blocker: false, penalty: 0, details: `densité ${(density * 100).toFixed(2)}%` };
}

function checkRepetition(text: string): CheckResult {
  const words = normalize(text).split(/\s+/).filter((w) => w.length >= 5);
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const overused: string[] = [];
  for (const [w, n] of counts) if (n >= 6 && !['salon', 'evenement', 'edition', 'visiteur', 'exposant', 'professionnel', 'lotexpo'].includes(w)) overused.push(`${w} (${n})`);
  if (overused.length === 0) {
    return { code: 'repetition', label: 'Pas de répétition excessive', status: 'pass', blocker: false, penalty: 0 };
  }
  return {
    code: 'repetition',
    label: 'Pas de répétition excessive',
    status: 'warning',
    blocker: false,
    penalty: 5,
    details: 'Mots répétés ≥ 6 fois',
    evidence: overused.slice(0, 5),
  };
}

function checkFakeFaq(text: string): CheckResult {
  if (/\b(q\s*:|question\s*:|r[ée]ponse\s*:|faq)\b/i.test(text)) {
    return {
      code: 'fake_faq',
      label: 'Pas de FAQ artificielle',
      status: 'warning',
      blocker: false,
      penalty: 10,
      details: 'Motif type FAQ détecté dans la description',
    };
  }
  return { code: 'fake_faq', label: 'Pas de FAQ artificielle', status: 'pass', blocker: false, penalty: 0 };
}

// ───────────────────────────── Public API ─────────────────────────────

export function validateEnrichedDescription(
  description: string,
  source: EventSource,
  exhibitorNames: string[],
): ValidationResult {
  const text = (description ?? '').trim();
  const lengthRes = checkLength(text, source);
  const checks: CheckResult[] = [
    lengthRes.check,
    checkDates(text, source),
    checkCity(text, source),
    checkVenue(text, source),
    checkNumbersGrounded(text, source),
    checkExhibitorsGrounded(text, exhibitorNames),
    checkPriceInvented(text, source),
    checkProgramInvented(text),
    checkSuperlatives(text),
    checkCommercialPromise(text),
    checkGeneric(text, source),
    checkRepetition(text),
    checkFakeFaq(text),
  ];

  const blockers = checks.filter((c) => c.blocker && c.status === 'fail').map((c) => `${c.code}: ${c.details ?? c.label}`);
  const warnings = checks.filter((c) => c.status === 'warning').map((c) => `${c.code}: ${c.details ?? c.label}`);

  const penalty = checks.reduce((s, c) => s + (c.status !== 'pass' ? c.penalty : 0), 0);
  let score = Math.max(0, Math.min(100, 100 - penalty));

  let status: 'passed' | 'warning' | 'failed';
  let decision: 'auto_validate' | 'manual_review';
  let reason: string;

  if (blockers.length > 0) {
    status = 'failed';
    score = Math.min(score, 50);
    decision = 'manual_review';
    reason = `Bloquant(s): ${blockers.join(' | ')}`;
  } else if (score >= 85) {
    status = 'passed';
    decision = 'auto_validate';
    reason = warnings.length === 0 ? 'Tous les contrôles passés' : `Validé malgré ${warnings.length} warning(s) mineur(s)`;
  } else {
    status = 'warning';
    decision = 'manual_review';
    reason = `Score insuffisant (${score} < 85) — ${warnings.length} warning(s)`;
  }

  return {
    status,
    score,
    decision,
    reason,
    checks,
    blockers,
    warnings,
    stats: {
      char_count: text.length,
      word_count: lengthRes.words,
      min_words_required: lengthRes.min,
    },
    validated_at: new Date().toISOString(),
  };
}