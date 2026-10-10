/** Formules Lotexpo Leads affichées sur /lotexpo-leads. Modifier ici seulement. */
export interface LeadsPlan {
  id: 'free' | 'salon' | 'annual';
  name: string;
  price: string;
  priceUnit?: string;
  tagline: string;
  features: string[];
  featured?: boolean;
  badge?: string;
}

export const LEADS_PLANS: LeadsPlan[] = [
  {
    id: 'free',
    name: 'Gratuit',
    price: '0 €',
    tagline: 'Pour essayer la saisie sur un salon.',
    features: ['Comptes des administrateurs de la fiche', 'Saisie manuelle et badge QR', 'Fonctionne hors réseau', 'Liste des rencontres'],
  },
  {
    id: 'salon',
    name: 'Pass salon',
    price: '290 €',
    priceUnit: 'HT par salon',
    tagline: 'Pour toute l\'équipe sur un salon.',
    features: ['Toute l\'équipe du stand', 'Lecture de cartes et dictée par IA', 'Tableau de bord et objectif du jour', 'Débrief, synthèse IA, bilan et export'],
    featured: true,
    badge: 'Le plus choisi',
  },
  {
    id: 'annual',
    name: 'Annuel',
    price: '1 490 €',
    priceUnit: 'HT par an',
    tagline: 'Pour les exposants qui font plusieurs salons.',
    features: ['Tous vos salons de l\'année', 'Tout le Pass salon', 'Comparaison entre salons', 'Accompagnement au premier salon'],
  },
];

export const LEADS_PLANS_NOTE = 'Prix hors taxes, indicatifs pendant la bêta. Paiement en ligne à la sortie de la bêta.';
