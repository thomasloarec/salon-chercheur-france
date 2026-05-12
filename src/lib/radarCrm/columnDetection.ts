// Auto-detect CSV columns based on common synonyms (FR + EN)

export type RadarField = 'company_name' | 'website_raw' | 'crm_status' | 'owner_name' | 'owner_email' | 'notes';

export const RADAR_FIELD_LABELS: Record<RadarField, string> = {
  company_name: "Nom de l'entreprise",
  website_raw: 'Site web / domaine',
  crm_status: 'Statut CRM',
  owner_name: 'Commercial / Owner',
  owner_email: 'Email du commercial',
  notes: 'Notes',
};

export const RADAR_FIELD_REQUIRED: Record<RadarField, boolean> = {
  company_name: true,
  website_raw: true,
  crm_status: false,
  owner_name: false,
  owner_email: false,
  notes: false,
};

const SYNONYMS: Record<RadarField, string[]> = {
  company_name: [
    'company', 'company_name', 'companyname', 'entreprise', 'nom entreprise', 'nom_entreprise',
    'societe', 'société', 'account name', 'account_name', 'nom du compte', 'nom compte', 'name', 'nom',
    'raison sociale',
  ],
  website_raw: [
    'website', 'web site', 'site', 'site web', 'site_web', 'url', 'domain', 'domaine',
    'website_raw', 'site internet', 'site_internet', 'web', 'website url', 'company website',
  ],
  crm_status: [
    'status', 'statut', 'crm_status', 'crm status', 'type', 'categorie', 'catégorie',
    'lifecycle', 'stage', 'pipeline',
  ],
  owner_name: [
    'owner', 'commercial', 'sales', 'sales owner', 'sales_owner', 'responsable', 'account owner',
    'account_owner', 'assigned to', 'assigned_to', 'propriétaire', 'proprietaire',
  ],
  owner_email: [
    'owner_email', 'owner email', 'email owner', 'email_owner', 'email commercial', 'email_commercial',
    'sales email', 'sales_email',
  ],
  notes: [
    'notes', 'note', 'commentaire', 'commentaires', 'comment', 'comments', 'description',
  ],
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function autoDetectMapping(headers: string[]): Partial<Record<RadarField, string>> {
  const mapping: Partial<Record<RadarField, string>> = {};
  const used = new Set<string>();

  for (const field of Object.keys(SYNONYMS) as RadarField[]) {
    const synSet = SYNONYMS[field].map(normalize);
    const match = headers.find((h) => !used.has(h) && synSet.includes(normalize(h)));
    if (match) {
      mapping[field] = match;
      used.add(match);
      continue;
    }
    // Loose contains-match fallback
    const loose = headers.find((h) => {
      if (used.has(h)) return false;
      const n = normalize(h);
      return synSet.some((s) => n === s || n.includes(s));
    });
    if (loose) {
      mapping[field] = loose;
      used.add(loose);
    }
  }
  return mapping;
}
