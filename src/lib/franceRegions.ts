// Mapping départements -> région (slug + libellé)
export type RegionInfo = { slug: string; name: string };

export const REGION_BY_DEPT: Record<string, RegionInfo> = {
  // Auvergne-Rhône-Alpes
  "01": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
  "03": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
  "07": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
  "15": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
  "26": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
  "38": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
  "42": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
  "43": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
  "63": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
  "69": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
  "73": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
  "74": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },

  // Bourgogne-Franche-Comté
  "21": { slug: "bourgogne-franche-comte", name: "Bourgogne-Franche-Comté" },
  "25": { slug: "bourgogne-franche-comte", name: "Bourgogne-Franche-Comté" },
  "39": { slug: "bourgogne-franche-comte", name: "Bourgogne-Franche-Comté" },
  "58": { slug: "bourgogne-franche-comte", name: "Bourgogne-Franche-Comté" },
  "70": { slug: "bourgogne-franche-comte", name: "Bourgogne-Franche-Comté" },
  "71": { slug: "bourgogne-franche-comte", name: "Bourgogne-Franche-Comté" },
  "89": { slug: "bourgogne-franche-comte", name: "Bourgogne-Franche-Comté" },
  "90": { slug: "bourgogne-franche-comte", name: "Bourgogne-Franche-Comté" },

  // Bretagne
  "22": { slug: "bretagne", name: "Bretagne" },
  "29": { slug: "bretagne", name: "Bretagne" },
  "35": { slug: "bretagne", name: "Bretagne" },
  "56": { slug: "bretagne", name: "Bretagne" },

  // Centre-Val de Loire
  "18": { slug: "centre-val-de-loire", name: "Centre-Val de Loire" },
  "28": { slug: "centre-val-de-loire", name: "Centre-Val de Loire" },
  "36": { slug: "centre-val-de-loire", name: "Centre-Val de Loire" },
  "37": { slug: "centre-val-de-loire", name: "Centre-Val de Loire" },
  "41": { slug: "centre-val-de-loire", name: "Centre-Val de Loire" },
  "45": { slug: "centre-val-de-loire", name: "Centre-Val de Loire" },

  // Corse (CP 201xx / 202xx)
  "20": { slug: "corse", name: "Corse" },

  // Grand Est
  "08": { slug: "grand-est", name: "Grand Est" },
  "10": { slug: "grand-est", name: "Grand Est" },
  "51": { slug: "grand-est", name: "Grand Est" },
  "52": { slug: "grand-est", name: "Grand Est" },
  "54": { slug: "grand-est", name: "Grand Est" },
  "55": { slug: "grand-est", name: "Grand Est" },
  "57": { slug: "grand-est", name: "Grand Est" },
  "67": { slug: "grand-est", name: "Grand Est" },
  "68": { slug: "grand-est", name: "Grand Est" },
  "88": { slug: "grand-est", name: "Grand Est" },

  // Hauts-de-France
  "02": { slug: "hauts-de-france", name: "Hauts-de-France" },
  "59": { slug: "hauts-de-france", name: "Hauts-de-France" },
  "60": { slug: "hauts-de-france", name: "Hauts-de-France" },
  "62": { slug: "hauts-de-france", name: "Hauts-de-France" },
  "80": { slug: "hauts-de-france", name: "Hauts-de-France" },

  // Île-de-France
  "75": { slug: "ile-de-france", name: "Île-de-France" },
  "77": { slug: "ile-de-france", name: "Île-de-France" },
  "78": { slug: "ile-de-france", name: "Île-de-France" },
  "91": { slug: "ile-de-france", name: "Île-de-France" },
  "92": { slug: "ile-de-france", name: "Île-de-France" },
  "93": { slug: "ile-de-france", name: "Île-de-France" },
  "94": { slug: "ile-de-france", name: "Île-de-France" },
  "95": { slug: "ile-de-france", name: "Île-de-France" },

  // Normandie
  "14": { slug: "normandie", name: "Normandie" },
  "27": { slug: "normandie", name: "Normandie" },
  "50": { slug: "normandie", name: "Normandie" },
  "61": { slug: "normandie", name: "Normandie" },
  "76": { slug: "normandie", name: "Normandie" },

  // Nouvelle-Aquitaine
  "16": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
  "17": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
  "19": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
  "23": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
  "24": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
  "33": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
  "40": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
  "47": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
  "64": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
  "79": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
  "86": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
  "87": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },

  // Occitanie
  "09": { slug: "occitanie", name: "Occitanie" },
  "11": { slug: "occitanie", name: "Occitanie" },
  "12": { slug: "occitanie", name: "Occitanie" },
  "30": { slug: "occitanie", name: "Occitanie" },
  "31": { slug: "occitanie", name: "Occitanie" },
  "32": { slug: "occitanie", name: "Occitanie" },
  "34": { slug: "occitanie", name: "Occitanie" },
  "46": { slug: "occitanie", name: "Occitanie" },
  "48": { slug: "occitanie", name: "Occitanie" },
  "65": { slug: "occitanie", name: "Occitanie" },
  "66": { slug: "occitanie", name: "Occitanie" },
  "81": { slug: "occitanie", name: "Occitanie" },
  "82": { slug: "occitanie", name: "Occitanie" },

  // Pays de la Loire
  "44": { slug: "pays-de-la-loire", name: "Pays de la Loire" },
  "49": { slug: "pays-de-la-loire", name: "Pays de la Loire" },
  "53": { slug: "pays-de-la-loire", name: "Pays de la Loire" },
  "72": { slug: "pays-de-la-loire", name: "Pays de la Loire" },
  "85": { slug: "pays-de-la-loire", name: "Pays de la Loire" },

  // Provence-Alpes-Côte d'Azur
  "04": { slug: "provence-alpes-cote-d-azur", name: "Provence-Alpes-Côte d'Azur" },
  "05": { slug: "provence-alpes-cote-d-azur", name: "Provence-Alpes-Côte d'Azur" },
  "06": { slug: "provence-alpes-cote-d-azur", name: "Provence-Alpes-Côte d'Azur" },
  "13": { slug: "provence-alpes-cote-d-azur", name: "Provence-Alpes-Côte d'Azur" },
  "83": { slug: "provence-alpes-cote-d-azur", name: "Provence-Alpes-Côte d'Azur" },
  "84": { slug: "provence-alpes-cote-d-azur", name: "Provence-Alpes-Côte d'Azur" },

  // DROM (CP 97X / 976)
  "971": { slug: "guadeloupe", name: "Guadeloupe" },
  "972": { slug: "martinique", name: "Martinique" },
  "973": { slug: "guyane", name: "Guyane" },
  "974": { slug: "la-reunion", name: "La Réunion" },
  "976": { slug: "mayotte", name: "Mayotte" },
};

export function deptFromPostal(cp?: string | null): string | null {
  const v = (cp ?? "").trim();
  if (!v) return null;
  // DROM
  if (v.startsWith("97") || v.startsWith("98")) {
    return v.slice(0, 3); // 971/972/973/974, 976
  }
  // Corse (201xx, 202xx)
  if (v.startsWith("201") || v.startsWith("202")) return "20";
  // Métropole
  return v.slice(0, 2);
}

export function regionSlugFromPostal(cp?: string | null): string | null {
  const d = deptFromPostal(cp);
  if (!d) return null;
  const info = REGION_BY_DEPT[d];
  return info?.slug ?? null;
}