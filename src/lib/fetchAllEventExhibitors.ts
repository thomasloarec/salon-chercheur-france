import { supabase } from '@/integrations/supabase/client';
import { fetchExhibitorPublicSlugs, resolvePublicSlug } from '@/lib/exhibitorPublicSlug';

/**
 * Lot 6 — extraction (sans changement de logique) du chargement complet des
 * exposants d'un salon utilisé par la modale « Voir tous les exposants ».
 * Anciennement inline dans ExhibitorsSidebar.
 *
 * Requêtes batchées, aucun N+1 : participations → participation → exhibitors /
 * exposants / exhibitor_ai → public_exhibitor_profiles.
 */
export async function fetchAllEventExhibitors(params: {
  slug?: string | null;
  idEvent?: string | null;
}): Promise<any[]> {
  try {
    let eventIdText = params.idEvent || undefined;

    if (!eventIdText && params.slug) {
      const { data: eventData } = await supabase
        .from('events')
        .select('id_event')
        .eq('slug', params.slug)
        .maybeSingle();
      eventIdText = eventData?.id_event ?? undefined;
    }

    if (!eventIdText) return [];

    const { data: participations } = await supabase
      .from('participations_with_exhibitors')
      .select('*')
      .eq('id_event_text', eventIdText)
      .order('exhibitor_name', { ascending: true });

    const participationIds = (participations || [])
      .map((p) => p.id_participation)
      .filter(Boolean);

    const exhibitorUUIDs: Record<string, string> = {};
    const exhibitorLogos: Record<string, string> = {};
    const exhibitorDescriptions: Record<string, string> = {};
    const exhibitorWebsites: Record<string, string> = {};
    const exhibitorAiDescriptions: Record<string, string> = {};
    const legacyExposantData: Record<string, any> = {};

    if (participationIds.length > 0) {
      const { data: participationDetails } = await supabase
        .from('participation')
        .select('id_participation, exhibitor_id, id_exposant')
        .in('id_participation', participationIds);

      if (participationDetails) {
        participationDetails.forEach((p) => {
          if (p.exhibitor_id && p.id_participation) {
            exhibitorUUIDs[p.id_participation] = p.exhibitor_id;
          }
        });

        const uuids = Object.values(exhibitorUUIDs).filter(Boolean);
        if (uuids.length > 0) {
          const [{ data: exhibitors }, { data: aiRows }] = await Promise.all([
            supabase.from('exhibitors').select('id, logo_url, description, website').in('id', uuids),
            supabase
              .from('exhibitor_ai')
              .select('exhibitor_id, resume_court')
              .in('exhibitor_id', uuids)
              .not('resume_court', 'is', null),
          ]);

          aiRows?.forEach((ai) => {
            if (ai.resume_court) exhibitorAiDescriptions[ai.exhibitor_id] = ai.resume_court;
          });
          exhibitors?.forEach((e) => {
            if (e.logo_url) exhibitorLogos[e.id] = e.logo_url;
            if (e.description) exhibitorDescriptions[e.id] = e.description;
            if (e.website) exhibitorWebsites[e.id] = e.website;
          });
        }

        const legacyIds = participationDetails
          .filter((p) => !p.exhibitor_id && p.id_exposant)
          .map((p) => p.id_exposant);

        if (legacyIds.length > 0) {
          const [{ data: legacyExposants }, { data: legacyAiRows }] = await Promise.all([
            supabase
              .from('exposants')
              .select('id_exposant, nom_exposant, website_exposant, exposant_description')
              .in('id_exposant', legacyIds),
            supabase
              .from('exhibitor_ai')
              .select('exhibitor_id, resume_court')
              .in('exhibitor_id', legacyIds)
              .not('resume_court', 'is', null),
          ]);

          legacyAiRows?.forEach((ai) => {
            if (ai.resume_court) exhibitorAiDescriptions[ai.exhibitor_id] = ai.resume_court;
          });
          legacyExposants?.forEach((ex) => {
            legacyExposantData[ex.id_exposant] = {
              name: ex.nom_exposant,
              website: ex.website_exposant,
              description: ex.exposant_description,
            };
          });
        }
      }
    }

    const mapped = (participations || [])
      .map((p) => {
        const exhibitorUUID = p.id_participation ? exhibitorUUIDs[p.id_participation] : undefined;
        const logoUrl = exhibitorUUID ? exhibitorLogos[exhibitorUUID] : null;
        const description = exhibitorUUID
          ? exhibitorDescriptions[exhibitorUUID]
          : (p.id_exposant && legacyExposantData[p.id_exposant]?.description) ||
            p.exposant_description;
        const website = exhibitorUUID
          ? exhibitorWebsites[exhibitorUUID]
          : (p.id_exposant && legacyExposantData[p.id_exposant]?.website) ||
            p.exhibitor_website ||
            p.participation_website;

        const exhibitorName =
          p.name_final ||
          p.exhibitor_name ||
          p.legacy_name ||
          (p.id_exposant && legacyExposantData[p.id_exposant]?.name) ||
          p.id_exposant ||
          '';

        const lookupKey = exhibitorUUID || p.id_exposant;
        const aiDesc = lookupKey ? exhibitorAiDescriptions[lookupKey] : undefined;

        return {
          id: exhibitorUUID || p.id_exposant || String(p.exhibitor_uuid || ''),
          id_exposant: p.id_exposant,
          exhibitor_uuid: exhibitorUUID,
          name: exhibitorName,
          exhibitor_name: exhibitorName,
          slug: p.id_exposant || String(p.exhibitor_uuid || ''),
          logo_url: logoUrl,
          description: aiDesc || description,
          exposant_description: description,
          ai_resume_court: aiDesc,
          website,
          website_exposant: website,
          stand: p.stand_exposant || null,
          stand_exposant: p.stand_exposant || null,
          urlexpo_event: p.urlexpo_event,
          hall: null,
          plan: 'free' as const,
        };
      })
      .filter((e) => e.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));

    const slugMaps = await fetchExhibitorPublicSlugs(
      mapped.map((e) => e.exhibitor_uuid || null),
      mapped.map((e) => e.id_exposant || null),
    );

    return mapped.map((e) => {
      const info = resolvePublicSlug(slugMaps, {
        exhibitorId: e.exhibitor_uuid,
        legacyId: e.id_exposant,
      });
      return {
        ...e,
        public_slug: info?.public_slug ?? null,
        seo_indexable: info?.seo_indexable ?? false,
        is_test: info?.is_test ?? false,
      };
    });
  } catch (err) {
    console.error('[fetchAllEventExhibitors] error', err);
    return [];
  }
}
