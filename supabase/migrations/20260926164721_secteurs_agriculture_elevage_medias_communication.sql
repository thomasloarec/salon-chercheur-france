-- Lotexpo : ajout des secteurs « Agriculture & Élevage » et « Médias & Communication »
-- Décisions Thomas 26/09/2026 : noms validés, sous-secteurs existants déplacés, affichage accueil.
-- Aucun identifiant de sous-secteur ne change : exhibitor_sub_sectors, embeddings et
-- recommandations restent valides. Seuls les rattachements secteur (canal A et canal B)
-- et le clustering par secteur sont réalignés.

-- 1. Nouveaux secteurs
INSERT INTO public.sectors (name, description, keywords)
SELECT v.name, v.description, v.keywords
FROM (VALUES
  ('Agriculture & Élevage',
   'Agriculture, élevage, machinisme agricole, productions végétales et viticulture',
   ARRAY['agriculture','agricole','élevage','machinisme','agroéquipement','tracteur','viticulture','horticulture','semences','alimentation animale','cultures']),
  ('Médias & Communication',
   'Presse, audiovisuel, édition, publicité et communication',
   ARRAY['médias','presse','audiovisuel','édition','publicité','communication','influence','radio','télévision','cinéma','impression'])
) AS v(name, description, keywords)
WHERE NOT EXISTS (SELECT 1 FROM public.sectors s WHERE s.name = v.name);

-- 2. Déplacement des sous-secteurs existants (ids inchangés)
UPDATE public.sub_sectors ss
SET sector_id = (SELECT id FROM public.sectors WHERE name = 'Agriculture & Élevage')
WHERE ss.name IN ('Agriculture & élevage','Machines & équipements agricoles',
                  'Horticulture & production végétale','Nutrition & alimentation animale');

UPDATE public.sub_sectors ss
SET sector_id = (SELECT id FROM public.sectors WHERE name = 'Médias & Communication')
WHERE ss.name = 'Médias & édition spécialisée';

-- 3. Canal B : secteur IA aligné sur le sous-secteur principal (même règle que set_exhibitor_categories)
CREATE TEMP TABLE _moved_exh ON COMMIT DROP AS
SELECT e.exhibitor_id, ss.sector_id AS new_sector_id
FROM public.exhibitor_sub_sectors e
JOIN public.sub_sectors ss ON ss.id = e.sub_sector_id
JOIN public.sectors s ON s.id = ss.sector_id
WHERE e.is_primary
  AND s.name IN ('Agriculture & Élevage','Médias & Communication');

UPDATE public.exhibitor_ai a
SET secteur_id = m.new_sector_id
FROM _moved_exh m
WHERE a.exhibitor_id = m.exhibitor_id
  AND a.secteur_id IS DISTINCT FROM m.new_sector_id;

-- 4. Mapping des libellés bruts : secteur aligné sur le premier sous-secteur
UPDATE public.sector_label_map lm
SET sector_id = ss.sector_id
FROM public.sub_sectors ss
JOIN public.sectors s ON s.id = ss.sector_id
WHERE ss.id = lm.sub_sector_ids[1]
  AND s.name IN ('Agriculture & Élevage','Médias & Communication')
  AND lm.sector_id IS DISTINCT FROM ss.sector_id;

-- 5. Clustering : les clusters (libellés conservés) majoritairement composés d'exposants
--    déplacés sont rattachés au nouveau secteur
CREATE TEMP TABLE _reparent ON COMMIT DROP AS
SELECT tc.id AS category_id, x.new_sector_id
FROM public.taxonomy_categories tc
JOIN LATERAL (
  SELECT m.new_sector_id, count(*) AS n_moved,
         (SELECT count(*) FROM public.exhibitor_categories ec2
           WHERE ec2.category_id = tc.id AND ec2.version = tc.version) AS n_total
  FROM public.exhibitor_categories ec
  JOIN _moved_exh m ON m.exhibitor_id = ec.exhibitor_id
  WHERE ec.category_id = tc.id AND ec.version = tc.version
  GROUP BY m.new_sector_id
  ORDER BY count(*) DESC
  LIMIT 1
) x ON x.n_moved * 2 >= x.n_total
WHERE tc.secteur_id IN (SELECT id FROM public.sectors
                        WHERE name IN ('Agroalimentaire & Boissons','Éducation & Formation'));

UPDATE public.taxonomy_categories tc
SET secteur_id = r.new_sector_id
FROM _reparent r
WHERE tc.id = r.category_id;

-- 6. Désaffectation des exposants dont le cluster n'est plus dans leur secteur
--    (déplacés, ou restés dans un cluster rattaché ailleurs). Réaffectés juste après.
DELETE FROM public.exhibitor_categories ec
USING public.taxonomy_categories tc, public.exhibitor_ai a
WHERE tc.id = ec.category_id
  AND a.exhibitor_id = ec.exhibitor_id
  AND a.secteur_id IS DISTINCT FROM tc.secteur_id
  AND (ec.exhibitor_id IN (SELECT exhibitor_id FROM _moved_exh)
       OR ec.category_id IN (SELECT category_id FROM _reparent));

