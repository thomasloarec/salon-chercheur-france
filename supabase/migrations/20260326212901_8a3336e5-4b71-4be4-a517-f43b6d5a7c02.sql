
-- Calculate and store enrichissement_score for all events
UPDATE events SET enrichissement_score = (
  -- Potentiel audience (40 pts max)
  CASE 
    WHEN affluence ~ '^\d+$' AND affluence::integer >= 10000 THEN 25
    WHEN affluence ~ '^\d+$' AND affluence::integer >= 1000  THEN 15
    WHEN affluence IS NOT NULL AND affluence != '' THEN 5
    ELSE 0 
  END
  +
  CASE 
    WHEN (SELECT COUNT(*) FROM participation p WHERE p.id_event = events.id) >= 200 THEN 15
    WHEN (SELECT COUNT(*) FROM participation p WHERE p.id_event = events.id) >= 50  THEN 8
    WHEN (SELECT COUNT(*) FROM participation p WHERE p.id_event = events.id) > 0    THEN 3
    ELSE 0 
  END
  -- Richesse matière (30 pts max)
  + CASE WHEN length(description_event) > 400 THEN 10
         WHEN length(description_event) > 100 THEN 5
         ELSE 0 END
  + CASE WHEN url_site_officiel IS NOT NULL AND url_site_officiel != '' THEN 5 ELSE 0 END
  + CASE WHEN nom_lieu IS NOT NULL AND nom_lieu != ''                   THEN 5 ELSE 0 END
  + CASE WHEN tarif IS NOT NULL AND tarif != ''                         THEN 5 ELSE 0 END
  + CASE WHEN url_image IS NOT NULL AND url_image != ''                 THEN 5 ELSE 0 END
  -- Urgence temporelle (30 pts max)
  + CASE 
      WHEN date_debut > NOW() AND (date_debut - NOW()::date) < 45  THEN 20
      WHEN date_debut > NOW() AND (date_debut - NOW()::date) < 90  THEN 15
      WHEN date_debut > NOW() AND (date_debut - NOW()::date) < 180 THEN 8
      WHEN date_debut > NOW() THEN 2
      ELSE 0 
    END
  + CASE WHEN date_debut > NOW() THEN 10 ELSE 0 END
);

-- Derive enrichissement_niveau from score
UPDATE events SET enrichissement_niveau = 
  CASE 
    WHEN enrichissement_score >= 65 THEN 'premium'
    WHEN enrichissement_score >= 35 THEN 'standard'
    ELSE 'minimal'
  END
WHERE enrichissement_score IS NOT NULL;

-- Set default enrichissement_statut for events that don't have one
UPDATE events SET enrichissement_statut = 'non_traite'
WHERE enrichissement_statut IS NULL;
