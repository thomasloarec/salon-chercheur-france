import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_SECTORS, normalizeSectorSlug } from '@/lib/taxonomy';

export type Option = { value: string; label: string };

// 1) Secteurs – préférer la taxonomie canonique, merger avec DB par nom
export async function fetchAllSectorsPreferCanonical(): Promise<Option[]> {
  // Base = canonique (convertit en map par label pour matching)
  const canonicalMap = new Map<string, string>();
  for (const s of CANONICAL_SECTORS) {
    canonicalMap.set(s.label, s.value);
  }

  // Créer la liste de base avec les canoniques
  const resultMap = new Map<string, string>();
  for (const s of CANONICAL_SECTORS) {
    resultMap.set(s.value, s.label);
  }

  // DB (facultatif) : on merge les secteurs existants
  try {
    const { data, error } = await supabase
      .from('sectors')
      .select('id, name')
      .order('name', { ascending: true });
      
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const id = String(row?.id ?? '').trim();
        const name = String(row?.name ?? '').trim();
        if (!id || !name) continue;
        
        // Si ce secteur correspond à un canonique par nom, utiliser le slug canonique
        const canonicalSlug = canonicalMap.get(name);
        if (canonicalSlug) {
          const normalizedSlug = normalizeSectorSlug(canonicalSlug);
          resultMap.set(normalizedSlug, name);
        } else {
          // Sinon utiliser l'ID comme valeur (pour les secteurs non-canoniques)
          resultMap.set(id, name);
        }
      }
    }
  } catch (e) {
    console.warn('[filters] sectors db read skipped:', e);
  }

  const merged: Option[] = Array.from(resultMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

  return merged;
}

// 2) Types d'événement – liste basée sur les valeurs existantes
export async function fetchAllEventTypes(): Promise<Option[]> {
  // Fallback to static list since there's no event_types table
  return [
    { value: 'salon', label: 'Salon' },
    { value: 'conference', label: 'Conférence' },
    { value: 'congres', label: 'Congrès' },
    { value: 'exposition', label: 'Exposition' },
    { value: 'forum', label: 'Forum' },
    { value: 'convention', label: 'Convention' },
    { value: 'ceremonie', label: 'Cérémonie' },
  ];
}

// 3) Mois – liste fixe 01..12 (labels FR)
export const ALL_MONTHS: Option[] = [
  { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' },
  { value: '03', label: 'Mars' },    { value: '04', label: 'Avril' },
  { value: '05', label: 'Mai' },     { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' },
  { value: '09', label: 'Septembre' },{ value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },{ value: '12', label: 'Décembre' },
];

// 4) Régions – standardisées avec slugs canoniques
export async function fetchAllRegions(): Promise<Option[]> {
  // Import dynamique pour éviter les cycles
  const { REGIONS } = await import('@/lib/regions');
  
  // Utiliser la taxonomie standardisée des régions
  return Object.values(REGIONS)
    .map(r => ({ value: r.slug, label: r.name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}