SELECT public.assign_pending_categories(1);

-- 7. Tailles de clusters recalculées pour les secteurs touchés
UPDATE public.taxonomy_categories tc
SET size = (SELECT count(*) FROM public.exhibitor_categories ec
            WHERE ec.category_id = tc.id AND ec.version = tc.version)
WHERE tc.secteur_id IN (SELECT id FROM public.sectors WHERE name IN
  ('Agroalimentaire & Boissons','Éducation & Formation','Agriculture & Élevage','Médias & Communication'));

-- 8. Garde-fou durable : le secteur IA suit toujours le sous-secteur principal reconnu
--    (avant : la macro renvoyée par le modèle primait, source d'incohérence).
CREATE OR REPLACE FUNCTION public.upsert_exhibitor_enrichment(p_exhibitor_id text, p_source_url text, p_source_table text, p_macro text, p_sous_secteurs text[], p_produits_services jsonb, p_mots_cles_metier jsonb, p_profils_visiteurs jsonb, p_type_interet jsonb, p_resume_court text, p_pass_label text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sector_id uuid;
  v_sub_ids uuid[];
  v_canonical_names jsonb;
  v_locked boolean;
  v_has_match boolean;
  v_outcome text;
begin
  v_locked := coalesce(exhibitor_categories_locked(p_exhibitor_id), false);

  select id into v_sector_id from sectors where name = p_macro;

  select array_agg(ss.id order by x.ord) into v_sub_ids
  from unnest(p_sous_secteurs) with ordinality as x(nom, ord)
  join sub_sectors ss on ss.name = x.nom;
  v_sub_ids := coalesce(v_sub_ids, '{}');

  v_has_match := coalesce(array_length(v_sub_ids, 1), 0) >= 1;

  -- Le secteur suit le sous-secteur principal reconnu (cohérence canal A / canal B)
  if v_has_match then
    select sector_id into v_sector_id from sub_sectors where id = v_sub_ids[1];
  end if;

  -- Noms canoniques résolus, dans l'ordre, plafonnés à 3 comme le rattachement.
  select jsonb_agg(ss.name order by u.ord) into v_canonical_names
  from unnest(v_sub_ids) with ordinality as u(sid, ord)
  join sub_sectors ss on ss.id = u.sid
  where u.ord <= 3;

  v_outcome := case when v_locked then 'locked'
                    when v_has_match then 'applied'
                    else 'no_match' end;

  insert into exhibitor_ai (
    exhibitor_id, source_url, source_table, secteur_id, secteur_principal,
    sous_secteurs, produits_services, mots_cles_metier, profils_visiteurs,
    type_interet, resume_court, enriched_at, reclass_pass, reclass_at, reclass_outcome)
  values (
    p_exhibitor_id, p_source_url, p_source_table,
    case when v_locked then null else v_sector_id end,
    case when v_locked or not v_has_match then null
         else (select name from sub_sectors where id = v_sub_ids[1]) end,
    case when v_locked or not v_has_match then '[]'::jsonb
         else coalesce(v_canonical_names, '[]'::jsonb) end,
    p_produits_services, p_mots_cles_metier, p_profils_visiteurs,
    p_type_interet, p_resume_court, now(),
    p_pass_label, case when p_pass_label is null then null else now() end,
    case when p_pass_label is null then null else v_outcome end)
  on conflict (exhibitor_id) do update set
    source_url        = excluded.source_url,
    source_table      = excluded.source_table,
    produits_services = excluded.produits_services,
    mots_cles_metier  = excluded.mots_cles_metier,
    profils_visiteurs = excluded.profils_visiteurs,
    type_interet      = excluded.type_interet,
    resume_court      = excluded.resume_court,
    enriched_at       = now(),
    reclass_pass      = coalesce(excluded.reclass_pass, exhibitor_ai.reclass_pass),
    reclass_at        = coalesce(excluded.reclass_at, exhibitor_ai.reclass_at),
    reclass_outcome   = coalesce(excluded.reclass_outcome, exhibitor_ai.reclass_outcome),
    secteur_id        = case when v_locked or not v_has_match
                             then exhibitor_ai.secteur_id else excluded.secteur_id end,
    secteur_principal = case when v_locked or not v_has_match
                             then exhibitor_ai.secteur_principal else excluded.secteur_principal end,
    sous_secteurs     = case when v_locked or not v_has_match
                             then exhibitor_ai.sous_secteurs else excluded.sous_secteurs end;

  if v_locked then return; end if;
  if not v_has_match then return; end if;

  delete from exhibitor_sub_sectors where exhibitor_id = p_exhibitor_id;

  insert into exhibitor_sub_sectors (exhibitor_id, sub_sector_id, is_primary, source, position)
  select p_exhibitor_id, sid, (ord = 1), 'ai', ord::smallint
  from unnest(v_sub_ids) with ordinality as u(sid, ord)
  where ord <= 3
  on conflict (exhibitor_id, sub_sector_id) do nothing;
end;
$function$;

NOTIFY pgrst, 'reload schema';
