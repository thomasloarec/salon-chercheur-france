
-- Supprimer l'ancienne fonction et créer la nouvelle avec la signature demandée
DROP FUNCTION IF EXISTS public.search_events;

CREATE OR REPLACE FUNCTION public.search_events(
  sector_ids     uuid[]     DEFAULT '{}',
  event_types    text[]     DEFAULT '{}',
  months          integer[] DEFAULT '{}',
  region_names   text[]     DEFAULT '{}',    -- ← Nouveau param : liste de régions
  page_num        integer   DEFAULT 1,
  page_size       integer   DEFAULT 20
)
RETURNS TABLE (
  id                   uuid,
  nom_event            text,
  description_event    text,
  date_debut           date,
  date_fin             date,
  secteur              text,
  ville                text,
  region               text,
  pays                 text,
  nom_lieu             text,
  url_image            text,
  tags                 text[],
  affluence            integer,
  estimated_exhibitors integer,
  is_b2b               boolean,
  type_event           text,
  created_at           timestamptz,
  updated_at           timestamptz,
  last_scraped_at      timestamptz,
  scraped_from         text,
  rue                  text,
  visible              boolean,
  slug                 text,
  total_count          bigint,
  code_postal          text,
  url_site_officiel    text,
  tarif                text
)
LANGUAGE plpgsql AS $$
DECLARE
  wheres    text[] := ARRAY[
               'e.visible = true',
               'e.date_debut >= CURRENT_DATE'
             ];
  where_sql text;
  count_sql text;
  main_sql  text;
  cnt       bigint;
  limit_off text := format('LIMIT %s OFFSET %s', page_size, (page_num-1)*page_size);
BEGIN

  -- Log des paramètres d'entrée
  RAISE NOTICE 'RPC search_events appelée avec: sector_ids=%, event_types=%, months=%, region_names=%, page=%/%', 
    sector_ids, event_types, months, region_names, page_num, page_size;

  -- 1) Filtrage par secteurs
  IF array_length(sector_ids,1) > 0 THEN
    wheres := wheres || format(
      'e.id IN (SELECT event_id FROM event_sectors WHERE sector_id = ANY(ARRAY[%s]::uuid[]))',
      array_to_string(
        ARRAY(SELECT quote_literal(s) FROM unnest(sector_ids) AS s),
        ','
      )
    );
    RAISE NOTICE 'Filtre secteurs ajouté: %s secteurs', array_length(sector_ids,1);
  END IF;

  -- 2) Filtrage par types d'événement
  IF array_length(event_types,1) > 0 THEN
    wheres := wheres || format(
      'e.type_event = ANY(ARRAY[%s]::text[])',
      array_to_string(
        ARRAY(SELECT quote_literal(t) FROM unnest(event_types) AS t),
        ','
      )
    );
    RAISE NOTICE 'Filtre types ajouté: %s types', array_length(event_types,1);
  END IF;

  -- 3) Filtrage par mois
  IF array_length(months,1) > 0 THEN
    wheres := wheres || format(
      'EXTRACT(MONTH FROM e.date_debut)::int = ANY(ARRAY[%s]::int[])',
      array_to_string(
        ARRAY(SELECT quote_literal(m::text) FROM unnest(months) AS m),
        ','
      )
    );
    RAISE NOTICE 'Filtre mois ajouté: %s mois', array_length(months,1);
  END IF;

  -- 4) Filtrage par région (plusieurs régions possible)
  IF array_length(region_names,1) > 0 THEN
    wheres := wheres || format(
      'e.region = ANY(ARRAY[%s]::text[])',
      array_to_string(
        ARRAY(SELECT quote_literal(r) FROM unnest(region_names) AS r),
        ','
      )
    );
    RAISE NOTICE 'Filtre régions ajouté: %s régions', array_length(region_names,1);
  END IF;

  -- Construction du WHERE
  where_sql := array_to_string(wheres, ' AND ');
  RAISE NOTICE 'WHERE final construit: %', where_sql;

  -- 5) Comptage total
  count_sql := format('SELECT COUNT(DISTINCT e.id) FROM events e WHERE %s', where_sql);
  RAISE NOTICE 'SQL de comptage: %', count_sql;
  EXECUTE count_sql INTO cnt;
  RAISE NOTICE 'Total trouvé: %s événements', cnt;

  -- 6) Requête principale avec LIMIT/OFFSET
  main_sql := format($q$
    SELECT DISTINCT
      e.id, e.nom_event, e.description_event, e.date_debut, e.date_fin,
      e.secteur, e.ville, e.region, e.pays, e.nom_lieu, e.url_image,
      e.tags, e.affluence, e.estimated_exhibitors, e.is_b2b, e.type_event,
      e.created_at, e.updated_at, e.last_scraped_at, e.scraped_from,
      e.rue, e.visible, e.slug,
      %L::bigint AS total_count,
      e.code_postal, e.url_site_officiel, e.tarif
    FROM events e
    WHERE %s
    ORDER BY e.date_debut ASC
    %s
  $q$, cnt, where_sql, limit_off);

  RAISE NOTICE 'SQL principal: %', main_sql;
  RAISE NOTICE 'Exécution avec LIMIT %s OFFSET %s', page_size, (page_num-1)*page_size;

  RETURN QUERY EXECUTE main_sql;
  
  -- Log final
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Résultats retournés: %s événements sur cette page', cnt;
END;
$$;
