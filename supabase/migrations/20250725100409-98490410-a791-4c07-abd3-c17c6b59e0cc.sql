-- Générer les slugs manquants pour les événements existants
UPDATE public.events 
SET slug = generate_event_slug(
  nom_event, 
  ville, 
  EXTRACT(YEAR FROM date_debut)::integer
)
WHERE slug IS NULL AND nom_event IS NOT NULL AND ville IS NOT NULL AND date_debut IS NOT NULL;

-- Gérer les doublons éventuels en ajoutant un suffixe numérique
DO $$
DECLARE
  event_record RECORD;
  new_slug TEXT;
  counter INTEGER;
BEGIN
  -- Parcourir tous les événements avec des slugs potentiellement dupliqués
  FOR event_record IN 
    SELECT id, nom_event, ville, date_debut, slug
    FROM events 
    WHERE slug IS NOT NULL
  LOOP
    counter := 1;
    new_slug := event_record.slug;
    
    -- Vérifier s'il y a des doublons et ajouter un suffixe si nécessaire
    WHILE EXISTS (
      SELECT 1 FROM events 
      WHERE slug = new_slug AND id != event_record.id
    ) LOOP
      new_slug := event_record.slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    
    -- Mettre à jour si le slug a changé
    IF new_slug != event_record.slug THEN
      UPDATE events SET slug = new_slug WHERE id = event_record.id;
    END IF;
  END LOOP;
END $$;