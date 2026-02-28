-- Add new columns
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS faq jsonb DEFAULT '[]'::jsonb;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS why_visit_text text;

-- Migrate event_ids from uuid[] to jsonb (array of {event_id, description} objects)
ALTER TABLE blog_articles ADD COLUMN event_ids_new jsonb DEFAULT '[]'::jsonb;

UPDATE blog_articles
SET event_ids_new = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('event_id', eid::text, 'description', ''))
   FROM unnest(event_ids) AS eid),
  '[]'::jsonb
);

ALTER TABLE blog_articles DROP COLUMN event_ids;
ALTER TABLE blog_articles RENAME COLUMN event_ids_new TO event_ids;