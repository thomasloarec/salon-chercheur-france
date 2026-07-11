CREATE OR REPLACE FUNCTION public.upsert_exhibitor_enrichment(
  p_exhibitor_id      text,
  p_source_url        text,
  p_source_table      text,
  p_macro             text,
  p_sous_secteurs     text[],
  p_produits_services jsonb,
  p_mots_cles_metier  jsonb,
  p_profils_visiteurs jsonb,
  p_type_interet      jsonb,
  p_resume_court      text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sector_id uuid;
  v_sub_ids   uuid[];
BEGIN
  SELECT id INTO v_sector_id FROM sectors WHERE name = p_macro;

  SELECT array_agg(ss.id ORDER BY x.ord) INTO v_sub_ids
  FROM unnest(p_sous_secteurs) WITH ORDINALITY AS x(nom, ord)
  JOIN sub_sectors ss ON ss.name = x.nom;

  v_sub_ids := COALESCE(v_sub_ids, '{}');

  -- macro non trouvée mais sous-secteurs présents -> déduire la macro du 1er
  IF v_sector_id IS NULL AND array_length(v_sub_ids,1) >= 1 THEN
    SELECT sector_id INTO v_sector_id FROM sub_sectors WHERE id = v_sub_ids[1];
  END IF;

  INSERT INTO exhibitor_ai (
    exhibitor_id, source_url, source_table, secteur_id, secteur_principal,
    sous_secteurs, produits_services, mots_cles_metier, profils_visiteurs,
    type_interet, resume_court, enriched_at
  ) VALUES (
    p_exhibitor_id, p_source_url, p_source_table, v_sector_id,
    (SELECT name FROM sub_sectors WHERE id = v_sub_ids[1]),
    to_jsonb(p_sous_secteurs), p_produits_services, p_mots_cles_metier,
    p_profils_visiteurs, p_type_interet, p_resume_court, now()
  )
  ON CONFLICT (exhibitor_id) DO UPDATE SET
    source_url = EXCLUDED.source_url, source_table = EXCLUDED.source_table,
    secteur_id = EXCLUDED.secteur_id, secteur_principal = EXCLUDED.secteur_principal,
    sous_secteurs = EXCLUDED.sous_secteurs, produits_services = EXCLUDED.produits_services,
    mots_cles_metier = EXCLUDED.mots_cles_metier, profils_visiteurs = EXCLUDED.profils_visiteurs,
    type_interet = EXCLUDED.type_interet, resume_court = EXCLUDED.resume_court,
    enriched_at = now();

  DELETE FROM exhibitor_sub_sectors WHERE exhibitor_id = p_exhibitor_id;

  IF array_length(v_sub_ids,1) >= 1 THEN
    INSERT INTO exhibitor_sub_sectors (exhibitor_id, sub_sector_id, is_primary)
    SELECT p_exhibitor_id, sid, (ord = 1)
    FROM unnest(v_sub_ids) WITH ORDINALITY AS u(sid, ord)
    ON CONFLICT (exhibitor_id, sub_sector_id) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_exhibitor_enrichment(text,text,text,text,text[],jsonb,jsonb,jsonb,jsonb,text) TO service_role;