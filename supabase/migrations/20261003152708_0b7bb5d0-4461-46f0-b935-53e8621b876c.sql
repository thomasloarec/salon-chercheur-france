-- Assistant « Pépites », lot 4 ter : une pépite aimée reste une pépite.
-- Constat du 03/10 : après la relance du profil Standex, une Nouveauté ajoutée à l'agenda a été relue
-- et rejetée (note 55). Le moteur la conserve désormais telle quelle ; la vue de contrôle signale
-- tout cas contraire (« pepite_aimee_retiree »). Même colonnes qu'avant, droits conservés.

create or replace view public.assistant_feedback_violations
with (security_invoker = true) as
select f.profile_id, 'pepite_refusee_revenue'::text as probleme,
       f.item_type, f.item_id, f.event_id, f.created_at
from public.assistant_feedback f
join public.assistant_matches m
  on m.profile_id = f.profile_id and m.item_type = f.item_type and m.item_id = f.item_id
 and m.status = 'retained'
where f.undone_at is null and f.signal = 'pas_pour_moi'
union all
select f.profile_id, 'salon_refuse_resuggere'::text,
       null::text, null::uuid, s.event_id, f.created_at
from public.assistant_feedback f
join public.assistant_suggestions s
  on s.profile_id = f.profile_id and s.status in ('pending', 'notified')
 and (s.event_id = f.event_id
      or (f.reason = 'pas_interesse' and f.series_id is not null
          and s.event_id in (select e.id from public.events e where e.series_id = f.series_id)))
where f.undone_at is null and f.signal = 'je_n_irai_pas'
union all
select f.profile_id, 'pepite_aimee_retiree'::text,
       f.item_type, f.item_id, f.event_id, f.created_at
from public.assistant_feedback f
join public.assistant_matches m
  on m.profile_id = f.profile_id and m.item_type = f.item_type and m.item_id = f.item_id
 and m.status <> 'retained'
where f.undone_at is null and f.signal in ('agenda', 'inscription', 'rdv');

revoke all on public.assistant_feedback_violations from anon, authenticated;

notify pgrst, 'reload schema';