import { supabase } from '@/integrations/supabase/client';

export type LightExhibitor = {
  id_exposant?: string | null;
  exhibitor_name?: string | null;
  stand_exposant?: string | null;
  website_exposant?: string | null;
  exposant_description?: string | null;
  urlexpo_event?: string | null;
  logo_url?: string | null;
  exhibitor_uuid?: string | null;
  ai_resume_court?: string | null;
};

/**
 * Hydrate exhibitor data with additional info from database
 * Uses 4 fallback strategies to ensure data is found
 */
export async function hydrateExhibitor(light: LightExhibitor): Promise<LightExhibitor> {
  console.log('🔍 hydrateExhibitor - Input:', {
    id_exposant: light.id_exposant,
    exhibitor_uuid: light.exhibitor_uuid,
    has_description: !!light.exposant_description,
    has_website: !!light.website_exposant
  });

  // Si toutes les données sont déjà présentes, pas besoin d'hydratation
  if (light.exposant_description && light.website_exposant && light.logo_url && light.ai_resume_court) {
    console.log('✅ Données déjà complètes, skip hydratation');
    return light;
  }

  // ============================================================================
  // STRATÉGIE 0 : Chercher resume_court dans exhibitor_ai si manquant
  // ============================================================================
  if (!light.ai_resume_court) {
    const aiLookupId = light.exhibitor_uuid || light.id_exposant;
    if (aiLookupId) {
      const { data: aiRow } = await supabase
        .from('exhibitor_ai')
        .select('resume_court')
        .eq('exhibitor_id', aiLookupId)
        .maybeSingle();
      
      if (aiRow?.resume_court) {
        light = { ...light, ai_resume_court: aiRow.resume_court };
      }
    }
  }

  // ============================================================================
  // STRATÉGIE 1 : Chercher via exhibitor_uuid (PRIORITÉ pour nouveaux exposants)
  // ============================================================================
  
  if (light.exhibitor_uuid) {
    console.log('🔍 Tentative 1 : Recherche directe via exhibitor_uuid');
    
    const { data: exhibitor, error } = await supabase
      .from('exhibitors')
      .select('id, name, website, description, logo_url')
      .eq('id', light.exhibitor_uuid)
      .maybeSingle();

    if (exhibitor && !error) {
      console.log('✅ Trouvé via exhibitor_uuid:', {
        name: exhibitor.name,
        has_description: !!exhibitor.description,
        has_logo: !!exhibitor.logo_url
      });

      return {
        ...light,
        exhibitor_name: exhibitor.name || light.exhibitor_name,
        website_exposant: exhibitor.website || light.website_exposant,
        exposant_description: exhibitor.description || light.exposant_description,
        logo_url: exhibitor.logo_url || light.logo_url
      };
    }
  }

  // ============================================================================
  // STRATÉGIE 2 : Chercher via participation.exhibitor_id
  // ============================================================================
  
  if (light.id_exposant) {
    console.log('🔍 Tentative 2 : Recherche via participation.exhibitor_id');
    
    const { data: participation, error: partError } = await supabase
      .from('participation')
      .select('exhibitor_id')
      .eq('id_exposant', light.id_exposant)
      .maybeSingle();

    if (participation?.exhibitor_id && !partError) {
      console.log('✅ Participation trouvée, exhibitor_id:', participation.exhibitor_id);
      
      const { data: exhibitor, error: exError } = await supabase
        .from('exhibitors')
        .select('id, name, website, description, logo_url')
        .eq('id', participation.exhibitor_id)
        .maybeSingle();

      if (exhibitor && !exError) {
        console.log('✅ Trouvé via participation → exhibitors:', {
          name: exhibitor.name,
          has_description: !!exhibitor.description,
          has_logo: !!exhibitor.logo_url
        });

        return {
          ...light,
          exhibitor_uuid: exhibitor.id,
          exhibitor_name: exhibitor.name || light.exhibitor_name,
          website_exposant: exhibitor.website || light.website_exposant,
          exposant_description: exhibitor.description || light.exposant_description,
          logo_url: exhibitor.logo_url || light.logo_url
        };
      }
    }
  }

  // ============================================================================
  // STRATÉGIE 3 : Fallback vers exposants (legacy)
  // ============================================================================
  
  if (light.id_exposant) {
    console.log('🔍 Tentative 3 : Fallback vers exposants legacy');
    
    const { data: exposant, error: legacyError } = await supabase
      .from('exposants')
      .select('id_exposant, nom_exposant, website_exposant, exposant_description')
      .eq('id_exposant', light.id_exposant)
      .maybeSingle();

    if (exposant && !legacyError) {
      console.log('✅ Trouvé dans exposants legacy:', {
        name: exposant.nom_exposant,
        has_description: !!exposant.exposant_description
      });

      return {
        ...light,
        exhibitor_name: exposant.nom_exposant || light.exhibitor_name,
        website_exposant: exposant.website_exposant || light.website_exposant,
        exposant_description: exposant.exposant_description || light.exposant_description
      };
    }
  }

  // ============================================================================
  // STRATÉGIE 4 : Recherche par nom (dernier recours)
  // ============================================================================
  
  if (light.exhibitor_name) {
    console.log('🔍 Tentative 4 : Recherche par nom dans exhibitors');
    
    const { data: exhibitor, error } = await supabase
      .from('exhibitors')
      .select('id, name, website, description, logo_url')
      .ilike('name', light.exhibitor_name)
      .maybeSingle();

    if (exhibitor && !error) {
      console.log('✅ Trouvé par nom dans exhibitors');

      return {
        ...light,
        exhibitor_uuid: exhibitor.id,
        website_exposant: exhibitor.website || light.website_exposant,
        exposant_description: exhibitor.description || light.exposant_description,
        logo_url: exhibitor.logo_url || light.logo_url
      };
    }
  }

  // ============================================================================
  // Aucune donnée trouvée
  // ============================================================================
  
  console.warn('⚠️ hydrateExhibitor - Aucune donnée supplémentaire trouvée');
  return light;
}
