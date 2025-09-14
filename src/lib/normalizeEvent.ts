import { coalesceImageUrl } from "@/lib/images";
import { imgDebug } from "@/lib/imgDebug";

export type CanonicalEvent = {
  id: string;
  title: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  type_code: string | null;
  secteur_labels: string[];
  ville: string | null;
  pays: string | null;
  visible: boolean | null;
  image_url: string | null;
  postal_code: string | null;
  // Champs additionnels pour compatibilité
  nom_event: string;
  date_debut: string | null;
  date_fin: string | null;
  secteur: any;
  nom_lieu: string | null;
  url_image: string | null;
  url_site_officiel: string | null;
  is_b2b: boolean;
  type_event: string | null;
  rue: string | null;
  code_postal: string | null;
};

function first<T>(...vals: T[]): T | null {
  for (const v of vals) if (v !== undefined && v !== null && String(v).trim?.() !== "") return v as T;
  return null;
}

export function normalizeEventRow(row: any): CanonicalEvent {
  const id = first(row.id, row.id_event, row.airtable_id, row.slug) ?? crypto.randomUUID?.() ?? String(Math.random());
  const title = first(row.nom_event, row.title, row.name, row.libelle) ?? "Événement";
  const slug = first(row.slug, row.permalink) ?? String(id);

  const start_date = first(row.date_debut, row.start_date, row.startDate) ?? null;
  const end_date   = first(row.date_fin, row.end_date, row.endDate) ?? null;

  const type_code = first(row.type_event, row.event_type_code, row.type) ?? null;

  const secteur = first(row.secteur, row.sectors, row.secteurs) ?? [];
  const secteur_labels = Array.isArray(secteur) ? secteur.filter(Boolean) : [];

  const ville = first(row.ville, row.city) ?? null;
  const pays  = first(row.pays, row.country) ?? null;

  const visible = row.visible ?? null;
  const image_url = coalesceImageUrl(row);
  const postal_code = first(row.code_postal, row.postal_code, row.zip) ?? null;

  // Debug: check if we have url_image but no image_url
  if (row?.url_image && !image_url) {
    imgDebug("fixup: url_image present but image_url empty", { 
      slug: row.slug, 
      url_image: row.url_image 
    });
  }

  return {
    id: String(id),
    title: String(title),
    slug: String(slug),
    start_date,
    end_date,
    type_code: type_code ? String(type_code) : null,
    secteur_labels,
    ville: ville ? String(ville) : null,
    pays: pays ? String(pays) : null,
    visible: typeof visible === "boolean" ? visible : null,
    image_url: image_url ? String(image_url) : null,
    postal_code: postal_code ? String(postal_code) : null,
    // Champs de compatibilité
    nom_event: String(title),
    date_debut: start_date,
    date_fin: end_date,
    secteur: row.secteur ?? [],
    nom_lieu: first(row.nom_lieu, row.venue_name, row.location_name, row.venue) ?? null,
    url_image: image_url ? String(image_url) : null,
    url_site_officiel: first(row.url_site_officiel, row.website, row.official_url, row.url) ?? null,
    is_b2b: Boolean(first(row.is_b2b, row.b2b, row.business) ?? false),
    type_event: type_code,
    rue: first(row.rue, row.street, row.address_street) ?? null,
    code_postal: postal_code ? String(postal_code) : null,
  };
}

// YYYY-MM-DD local (pas UTC)
export function todayYmdLocal(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

export function isOngoingOrUpcoming(ev: CanonicalEvent, today = todayYmdLocal()): boolean {
  const sd = ev.start_date ?? null;
  const ed = ev.end_date ?? null;

  if (sd && ed) {
    // en cours si sd <= today <= ed, à venir si sd >= today
    return (sd <= today && today <= ed) || (sd >= today);
  }
  if (sd && !ed) {
    return sd >= today; // à venir uniquement
  }
  if (!sd && ed) {
    return ed >= today; // on garde si fin ≥ aujourd'hui
  }
  return false;
}

// Helpers de filtre client (fallback)
export function matchesMonth(ev: CanonicalEvent, month: string | null): boolean {
  if (!month) return true;
  const d = ev.start_date;
  return !!(d && d.includes(`-${month}-`));
}
export function matchesType(ev: CanonicalEvent, type: string | null): boolean {
  if (!type) return true;
  return (ev.type_code ?? "") === type;
}
export function matchesSectorLabels(ev: CanonicalEvent, wanted: string[] | null): boolean {
  if (!wanted || !wanted.length) return true;
  return ev.secteur_labels?.some((lbl) => wanted.includes(lbl));
}