-- Lot 1 : profil (persona), source et statut email des contacts d'outreach (30/09/2026)
-- Profils valides par Thomas : COM, VENTE, DIRIGEANT, GENERIQUE.

-- 1. Colonnes nouvelles sur outreach_contacts (source existe deja, defaut 'hunter')
alter table public.outreach_contacts
  add column if not exists persona text,
  add column if not exists email_status text,
  add column if not exists apollo_person_id text,
  add column if not exists country text;

alter table public.outreach_contacts
  drop constraint if exists outreach_contacts_persona_check;
alter table public.outreach_contacts
  add constraint outreach_contacts_persona_check
  check (persona is null or persona in ('COM', 'VENTE', 'DIRIGEANT', 'GENERIQUE'));

-- 2. Calcul du profil a partir de l'intitule (memes regles que l'analyse Apollo)
create or replace function public.outreach_persona(p_title text, p_first_name text, p_department text default null)
returns text
language sql
immutable
set search_path = public
as $$
  with t as (
    select lower(translate(coalesce(p_title, ''),
      'àâäáãéèêëíîïóôöõúùûüçñÀÂÄÁÃÉÈÊËÍÎÏÓÔÖÕÚÙÛÜÇÑ',
      'aaaaaeeeeiiiioooouuuucnaaaaaeeeeiiiioooouuuucn')) as s,
      lower(coalesce(p_department, '')) as d
  )
  select case
    when coalesce(btrim(p_first_name), '') = '' then 'GENERIQUE'
    when s ~ '\y(event|events|evenement|evenements|evenementiel|evenementielle|salon|salons|trade ?shows?|tradeshows?|exhibitions?|exposition|foires?)\y'
      or s ~ '(marketing|communication|marcom|\ybrand|\ymarque|responsable digital|digital manager|\ycontent\y|contenu|relations? presse|public relations|\ypr\y|social media|community manager)'
      then 'COM'
    when s ~ '(sales|commercial|commerciale|business develop|export|\yvente|ventes|key account|grands comptes|account manager)'
      then 'VENTE'
    when s ~ '(\yceo\y|chief executive|gerant|gerante|founder|fondat|president|\ypdg\y|\ydg\y|directeur general|directrice generale|managing director|general manager|dirigeant|associe|partner|directeur de filiale|directrice de filiale|country manager|directeur france|directeur de site)'
      or (s ~ '\yowner\y' and s !~ 'product owner')
      then 'DIRIGEANT'
    when d in ('marketing', 'communication') then 'COM'
    when d = 'sales' then 'VENTE'
    when d in ('executive', 'management') then 'DIRIGEANT'
    else 'GENERIQUE'
  end
  from t;
$$;

revoke all on function public.outreach_persona(text, text, text) from public;
revoke all on function public.outreach_persona(text, text, text) from anon;
revoke all on function public.outreach_persona(text, text, text) from authenticated;

-- 3. Vue d'envoi WF3 : profil + date du salon exposes en fin de liste,
--    et exclusion des emails de contact en extension etrangere non francophone.
create or replace view public.v_eligibles_revendication as
 select oc.id,
    c.contact_email,
    c.first_name,
    oc.company_name,
    e.nom_event,
    slug.public_slug,
    oc.claim_step,
    ( select count(*) as count
           from outreach_campaigns oc2
          where oc2.event_id = oc.event_id and oc2.claim_status = 'claimed'::text) as claimed_count,
    oc.next_send_at,
    coalesce(c.persona, public.outreach_persona(c.job_title, c.first_name, c.department_guess)) as persona,
    e.date_debut
   from outreach_campaigns oc
     join events e on e.id = oc.event_id
     left join participation p on p.id_participation = oc.participation_id
     left join outreach_contacts c on c.outreach_campaign_id = oc.id and c.is_primary = true
     left join lateral ( select coalesce(( select epi.public_slug
                   from exhibitor_public_identities epi
                  where epi.exhibitor_id = oc.exhibitor_id and epi.is_active = true
                 limit 1), ( select epi.public_slug
                   from exhibitor_public_identities epi
                  where epi.exhibitor_id = p.exhibitor_id and epi.is_active = true
                 limit 1), ( select epi.public_slug
                   from exhibitor_public_identities epi
                  where epi.legacy_exposant_id = oc.id_exposant_legacy and epi.is_active = true
                 limit 1), ( select epi.public_slug
                   from exhibitor_public_identities epi
                  where epi.legacy_exposant_id = p.id_exposant and epi.is_active = true
                 limit 1)) as public_slug) slug on true
  where oc.hunter_status = 'ready'::text
    and c.contact_email is not null
    and (oc.claim_status = any (array['pending'::text, 'active'::text]))
    and oc.opt_out = false
    and not is_email_blacklisted(c.contact_email)
    and not has_recent_organizer_send(c.contact_email, 21)
    and oc.claim_step < 2
    and (oc.next_send_at is null or oc.next_send_at <= now())
    and e.date_debut >= (current_date + 3)
    and e.date_debut <= (current_date + 90)
    and e.visible = true
    and e.is_test = false
    and slug.public_slug is not null
    and oc.stop_reason is null
    and (coalesce(oc.campaign_status, ''::text) <> all (array['stopped'::text, 'opted_out'::text, 'completed'::text, 'converted'::text, 'blocked_invalid_email'::text, 'novelty_published'::text, 'expired'::text]))
    and not public.domain_is_foreign(split_part(c.contact_email, '@', 2))
  order by oc.claim_step desc, e.date_debut, oc.event_id, oc.next_send_at nulls first, oc.id;
