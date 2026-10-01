-- 20261001190000_radar_table_rase_imports.sql
-- Radar CRM : une nouvelle source CRM remplace TOUTES les précédentes (table rase).
--
-- Constat 01/10/2026 (compte admin@lotexpo.com) : les anciens imports (test.xlsx,
-- radar_crm_demo_40_entreprises.xlsx, entreprises_radar_crm.csv, entreprise CRM Standex.xlsx)
-- étaient toujours en base. Seul HubSpot était censé compter, mais :
--   - le rematch quotidien recalcule les correspondances de TOUS les imports et envoie
--     des notifications « Nouvelle opportunité » pour les anciens ;
--   - ces notifications portent ?importId=<ancien import>, et la page Radar affiche
--     alors l'ancien fichier (ex. Business Hydro : 124 comptes de test.xlsx).
--
-- Correctifs :
--   1. radar_purge_stale_imports() : supprime les imports non manuels autres que celui à garder
--      (cascade : entreprises, correspondances, alertes) + leurs notifications Radar.
--   2. Trigger sur crm_imports : dès qu'un import non manuel passe à « completed » avec des
--      entreprises (fichier, CSV ou HubSpot), les autres imports non manuels du compte sont purgés.
--   3. crm_run_matching : ne calcule plus rien pour un import qui n'est ni l'actif ni les
--      ajouts manuels (plus de notification venant d'un vieil import).
--   4. get_my_radar_view : un importId périmé dans un lien est ignoré, l'import actif est affiché.
--   5. get_my_radar_event_matches : utilise l'import actif + les ajouts manuels (règle d'or).
--   6. Nettoyage immédiat de tous les comptes.
--
-- Conservé : les « Ajouts manuels » (entreprises ajoutées à la main dans Radar), les préférences
-- (étoiles, ignorés, statuts) et les missions/notes, rattachés au domaine de l'entreprise : ils
-- se raccrochent automatiquement si l'entreprise existe dans le nouveau CRM.
-- Les patchs 3 à 5 relisent la définition actuelle des fonctions et s'arrêtent sans rien modifier
-- si le texte attendu n'est pas trouvé exactement une fois.

