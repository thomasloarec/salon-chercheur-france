-- Drop the old boolean-returning function
drop function if exists public.can_add_novelty(uuid, uuid);

-- Create the new JSON-returning function
create or replace function public.can_add_novelty(
  p_exhibitor_id uuid,
  p_event_id uuid
) returns json 
language plpgsql 
security definer 
set search_path = public
as $$
declare
  v_plan text;
  v_count int;
  v_allowed boolean;
  v_reason text;
begin
  -- Validate inputs
  if p_exhibitor_id is null or p_event_id is null then
    return json_build_object(
      'allowed', false,
      'reason', 'Missing exhibitor_id or event_id',
      'current_count', 0,
      'plan', null
    );
  end if;

  -- Get exhibitor plan (default to 'free')
  select coalesce(plan, 'free') into v_plan
  from public.exhibitors
  where id = p_exhibitor_id;

  if v_plan is null then
    v_plan := 'free';
  end if;

  -- Count existing novelties for this exhibitor and event (excluding rejected/deleted)
  select count(*) into v_count
  from public.novelties n
  where n.exhibitor_id = p_exhibitor_id
    and n.event_id = p_event_id
    and coalesce(n.status, 'Draft') in ('Draft','Pending','UnderReview','Published');

  -- Check quota based on plan
  if v_plan = 'free' then
    v_allowed := (v_count < 1);
    if not v_allowed then
      v_reason := 'Plan gratuit : 1 nouveauté maximum par exposant et par événement.';
    else
      v_reason := '';
    end if;
  else
    -- Pro/enterprise plans have unlimited novelties
    v_allowed := true;
    v_reason := '';
  end if;

  return json_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'current_count', v_count,
    'plan', v_plan
  );
end $$;