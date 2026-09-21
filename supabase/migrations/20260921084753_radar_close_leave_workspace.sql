-- =========================================================================
-- 20260921084753_radar_close_leave_workspace.sql
-- Radar CRM : suppression correcte par ESPACE (remplace le no-op user-scoped)
--
--   radar_close_workspace(p_account_id uuid default null)
--     -> owner : purge complete de l'espace + tombstone (deleted_at)
--   radar_leave_workspace(p_account_id uuid default null)
--     -> membre : quitte l'espace, le contenu partage reste a l'equipe
--
-- p_account_id null => l'espace actif est resolu cote serveur via
-- radar_current_account_id(auth.uid()), comme le reste de l'app.
--
-- L'ancienne delete_my_radar_crm_data() est CONSERVEE (inoffensive) le temps
-- de basculer le front, puis pourra etre supprimee dans une migration suivante.
--
-- Applique en prod le 2026-09-21 via Supabase MCP (apply_migration).
-- Verifie empiriquement sur donnees reelles (compte Standex) en transaction
-- annulee : close purge companies/imports/matches/alerts/missions(+notes,taches,
-- voice via cascade)/offer_profile/relationships/company_prefs/event_participants/
-- access_requests/invitations, revoque les membres, pose deleted_at ; leave
-- revoque l'appartenance de l'appelant, bloque l'owner unique (sole_owner_must_close),
-- et ne purge les donnees user-global que s'il ne reste aucun espace actif.
-- =========================================================================

create or replace function public.radar_close_workspace(p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_acct uuid;
  v_imports int; v_companies int; v_matches int; v_alerts int; v_missions int;
  v_offer int; v_rel int; v_prefs int; v_parts int; v_reqs int; v_invs int; v_members int;
  v_remaining int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_acct := coalesce(p_account_id, public.radar_current_account_id(v_uid));
  if v_acct is null then raise exception 'no_active_space'; end if;
  if not (public.is_admin() or public.is_radar_owner(v_acct, v_uid)) then
    raise exception 'forbidden';
  end if;

  -- comptages avant purge (pour le retour)
  select count(*) into v_companies from crm_companies             where radar_account_id = v_acct;
  select count(*) into v_imports   from crm_imports               where radar_account_id = v_acct;
  select count(*) into v_matches   from crm_company_event_matches where radar_account_id = v_acct;
  select count(*) into v_missions  from radar_missions            where radar_account_id = v_acct;

  -- alertes liees aux entreprises de l'espace (crm_event_alerts n'a pas de radar_account_id)
  delete from crm_event_alerts
   where crm_company_id in (select id from crm_companies where radar_account_id = v_acct);
  get diagnostics v_alerts = row_count;

  -- contenu radar_* NON cascade par la FK compte (piege suppression partielle)
  delete from radar_missions             where radar_account_id = v_acct;  -- cascade notes/taches/voice via mission_id
  delete from radar_offer_profile        where radar_account_id = v_acct;  get diagnostics v_offer = row_count;
  delete from radar_company_relationship where radar_account_id = v_acct;  get diagnostics v_rel = row_count;
  delete from radar_company_prefs        where radar_account_id = v_acct;  get diagnostics v_prefs = row_count;
  delete from radar_event_participants   where radar_account_id = v_acct;  get diagnostics v_parts = row_count;
  delete from radar_access_requests      where radar_account_id = v_acct;  get diagnostics v_reqs = row_count;
  delete from radar_invitations          where radar_account_id = v_acct;  get diagnostics v_invs = row_count;

  -- donnees crm_* de l'espace (companies avant imports : FK import_id)
  delete from crm_company_event_matches where radar_account_id = v_acct;
  delete from crm_companies             where radar_account_id = v_acct;
  delete from crm_imports               where radar_account_id = v_acct;

  -- revoquer tous les membres actifs de l'espace
  update radar_members set status='revoked', is_primary=false, updated_at=now()
   where radar_account_id = v_acct and status='active';
  get diagnostics v_members = row_count;

  -- tombstone de l'espace (convention deleted_at, coherente avec le reste)
  update radar_accounts set deleted_at=now(), updated_at=now() where id = v_acct;

  -- nettoyage perso de l'appelant s'il ne lui reste AUCUN espace actif
  select count(*) into v_remaining
    from radar_members m join radar_accounts a on a.id = m.radar_account_id
   where m.user_id = v_uid and m.status='active' and a.deleted_at is null;
  if v_remaining = 0 then
    delete from crm_notification_preferences where user_id = v_uid;
    delete from crm_usage_events where user_id = v_uid
      and (metadata->>'source' = 'radar_crm' or event_type like 'crm_%' or event_type like 'radar_%');
    delete from crm_event_alerts where user_id = v_uid;
    delete from radar_email_log   where user_id = v_uid;
    delete from crm_connections   where user_id = v_uid;
    delete from radar_access_requests where user_id = v_uid;
  end if;

  return jsonb_build_object(
    'success', true,
    'action', 'closed',
    'account_id', v_acct,
    'deleted', jsonb_build_object(
      'imports', v_imports, 'companies', v_companies, 'matches', v_matches,
      'alerts', v_alerts, 'missions', v_missions, 'offer_profile', v_offer,
      'relationships', v_rel, 'company_prefs', v_prefs, 'event_participants', v_parts,
      'access_requests', v_reqs, 'invitations', v_invs, 'members_revoked', v_members
    ),
    'personal_purged', (v_remaining = 0)
  );
