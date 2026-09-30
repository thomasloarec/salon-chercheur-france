-- Requalification Apollo (30/09/2026) : exposants à adresse générique Hunter et grands groupes exclus.
-- Un enrichissement Apollo par domaine, appliqué à toutes les campagnes de ce domaine.
alter table public.outreach_campaigns
  add column if not exists apollo_requalif_at timestamptz;

create or replace function public.outreach_apply_apollo_contact(p jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_ids uuid[] := array(select jsonb_array_elements_text(coalesce(p->'campaign_ids', '[]'::jsonb))::uuid);
  v_c jsonb := p->'contact';
  v_ok boolean := coalesce((p->>'ok')::boolean, false);
  v_credits integer := coalesce((p->>'credits')::integer, 0);
  v_result text := coalesce(p->>'result', 'erreur');
  v_email text := lower(trim(v_c->>'contact_email'));
  v_id uuid;
  v_first boolean := true;
  n_ok integer := 0;
  n_skip integer := 0;
begin
  foreach v_id in array v_ids loop
    if not exists (
      select 1 from outreach_campaigns
       where id = v_id and stop_reason is null and opt_out = false
         and claim_status in ('pending', 'active')
    ) then
      n_skip := n_skip + 1;
      continue;
    end if;

    if v_ok and v_email is not null and (
         (select count(*) from outreach_contacts where outreach_campaign_id = v_id) < 3
         or exists (select 1 from outreach_contacts where outreach_campaign_id = v_id and lower(contact_email) = v_email)
       ) then
      update outreach_contacts
         set is_primary = false
       where outreach_campaign_id = v_id and is_primary and lower(contact_email) <> v_email;

      insert into outreach_contacts (
        outreach_campaign_id, contact_email, first_name, last_name, full_name, job_title,
        department_guess, source, persona, email_status, apollo_person_id, country,
        is_primary, contact_status)
      values (
        v_id, v_email, v_c->>'first_name', v_c->>'last_name', v_c->>'full_name', v_c->>'job_title',
        v_c->>'department_guess', 'apollo', v_c->>'persona', 'verified', v_c->>'apollo_person_id',
        coalesce(v_c->>'country', 'France'), true, 'ready')
      on conflict (outreach_campaign_id, lower(contact_email))
      do update set is_primary = true, contact_status = 'ready';

      update outreach_campaigns
         set hunter_status = 'ready',
             contact_email = v_email,
             hunter_prenom = v_c->>'first_name',
             hunter_poste = v_c->>'job_title',
             claim_step = 0,
             next_send_at = null,
             apollo_checked_at = now(),
             apollo_requalif_at = now(),
             apollo_result = 'contact_verifie',
             apollo_credits = apollo_credits + case when v_first then v_credits else 0 end
       where id = v_id;
      n_ok := n_ok + 1;
    else
      update outreach_campaigns
         set apollo_checked_at = now(),
             apollo_requalif_at = now(),
             apollo_result = case when v_ok then 'erreur' else v_result end,
             apollo_credits = apollo_credits + case when v_first then v_credits else 0 end
       where id = v_id;
      n_skip := n_skip + 1;
    end if;
    v_first := false;
  end loop;
  return jsonb_build_object('appliquees', n_ok, 'inchangees', n_skip);
end;
$$;

revoke execute on function public.outreach_apply_apollo_contact(jsonb) from public, anon, authenticated;
