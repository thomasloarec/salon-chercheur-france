-- Patch minimal de la fonction search_events pour corriger la syntaxe SQL
CREATE OR REPLACE FUNCTION public.search_events(
  sector_ids   uuid[]     DEFAULT '{}'::uuid[],
  event_types  text[]     DEFAULT '{}'::text[],
  months       integer[]  DEFAULT '{}'::integer[],
  region_codes text[]     DEFAULT '{}'::text[],
  page_num     integer    DEFAULT 1,
  page_size    integer    DEFAULT 20
)
RETURNS TABLE(id uuid, id_event text, nom_event text, date_debut date, date_fin date, ville text, secteur jsonb, url_image text, slug text, rue text, code_postal text, nom_lieu text, url_site_officiel text, type_event text, is_b2b boolean, visible boolean, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  wheres    text[] := ARRAY[
                'e.visible = true',
                'e.date_debut >= CURRENT_DATE'
              ];
  where_sql text;
  cnt       bigint;
BEGIN
  -- sectors (corrigé: utilisation correcte de l'ARRAY)
  IF array_length(sector_ids,1) > 0 THEN
    wheres := wheres || ARRAY['e.id_event IN (SELECT event_id FROM event_sectors WHERE sector_id = ANY($1))'];
  END IF;

  -- types (corrigé: utilisation correcte de l'ARRAY)
  IF array_length(event_types,1) > 0 THEN
    wheres := wheres || ARRAY['e.type_event = ANY($2)'];
  END IF;

  -- months (corrigé: utilisation correcte de l'ARRAY)
  IF array_length(months,1) > 0 THEN
    wheres := wheres || ARRAY['EXTRACT(MONTH FROM e.date_debut)::int = ANY($3)'];
  END IF;

  -- regions (corrigé: utilisation correcte de l'ARRAY)
  IF array_length(region_codes,1) > 0 THEN
    wheres := wheres || ARRAY['EXISTS (
                           SELECT 1 FROM events_geo g
                           WHERE g.id_event = e.id_event
                             AND g.region_code = ANY($4)
                         )'];
  END IF;

  where_sql := array_to_string(wheres,' AND ');

  EXECUTE
    format('SELECT COUNT(DISTINCT e.id_event) FROM events e WHERE %s', where_sql)
    USING sector_ids, event_types, months, region_codes
    INTO cnt;

  RETURN QUERY EXECUTE
    format($q$
      SELECT DISTINCT
        e.id, e.id_event, e.nom_event, e.date_debut, e.date_fin, e.ville, e.secteur,
        e.url_image, e.slug, e.rue, e.code_postal, e.nom_lieu,
        e.url_site_officiel, e.type_event, e.is_b2b, e.visible,
        %L::bigint AS total_count
      FROM events e
      WHERE %s
      ORDER BY e.date_debut ASC
      LIMIT %s OFFSET %s
    $q$, cnt, where_sql, page_size, (page_num-1)*page_size)
    USING sector_ids, event_types, months, region_codes;
END;
$$;