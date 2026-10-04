import {
  Building2,
  CalendarHeart,
  Megaphone,
  Radar,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';

export interface NavSolutionItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export interface NavSolutionGroup {
  title: string;
  items: NavSolutionItem[];
}

/** Lien direct de la barre principale, visible par tout le monde. */
export const AGENDA_NAV_ITEM = {
  to: '/agenda',
  label: 'Mon Agenda',
  icon: CalendarHeart,
};

/**
 * Menu « Solutions », rangé par public.
 * Utilisé par Header (desktop) et MobileNavDrawer (mobile).
 */
export const NAV_SOLUTION_GROUPS: NavSolutionGroup[] = [
  {
    title: 'Visiteurs',
    items: [
      { to: '/agenda', label: 'Mon Agenda', icon: CalendarHeart, description: "L'IA prépare vos salons, gratuitement" },
      { to: '/recherche-ia', label: 'Recherche IA', icon: Sparkles, description: "Trouvez le bon salon avec l'IA" },
    ],
  },
  {
    title: 'Exposants',
    items: [
      { to: '/exposants', label: 'Publier une Nouveauté', icon: Megaphone, description: "Attirez les bons visiteurs avant l'ouverture" },
    ],
  },
  {
    title: 'Commerciaux',
    items: [
      { to: '/radar-crm', label: 'Radar CRM', icon: Radar, description: 'Suivez vos comptes sur les salons' },
      { to: '/directeur-commercial', label: 'Directeurs commerciaux', icon: Target, description: 'Testez la prospection salon sans importer vos données' },
    ],
  },
  {
    title: 'Organisateurs',
    items: [
      { to: '/organisateurs', label: 'Organisateurs de salons', icon: Building2, description: 'Revendiquez et faites vivre votre salon' },
    ],
  },
];
