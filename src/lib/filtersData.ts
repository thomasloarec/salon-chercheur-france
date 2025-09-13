import { supabase } from '@/integrations/supabase/client';

export type Option = { value: string; label: string };

// 1) Secteurs – lire TOUT depuis la table de référence
export async function fetchAllSectors(): Promise<Option[]> {
  const { data, error } = await supabase
    .from('sectors')
    .select('id, name')
    .order('name', { ascending: true });
    
  if (error) {
    console.warn('[filters] sectors fallback:', error.message);
    return [];
  }
  
  return (data ?? [])
    .filter(s => s?.id?.trim() && s?.name?.trim())
    .map(s => ({ value: s.id, label: s.name }));
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

// 4) Régions – table de référence
export async function fetchAllRegions(): Promise<Option[]> {
  const { data, error } = await supabase
    .from('regions')
    .select('code, nom')
    .order('nom', { ascending: true });

  if (!error && data) {
    return data
      .filter(r => r?.code?.trim() && r?.nom?.trim())
      .map(r => ({ value: r.code, label: r.nom }));
  }

  console.warn('[filters] regions table missing or error, using fallback');
  // Fallback: principales régions métropole + DROM
  return [
    { value: '11', label: 'Île-de-France' },
    { value: '84', label: 'Auvergne-Rhône-Alpes' },
    { value: '27', label: 'Bourgogne-Franche-Comté' },
    { value: '53', label: 'Bretagne' },
    { value: '24', label: 'Centre-Val de Loire' },
    { value: '94', label: 'Corse' },
    { value: '44', label: 'Grand Est' },
    { value: '32', label: 'Hauts-de-France' },
    { value: '28', label: 'Normandie' },
    { value: '75', label: 'Nouvelle-Aquitaine' },
    { value: '76', label: 'Occitanie' },
    { value: '52', label: 'Pays de la Loire' },
    { value: '93', label: 'Provence-Alpes-Côte d\'Azur' },
    { value: '01', label: 'Guadeloupe' },
    { value: '03', label: 'Guyane' },
    { value: '02', label: 'Martinique' },
    { value: '06', label: 'Mayotte' },
    { value: '04', label: 'La Réunion' },
  ];
}