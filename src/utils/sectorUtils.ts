
import type { Json } from '@/integrations/supabase/types';

export const convertSecteurToString = (secteur: Json | string | null | undefined): string => {
  if (typeof secteur === 'string') {
    return secteur;
  }
  
  if (Array.isArray(secteur) && secteur.length > 0) {
    return String(secteur[0]);
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
