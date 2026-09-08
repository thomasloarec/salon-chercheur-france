-- =====================================================================
-- Lot B (4/5) : application de la veille aux canaux de notification.
-- Applique en prod le 08/09/2026 via Supabase MCP.
--   - radar_notify_prep_reminder et radar_notify_salons_live : un compte
--     en veille n'est pas compte ;
--   - crm_run_matching : chaque entree de newMatches porte desormais un
--     drapeau `notifiable`, consomme par radar-crm-rematch-cron ;
--   - radar_notify_hot_prospects : deja silencieux par construction, il
--     exige relationship_status = 'prospect_chaud'. Non modifie.
-- Reecriture mecanique avec garde-fous.
-- =====================================================================
do $rewrite$
declare
  r record;
  v_def text;
  v_new text;
  v_seen int := 0;
  v_src constant text := '      and (c.import_id = public.radar_active_import_id(m.radar_account_id) or c.import_id = public.radar_manual_import_id(m.radar_account_id))';
  v_dst constant text := '      and (c.import_id = public.radar_active_import_id(m.radar_account_id) or c.import_id = public.radar_manual_import_id(m.radar_account_id))' || E'\n' ||
                         '      and not public.radar_company_in_veille(m.radar_account_id, c.import_id, public.radar_company_key(c.normalized_domain, c.company_name))';
  v_match_src constant text := '      c.import_id,' || E'\n' || '      m.id_exposant,';
  v_match_dst constant text := '      c.import_id,' || E'\n' ||
                               '      (not public.radar_company_in_veille(c.radar_account_id, c.import_id, public.radar_company_key(c.normalized_domain, c.company_name))) AS notifiable,' || E'\n' ||
                               '      m.id_exposant,';
begin
  for r in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('radar_notify_prep_reminder','radar_notify_salons_live')
    order by p.proname
  loop
    v_seen := v_seen + 1;
    v_def := pg_get_functiondef(r.oid);
    if position(v_src in v_def) = 0 then
      raise exception 'MOTIF_ABSENT | %', r.proname;
    end if;
    v_new := replace(v_def, v_src, v_dst);
    if position('radar_company_in_veille' in v_new) = 0 then
      raise exception 'FILTRE_NON_APPLIQUE | %', r.proname;
    end if;
    execute v_new;
  end loop;

  if v_seen <> 2 then
    raise exception 'NOMBRE_DE_FONCTIONS_INATTENDU | attendu 2, trouve %', v_seen;
  end if;

  select p.oid into r
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'crm_run_matching';

  v_def := pg_get_functiondef(r.oid);
  if position(v_match_src in v_def) = 0 then
    raise exception 'MOTIF_ABSENT | crm_run_matching';
  end if;
  v_new := replace(v_def, v_match_src, v_match_dst);
  if position('AS notifiable' in v_new) = 0 then
    raise exception 'DRAPEAU_NON_APPLIQUE | crm_run_matching';
  end if;
  execute v_new;
end
$rewrite$;
