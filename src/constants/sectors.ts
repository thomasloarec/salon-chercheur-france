
// Informations pour chaque secteur.
// Les couleurs ont été retirées : les 15 secteurs partagent désormais les mêmes classes,
// portées côté composant (bg-muted / text-muted-foreground).
export const SECTOR_CONFIG: Record<string, {
  description: string;
}> = {
  'Agroalimentaire & Boissons': {
    description: "Industrie alimentaire, agriculture, viticulture et boissons"
  },
  'Automobile & Mobilité': {
    description: "Secteur automobile, transports et nouvelles mobilités"
  },
  'BTP & Construction': {
    description: "Bâtiment, travaux publics, architecture et immobilier"
  },
  'Cosmétique & Bien-être': {
    description: "Beauté, cosmétiques, bien-être et esthétique"
  },
  'Énergie & Environnement': {
    description: "Énergies renouvelables, environnement et développement durable"
  },
  'Finance, Assurance & Immobilier': {
    description: "Services financiers, assurance et marché immobilier"
  },
  'Industrie & Production': {
    description: "Industrie manufacturière, mécanique et production"
  },
  'Santé & Médical': {
    description: "Secteur médical, pharmaceutique et biotechnologies"
  },
  'Secteur Public & Collectivités': {
    description: "Administration publique, collectivités territoriales et services publics"
  },
  'Services aux Entreprises & RH': {
    description: "Conseil, ressources humaines et services aux entreprises"
  },
  'Technologie & Innovation': {
    description: "Technologies, innovation, numérique et startups"
  },
  'Mode & Textile': {
    description: "Mode, textile, habillement et accessoires"
  },
  'Commerce & Distribution': {
    description: "Commerce, retail, distribution et logistique"
  },
  'Éducation & Formation': {
    description: "Éducation, formation professionnelle et enseignement"
  },
  'Tourisme & Événementiel': {
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
