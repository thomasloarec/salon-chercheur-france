-- Correctif programmes (03/10/2026)
-- 1. Année corrigée sur 4 salons (le PDF ne donnait pas l'année, l'extraction l'a devinée)
-- 2. Suppression des programmes d'une autre édition : SALON DU BON 2026, MUSEVA
-- 3. Forum Franchise Région Sud : programme 2025 remplacé par le programme 2026
-- 4. Mapic : dates corrigées (3 et 4 novembre 2026)
-- 5. Assistant : suggestions orphelines supprimées, compteurs recalculés
-- Chaque étape vérifie le nombre de lignes touchées : au moindre écart, tout est annulé.

do $$
declare
  v_forum  constant uuid := 'd0815305-12c1-4e10-86df-542d08f1083a';
  v_bon    constant uuid := '1aec5bcf-7f6a-4829-8018-af2d19532be3';
  v_museva constant uuid := '4154540a-c5dd-43a5-ab45-b410ccdfac7c';
  v_mapic  constant uuid := '90401e58-908c-48a7-8497-e56e8991f72b';
  v_year_fix constant uuid[] := array[
    '5856ccae-fa53-4c2a-a0a4-1525283620d3',  -- VINITECH-SIFEL (117)
    'ce0569f2-dd9d-47f8-b2cc-c6c535623716',  -- MED'Agri 2026 (40)
    'ab504a5c-7b6a-4b43-9ee3-b825efc6bf85',  -- AEROFORUM 2026 (14)
    '150f080c-a4b8-4550-bdcd-4c8b2918347e'   -- Journée des Acteurs Engagés pour le Progrès (7)
  ]::uuid[];
  v_n int;
  r record;
begin
  -- 0. Couples (profil, salon) à recompter à la fin
  create temp table _recount on commit drop as
    select distinct m.profile_id, m.event_id
    from public.assistant_matches m
    where m.event_id in (v_bon, v_museva, v_forum);

  -- 1. Année corrigée : même jour et même mois, année de l'édition, seulement si la date tombe dans les dates du salon
  update public.event_program_sessions s
     set day_date = make_date(extract(year from e.date_debut)::int,
                              extract(month from s.day_date)::int,
                              extract(day from s.day_date)::int),
         updated_at = now()
    from public.events e
   where e.id = s.event_id
     and s.event_id = any(v_year_fix)
     and s.day_date is not null
     and s.day_date not between e.date_debut and e.date_fin
     and make_date(extract(year from e.date_debut)::int,
                   extract(month from s.day_date)::int,
                   extract(day from s.day_date)::int) between e.date_debut and e.date_fin;
  get diagnostics v_n = row_count;
  if v_n <> 178 then
    raise exception 'Etape 1 : 178 sessions attendues, % trouvées', v_n;
  end if;

  select count(*) into v_n
    from public.event_program_sessions s join public.events e on e.id = s.event_id
   where s.event_id = any(v_year_fix) and s.day_date is not null
     and s.day_date not between e.date_debut and e.date_fin;
  if v_n <> 0 then
    raise exception 'Etape 1 : % sessions encore hors des dates du salon', v_n;
  end if;

  -- 2. Intervenants des 3 programmes retirés (supprime aussi leurs liens aux sessions)
  delete from public.event_program_speakers where event_id in (v_bon, v_museva, v_forum);
  get diagnostics v_n = row_count;
  if v_n <> 131 then
    raise exception 'Etape 2 : 131 intervenants attendus, % trouvés', v_n;
  end if;

  -- 3. Sessions des 3 programmes retirés (supprime aussi enrichissements et embeddings)
  delete from public.event_program_sessions where event_id in (v_bon, v_museva, v_forum);
  get diagnostics v_n = row_count;
  if v_n <> 71 then
    raise exception 'Etape 3 : 71 sessions attendues (40 + 25 + 6), % trouvées', v_n;
  end if;

  -- 4. Suggestions de l'assistant qui pointent vers une session disparue
  delete from public.assistant_matches m
   where m.item_type = 'session'
     and not exists (select 1 from public.event_program_sessions s where s.id = m.item_id);
  get diagnostics v_n = row_count;
  if v_n <> 70 then
    raise exception 'Etape 4 : 70 suggestions attendues, % trouvées', v_n;
  end if;

  -- 5. Forum Franchise Région Sud 2026 (mardi 17 novembre 2026, Pasino Grand, Aix-en-Provence)
  insert into public.event_program_sessions
    (event_id, title, description, session_type, day_date, start_time, end_time, position, status, source)
  values
    (v_forum, 'Devenir franchisé - Les clés de la réussite',
     'Futur franchisé, prêt à vous lancer ? Découvrez les étapes indispensables pour réussir votre projet en franchise.',
     'conference', '2026-11-17', '10:30', '11:00', 0, 'published', 'pdf_import'),
    (v_forum, 'Sécuriser sa franchise : documents contractuels et autres clauses',
     null,
     'conference', '2026-11-17', '11:15', '11:45', 1, 'published', 'pdf_import'),
    (v_forum, 'Réussir le financement de son projet : préparation et solutions de financement',
     'Le financement est une étape essentielle pour réussir à devenir franchisé. Comment rechercher son financement ? Quelles sont les étapes et les pièges à éviter ? Notre expert vous partage leur expérience pour vous donner toutes les chances d''obtenir votre financement.',
     'conference', '2026-11-17', '12:00', '12:30', 2, 'published', 'pdf_import'),
    (v_forum, 'Devenir franchiseur : les étapes pour créer son réseau et le développer avec succès',
     'Vous souhaitez devenir franchiseur ? Participez à notre conférence et découvrez les étapes à prendre en compte pour créer un réseau et les ressources nécessaires pour y parvenir. Écoutez également le retour d''expérience d''un dirigeant qui vient de créer son réseau et qui se développe.',
     'conference', '2026-11-17', '13:30', '14:00', 3, 'published', 'pdf_import'),
    (v_forum, 'S''implanter dans la région Sud : dynamiques territoriales et opportunités de développement',
     null,
     'conference', '2026-11-17', '14:15', '14:45', 4, 'published', 'pdf_import'),
    (v_forum, 'Se faire accompagner : l''offre CCI au régional',
     null,
     'conference', '2026-11-17', '15:00', '15:30', 5, 'published', 'pdf_import');

  -- 6. Mapic : 3 et 4 novembre 2026 (programme officiel et cannes.com)
  perform set_config('app.event_change_apply', '1', true);
  update public.events
     set date_debut = '2026-11-03', date_fin = '2026-11-04'
   where id = v_mapic and date_debut = '2026-11-04' and date_fin = '2026-11-05';
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'Etape 6 : Mapic introuvable ou dates déjà modifiées';
  end if;
  perform set_config('app.event_change_apply', '', true);

  -- 7. Compteurs de l'assistant recalculés pour les salons touchés
  for r in select profile_id, event_id from _recount loop
    perform public.assistant_recount_suggestion(r.profile_id, r.event_id);
  end loop;
end
$$;