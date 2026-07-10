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
  // Chiffres présents dans la description source (import/organisateur) :
  // ce sont des faits sourcés (ex. "8 000 visiteurs", "200 exposants"), pas des inventions.
  if (src.description_event) {
    const desc = src.description_event.replace(/<[^>]+>/g, ' ');
    const dm = desc.match(/\d[\d\s.]*/g) ?? [];
    for (const x of dm) {
      const v = Number(x.replace(/[\s.]/g, ''));
      if (Number.isFinite(v)) nums.add(v);
    }
  }
  return nums;
}

// ───────────────────────────── Checks ─────────────────────────────

function checkLength(text: string, src: EventSource): { check: CheckResult; words: number; min: number } {
  const words = wordCount(text);
  const min = src.enrichissement_niveau === 'premium' ? 250 : 180;
  // Règle 3 paliers :
  //  ≥ 95 % du minimum : longueur acceptable (pass, aucune pénalité) — auto-validation possible
  //  85 % – 95 %       : warning (revue manuelle, pénalité légère)
  //  < 85 %            : fail bloquant
  const softMin = Math.floor(min * 0.95);
  const hardMin = Math.floor(min * 0.85);
  let status: CheckStatus;
  let penalty: number;
  let blocker: boolean;
  if (words >= softMin) {
    status = 'pass';
    penalty = 0;
    blocker = false;
  } else if (words >= hardMin) {
    status = 'warning';
    penalty = 10;
    blocker = false;
  } else {
    status = 'fail';
    penalty = 100;
    blocker = true;
  }
  return {
    words,
    min,
    check: {
      code: 'length_min',
      label: 'Longueur minimale',
      status,
      blocker,
      penalty,
      details: `${words} mots (min: ${min}, acceptable ≥ ${softMin}, fail < ${hardMin})`,
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
  // Alias géographiques : communes de banlieue qui hébergent les parcs d'expo
  // de la grande ville voisine. Citer la grande ville n'est PAS une erreur.
  // clé = ville source (commune réelle), valeurs = villes "tolérées" dans le texte
  const CITY_ALIASES: Record<string, string[]> = {
    chassieu: ['lyon'],
    eurexpo: ['lyon'],
    villeurbanne: ['lyon'],
    villepinte: ['paris'],
    'le bourget': ['paris'],
    bourget: ['paris'],
    'paris nord villepinte': ['paris'],
    'porte de versailles': ['paris'],
    nanterre: ['paris'],
    'la defense': ['paris'],
    courbevoie: ['paris'],
    puteaux: ['paris'],
    cergy: ['paris'],
    'parc chanot': ['marseille'],
    'aubagne': ['marseille'],
    blagnac: ['toulouse'],
    merignac: ['bordeaux'],
    'lesquin': ['lille'],
    'villeneuve d ascq': ['lille'],
    'saint herblain': ['nantes'],
    'la baule': ['nantes'],
    schiltigheim: ['strasbourg'],
    'illkirch': ['strasbourg'],
  };
  const allowed = new Set<string>([cityNorm, ...(CITY_ALIASES[cityNorm] ?? [])]);
  if (!norm.includes(cityNorm) && ![...allowed].some((a) => norm.includes(a))) {
    // ville pas mentionnée — toléré (warning faible)
    return { code: 'city_consistency', label: 'Cohérence de la ville', status: 'pass', blocker: false, penalty: 0, details: 'ville source non citée (toléré)' };
  }
  // Liste blanche des autres villes FR majeures qu'on ne veut pas voir citées à tort
  const otherCities = ['paris', 'lyon', 'marseille', 'toulouse', 'bordeaux', 'lille', 'nantes', 'strasbourg', 'nice', 'montpellier', 'rennes', 'grenoble', 'cannes', 'reims'];
  const wrong = otherCities.filter((c) => !allowed.has(c) && new RegExp(`\\b${c}\\b`).test(norm));
  if (wrong.length > 0) {
    return {
      code: 'city_consistency',
      label: 'Cohérence de la ville',
      status: 'fail',
      blocker: true,
      penalty: 100,
      details: `Ville(s) étrangère(s) citée(s): ${wrong.join(', ')} alors que l'événement est à ${src.ville}${CITY_ALIASES[cityNorm] ? ` (alias autorisés: ${CITY_ALIASES[cityNorm].join(', ')})` : ''}`,
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

function checkExhibitorsGrounded(text: string, src: EventSource, exhibitorNames: string[]): CheckResult {
  // Cherche des tokens en MAJUSCULES non sourcés ET utilisés dans un contexte
  // qui désigne explicitement une entreprise / un exposant. Évite les faux
  // positifs sur acronymes (MICE, UNESCO, ESG…) ou termes présents dans le
  // contexte source (nom_event, lieu, secteur, description_event).
  const allowed = new Set(exhibitorNames.map(normalize).filter(Boolean));

  // Liste blanche : acronymes institutionnels / sectoriels courants
  const STOPCAPS = new Set([
    // Tech / business
    'AI', 'IA', 'B2B', 'B2C', 'D2C', 'PME', 'ETI', 'TPE', 'SAS', 'SARL', 'SA',
    'IT', 'OT', 'CTO', 'CEO', 'CFO', 'COO', 'CMO', 'DG', 'RH',
    'CRM', 'ERP', 'SEO', 'SEA', 'API', 'SDK', 'SAAS', 'PAAS', 'IAAS', 'KPI',
    'IOT', 'ML', 'NLP', 'LLM', 'AR', 'VR', 'XR', 'UI', 'UX', 'QA',
    // RSE / finance / juridique
    'RSE', 'ESG', 'CSR', 'RGPD', 'GDPR', 'TVA', 'IFRS', 'EBITDA', 'ROI', 'IPO',
    'LP', 'GP', 'LPS', 'GPS', 'VC', 'PE', 'AUM', 'NAV',
    // Pays / régions / langues
    'FR', 'EU', 'UE', 'USA', 'UK', 'US', 'CN', 'JP', 'DACH', 'EMEA', 'APAC', 'MENA', 'LATAM',
    // Tourisme / événementiel / institutions
    'MICE', 'UNESCO', 'OTAN', 'NATO', 'OMS', 'ONU', 'OCDE', 'OPEP', 'COP', 'GIEC',
    'SNCF', 'RATP', 'TGV', 'RER',
    // Salons / médias
    'CES', 'IFA', 'NRF', 'SIAL', 'CFIA',
  ]);

  // Tokens présents dans le contexte source — à ignorer automatiquement
  const sourceBag = normalize([
    src.nom_event ?? '',
    src.ville ?? '',
    src.pays ?? '',
    src.nom_lieu ?? '',
    src.rue ?? '',
    src.description_event ?? '',
    ...(Array.isArray(src.secteur)
      ? src.secteur.map((s) => (typeof s === 'string' ? s : (s as { name?: string })?.name ?? ''))
      : []),
  ].join(' '));

  // Regex CAPS 3+ caractères (acronymes ou noms type ACME)
  const re = /\b([A-Z][A-Z0-9&.\-]{2,}(?:\s+[A-Z][A-Z0-9&.\-]{2,}){0,3})\b/g;

  // Contextes "exposant" : on ne flag que si le token apparaît dans une
  // fenêtre de 40 caractères contenant un mot évocateur d'entreprise.
  const companyContextRe = /(stand|exposant|exposants|expose|exposera|présent[ée]?\s+(?:par|sur)|société|entreprise|marque|groupe|filiale|fournisseur|partenaire\s+officiel|sponsor|éditeur|fabricant|startup|scale-?up|équipementier)/i;

  const suspects: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const token = m[1].trim();
    if (STOPCAPS.has(token.toUpperCase())) continue;
    const norm = normalize(token);
    if (!norm) continue;
    if (allowed.has(norm)) continue;
    // Fragment d'un nom autorisé
    let inAllowed = false;
    for (const a of allowed) {
      if (a && (a.includes(norm) || norm.includes(a))) { inAllowed = true; break; }
    }
    if (inAllowed) continue;
    // Présent dans le contexte source (nom_event, lieu, secteur, description_event…)
    if (sourceBag.includes(norm)) continue;
    // Contexte explicitement "entreprise" ?
    const start = Math.max(0, m.index - 40);
    const end = Math.min(text.length, m.index + token.length + 40);
    const window = text.slice(start, end);
    if (!companyContextRe.test(window)) continue;
    suspects.push(token);
  }

  const dedup = [...new Set(suspects)];
  if (dedup.length === 0) {
    return { code: 'exhibitors_grounded', label: 'Exposants sourcés', status: 'pass', blocker: false, penalty: 0 };
  }
  return {
    code: 'exhibitors_grounded',
    label: 'Exposants sourcés',
    status: 'warning',
    blocker: false,
    penalty: 15,
    details: `${dedup.length} entreprise(s) citée(s) en contexte exposant mais absente(s) de la liste`,
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

function checkProgramInvented(text: string, src: EventSource): CheckResult {
  // Bloque uniquement les inventions précises : horaires, sessions nommées,
  // intervenants nommés, programmes jour-par-jour, ateliers/keynotes spécifiques.
  // Les thématiques générales (déjà dans description_event) ne sont pas bloquées.
  const sourceText = normalize(src.description_event ?? '');

  const patterns: { re: RegExp; label: string; allowIfInSource?: boolean }[] = [
    { re: /\b\d{1,2}h\d{2}\b/i, label: 'horaire précis (ex: 9h30)', allowIfInSource: true },
    { re: /\bde\s+\d{1,2}h(\d{2})?\s+(?:à|a)\s+\d{1,2}h/i, label: 'créneau horaire', allowIfInSource: true },
    { re: /conf[ée]rence\s+inaugurale/i, label: 'conférence inaugurale' },
    { re: /atelier\s+[«"][^»"]{3,}[»"]/i, label: 'atelier nommé' },
    { re: /workshop\s+[«"][^»"]{3,}[»"]/i, label: 'workshop nommé' },
    { re: /keynote\s+(?:de\s+)?(?:m\.|mme|monsieur|madame|dr\.?|prof\.?)\s+[A-Z]/i, label: 'keynote avec intervenant nommé' },
    { re: /intervenant[s]?\s*:\s*[A-Z]/i, label: 'liste d\'intervenants nommés' },
    { re: /jour\s+\d\s*:\s*/i, label: 'programme jour-par-jour' },
    { re: /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+\d{1,2}h/i, label: 'session jour+horaire' },
  ];

  const hits: string[] = [];
  for (const p of patterns) {
    const m = text.match(p.re);
    if (!m) continue;
    // Si le motif EXACT est déjà présent dans la source, on tolère
    if (p.allowIfInSource && sourceText.includes(normalize(m[0]))) continue;
    hits.push(p.label);
  }

  if (hits.length === 0) {
    return { code: 'program_invented', label: 'Programme non inventé', status: 'pass', blocker: false, penalty: 0 };
  }
  return {
    code: 'program_invented',
    label: 'Programme non inventé',
    status: 'warning',
    blocker: false,
    penalty: 15,
    details: 'Élément(s) de programme précis détecté(s) — vérifier la source',
    evidence: hits.slice(0, 5),
  };
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
  // Approche par ANCRAGES : on compte les éléments factuels distincts présents
  // (nom_event, ville, pays, lieu, année(s), secteur(s)). Un texte avec ≥ 5
  // ancrages distincts est considéré comme suffisamment ancré, même si la
  // densité brute reste faible.
  const norm = normalize(text);
  const totalWords = wordCount(norm);
  if (totalWords === 0) {
    return { code: 'generic_text', label: 'Texte non générique', status: 'warning', blocker: false, penalty: 10, details: 'texte vide après normalisation' };
  }

  const anchors: { key: string; hit: boolean }[] = [];
  const addAnchor = (key: string, candidates: string[]) => {
    const hit = candidates.some((c) => {
      const cn = normalize(c);
      if (!cn || cn.length < 2) return false;
      return norm.includes(cn);
    });
    anchors.push({ key, hit });
  };

  // 1. nom_event : on accepte n'importe quel token significatif (≥ 3 car), ex: "IFTM"
  const nameTokens = normalize(src.nom_event ?? '')
    .split(' ')
    .filter((w) => w.length >= 3 && !['les', 'des', 'pour', 'avec', 'salon', 'event', 'expo'].includes(w));
  addAnchor('nom_event', [normalize(src.nom_event ?? ''), ...nameTokens]);

  // 2. ville
  if (src.ville) addAnchor('ville', [src.ville]);
  // 3. pays
  if (src.pays) addAnchor('pays', [src.pays]);
  // 4. lieu
  if (src.nom_lieu) {
    const venueTokens = normalize(src.nom_lieu).split(' ').filter((w) => w.length >= 4);
    addAnchor('lieu', [normalize(src.nom_lieu), ...venueTokens]);
  }
  // 5. année(s)
  const years = new Set<string>();
  for (const d of [src.date_debut, src.date_fin]) {
    if (d) {
      const y = new Date(d).getFullYear();
      if (Number.isFinite(y)) years.add(String(y));
    }
  }
  if (years.size > 0) addAnchor('annee', [...years]);
  // 6. secteur(s)
  const sectors = sectorTokens(src.secteur);
  if (sectors.length > 0) {
    const flat = sectors.flatMap((s) => [s, ...s.split(' ').filter((w) => w.length >= 4)]);
    addAnchor('secteur', flat);
  }
  // 7. URL officielle (domaine)
  if (src.url_site_officiel) {
    try {
      const host = new URL(src.url_site_officiel).hostname.replace(/^www\./, '').split('.')[0];
      if (host && host.length >= 3) addAnchor('source_officielle', [host]);
    } catch { /* ignore */ }
  }

  const hitCount = anchors.filter((a) => a.hit).length;
  const missing = anchors.filter((a) => !a.hit).map((a) => a.key);

  // Densité brute (fallback) : nb d'occurrences de tokens d'ancrages / mots
  let occ = 0;
  for (const a of anchors) {
    // approximation : pour le scoring densité, on compte juste les ancrages présents
    if (a.hit) occ += 1;
  }
  const density = occ / totalWords;

  // Pass si ≥ 5 ancrages OU densité ≥ 0.5 %
  if (hitCount >= 5 || density >= 0.005) {
    return {
      code: 'generic_text',
      label: 'Texte non générique',
      status: 'pass',
      blocker: false,
      penalty: 0,
      details: `${hitCount} ancrage(s) présent(s) (densité ${(density * 100).toFixed(2)}%)`,
    };
  }

  return {
    code: 'generic_text',
    label: 'Texte non générique',
    status: 'warning',
    blocker: false,
    penalty: 10,
    details: `Seulement ${hitCount} ancrage(s) factuel(s) présent(s) — manque: ${missing.join(', ')}`,
    evidence: missing,
  };
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
    checkExhibitorsGrounded(text, source, exhibitorNames),
    checkPriceInvented(text, source),
    checkProgramInvented(text, source),
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