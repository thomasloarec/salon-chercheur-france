alter view public.v_exposant_cleanup_actions
  set (security_invoker = on, security_barrier = on);

revoke all on public.v_exposant_cleanup_actions from anon;