end;
$function$;

create or replace function public.radar_leave_workspace(p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_acct uuid;
  v_role text; v_status text;
  v_owners int; v_remaining int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_acct := coalesce(p_account_id, public.radar_current_account_id(v_uid));
  if v_acct is null then raise exception 'no_active_space'; end if;

  select role, status into v_role, v_status
    from radar_members where radar_account_id = v_acct and user_id = v_uid;
  if v_role is null then raise exception 'not_a_member'; end if;
  if v_status <> 'active' then
    return jsonb_build_object('success', true, 'action', 'noop', 'account_id', v_acct);
  end if;

  -- un owner unique ne peut pas "quitter" : il doit fermer l'espace
  if v_role = 'owner' then
    select count(*) into v_owners from radar_members
     where radar_account_id = v_acct and status='active' and role='owner';
    if v_owners <= 1 then raise exception 'sole_owner_must_close'; end if;
  end if;

  update radar_members set status='revoked', is_primary=false, updated_at=now()
   where radar_account_id = v_acct and user_id = v_uid;

  -- le contenu partage (missions/notes/taches cree par l'appelant) reste a l'equipe

  select count(*) into v_remaining
    from radar_members m join radar_accounts a on a.id = m.radar_account_id
   where m.user_id = v_uid and m.status='active' and a.deleted_at is null;
  if v_remaining = 0 then
    delete from crm_notification_preferences where user_id = v_uid;
    delete from crm_usage_events where user_id = v_uid
      and (metadata->>'source' = 'radar_crm' or event_type like 'crm_%' or event_type like 'radar_%');
    delete from crm_event_alerts where user_id = v_uid;
    delete from radar_email_log   where user_id = v_uid;
    delete from crm_connections   where user_id = v_uid;
    delete from radar_access_requests where user_id = v_uid;
  end if;

  return jsonb_build_object(
    'success', true, 'action', 'left', 'account_id', v_acct,
    'personal_purged', (v_remaining = 0), 'remaining_spaces', v_remaining
  );
end;
$function$;

-- Grants (REVOKE anon explicite : REVOKE PUBLIC seul est insuffisant sur cette instance)
revoke all on function public.radar_close_workspace(uuid) from public;
revoke all on function public.radar_close_workspace(uuid) from anon;
grant execute on function public.radar_close_workspace(uuid) to authenticated;
grant execute on function public.radar_close_workspace(uuid) to service_role;

revoke all on function public.radar_leave_workspace(uuid) from public;
revoke all on function public.radar_leave_workspace(uuid) from anon;
grant execute on function public.radar_leave_workspace(uuid) to authenticated;
grant execute on function public.radar_leave_workspace(uuid) to service_role;

notify pgrst, 'reload schema';
