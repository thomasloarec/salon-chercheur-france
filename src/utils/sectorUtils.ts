
import type { Json } from '@/integrations/supabase/types';

/**
 * Convertit un secteur en string (pour affichage simple)
 * @deprecated Utiliser convertSecteurToArray pour conserver tous les secteurs
 */
export const convertSecteurToString = (secteur: Json | string | null | undefined): string => {
  if (typeof secteur === 'string') {
    return secteur;
  }
  
  if (Array.isArray(secteur) && secteur.length > 0) {
    // Retourner tous les secteurs séparés par une virgule
    return secteur.map(s => String(s)).join(', ');
  }
  
  if (secteur && typeof secteur === 'object' && !Array.isArray(secteur)) {
    // If it's an object, try to extract a string value
    const values = Object.values(secteur);
    if (values.length > 0) {
      return String(values[0]);
    }
  }
  
  return '';
};

/**
 * Convertit un secteur en tableau de strings
 */
export const convertSecteurToArray = (secteur: Json | string | string[] | null | undefined): string[] => {
  if (!secteur) return [];
  
  if (Array.isArray(secteur)) {
    // Flatten et filtrer les valeurs vides
    return secteur.flatMap(s => {
      if (Array.isArray(s)) return s.map(String);
      if (typeof s === 'string') return [s];
      return [];
    }).filter(Boolean);
  }
  
  if (typeof secteur === 'string') {
    // Si c'est une string JSON, la parser
    if (secteur.startsWith('[') && secteur.endsWith(']')) {
      try {
        const parsed = JSON.parse(secteur);
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [secteur];
      } catch {
        return [secteur];
      }
    }
    // Si contient des virgules, séparer
    if (secteur.includes(',')) {
      return secteur.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [secteur];
  }
  
  return [];
};