-- 1. Purge ---------------------------------------------------------------------------------
create or replace function public.radar_purge_stale_imports(p_account_id uuid, p_keep_import_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if p_account_id is null or p_keep_import_id is null then
    return 0;
  end if;

  with del as (
    delete from public.crm_imports i
    where i.radar_account_id = p_account_id
      and i.id <> p_keep_import_id
      and i.source_type <> 'manual'
      and i.status <> 'processing'
    returning i.id
  )
  select coalesce(array_agg(id), array[]::uuid[]) into v_ids from del;

  if array_length(v_ids, 1) > 0 then
    delete from public.notifications n
    where n.type = 'radar_new_matches'
      and n.metadata->>'importId' = any (select x::text from unnest(v_ids) x);
  end if;

  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

revoke all on function public.radar_purge_stale_imports(uuid, uuid) from public;
revoke all on function public.radar_purge_stale_imports(uuid, uuid) from anon;
revoke all on function public.radar_purge_stale_imports(uuid, uuid) from authenticated;

-- 2. Trigger table rase --------------------------------------------------------------------
create or replace function public.crm_imports_table_rase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from 'completed'
     and new.source_type <> 'manual'
     and new.radar_account_id is not null
     and exists (select 1 from public.crm_companies c where c.import_id = new.id) then
    perform public.radar_purge_stale_imports(new.radar_account_id, new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.crm_imports_table_rase() from public;
revoke all on function public.crm_imports_table_rase() from anon;
revoke all on function public.crm_imports_table_rase() from authenticated;

drop trigger if exists trg_crm_imports_table_rase on public.crm_imports;
create trigger trg_crm_imports_table_rase
  after update of status on public.crm_imports
  for each row
  execute function public.crm_imports_table_rase();

-- 3 à 5. Patchs des fonctions existantes -----------------------------------------------------
DO $patch$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  -- 3. crm_run_matching : garde « import actif ou manuel »
  v_def := pg_get_functiondef('public.crm_run_matching'::regproc);
  IF position('inactive_import' IN v_def) = 0 THEN
    v_old := E'    RAISE EXCEPTION ''Import not found or not owned by user'';\n  END IF;\n';
    IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1
       OR (length(v_def) - length(replace(v_def, E'DECLARE\n', ''))) / length(E'DECLARE\n') <> 1 THEN
      RAISE EXCEPTION 'crm_run_matching : texte attendu introuvable, migration arrêtée';
    END IF;
    v_new := v_old || $g$
  -- Table rase : rien n'est calculé ni notifié pour un ancien import.
  SELECT radar_account_id INTO v_acc FROM public.crm_imports WHERE id = p_import_id;
  IF v_acc IS NOT NULL
     AND p_import_id IS DISTINCT FROM public.radar_active_import_id(v_acc)
     AND p_import_id IS DISTINCT FROM public.radar_manual_import_id(v_acc) THEN
    RETURN jsonb_build_object(
      'matchesCount', 0, 'totalCompanies', 0, 'matchedCompaniesCount', 0,
      'unmatchedCompaniesCount', 0, 'futureMatchesCount', 0, 'pastMatchesCount', 0,
      'newMatches', '[]'::jsonb, 'needsReviewCount', 0, 'suspiciousRate', null,
      'skipped', 'inactive_import');
  END IF;
$g$;
    v_def := replace(v_def, v_old, v_new);
    v_def := replace(v_def, E'DECLARE\n', E'DECLARE\n  v_acc uuid;\n');
    EXECUTE v_def;
  END IF;

  -- 4. get_my_radar_view : un importId périmé est ignoré
  v_def := pg_get_functiondef('public.get_my_radar_view'::regproc);
  IF position('importId périmé' IN v_def) = 0 THEN
    v_old := E'  if v_import_id is null then\n    select i.id into v_import_id from public.crm_imports i';
    IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
      RAISE EXCEPTION 'get_my_radar_view : texte attendu introuvable, migration arrêtée';
    END IF;
    v_new := E'  -- importId périmé (ancien lien de notification) : on affiche l''import actif.\n'
          || E'  if v_import_id is distinct from public.radar_active_import_id(v_account_id) then\n'
          || E'    v_import_id := null;\n'
          || E'  end if;\n\n'
          || v_old;
    EXECUTE replace(v_def, v_old, v_new);
  END IF;

  -- 5. get_my_radar_event_matches : import actif + ajouts manuels
  v_def := pg_get_functiondef('public.get_my_radar_event_matches'::regproc);
  IF position('radar_active_import_id' IN v_def) = 0 THEN
    IF (SELECT count(*) FROM regexp_matches(v_def,
          'select i\.id into v_import_id from public\.crm_imports i.*?order by i\.created_at desc limit 1;', 'g')) <> 1
       OR (length(v_def) - length(replace(v_def, 'and import_id = v_import_id', ''))) / length('and import_id = v_import_id') <> 1 THEN
      RAISE EXCEPTION 'get_my_radar_event_matches : texte attendu introuvable, migration arrêtée';
    END IF;
    v_def := regexp_replace(v_def,
      'select i\.id into v_import_id from public\.crm_imports i.*?order by i\.created_at desc limit 1;',
      'v_import_id := public.radar_active_import_id(v_account_id);');
    v_def := replace(v_def, 'and import_id = v_import_id',
      'and (import_id = v_import_id or import_id = public.radar_manual_import_id(v_account_id))');
    EXECUTE v_def;
  END IF;
END
$patch$;

-- 6. Nettoyage immédiat ----------------------------------------------------------------------
DO $cleanup$
DECLARE
  r record;
  v_total integer := 0;
BEGIN
  FOR r IN
    SELECT a.id, public.radar_active_import_id(a.id) AS keep_id
    FROM public.radar_accounts a
    WHERE a.deleted_at IS NULL
  LOOP
    IF r.keep_id IS NOT NULL THEN
      v_total := v_total + public.radar_purge_stale_imports(r.id, r.keep_id);
    END IF;
  END LOOP;

  -- Notifications Radar qui pointent vers un import qui n'existe plus.
  DELETE FROM public.notifications n
  WHERE n.type = 'radar_new_matches'
    AND n.metadata ? 'importId'
    AND NOT EXISTS (SELECT 1 FROM public.crm_imports i WHERE i.id::text = n.metadata->>'importId');

  RAISE NOTICE 'Imports périmés supprimés : %', v_total;
END
$cleanup$;

-- Vérification après exécution :
-- select a.name, i.source_type, i.file_name, (select count(*) from crm_companies c where c.import_id = i.id) entreprises
-- from crm_imports i join radar_accounts a on a.id = i.radar_account_id order by 1, i.created_at desc;
-- attendu pour admin@lotexpo.com : uniquement HubSpot (auto) + Ajouts manuels.
