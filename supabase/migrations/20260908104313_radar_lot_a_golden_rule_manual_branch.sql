-- =====================================================================
-- Lot A (2/3) : seconde branche de la regle d'or dans 10 fonctions.
-- Applique en prod le 08/09/2026 via Supabase MCP.
--
-- La branche historique `import_id IS NULL` est morte depuis que
-- crm_companies.import_id est NOT NULL. Elle est remplacee par
-- `import_id = <import manuel du compte>`.
--
-- Reecriture mecanique a partir de pg_get_functiondef, avec garde-fous :
-- toute divergence par rapport au motif attendu leve une exception et
-- annule l'ensemble de la migration.
--
-- Fonctions touchees : apply_radar_mission_strategy,
-- get_radar_mission_context, get_radar_onboarding_progress,
-- get_radar_salon_missions, get_radar_salon_similar,
-- get_radar_similar_counts, search_radar_salon_exposants,
-- radar_notify_hot_prospects, radar_notify_prep_reminder,
-- radar_notify_salons_live.
-- =====================================================================
do $rewrite$
declare
  r record;
  v_def text;
  v_new text;
  v_vars text[] := array[
    'apply_radar_mission_strategy','get_radar_mission_context',
    'get_radar_onboarding_progress','get_radar_salon_missions',
    'get_radar_salon_similar','get_radar_similar_counts',
    'search_radar_salon_exposants'
  ];
  v_notify text[] := array[
    'radar_notify_hot_prospects','radar_notify_prep_reminder','radar_notify_salons_live'
  ];
  v_seen int := 0;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(v_vars || v_notify)
    order by p.proname
  loop
    v_seen := v_seen + 1;
    v_def := pg_get_functiondef(r.oid);

    if position('import_id is null' in v_def) = 0 then
      raise exception 'MOTIF_ABSENT | %', r.proname;
    end if;

    if r.proname = any(v_notify) then
      v_new := replace(v_def,
        'or c.import_id is null)',
        'or c.import_id = public.radar_manual_import_id(m.radar_account_id))');
    else
      v_new := replace(v_def,
        'v_import_id uuid;',
        'v_import_id uuid; v_manual_import_id uuid;');
      v_new := replace(v_new,
        'v_import_id := public.radar_active_import_id(v_account_id);',
        'v_import_id := public.radar_active_import_id(v_account_id); v_manual_import_id := public.radar_manual_import_id(v_account_id);');
      v_new := replace(v_new, 'or cc2.import_id is null)', 'or cc2.import_id = v_manual_import_id)');
      v_new := replace(v_new, 'or cc.import_id is null)',  'or cc.import_id = v_manual_import_id)');
      v_new := replace(v_new, 'or c.import_id is null)',   'or c.import_id = v_manual_import_id)');
      v_new := replace(v_new, 'or import_id is null)',     'or import_id = v_manual_import_id)');

      if position('v_manual_import_id uuid' in v_new) = 0
         or position('v_manual_import_id := public.radar_manual_import_id' in v_new) = 0 then
        raise exception 'DECLARATION_OU_AFFECTATION_ECHOUEE | %', r.proname;
      end if;
    end if;

    if position('import_id is null' in v_new) > 0 then
      raise exception 'MOTIF_RESIDUEL | %', r.proname;
    end if;

    execute v_new;
  end loop;

  if v_seen <> 10 then
    raise exception 'NOMBRE_DE_FONCTIONS_INATTENDU | attendu 10, trouve %', v_seen;
  end if;
end
$rewrite$;
