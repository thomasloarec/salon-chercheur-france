// src/lib/normalizeEvent.ts

export type CanonicalEvent = {
  id: string;
  title: string;
  slug: string;
  start_date: string | null;
  region_code: string | null;
  event_type_code: string | null;
  secteur_labels: string[]; // jsonb labels
  // Champs additionnels pour compatibilité
  nom_event: string;
  date_debut: string | null;
  date_fin: string | null;
  secteur: any;
  nom_lieu: string | null;
  ville: string | null;
  url_image: string | null;
  url_site_officiel: string | null;
  is_b2b: boolean;
  type_event: string | null;
  rue: string | null;
  code_postal: string | null;
  visible: boolean;
};

function firstNonEmpty<T = any>(...vals: T[]): T | null {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim?.() !== "") return v as T;
  }
  return null;
}

export function normalizeEventRow(row: any): CanonicalEvent {
  const id = firstNonEmpty(row.id, row.id_event, row.event_id, row.pk, row.slug) ?? crypto.randomUUID?.() ?? String(Math.random());
  const title = firstNonEmpty(row.name, row.title, row.nom, row.nom_event, row.event_name, row.libelle, row.slug) ?? "Événement";
  const slug = firstNonEmpty(row.slug, row.permalink, row.url_slug) ?? String(id);

  const start_date = firstNonEmpty(row.start_date, row.date_debut, row.startDate, row.start) ?? null;
  const region_code = firstNonEmpty(row.region_code, row.region, row.region_slug, row.code_region) ?? null;
  const event_type_code = firstNonEmpty(row.event_type_code, row.type, row.type_code, row.event_type, row.type_event) ?? null;

  // secteur peut être stocké sous différents noms; privilégier "secteur" jsonb[]
  const secteur = firstNonEmpty(row.secteur, row.sectors, row.sector, row.secteurs) ?? [];
  const secteur_labels = Array.isArray(secteur) ? secteur.filter(Boolean) : [];

  return {
    id: String(id),
    title: String(title),
    slug: String(slug),
    start_date,
    region_code,
    event_type_code,
    secteur_labels,
    // Champs de compatibilité
    nom_event: String(title),
    date_debut: start_date,
    date_fin: firstNonEmpty(row.end_date, row.date_fin, row.endDate, row.end) ?? null,
    secteur: row.secteur ?? [],
    nom_lieu: firstNonEmpty(row.nom_lieu, row.venue_name, row.location_name, row.venue) ?? null,
    ville: firstNonEmpty(row.ville, row.city, row.location_city) ?? null,
    url_image: firstNonEmpty(row.url_image, row.image_url, row.image, row.photo) ?? null,
    url_site_officiel: firstNonEmpty(row.url_site_officiel, row.website, row.official_url, row.url) ?? null,
    is_b2b: Boolean(firstNonEmpty(row.is_b2b, row.b2b, row.business) ?? false),
    type_event: event_type_code,
    rue: firstNonEmpty(row.rue, row.street, row.address_street) ?? null,
    code_postal: firstNonEmpty(row.code_postal, row.postal_code, row.zip) ?? null,
    visible: Boolean(firstNonEmpty(row.visible, row.published, row.active) ?? false),
  };
}

// Helpers de filtre client
export function matchesMonth(ev: CanonicalEvent, month: string | null): boolean {
  if (!month) return true;
  const d = ev.start_date;
  if (!d || typeof d !== "string") return false;
  // tolérant ISO: "YYYY-MM-DD" -> contient `-MM-`
  return d.includes(`-${month}-`);
}

export function matchesRegion(ev: CanonicalEvent, region: string | null): boolean {
  if (!region) return true;
  return (ev.region_code ?? "") === region;
}

export function matchesType(ev: CanonicalEvent, type: string | null): boolean {
  if (!type) return true;
  return (ev.event_type_code ?? "") === type;
}

export function matchesSectorLabels(ev: CanonicalEvent, wantedLabels: string[] | null): boolean {
  if (!wantedLabels || wantedLabels.length === 0) return true;
  if (!Array.isArray(ev.secteur_labels)) return false;
  // Au moins une intersection
  return ev.secteur_labels.some(lbl => wantedLabels.includes(lbl));
}