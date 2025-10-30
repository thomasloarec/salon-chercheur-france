import { supabase } from '@/integrations/supabase/client';
import { normalizeExternalUrl } from '@/lib/url';

type LightExhibitor = {
  id_exposant?: string | null;
  exhibitor_name?: string | null;
  stand_exposant?: string | null;
  website_exposant?: string | null;
  exposant_description?: string | null;
  urlexpo_event?: string | null;
  logo_url?: string | null;
};

export async function hydrateExhibitor(light: LightExhibitor): Promise<LightExhibitor> {
  if (!light) return light;

  // si déjà hydraté, ne rien faire
  if (light.website_exposant || light.exposant_description) return light;

  // Chercher d'abord dans la table exhibitors moderne par id_exposant
  if (light.id_exposant) {
    // Trouver la participation qui correspond pour obtenir l'exhibitor_id
    const { data: participation } = await supabase
      .from('participation')
      .select('exhibitor_id')
      .eq('id_exposant', light.id_exposant)
      .maybeSingle();

    if (participation?.exhibitor_id) {
      // Récupérer les données de la table exhibitors
      const { data: exhibitor } = await supabase
        .from('exhibitors')
        .select('name, website, description, logo_url')
        .eq('id', participation.exhibitor_id)
        .maybeSingle();

      if (exhibitor) {
        return {
          ...light,
          exhibitor_name: light.exhibitor_name ?? exhibitor.name,
          website_exposant: normalizeExternalUrl(exhibitor.website) ?? light.website_exposant ?? null,
          exposant_description: exhibitor.description ?? light.exposant_description ?? null,
          logo_url: exhibitor.logo_url ?? light.logo_url ?? null,
        };
      }
    }
  }

  // Chercher dans la table exposants legacy par id_exposant
  if (light.id_exposant) {
    const { data, error } = await supabase
      .from('exposants')
      .select('id_exposant, nom_exposant, website_exposant, exposant_description')
      .eq('id_exposant', light.id_exposant)
      .maybeSingle();

    if (!error && data) {
      return {
        ...light,
        id_exposant: data.id_exposant,
        exhibitor_name: light.exhibitor_name ?? data.nom_exposant,
        website_exposant: normalizeExternalUrl(data.website_exposant) ?? light.website_exposant ?? null,
        exposant_description: data.exposant_description ?? light.exposant_description ?? null,
      };
    }
  }

  // Fallback par nom (ilike) dans exposants
  if (light.exhibitor_name) {
    const { data } = await supabase
      .from('exposants')
      .select('id_exposant, nom_exposant, website_exposant, exposant_description')
      .ilike('nom_exposant', light.exhibitor_name)
      .maybeSingle();

    if (data) {
      return {
        ...light,
        id_exposant: data.id_exposant,
        exhibitor_name: light.exhibitor_name ?? data.nom_exposant,
        website_exposant: normalizeExternalUrl(data.website_exposant) ?? light.website_exposant ?? null,
        exposant_description: data.exposant_description ?? light.exposant_description ?? null,
      };
    }
  }

  return light;
}
