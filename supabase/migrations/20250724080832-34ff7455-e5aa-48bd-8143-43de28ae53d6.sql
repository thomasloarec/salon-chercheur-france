-- Back-filler airtable_id existant depuis events_import
UPDATE public.events e
SET    airtable_id = ei.airtable_id
FROM   public.events_import ei
WHERE  e.id_event = ei.id
  AND  e.airtable_id IS NULL;