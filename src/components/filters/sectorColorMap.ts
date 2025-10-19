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
    bgActive: "bg-gradient-to-br from-sky-200/60 via-blue-200/60 to-indigo-200/60 dark:from-sky-900/40 dark:via-blue-900/40 dark:to-indigo-900/40",
    borderActive: "border-sky-500",
    textActive: "text-sky-800 dark:text-sky-300",
    iconActive: "text-sky-700 dark:text-sky-300",
    bgHover: "hover:bg-sky-50 dark:hover:bg-sky-900/30",
    textHover: "group-hover:text-sky-900 dark:group-hover:text-sky-200",
  },
  "commerce-distribution": {
    bgActive: "bg-gradient-to-br from-amber-200/60 via-orange-200/60 to-yellow-200/60 dark:from-amber-900/40 dark:via-orange-900/40 dark:to-yellow-900/40",
    borderActive: "border-amber-500",
    textActive: "text-amber-800 dark:text-amber-300",
    iconActive: "text-amber-700 dark:text-amber-300",
    bgHover: "hover:bg-amber-50 dark:hover:bg-amber-900/30",
    textHover: "group-hover:text-amber-900 dark:group-hover:text-amber-200",
  },
  "cosmetique-bien-etre": {
    bgActive: "bg-gradient-to-br from-pink-200/60 via-rose-200/60 to-fuchsia-200/60 dark:from-pink-900/40 dark:via-rose-900/40 dark:to-fuchsia-900/40",
    borderActive: "border-pink-500",
    textActive: "text-pink-800 dark:text-pink-300",
    iconActive: "text-pink-700 dark:text-pink-300",
    bgHover: "hover:bg-pink-50 dark:hover:bg-pink-900/30",
    textHover: "group-hover:text-pink-900 dark:group-hover:text-pink-200",
  },
  "education-formation": {
    bgActive: "bg-gradient-to-br from-violet-200/60 via-purple-200/60 to-fuchsia-200/60 dark:from-violet-900/40 dark:via-purple-900/40 dark:to-fuchsia-900/40",
    borderActive: "border-violet-500",
    textActive: "text-violet-800 dark:text-violet-300",
    iconActive: "text-violet-700 dark:text-violet-300",
    bgHover: "hover:bg-violet-50 dark:hover:bg-violet-900/30",
    textHover: "group-hover:text-violet-900 dark:group-hover:text-violet-200",
  },
  "energie-environnement": {
    bgActive: "bg-gradient-to-br from-emerald-200/60 via-lime-200/60 to-green-200/60 dark:from-emerald-900/40 dark:via-lime-900/40 dark:to-green-900/40",
    borderActive: "border-emerald-500",
    textActive: "text-emerald-800 dark:text-emerald-300",
    iconActive: "text-emerald-700 dark:text-emerald-300",
    bgHover: "hover:bg-emerald-50 dark:hover:bg-emerald-900/30",
    textHover: "group-hover:text-emerald-900 dark:group-hover:text-emerald-200",
  },
  "industrie-production": {
    bgActive: "bg-gradient-to-br from-slate-200/60 via-zinc-200/60 to-neutral-200/60 dark:from-slate-900/40 dark:via-zinc-900/40 dark:to-neutral-900/40",
    borderActive: "border-slate-500",
    textActive: "text-slate-800 dark:text-slate-300",
    iconActive: "text-slate-700 dark:text-slate-300",
    bgHover: "hover:bg-slate-50 dark:hover:bg-slate-900/30",
    textHover: "group-hover:text-slate-900 dark:group-hover:text-slate-200",
  },
  "mode-textile": {
    bgActive: "bg-gradient-to-br from-rose-200/60 via-pink-200/60 to-fuchsia-200/60 dark:from-rose-900/40 dark:via-pink-900/40 dark:to-fuchsia-900/40",
    borderActive: "border-rose-500",
    textActive: "text-rose-800 dark:text-rose-300",
    iconActive: "text-rose-700 dark:text-rose-300",
    bgHover: "hover:bg-rose-50 dark:hover:bg-rose-900/30",
    textHover: "group-hover:text-rose-900 dark:group-hover:text-rose-200",
  },
  "sante-medical": {
    bgActive: "bg-gradient-to-br from-teal-200/60 via-cyan-200/60 to-sky-200/60 dark:from-teal-900/40 dark:via-cyan-900/40 dark:to-sky-900/40",
    borderActive: "border-teal-500",
    textActive: "text-teal-800 dark:text-teal-300",
    iconActive: "text-teal-700 dark:text-teal-300",
    bgHover: "hover:bg-teal-50 dark:hover:bg-teal-900/30",
    textHover: "group-hover:text-teal-900 dark:group-hover:text-teal-200",
  },
  "technologie-innovation": {
    bgActive: "bg-gradient-to-br from-indigo-200/60 via-blue-200/60 to-cyan-200/60 dark:from-indigo-900/40 dark:via-blue-900/40 dark:to-cyan-900/40",
    borderActive: "border-indigo-500",
    textActive: "text-indigo-800 dark:text-indigo-300",
    iconActive: "text-indigo-700 dark:text-indigo-300",
    bgHover: "hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
    textHover: "group-hover:text-indigo-900 dark:group-hover:text-indigo-200",
  },
  "tourisme-evenementiel": {
    bgActive: "bg-gradient-to-br from-fuchsia-200/60 via-purple-200/60 to-pink-200/60 dark:from-fuchsia-900/40 dark:via-purple-900/40 dark:to-pink-900/40",
    borderActive: "border-fuchsia-500",
    textActive: "text-fuchsia-800 dark:text-fuchsia-300",
    iconActive: "text-fuchsia-700 dark:text-fuchsia-300",
    bgHover: "hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/30",
    textHover: "group-hover:text-fuchsia-900 dark:group-hover:text-fuchsia-200",
  },
  "finance-assurance-immobilier": {
    bgActive: "bg-gradient-to-br from-cyan-200/60 via-teal-200/60 to-emerald-200/60 dark:from-cyan-900/40 dark:via-teal-900/40 dark:to-emerald-900/40",
    borderActive: "border-cyan-500",
    textActive: "text-cyan-800 dark:text-cyan-300",
    iconActive: "text-cyan-700 dark:text-cyan-300",
    bgHover: "hover:bg-cyan-50 dark:hover:bg-cyan-900/30",
    textHover: "group-hover:text-cyan-900 dark:group-hover:text-cyan-200",
  },
  "services-entreprises-rh": {
    bgActive: "bg-gradient-to-br from-stone-200/60 via-zinc-200/60 to-neutral-200/60 dark:from-stone-900/40 dark:via-zinc-900/40 dark:to-neutral-900/40",
    borderActive: "border-stone-500",
    textActive: "text-stone-800 dark:text-stone-300",
    iconActive: "text-stone-700 dark:text-stone-300",
    bgHover: "hover:bg-stone-50 dark:hover:bg-stone-900/30",
    textHover: "group-hover:text-stone-900 dark:group-hover:text-stone-200",
  },
  "secteur-public-collectivites": {
    bgActive: "bg-gradient-to-br from-emerald-200/60 via-green-200/60 to-lime-200/60 dark:from-emerald-900/40 dark:via-green-900/40 dark:to-lime-900/40",
    borderActive: "border-lime-600",
    textActive: "text-lime-800 dark:text-lime-300",
    iconActive: "text-lime-700 dark:text-lime-300",
    bgHover: "hover:bg-lime-50 dark:hover:bg-lime-900/30",
    textHover: "group-hover:text-lime-900 dark:group-hover:text-lime-200",
  },
  "agroalimentaire-boissons": {
    bgActive: "bg-gradient-to-br from-lime-200/60 via-amber-200/60 to-green-200/60 dark:from-lime-900/40 dark:via-amber-900/40 dark:to-green-900/40",
    borderActive: "border-amber-600",
    textActive: "text-amber-800 dark:text-amber-300",
    iconActive: "text-amber-700 dark:text-amber-300",
    bgHover: "hover:bg-amber-50 dark:hover:bg-amber-900/30",
    textHover: "group-hover:text-amber-900 dark:group-hover:text-amber-200",
  },
  "btp-construction": {
    bgActive: "bg-gradient-to-br from-orange-200/60 via-amber-200/60 to-yellow-200/60 dark:from-orange-900/40 dark:via-amber-900/40 dark:to-yellow-900/40",
    borderActive: "border-orange-600",
    textActive: "text-orange-800 dark:text-orange-300",
    iconActive: "text-orange-700 dark:text-orange-300",
    bgHover: "hover:bg-orange-50 dark:hover:bg-orange-900/30",
    textHover: "group-hover:text-orange-900 dark:group-hover:text-orange-200",
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
