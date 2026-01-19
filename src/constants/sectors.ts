
// Configuration des couleurs et informations pour chaque secteur
// Utilise des couleurs HSL inline pour éviter les problèmes de purge Tailwind
export const SECTOR_CONFIG: Record<string, {
  color: string;
  bgColor: string;
  textColor: string;
  description: string;
}> = {
  'Agroalimentaire & Boissons': {
    color: "bg-green-100 text-green-800",
    bgColor: "hsl(142, 76%, 90%)",
    textColor: "hsl(142, 72%, 29%)",
    description: "Industrie alimentaire, agriculture, viticulture et boissons"
  },
  'Automobile & Mobilité': {
    color: "bg-blue-100 text-blue-800",
    bgColor: "hsl(214, 95%, 93%)",
    textColor: "hsl(224, 76%, 48%)",
    description: "Secteur automobile, transports et nouvelles mobilités"
  },
  'BTP & Construction': {
    color: "bg-orange-100 text-orange-800",
    bgColor: "hsl(34, 100%, 92%)",
    textColor: "hsl(26, 90%, 37%)",
    description: "Bâtiment, travaux publics, architecture et immobilier"
  },
  'Cosmétique & Bien-être': {
    color: "bg-pink-100 text-pink-800",
    bgColor: "hsl(326, 78%, 95%)",
    textColor: "hsl(336, 74%, 35%)",
    description: "Beauté, cosmétiques, bien-être et esthétique"
  },
  'Énergie & Environnement': {
    color: "bg-emerald-100 text-emerald-800",
    bgColor: "hsl(152, 76%, 91%)",
    textColor: "hsl(163, 72%, 30%)",
    description: "Énergies renouvelables, environnement et développement durable"
  },
  'Finance, Assurance & Immobilier': {
    color: "bg-amber-100 text-amber-800",
    bgColor: "hsl(48, 96%, 89%)",
    textColor: "hsl(32, 95%, 30%)",
    description: "Services financiers, assurance et marché immobilier"
  },
  'Industrie & Production': {
    color: "bg-gray-100 text-gray-800",
    bgColor: "hsl(220, 14%, 96%)",
    textColor: "hsl(215, 25%, 27%)",
    description: "Industrie manufacturière, mécanique et production"
  },
  'Santé & Médical': {
    color: "bg-red-100 text-red-800",
    bgColor: "hsl(0, 86%, 94%)",
    textColor: "hsl(0, 74%, 42%)",
    description: "Secteur médical, pharmaceutique et biotechnologies"
  },
  'Secteur Public & Collectivités': {
    color: "bg-slate-100 text-slate-800",
    bgColor: "hsl(210, 40%, 96%)",
    textColor: "hsl(215, 25%, 27%)",
    description: "Administration publique, collectivités territoriales et services publics"
  },
  'Services aux Entreprises & RH': {
    color: "bg-teal-100 text-teal-800",
    bgColor: "hsl(166, 76%, 92%)",
    textColor: "hsl(172, 66%, 30%)",
    description: "Conseil, ressources humaines et services aux entreprises"
  },
  'Technologie & Innovation': {
    color: "bg-purple-100 text-purple-800",
    bgColor: "hsl(270, 76%, 94%)",
    textColor: "hsl(272, 72%, 47%)",
    description: "Technologies, innovation, numérique et startups"
  },
  'Mode & Textile': {
    color: "bg-indigo-100 text-indigo-800",
    bgColor: "hsl(226, 76%, 95%)",
    textColor: "hsl(231, 48%, 48%)",
    description: "Mode, textile, habillement et accessoires"
  },
  'Commerce & Distribution': {
    color: "bg-yellow-100 text-yellow-800",
    bgColor: "hsl(55, 96%, 88%)",
    textColor: "hsl(35, 92%, 33%)",
    description: "Commerce, retail, distribution et logistique"
  },
  'Éducation & Formation': {
    color: "bg-cyan-100 text-cyan-800",
    bgColor: "hsl(185, 96%, 90%)",
    textColor: "hsl(192, 91%, 30%)",
    description: "Éducation, formation professionnelle et enseignement"
  },
  'Tourisme & Événementiel': {
    color: "bg-violet-100 text-violet-800",
    bgColor: "hsl(263, 76%, 95%)",
    textColor: "hsl(263, 70%, 50%)",
    description: "Tourisme, événementiel, loisirs et voyages"
  }
};

// Secteurs à exclure de l'affichage sur la page d'accueil (mais toujours disponibles dans les filtres)
export const HIDDEN_SECTORS_ON_HOME = [
  'Mode & Textile',
  'Éducation & Formation',
  'Cosmétique & Bien-être',
  'Finance, Assurance & Immobilier',
  'Services aux Entreprises & RH',
  'Secteur Public & Collectivités'
];

// Normalise une chaîne pour comparaison (sans accents, minuscules)
const normalizeForComparison = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .trim();
};

// Valeur par défaut pour les secteurs non reconnus
const DEFAULT_SECTOR_CONFIG = {
  color: "bg-gray-100 text-gray-800",
  bgColor: "hsl(220, 14%, 96%)",
  textColor: "hsl(215, 25%, 27%)",
  description: "Secteur d'activité"
};

export const getSectorConfig = (sectorName: string) => {
  // D'abord essayer une correspondance exacte
  if (SECTOR_CONFIG[sectorName]) {
    return SECTOR_CONFIG[sectorName];
  }
  
  // Sinon, essayer une correspondance normalisée (sans accents, insensible à la casse)
  const normalizedInput = normalizeForComparison(sectorName);
  
  for (const [key, value] of Object.entries(SECTOR_CONFIG)) {
    if (normalizeForComparison(key) === normalizedInput) {
      return value;
    }
  }
  
  // Fallback par défaut
  return DEFAULT_SECTOR_CONFIG;
};
