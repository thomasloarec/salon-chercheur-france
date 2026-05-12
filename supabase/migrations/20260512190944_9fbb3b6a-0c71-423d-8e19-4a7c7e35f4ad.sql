CREATE OR REPLACE VIEW public.crm_radar_participations_view AS
SELECT ex.id_exposant,
    ex.nom_exposant,
    ex.website_exposant,
    ex.normalized_domain,
    min(p.id_participation::text)::uuid AS representative_participation_id,
    string_agg(DISTINCT NULLIF(TRIM(BOTH FROM p.stand_exposant), ''::text), ' | '::text) FILTER (WHERE NULLIF(TRIM(BOTH FROM p.stand_exposant), ''::text) IS NOT NULL) AS stand_exposants_list,
    count(DISTINCT NULLIF(TRIM(BOTH FROM p.stand_exposant), ''::text)) AS stand_count,
    count(*) AS participation_row_count,
    min(p.urlexpo_event) AS urlexpo_event,
    e.id AS event_id,
    e.id_event AS event_id_text,
    e.nom_event,
    e.type_event,
    e.date_debut,
    e.date_fin,
    e.ville,
    e.nom_lieu,
    e.visible,
    e.date_debut >= CURRENT_DATE AS is_future_event,
    e.date_debut - CURRENT_DATE AS days_until_event,
    e.url_image,
    e.slug,
    e.secteur,
    e.description_event
FROM participation p
  JOIN exposants ex ON ex.id_exposant = p.id_exposant
  JOIN events e ON e.id = p.id_event
WHERE e.visible = true
  AND ex.normalized_domain IS NOT NULL
  AND ex.normalized_domain LIKE '%.%'
  AND length(ex.normalized_domain) > 4
  AND (ex.normalized_domain <> ALL (ARRAY['linkedin.com','fr.linkedin.com','google.com','maps.google.com','facebook.com','youtube.com','youtu.be','linktr.ee','instagram.com','twitter.com','x.com','example.com']))
  AND ex.normalized_domain NOT LIKE '%.example.com'
GROUP BY ex.id_exposant, ex.nom_exposant, ex.website_exposant, ex.normalized_domain,
         e.id, e.id_event, e.nom_event, e.type_event, e.date_debut, e.date_fin,
         e.ville, e.nom_lieu, e.visible, e.url_image, e.slug, e.secteur, e.description_event;