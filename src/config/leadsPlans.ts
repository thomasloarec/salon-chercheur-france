/** Formules Lotexpo Leads affichées sur /lotexpo-leads. Modifier ici seulement. */
export interface LeadsFeature { id: string; label: string }

export const LEADS_FEATURES: LeadsFeature[] = [
  { id: 'capture', label: 'Saisie manuelle et badge QR' },
  { id: 'offline', label: 'Fonctionne hors réseau' },
  { id: 'list', label: 'Liste et suivi des rencontres' },
  { id: 'card_ai', label: 'Lecture des cartes de visite par IA' },
  { id: 'voice_ai', label: 'Dictée de la rencontre par IA' },
  { id: 'dashboard', label: 'Tableau de bord et objectif du jour' },
  { id: 'debrief', label: 'Débrief et synthèse IA' },
  { id: 'report', label: 'Bilan du salon et export CRM' },
  { id: 'all_salons', label: "Tous vos salons de l'année" },
  { id: 'compare', label: 'Comparaison entre salons' },
  { id: 'onboarding', label: 'Accompagnement au premier salon' },
];

export interface LeadsPlan {
  id: 'free' | 'salon' | 'annual';
  name: string;
  price: string;
  priceUnit?: string;
  tagline: string;
  seats: number;
  seatsLabel: string;
  includes: Record<string, boolean>;
  featured?: boolean;
  badge?: string;
}

const upTo = (lastIncluded: string): Record<string, boolean> => {
  const idx = LEADS_FEATURES.findIndex((f) => f.id === lastIncluded);
  return Object.fromEntries(LEADS_FEATURES.map((f, i) => [f.id, i <= idx]));
};

export const LEADS_PLANS: LeadsPlan[] = [
  {
    id: 'free',
    name: 'Gratuit',
    price: '0 €',
    tagline: 'Pour essayer la saisie sur un salon.',
    seats: 1,
    seatsLabel: '1 seul utilisateur',
    includes: upTo('list'),
  },
  {
    id: 'salon',
    name: 'Pass salon',
    price: '290 €',
    priceUnit: 'par salon',
    tagline: 'Pour toute l\'équipe sur un salon.',
    seats: 15,
    seatsLabel: "Jusqu'à 15 utilisateurs",
    includes: upTo('report'),
    featured: true,
    badge: 'Le plus choisi',
  },
  {
    id: 'annual',
    name: 'Annuel',
    price: '1 490 €',
    priceUnit: 'par an',
    tagline: 'Pour les exposants qui font plusieurs salons.',
    seats: 15,
    seatsLabel: "Jusqu'à 15 utilisateurs",
    includes: upTo('onboarding'),
  },
];

export const LEADS_PLANS_NOTE = 'Prix nets, TVA non applicable (art. 293 B du CGI). Pendant la bêta, toutes les fonctions sont offertes aux premiers exposants.';
