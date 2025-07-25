-- Étape 1 : Imposer l'unicité de id_event pour éviter les doublons futurs
ALTER TABLE public.events
ADD CONSTRAINT unique_id_event UNIQUE (id_event);

-- Étape 2 : Nettoyer les doublons existants avant l'UPSERT
-- Garder seulement la version la plus récente de chaque id_event
DELETE FROM public.events e1
WHERE EXISTS (
    SELECT 1 FROM public.events e2 
    WHERE e2.id_event = e1.id_event 
    AND e2.created_at > e1.created_at
);

-- Étape 3 : Mise à jour du pipeline d'import avec logique UPSERT
-- Cette requête remplace les INSERT classiques dans les edge functions
INSERT INTO public.events (
  id_event, nom_event, date_debut, date_fin, ville,
  secteur, url_image, slug, rue, code_postal, nom_lieu,
  url_site_officiel, type_event, is_b2b, visible, updated_at
)
SELECT
  ei.id_event,
  ei.nom_event,
  ei.date_debut,
  ei.date_fin,
  ei.ville,
  to_jsonb(ei.secteur) AS secteur,
  ei.url_image,
  CASE 
    WHEN ei.nom_event IS NOT NULL AND ei.ville IS NOT NULL 
    THEN lower(regexp_replace(ei.nom_event || '-' || ei.ville, '[^a-z0-9]+', '-', 'gi'))
    ELSE lower(regexp_replace(COALESCE(ei.nom_event, 'event'), '[^a-z0-9]+', '-', 'gi'))
  END AS slug,
  ei.rue,
  ei.code_postal,
  ei.nom_lieu,
  ei.url_site_officiel,
  ei.type_event,
  ei.is_b2b,
  ei.visible,
  NOW() AS updated_at
FROM public.events_import ei
WHERE ei.id_event IS NOT NULL
ON CONFLICT (id_event) DO UPDATE
  SET
    nom_event         = EXCLUDED.nom_event,
    date_debut        = EXCLUDED.date_debut,
    date_fin          = EXCLUDED.date_fin,
    ville             = EXCLUDED.ville,
    secteur           = EXCLUDED.secteur,
    url_image         = EXCLUDED.url_image,
    slug              = EXCLUDED.slug,
    rue               = EXCLUDED.rue,
    code_postal       = EXCLUDED.code_postal,
    nom_lieu          = EXCLUDED.nom_lieu,
    url_site_officiel = EXCLUDED.url_site_officiel,
    type_event        = EXCLUDED.type_event,
    is_b2b            = EXCLUDED.is_b2b,
    visible           = EXCLUDED.visible,
    updated_at        = EXCLUDED.updated_at;