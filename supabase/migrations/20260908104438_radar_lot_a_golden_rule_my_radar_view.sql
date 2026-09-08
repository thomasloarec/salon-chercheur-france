-- =====================================================================
-- Lot A (3/3) : get_my_radar_view.
-- Applique en prod le 08/09/2026 via Supabase MCP.
--
-- Onzieme fonction appliquant la regle d'or, decouverte apres coup : elle
-- ne passe pas par radar_active_import_id, elle reimplemente la resolution
-- de l'import actif, sans exclure les imports manuels. Deux correctifs :
--   1. exclure source_type = 'manual' de cette resolution locale ;
--   2. remplacer la branche morte `import_id is null` par l'import manuel.
--
-- Le test de flux `if v_import_id is null then` (parametre p_import_id non
-- fourni) doit rester intact : un garde-fou le verifie explicitement.
-- =====================================================================
do $rewrite$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_src_where constant text := '    where i.radar_account_id = v_account_id' || E'\n' ||
                               '      and exists (select 1 from public.crm_companies c where c.import_id = i.id)';
  v_new_where constant text := '    where i.radar_account_id = v_account_id' || E'\n' ||
                               '      and i.source_type <> ''manual''' || E'\n' ||
                               '      and exists (select 1 from public.crm_companies c where c.import_id = i.id)';
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_my_radar_view';

  if v_oid is null then raise exception 'FONCTION_ABSENTE | get_my_radar_view'; end if;

  v_def := pg_get_functiondef(v_oid);

  if position('(import_id = v_import_id or import_id is null)' in v_def) = 0
     or position(v_src_where in v_def) = 0 then
    raise exception 'MOTIF_ABSENT | get_my_radar_view';
  end if;

  v_new := replace(v_def, v_src_where, v_new_where);

  v_new := replace(v_new,
    '(import_id = v_import_id or import_id is null)',
    '(import_id = v_import_id or import_id = public.radar_manual_import_id(v_account_id))');

  if position('(import_id = v_import_id or import_id is null)' in v_new) > 0 then
    raise exception 'MOTIF_RESIDUEL | get_my_radar_view';
  end if;
  if position('i.source_type <> ''manual''' in v_new) = 0 then
    raise exception 'EXCLUSION_MANUAL_ECHOUEE | get_my_radar_view';
  end if;
  if position('if v_import_id is null then' in v_new) = 0 then
    raise exception 'TEST_DE_FLUX_PERDU | get_my_radar_view';
  end if;

  execute v_new;
end
$rewrite$;
