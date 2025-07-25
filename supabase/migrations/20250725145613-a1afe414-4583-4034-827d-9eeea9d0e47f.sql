-- 1️⃣ Trigger pour interdire les insertions sur events via la publication
CREATE FUNCTION prevent_insert_on_publish()
RETURNS trigger AS $$
BEGIN
  -- Si on tente d'insérer (via publication) plutôt que de mettre à jour, on bloque
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Insertion interdite : use UPDATE to publish existing events';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_publish_insert
BEFORE INSERT ON public.events
FOR EACH ROW
WHEN (NEW.visible = TRUE)  -- uniquement lors de la publication
EXECUTE FUNCTION prevent_insert_on_publish();