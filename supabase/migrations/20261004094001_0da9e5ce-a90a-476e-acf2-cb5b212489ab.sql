-- Assistant salons, lot 5 bis (04/10/2026, retours de Thomas)
-- 1. Emails de l'assistant activés par défaut pour les nouveaux assistants.
-- 2. Recherche complète plus rapide après une action explicite (rattachement d'un compte, régions modifiées,
--    fin du parcours /agenda/creer ou du mode Modifier) : elle part dans la minute au lieu d'attendre
--    5 à 10 minutes. Les « Pas pour moi » gardent leur délai de 5 minutes (on attend la fin de la série).
--    Nouvelle colonne refresh_fast ; tâche assistant-refresh-feedback passée de 5 minutes à chaque minute.
-- 3. Alertes : les nouvelles conférences et les nouveaux stands d'un salon que le visiteur a déjà ajouté à son
--    agenda sont aussi signalés (c'était exclu par erreur au lot 5).
-- Les fonctions existantes sont modifiées par remplacement de texte vérifié.

alter table public.assistant_profiles alter column email_alerts_opt_in set default true;
alter table public.assistant_profiles add column if not exists refresh_fast boolean not null default false;

create or replace function pg_temp.lotexpo_patch(p_fn regprocedure, p_old text, p_new text)
returns void
language plpgsql
as $$
declare
  v_def text := pg_get_functiondef(p_fn);
begin
  if position(p_old in v_def) = 0 then
    raise exception 'Lot 5 bis : texte attendu introuvable dans % : %', p_fn, left(p_old, 80);
  end if;
  execute replace(v_def, p_old, p_new);
end
$$;

-- Dispatch : une demande « rapide » part sans attendre 5 minutes ; le drapeau est levé au départ.
select pg_temp.lotexpo_patch('public.assistant_dispatch_refresh(integer)'::regprocedure,
  'and ap.refresh_requested_at < now() - interval ''5 minutes''',
  'and (ap.refresh_fast or ap.refresh_requested_at < now() - interval ''5 minutes'')');
select pg_temp.lotexpo_patch('public.assistant_dispatch_refresh(integer)'::regprocedure,
  '       set refresh_dispatched_at = now(), refresh_attempts = refresh_attempts + 1',
  '       set refresh_dispatched_at = now(), refresh_attempts = refresh_attempts + 1, refresh_fast = false');

-- Rattachement à un compte : recherche complète rapide
select pg_temp.lotexpo_patch('public.assistant_claim_profile(uuid,uuid)'::regprocedure,
  'refresh_requested_at = now(), refresh_attempts = 0, updated_at = now()',
  'refresh_requested_at = now(), refresh_attempts = 0, refresh_fast = true, updated_at = now()');

-- Régions modifiées : recherche rapide
select pg_temp.lotexpo_patch('public.assistant_set_my_regions(text[])'::regprocedure,
  'refresh_requested_at = case when v_redo then now() else refresh_requested_at end,',
  'refresh_requested_at = case when v_redo then now() else refresh_requested_at end, refresh_fast = case when v_redo then true else refresh_fast end,');

-- Alertes : inclure les salons déjà ajoutés à l'agenda (statut « added ») pour les conférences et stands
select pg_temp.lotexpo_patch('public.assistant_alerts_collect(text,uuid,boolean)'::regprocedure,
  'on s.profile_id = m.profile_id and s.event_id = m.event_id and s.status in (''pending'', ''notified'', ''seen'')',
  'on s.profile_id = m.profile_id and s.event_id = m.event_id and s.status in (''pending'', ''notified'', ''seen'', ''added'')');

-- Tâche planifiée : chaque minute
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'assistant-refresh-feedback') then
    raise exception 'Lot 5 bis : tâche assistant-refresh-feedback introuvable';
  end if;
  perform cron.alter_job(
    (select jobid from cron.job where jobname = 'assistant-refresh-feedback'),
    schedule := '* * * * *');
end
$$;

-- Contrôles
do $$
begin
  if position('refresh_fast' in pg_get_functiondef('public.assistant_dispatch_refresh(integer)'::regprocedure)) = 0
     or position('refresh_fast' in pg_get_functiondef('public.assistant_claim_profile(uuid,uuid)'::regprocedure)) = 0
     or position('refresh_fast' in pg_get_functiondef('public.assistant_set_my_regions(text[])'::regprocedure)) = 0
     or position('''seen'', ''added'')' in pg_get_functiondef('public.assistant_alerts_collect(text,uuid,boolean)'::regprocedure)) = 0 then
    raise exception 'Contrôle : une fonction n''a pas été modifiée';
  end if;
  if (select schedule from cron.job where jobname = 'assistant-refresh-feedback') <> '* * * * *' then
    raise exception 'Contrôle : la tâche planifiée n''a pas été modifiée';
  end if;
  if (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'assistant_profiles' and column_name = 'email_alerts_opt_in') <> 'true' then
    raise exception 'Contrôle : valeur par défaut des emails non modifiée';
  end if;
end
$$;

notify pgrst, 'reload schema';