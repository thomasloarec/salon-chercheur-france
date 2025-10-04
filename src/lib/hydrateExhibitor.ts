import { supabase } from '@/integrations/supabase/client';

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

  // Chercher dans la table exposants par id_exposant
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
        website_exposant: data.website_exposant ?? light.website_exposant ?? null,
        exposant_description: data.exposant_description ?? light.exposant_description ?? null,
      };
    }
  }

  // Fallback par nom (ilike)
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
        website_exposant: data.website_exposant ?? light.website_exposant ?? null,
        exposant_description: data.exposant_description ?? light.exposant_description ?? null,
      };
    }
  }

  return light;
}
