// Tailwind color classes for each sector (pre-compiled, no dynamic generation)
export type SectorColorClasses = {
  // Active state
  bgActive: string;
  borderActive: string;
  textActive: string;
  iconActive?: string;
  // Hover state (inactive)
  bgHover: string;
  textHover: string;
};

export const sectorColorMap: Record<string, SectorColorClasses> = {
  "automobile-mobilite": {
    bgActive: "bg-gradient-to-br from-blue-500 to-cyan-600 dark:from-blue-600 dark:to-cyan-700",
    borderActive: "border-blue-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-blue-50 dark:hover:bg-blue-950/30",
    textHover: "group-hover:text-blue-700 dark:group-hover:text-blue-400"
  },
  "commerce-distribution": {
    bgActive: "bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700",
    borderActive: "border-amber-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-amber-50 dark:hover:bg-amber-950/30",
    textHover: "group-hover:text-amber-700 dark:group-hover:text-amber-400"
  },
  "cosmetique-bien-etre": {
    bgActive: "bg-gradient-to-br from-pink-500 to-rose-600 dark:from-pink-600 dark:to-rose-700",
    borderActive: "border-pink-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-pink-50 dark:hover:bg-pink-950/30",
    textHover: "group-hover:text-pink-700 dark:group-hover:text-pink-400"
  },
  "education-formation": {
    bgActive: "bg-gradient-to-br from-violet-500 to-purple-600 dark:from-violet-600 dark:to-purple-700",
    borderActive: "border-violet-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-violet-50 dark:hover:bg-violet-950/30",
    textHover: "group-hover:text-violet-700 dark:group-hover:text-violet-400"
  },
  "energie-environnement": {
    bgActive: "bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700",
    borderActive: "border-emerald-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
    textHover: "group-hover:text-emerald-700 dark:group-hover:text-emerald-400"
  },
  "industrie-production": {
    bgActive: "bg-gradient-to-br from-gray-500 to-slate-600 dark:from-gray-600 dark:to-slate-700",
    borderActive: "border-gray-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-gray-50 dark:hover:bg-gray-950/30",
    textHover: "group-hover:text-gray-700 dark:group-hover:text-gray-400"
  },
  "mode-textile": {
    bgActive: "bg-gradient-to-br from-purple-500 to-fuchsia-600 dark:from-purple-600 dark:to-fuchsia-700",
    borderActive: "border-purple-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-purple-50 dark:hover:bg-purple-950/30",
    textHover: "group-hover:text-purple-700 dark:group-hover:text-purple-400"
  },
  "sante-medical": {
    bgActive: "bg-gradient-to-br from-red-500 to-rose-600 dark:from-red-600 dark:to-rose-700",
    borderActive: "border-red-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-red-50 dark:hover:bg-red-950/30",
    textHover: "group-hover:text-red-700 dark:group-hover:text-red-400"
  },
  "technologie-innovation": {
    bgActive: "bg-gradient-to-br from-sky-500 to-blue-600 dark:from-sky-600 dark:to-blue-700",
    borderActive: "border-sky-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-sky-50 dark:hover:bg-sky-950/30",
    textHover: "group-hover:text-sky-700 dark:group-hover:text-sky-400"
  },
  "tourisme-evenementiel": {
    bgActive: "bg-gradient-to-br from-teal-500 to-cyan-600 dark:from-teal-600 dark:to-cyan-700",
    borderActive: "border-teal-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-teal-50 dark:hover:bg-teal-950/30",
    textHover: "group-hover:text-teal-700 dark:group-hover:text-teal-400"
  },
  "finance-assurance-immobilier": {
    bgActive: "bg-gradient-to-br from-orange-500 to-amber-600 dark:from-orange-600 dark:to-amber-700",
    borderActive: "border-orange-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-orange-50 dark:hover:bg-orange-950/30",
    textHover: "group-hover:text-orange-700 dark:group-hover:text-orange-400"
  },
  "services-entreprises-rh": {
    bgActive: "bg-gradient-to-br from-cyan-500 to-teal-600 dark:from-cyan-600 dark:to-teal-700",
    borderActive: "border-cyan-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-cyan-50 dark:hover:bg-cyan-950/30",
    textHover: "group-hover:text-cyan-700 dark:group-hover:text-cyan-400"
  },
  "secteur-public-collectivites": {
    bgActive: "bg-gradient-to-br from-lime-500 to-green-600 dark:from-lime-600 dark:to-green-700",
    borderActive: "border-lime-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-lime-50 dark:hover:bg-lime-950/30",
    textHover: "group-hover:text-lime-700 dark:group-hover:text-lime-400"
  },
  "agroalimentaire-boissons": {
    bgActive: "bg-gradient-to-br from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700",
    borderActive: "border-green-500",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-green-50 dark:hover:bg-green-950/30",
    textHover: "group-hover:text-green-700 dark:group-hover:text-green-400"
  },
  "btp-construction": {
    bgActive: "bg-gradient-to-br from-amber-600 to-orange-700 dark:from-amber-700 dark:to-orange-800",
    borderActive: "border-amber-600",
    iconActive: "text-white",
    textActive: "text-white dark:text-white",
    bgHover: "hover:bg-amber-50 dark:hover:bg-amber-950/30",
    textHover: "group-hover:text-amber-700 dark:group-hover:text-amber-400"
  },
};

// Neutral fallback for unrecognized sectors
export const sectorColorFallback: SectorColorClasses = {
  bgActive: "bg-gradient-to-br from-gray-200/60 via-slate-200/60 to-zinc-200/60 dark:from-gray-900/40 dark:via-slate-900/40 dark:to-zinc-900/40",
  borderActive: "border-gray-400",
  textActive: "text-gray-800 dark:text-gray-300",
  iconActive: "text-gray-700 dark:text-gray-300",
  bgHover: "hover:bg-gray-50 dark:hover:bg-gray-900/30",
  textHover: "group-hover:text-foreground",
};
