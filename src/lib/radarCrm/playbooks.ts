/**
 * Radar CRM — moteur de suggestions de mission (front only, déterministe).
 *
 * Génère un objectif, une phrase d'ouverture et un TOP 3 de questions terrain
 * à partir du statut relationnel du compte et du profil d'offre commercial.
 *
 * Aucun appel réseau : purement une fonction de templating avec fallbacks.
 * Les phrases finales ne contiennent jamais de slot non résolu ({problem}, {product}).
 */

import type { RelationshipStatus } from './relationship';

export interface OfferProfileInput {
  sells?: string | null;
  target?: string | null;
  problem?: string | null;
  qualifies?: string | null;
}

export interface MissionSuggestion {
  objective: string;
  opening_line: string;
  top_q1: string;
  top_q2: string;
  top_q3: string;
}

/** {problem} = profil.problem trimmé ; si vide → « ce sujet ». */
const resolveProblem = (offer: OfferProfileInput | null | undefined): string => {
  const p = (offer?.problem ?? '').trim();
  return p.length > 0 ? p : 'ce sujet';
};

/** {product} = premier produit de profil.sells ; null si vide (adapte la phrase). */
const resolveProduct = (offer: OfferProfileInput | null | undefined): string | null => {
  const first = (offer?.sells ?? '').split(',')[0]?.trim() ?? '';
  return first.length > 0 ? first : null;
};

/**
 * Génère les suggestions déterministes pour un statut + profil d'offre.
 * @param status statut relationnel (null → 'a_qualifier').
 */
export const buildMissionSuggestion = (
  status: RelationshipStatus | null | undefined,
  offer: OfferProfileInput | null | undefined,
): MissionSuggestion => {
  const s: RelationshipStatus = status ?? 'a_qualifier';
  const problem = resolveProblem(offer);
  const product = resolveProduct(offer);

  switch (s) {
    case 'client_actif':
      return {
        objective: "Détecter une opportunité d'extension ou d'upsell.",
        opening_line:
          "Bonjour, on travaille déjà avec certaines de vos équipes. Je passais voir ce que vous mettez en avant cette année.",
        top_q1: "Qu'est-ce que vous poussez surtout sur le salon cette année ?",
        top_q2: `Est-ce que ${problem} est un sujet qui monte chez vous en ce moment ?`,
        top_q3: "Les équipes qui travaillent là-dessus sont plutôt sur quel site ?",
      };

    case 'client_dormant':
      return {
        objective: "Rouvrir la conversation sans repartir directement sur l'achat.",
        opening_line:
          "Bonjour, on a déjà collaboré avec vos équipes. Je voulais comprendre vos nouveautés cette année.",
        top_q1: "Qu'est-ce que vous mettez surtout en avant sur ce salon ?",
        top_q2: `Est-ce que ${problem} reste un enjeu prioritaire pour vous cette année ?`,
        top_q3: "Est-ce que vos projets avec vos fournisseurs ont bougé sur ce périmètre ?",
      };

    case 'prospect_chaud':
      return {
        objective: "Vérifier si le projet est toujours actif et à quel stade.",
        opening_line:
          "Bonjour, on avait échangé il y a quelque temps avec vos équipes. Je voulais savoir où en est le sujet chez vous.",
        top_q1: "Est-ce que le sujet est toujours d'actualité cette année, ou les priorités ont changé ?",
        top_q2: "Le projet est-il toujours porté par la même équipe ?",
        top_q3: "Le périmètre ou le timing ont-ils évolué depuis nos échanges ?",
      };

    case 'prospect_froid':
      return {
        objective: "Qualifier le besoin et trouver une porte d'entrée.",
        opening_line:
          "Bonjour, je découvre votre activité sur le salon. Vous travaillez surtout avec quel type de clients ?",
        top_q1: `Est-ce que ${problem} est un enjeu chez vous en ce moment ?`,
        top_q2: "Ce type de sujet est plutôt suivi par la technique, les achats, ou par projet ?",
        top_q3: product
          ? `Vous avez des projets de développement autour de ${product} cette année ?`
          : "Vous avez des projets de développement cette année ?",
      };

    case 'ancien_client':
      return {
        objective: "Comprendre ce qui a changé et évaluer un retour.",
        opening_line:
          "Bonjour, on a travaillé ensemble par le passé. Je voulais voir ce qui a évolué chez vous depuis.",
        top_q1: "Qu'est-ce qui a changé dans votre organisation ces dernières années ?",
        top_q2: `Sur ${problem}, vous êtes équipés avec qui aujourd'hui ?`,
        top_q3: "Est-ce qu'il y aurait une porte d'entrée pour retravailler ensemble ?",
      };

    case 'a_qualifier':
    default:
      return {
        objective: "Découvrir l'activité et qualifier l'intérêt.",
        opening_line:
          "Bonjour, je découvre votre stand. Vous êtes plutôt sur quel type d'applications ?",
        top_q1: `Est-ce que ${problem} vous parle comme sujet ?`,
        top_q2: "Qui s'occupe de ce type de sujet chez vous ?",
        top_q3: "Est-ce que je peux vous envoyer une information courte après le salon ?",
      };
  }
};
