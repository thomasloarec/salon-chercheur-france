-- Lot 0 : exclusion des exposants a domaine etranger (30/09/2026)
-- Regle validee par Thomas : les extensions nationales etrangeres non francophones
-- sont exclues d'office. Les extensions generiques (.com, .eu, .io, .ai...) et
-- francophones (.fr, DOM-TOM, .be, .ch, .lu, .mc, .ca, Maghreb, Afrique francophone)
-- ne sont PAS exclues ici : elles seront verifiees par la localisation du contact (Apollo).

-- 1. Fonction de detection, utilisable sur un site ou un domaine d'email
create or replace function public.domain_is_foreign(p_domain text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    (
      select cc not in (
        -- France et outre-mer
        'fr','re','mq','gp','gf','yt','pm','nc','pf','wf','bl','mf','tf',
        -- francophones (traites comme generiques, verifies par le contact)
        'be','ch','lu','mc','ca','ma','tn','dz','sn','ci','cm','ga','cg','cd','bj','bf',
        'ml','ne','tg','mg','mu','ht','dj','km','td','cf','gn','bi','rw','lb','vu',
        -- extensions a 2 lettres utilisees de facon generique
        'eu','io','ai','co','me','tv','cc','ly','to','fm','gg','sh','ws','la','ms',
        'vc','sc','so','im','ac','nu','is','gl','ee','us'
      )
      from (
        select substring(
          lower(regexp_replace(regexp_replace(regexp_replace(
            split_part(btrim(p_domain), ',', 1),
            '^[a-z]+://', ''), '^www\.', ''), '[/:?#].*$', ''))
          from '\.([a-z]{2})$') as cc
      ) t
      where cc is not null
    ),
    false
  );
$$;

revoke all on function public.domain_is_foreign(text) from public;
revoke all on function public.domain_is_foreign(text) from anon;
revoke all on function public.domain_is_foreign(text) from authenticated;

-- 2. Garde a l'insertion et a la modification du site
create or replace function public.outreach_foreign_domain_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.stop_reason is null
     and coalesce(new.claim_status, 'pending') in ('pending', 'active')
     and public.domain_is_foreign(new.website) then
    new.stop_reason  := 'foreign_company';
    new.stop_note    := coalesce(new.stop_note, 'Auto : site en extension etrangere non francophone');
    new.stopped_at   := coalesce(new.stopped_at, now());
    new.next_send_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_outreach_foreign_domain_guard on public.outreach_campaigns;
create trigger trg_outreach_foreign_domain_guard
  before insert or update of website on public.outreach_campaigns
  for each row execute function public.outreach_foreign_domain_guard();

-- 3. Rattrapage des campagnes ouvertes sur des salons a venir
update public.outreach_campaigns oc
set stop_reason  = 'foreign_company',
    stop_note    = 'Auto : site en extension etrangere non francophone',
    stopped_at   = now(),
    next_send_at = null
from public.events e
where e.id = oc.event_id
  and e.date_debut >= current_date
  and oc.stop_reason is null
  and oc.claim_status in ('pending', 'active')
  and public.domain_is_foreign(oc.website);

-- 4. File d'enrichissement WF2 : ignorer les campagnes arretees (quelle qu'en soit la raison)
create or replace view public.v_a_enrichir as
 select oc.id,
    oc.event_id,
    oc.participation_id,
    oc.company_name,
    oc.website,
    oc.hunter_status,
    e.nom_event,
    e.date_debut,
    e.ville,
    e.slug as event_slug,
    e.date_debut - current_date as days_before_event
   from outreach_campaigns oc
     join events e on oc.event_id = e.id
  where e.date_debut > current_date
    and (e.date_debut - current_date) >= 5
    and (e.date_debut - current_date) <= 60
    and e.visible = true
    and e.is_test = false
    and oc.opt_out = false
    and oc.hunter_status = 'pending'::text
    and oc.website is not null
    and oc.stop_reason is null;
