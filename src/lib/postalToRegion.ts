import { REGIONS } from "./regions";

const D = (slug: keyof typeof REGIONS) => REGIONS[slug].slug;

export function regionSlugFromPostal(cp?: string | null): string | null {
  const v = (cp ?? "").trim();
  if (!v) return null;

  // DROM
  if (v.startsWith("97") || v.startsWith("98")) {
    const drom = v.slice(0,3);
    if (drom === "971") return D("guadeloupe");
    if (drom === "972") return D("martinique");
    if (drom === "973") return D("guyane");
    if (drom === "974") return D("la-reunion");
    if (drom === "976") return D("mayotte");
    return null;
  }

  // Corse : 201xx / 202xx
  if (v.startsWith("201") || v.startsWith("202")) return D("corse");

  const dep = v.slice(0,2);
  // Tables minimales par région (dpts → région)
  const byDep: Record<string,string> = {
    // IDF
    "75": D("ile-de-france"), "77": D("ile-de-france"), "78": D("ile-de-france"),
    "91": D("ile-de-france"), "92": D("ile-de-france"), "93": D("ile-de-france"),
    "94": D("ile-de-france"), "95": D("ile-de-france"),
    // Bretagne
    "22": D("bretagne"), "29": D("bretagne"), "35": D("bretagne"), "56": D("bretagne"),
    // Grand Est
    "08": D("grand-est"), "10": D("grand-est"), "51": D("grand-est"), "52": D("grand-est"),
    "54": D("grand-est"), "55": D("grand-est"), "57": D("grand-est"), "67": D("grand-est"),
    "68": D("grand-est"), "88": D("grand-est"),
    // Auvergne-Rhône-Alpes
    "01": D("auvergne-rhone-alpes"), "03": D("auvergne-rhone-alpes"), "07": D("auvergne-rhone-alpes"),
    "15": D("auvergne-rhone-alpes"), "26": D("auvergne-rhone-alpes"), "38": D("auvergne-rhone-alpes"),
    "42": D("auvergne-rhone-alpes"), "43": D("auvergne-rhone-alpes"), "63": D("auvergne-rhone-alpes"),
    "69": D("auvergne-rhone-alpes"), "73": D("auvergne-rhone-alpes"), "74": D("auvergne-rhone-alpes"),
    // Bourgogne-Franche-Comté
    "21": D("bourgogne-franche-comte"), "25": D("bourgogne-franche-comte"), "39": D("bourgogne-franche-comte"),
    "58": D("bourgogne-franche-comte"), "70": D("bourgogne-franche-comte"), "71": D("bourgogne-franche-comte"),
    "89": D("bourgogne-franche-comte"), "90": D("bourgogne-franche-comte"),
    // Centre-Val de Loire
    "18": D("centre-val-de-loire"), "28": D("centre-val-de-loire"), "36": D("centre-val-de-loire"),
    "37": D("centre-val-de-loire"), "41": D("centre-val-de-loire"), "45": D("centre-val-de-loire"),
    // Hauts-de-France
    "02": D("hauts-de-france"), "59": D("hauts-de-france"), "60": D("hauts-de-france"),
    "62": D("hauts-de-france"), "80": D("hauts-de-france"),
    // Normandie
    "14": D("normandie"), "27": D("normandie"), "50": D("normandie"),
    "61": D("normandie"), "76": D("normandie"),
    // Nouvelle-Aquitaine
    "16": D("nouvelle-aquitaine"), "17": D("nouvelle-aquitaine"), "19": D("nouvelle-aquitaine"),
    "23": D("nouvelle-aquitaine"), "24": D("nouvelle-aquitaine"), "33": D("nouvelle-aquitaine"),
    "40": D("nouvelle-aquitaine"), "47": D("nouvelle-aquitaine"), "64": D("nouvelle-aquitaine"),
    "79": D("nouvelle-aquitaine"), "86": D("nouvelle-aquitaine"), "87": D("nouvelle-aquitaine"),
    // Occitanie
    "09": D("occitanie"), "11": D("occitanie"), "12": D("occitanie"), "30": D("occitanie"),
    "31": D("occitanie"), "32": D("occitanie"), "34": D("occitanie"), "46": D("occitanie"),
    "48": D("occitanie"), "65": D("occitanie"), "66": D("occitanie"), "81": D("occitanie"),
    "82": D("occitanie"),
    // Pays de la Loire
    "44": D("pays-de-la-loire"), "49": D("pays-de-la-loire"), "53": D("pays-de-la-loire"),
    "72": D("pays-de-la-loire"), "85": D("pays-de-la-loire"),
    // Provence-Alpes-Côte d'Azur
    "04": D("provence-alpes-cote-d-azur"), "05": D("provence-alpes-cote-d-azur"), "06": D("provence-alpes-cote-d-azur"),
    "13": D("provence-alpes-cote-d-azur"), "83": D("provence-alpes-cote-d-azur"), "84": D("provence-alpes-cote-d-azur"),
  };
  return byDep[dep] ?? null;
}