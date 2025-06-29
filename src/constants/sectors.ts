
// Configuration des couleurs et informations pour chaque secteur
export const SECTOR_CONFIG: Record<string, {
  color: string;
  description: string;
}> = {
  'Agroalimentaire & Boissons': {
    color: "bg-green-100 text-green-800",
    description: "Industrie alimentaire, agriculture, viticulture et boissons"
  },
  'Automobile & Mobilité': {
    color: "bg-blue-100 text-blue-800", 
    description: "Secteur automobile, transports et nouvelles mobilités"
  },
  'BTP & Construction': {
    color: "bg-orange-100 text-orange-800",
    description: "Bâtiment, travaux publics, architecture et immobilier"
  },
  'Cosmétique & Bien-être': {
    color: "bg-pink-100 text-pink-800",
    description: "Beauté, cosmétiques, bien-être et esthétique"
  },
  'Énergie & Environnement': {
    color: "bg-emerald-100 text-emerald-800",
    description: "Énergies renouvelables, environnement et développement durable"
  },
  'Finance, Assurance & Immobilier': {
    color: "bg-blue-100 text-blue-800",
    description: "Services financiers, assurance et marché immobilier"
  },
  'Industrie & Production': {
    color: "bg-gray-100 text-gray-800",
    description: "Industrie manufacturière, mécanique et production"
  },
  'Santé & Médical': {
    color: "bg-red-100 text-red-800",
    description: "Secteur médical, pharmaceutique et biotechnologies"
  },
  'Secteur Public & Collectivités': {
    color: "bg-slate-100 text-slate-800",
    description: "Administration publique, collectivités territoriales et services publics"
  },
  'Services aux Entreprises & RH': {
    color: "bg-teal-100 text-teal-800",
    description: "Conseil, ressources humaines et services aux entreprises"
  },
  'Technologie & Innovation': {
    color: "bg-purple-100 text-purple-800",
    description: "Technologies, innovation, numérique et startups"
  },
  'Mode & Textile': {
    color: "bg-indigo-100 text-indigo-800",
    description: "Mode, textile, habillement et accessoires"
  },
  'Commerce & Distribution': {
    color: "bg-yellow-100 text-yellow-800",
    description: "Commerce, retail, distribution et logistique"
  },
  'Éducation & Formation': {
    color: "bg-cyan-100 text-cyan-800",
    description: "Éducation, formation professionnelle et enseignement"
  },
  'Tourisme & Événementiel': {
    color: "bg-violet-100 text-violet-800",
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

export const getSectorConfig = (sectorName: string) => {
  return SECTOR_CONFIG[sectorName] || {
    color: "bg-gray-100 text-gray-800",
    description: "Secteur d'activité"
  };
};
