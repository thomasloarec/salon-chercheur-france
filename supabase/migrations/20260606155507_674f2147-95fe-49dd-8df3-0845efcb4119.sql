CREATE OR REPLACE VIEW public.public_exhibitor_profiles AS
 WITH base AS (
         SELECT epi.id AS public_identity_id,
            epi.public_slug,
            epi.source_type,
            epi.is_active,
            epi.legacy_exposant_id,
            epi.exhibitor_id,
            epi.canonical_name,
            epi.created_at,
            epi.updated_at,
            COALESCE(NULLIF(btrim(ex.name), ''::text), NULLIF(btrim(le.nom_exposant), ''::text), NULLIF(btrim(epi.canonical_name), ''::text), 'Exposant #'::text || epi.public_slug) AS display_name,
            COALESCE(NULLIF(btrim(ex.website), ''::text), NULLIF(btrim(le.website_exposant), ''::text)) AS website,
            NULLIF(btrim(ex.logo_url), ''::text) AS logo_url,
            COALESCE(NULLIF(btrim(ex.description), ''::text), NULLIF(btrim(le.exposant_description), ''::text), NULLIF(btrim(ai.resume_court), ''::text)) AS description,
            NULLIF(btrim(ai.resume_court), ''::text) AS ai_summary,
            NULLIF(btrim(ex.linkedin_url), ''::text) AS linkedin_url,
            ex.owner_user_id IS NOT NULL OR COALESCE(tm.active_team_count, 0::bigint) > 0 AS is_claimed,
            COALESCE(ex.approved, false) = true OR ex.verified_at IS NOT NULL AS is_verified,
            COALESCE(ex.is_test, false) OR COALESCE(epi.canonical_name, ''::text) ~~* '\_\_%'::text OR COALESCE(ex.name, ''::text) ~~* '\_\_%'::text OR COALESCE(le.nom_exposant, ''::text) ~~* '\_\_%'::text OR epi.public_slug ~~ 't2abis-%'::text AS is_test,
            COALESCE(part.total_participations, 0::bigint) AS total_participations,
            COALESCE(part.distinct_events_count, 0::bigint) AS distinct_events_count,
            COALESCE(part.future_participations_count, 0::bigint) AS future_participations_count,
            COALESCE(part.past_participations_count, 0::bigint) AS past_participations_count,
            part.next_event_at,
            part.last_past_event_at,
            COALESCE(nov.published_novelties_count, 0::bigint) AS published_novelties_count,
            nov.last_novelty_at,
            ex.updated_at AS exhibitor_updated_at
           FROM exhibitor_public_identities epi
             LEFT JOIN exhibitors ex ON ex.id = epi.exhibitor_id
             LEFT JOIN exposants le ON le.id_exposant = epi.legacy_exposant_id
             LEFT JOIN LATERAL ( SELECT ai0.resume_court
                   FROM exhibitor_ai ai0
                  WHERE epi.exhibitor_id IS NOT NULL AND ai0.exhibitor_id = epi.exhibitor_id::text OR epi.legacy_exposant_id IS NOT NULL AND ai0.exhibitor_id = epi.legacy_exposant_id
                 LIMIT 1) ai ON true
             LEFT JOIN LATERAL ( SELECT count(*) AS active_team_count
                   FROM exhibitor_team_members t
                  WHERE epi.exhibitor_id IS NOT NULL AND t.exhibitor_id = epi.exhibitor_id AND t.status = 'active'::exhibitor_team_status) tm ON true
             LEFT JOIN LATERAL ( SELECT count(DISTINCT p.id_participation) AS total_participations,
                    count(DISTINCT p.id_event) AS distinct_events_count,
                    count(DISTINCT p.id_participation) FILTER (WHERE COALESCE(e.date_fin, e.date_debut) >= CURRENT_DATE) AS future_participations_count,
                    count(DISTINCT p.id_participation) FILTER (WHERE COALESCE(e.date_fin, e.date_debut) < CURRENT_DATE) AS past_participations_count,
                    min(e.date_debut) FILTER (WHERE COALESCE(e.date_fin, e.date_debut) >= CURRENT_DATE) AS next_event_at,
                    max(COALESCE(e.date_fin, e.date_debut)) FILTER (WHERE COALESCE(e.date_fin, e.date_debut) < CURRENT_DATE) AS last_past_event_at
                   FROM participation p
                     JOIN events e ON e.id = p.id_event
                  WHERE e.visible = true AND e.is_test = false AND (epi.legacy_exposant_id IS NOT NULL AND p.id_exposant = epi.legacy_exposant_id OR epi.exhibitor_id IS NOT NULL AND p.exhibitor_id = epi.exhibitor_id)) part ON true
             LEFT JOIN LATERAL ( SELECT count(*) AS published_novelties_count,
                    max(n.updated_at) AS last_novelty_at
                   FROM novelties n
                  WHERE epi.exhibitor_id IS NOT NULL AND n.exhibitor_id = epi.exhibitor_id AND n.status = 'published'::text AND COALESCE(n.is_test, false) = false) nov ON true
          WHERE epi.is_active = true
        )
 SELECT public_identity_id,
    public_slug,
    source_type,
    is_active,
    legacy_exposant_id,
    exhibitor_id,
    display_name,
    canonical_name,
    website,
    logo_url,
    description,
    ai_summary,
    linkedin_url,
    is_claimed,
    is_verified,
    is_test,
    total_participations,
    future_participations_count,
    past_participations_count,
    published_novelties_count,
    future_participations_count > 0 AS has_future_events,
    published_novelties_count > 0 AS has_published_novelties,
    website IS NOT NULL AS has_website,
    description IS NOT NULL AS has_description,
    logo_url IS NOT NULL AS has_logo,
        CASE
            WHEN is_claimed THEN true
            WHEN published_novelties_count >= 1 THEN true
            WHEN distinct_events_count >= 2 THEN true
            WHEN exhibitor_id IS NOT NULL AND char_length(COALESCE(description, ''::text)) >= 120 THEN true
            ELSE false
        END AS seo_indexable,
        CASE
            WHEN is_claimed THEN 'claimed'::text
            WHEN published_novelties_count >= 1 THEN 'published_novelty'::text
            WHEN distinct_events_count >= 2 THEN 'multiple_events'::text
            WHEN exhibitor_id IS NOT NULL AND char_length(COALESCE(description, ''::text)) >= 120 THEN 'enriched_profile'::text
            ELSE 'thin_content'::text
        END AS seo_reason,
    LEAST(COALESCE(last_novelty_at, last_past_event_at::timestamp with time zone, exhibitor_updated_at, updated_at, created_at), now()) AS last_activity_at,
    next_event_at,
    created_at,
    updated_at
   FROM base;