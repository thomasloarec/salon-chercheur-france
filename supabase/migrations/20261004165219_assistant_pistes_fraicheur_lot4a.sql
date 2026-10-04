-- Correctif intentions périmées, lot 4a : le fil de Mon Agenda signale honnêtement les intentions périmées.
-- Cadrage : claude/Correctif_Pistes_Perimees_Cadrage_04102026.md
-- assistant_my_feed.status :
--   refreshing   : vrai aussi tant que les intentions sont à reconstruire (la page relit alors le fil toutes les 15 s,
--                  cf. useAssistantFeed, et affiche « Je relis les programmes… »).
--   pistes_stale : nouveau, vrai si pistes_built_at absente ou antérieure à content_changed_at. Le frontend (lot 4b)
--                  remplace alors les chips par un libellé de mise à jour, au lieu d'afficher d'anciennes intentions.
-- Modification ciblée de la définition en place (une seule occurrence attendue), droits conservés.

do $$
declare
  d   text := pg_get_functiondef('public.assistant_my_feed(uuid)'::regprocedure);
  pat text := 'v_prof\.refresh_requested_at is not null\s+and \(v_prof\.refreshed_at is null or v_prof\.refreshed_at < v_prof\.refresh_requested_at\),';
  rep text := '(v_prof.refresh_requested_at is not null
                     and (v_prof.refreshed_at is null or v_prof.refreshed_at < v_prof.refresh_requested_at))
                    or (v_prof.pistes_built_at is null or v_prof.pistes_built_at < v_prof.content_changed_at),
      ''pistes_stale'', (v_prof.pistes_built_at is null or v_prof.pistes_built_at < v_prof.content_changed_at),';
begin
  if regexp_count(d, pat) <> 1 then
    raise exception 'Lot 4a : expression refreshing introuvable ou multiple (% occurrence(s)), arrêt sans écriture',
      regexp_count(d, pat);
  end if;
  if position('pistes_stale' in d) > 0 then
    raise exception 'Lot 4a : pistes_stale déjà présent, arrêt sans écriture';
  end if;
  execute regexp_replace(d, pat, rep);
end
$$;
