// ============================================================================
// score-seo-quality.ts
// Score de QUALITÉ SEO d'une description de salon (0-100).
//
// SOURCE UNIQUE, partagée entre :
//   - les Edge Functions SEO (génération / validation / auto-fix)
//   - le signal Alerte/Super de l'organisateur (front)
//
// Distinct de :
//   - auto_validation_score  = factualité (garde-fou anti-invention) — RESTE en place
//   - enrichissement_score   = opportunité/priorisation
//
// Fidèle au prototype validé sur 12 salons réels.
// Dimensions : profondeur 30 · couverture sémantique 25 · spécificité 20
//            · richesse lexicale 15 · structure 10.
//
// Fonction PURE, sans dépendance : identique en Deno (Edge Functions) et en
// navigateur (React). À maintenir à l'identique aux deux emplacements.
//
// COMBINAISON avec la factualité (au point d'appel) :
//   - si validateEnrichedDescription renvoie des blockers  -> signal 'alerte' + corriger (priorité factualité)
//   - sinon                                                -> signal = scoreSeoQuality(text).signal
// ============================================================================

export interface SeoQualitySubscores {
  profondeur: number;   // /30
  couverture: number;   // /25
  specificite: number;  // /20
  richesse: number;     // /15
  structure: number;    // /10
}

export interface SeoQualityStats {
  words: number;
  contentLemmas: number;
  entities: number;
  figures: number;
  distinctRatio: number;
  sentences: number;
}

export interface SeoQualityResult {
  score: number;                // 0-100
  signal: 'super' | 'alerte';   // Super si score >= SEO_QUALITY_SUPER_THRESHOLD
  subscores: SeoQualitySubscores;
  advice: string[];             // points à améliorer (dimensions faibles)
  stats: SeoQualityStats;
}

export const SEO_QUALITY_SUPER_THRESHOLD = 80;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

// Le champ source peut contenir du HTML : on le retire avant analyse.
function stripHtml(input: string): string {
  return (input || '').replace(/<[^>]+>/g, ' ');
}

function extractFeatures(rawText: string): SeoQualityStats & { distinctCount: number } {
  const text = stripHtml(rawText);
  const words = text.match(/[A-Za-zÀ-ÿ0-9]+/g) ?? [];
  const wordCount = words.length;

  // mots lettrés distincts (pour la richesse lexicale)
  const lettered = words.filter((w) => /[A-Za-zÀ-ÿ]/.test(w));
  const distinct = new Set(lettered.map((w) => w.toLowerCase()));

  // lemmes de contenu : tokens (>= 6 caractères) distincts, découpés sur non-mot
  const tokens = text.toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter(Boolean);
  const contentLemmas = new Set(tokens.filter((t) => t.length >= 6));

  const figures = (text.match(/\d+/g) ?? []).length;
  const entities = (text.match(/[A-ZÀ-Ö][A-Za-zÀ-ÿ0-9&.\-]+/g) ?? []).length;
  const sentences = Math.max(text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length, 1);
  const distinctRatio = wordCount > 0 ? distinct.size / wordCount : 0;

  return {
    words: wordCount,
    distinctCount: distinct.size,
    contentLemmas: contentLemmas.size,
    figures,
    entities,
    sentences,
    distinctRatio,
  };
}

export function scoreSeoQuality(rawText: string): SeoQualityResult {
  const f = extractFeatures(rawText);
  const wc = Math.max(f.words, 1);

  // Profondeur /30 — récompense le contenu long et riche (plateau 450-1000 mots),
  // au lieu de plafonner à 500. Léger repli au-delà de 1000.
  let depthN: number;
  if (wc <= 150) depthN = (0.15 * wc) / 150;
  else if (wc <= 450) depthN = 0.15 + (0.85 * (wc - 150)) / 300;
  else if (wc <= 1000) depthN = 1;
  else depthN = Math.max(0, 1 - (wc - 1000) / 1500);

  const profondeur = depthN * 30;

  // Couverture sémantique /25 — diversité des termes/sous-thèmes distincts.
  const couverture = clamp01(f.contentLemmas / 70) * 25;

  // Spécificité /20 — densité d'entités nommées + faits concrets (chiffres).
  // NB : c'est le renversement clé — ce que la factualité traite comme "risque",
  // le SEO le récompense comme "richesse" (la précision reste gérée par le plancher factuel).
  const specificite = clamp01((f.figures + f.entities) / 40) * 20;

  // Richesse lexicale /15 — variété du vocabulaire (anti-texte fade/répétitif).
  const richesse = clamp01((f.distinctRatio - 0.30) / 0.30) * 15;

  // Structure /10.
  const structure = f.sentences >= 6 ? 10 : f.sentences >= 3 ? 6 : 3;

  const score = round1(profondeur + couverture + specificite + richesse + structure);
  const signal: 'super' | 'alerte' = score >= SEO_QUALITY_SUPER_THRESHOLD ? 'super' : 'alerte';

  // Conseils ciblés sur les dimensions les plus faibles (en % de leur max).
  const advice: string[] = [];

  if (profondeur / 30 < 0.75) {
    advice.push(
      "Étoffez la description : visez 400 mots ou plus, avec des détails concrets sur le salon, ses thématiques et son public.",
    );
  }

  if (couverture / 25 < 0.70) {
    advice.push(
      "Élargissez le champ lexical : couvrez davantage de sous-thèmes et de termes précis du secteur (technologies, métiers, enjeux).",
    );
  }

  if (specificite / 20 < 0.60) {
    advice.push(
      "Ajoutez des éléments concrets : chiffres (exposants, visiteurs, éditions), noms des temps forts, partenaires ou thématiques nommées.",
    );
  }

  if (richesse / 15 < 0.60) {
    advice.push("Variez le vocabulaire : évitez les répétitions et les tournures génériques.");
  }

  if (structure < 10) {
    advice.push("Structurez le texte en plusieurs paragraphes et phrases pour la lisibilité.");
  }

  return {
    score,
    signal,
    subscores: {
      profondeur: round1(profondeur),
      couverture: round1(couverture),
      specificite: round1(specificite),
      richesse: round1(richesse),
      structure,
    },
    advice,
    stats: {
      words: f.words,
      contentLemmas: f.contentLemmas,
      entities: f.entities,
      figures: f.figures,
      distinctRatio: Math.round(f.distinctRatio * 100) / 100,
      sentences: f.sentences,
    },
  };
}
