
-- Enable the unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Add a slug column to the events table (if it doesn't exist)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug text;

-- Create a unique index on the slug column (if it doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS events_slug_idx ON public.events(slug);

-- Create a function to generate slugs
CREATE OR REPLACE FUNCTION generate_event_slug(event_name text, event_city text, event_year integer)
RETURNS text AS $$
DECLARE
    clean_name text;
    clean_city text;
    slug text;
BEGIN
    -- Clean the event name
    clean_name := lower(event_name);
    clean_name := unaccent(clean_name);
    clean_name := regexp_replace(clean_name, '''', '', 'g'); -- Remove apostrophes
    clean_name := regexp_replace(clean_name, '[^a-z0-9 -]', '', 'g'); -- Remove special chars
    clean_name := regexp_replace(clean_name, ' +', '-', 'g'); -- Replace spaces with hyphens
    clean_name := regexp_replace(clean_name, '-+', '-', 'g'); -- Remove duplicate hyphens
    clean_name := trim(both '-' from clean_name); -- Remove leading/trailing hyphens
    
    -- Clean the city name
    clean_city := lower(event_city);
    clean_city := unaccent(clean_city);
    clean_city := regexp_replace(clean_city, '''', '', 'g'); -- Remove apostrophes
    clean_city := regexp_replace(clean_city, '[^a-z0-9]', '', 'g'); -- Remove all non-alphanumeric
    
    -- Generate the slug
    slug := clean_name || '-' || event_year || '-' || clean_city;
    
    RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update all existing events with slugs
CREATE OR REPLACE FUNCTION update_existing_events_slugs()
RETURNS void AS $$
DECLARE
    event_record record;
    new_slug text;
    event_year integer;
    counter integer := 0;
BEGIN
    FOR event_record IN SELECT id, name, city, start_date FROM events WHERE slug IS NULL LOOP
        -- Extract year from start_date
        event_year := EXTRACT(YEAR FROM event_record.start_date);
        
        -- Generate slug
        new_slug := generate_event_slug(event_record.name, event_record.city, event_year);
        
        -- Handle potential duplicates by appending a counter
        WHILE EXISTS (SELECT 1 FROM events WHERE slug = new_slug) LOOP
            counter := counter + 1;
            new_slug := generate_event_slug(event_record.name, event_record.city, event_year) || '-' || counter;
        END LOOP;
        
        -- Update the event with the generated slug
        UPDATE events SET slug = new_slug WHERE id = event_record.id;
        
        -- Reset counter for next event
        counter := 0;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the function to update existing events
SELECT update_existing_events_slugs();

-- Create a trigger function to automatically generate slugs for new events
CREATE OR REPLACE FUNCTION auto_generate_event_slug()
RETURNS trigger AS $$
DECLARE
    new_slug text;
    event_year integer;
    counter integer := 0;
BEGIN
    -- Only generate slug if it's not provided
    IF NEW.slug IS NULL THEN
        -- Extract year from start_date
        event_year := EXTRACT(YEAR FROM NEW.start_date);
        
        -- Generate slug
        new_slug := generate_event_slug(NEW.name, NEW.city, event_year);
        
        -- Handle potential duplicates by appending a counter
        WHILE EXISTS (SELECT 1 FROM events WHERE slug = new_slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
            counter := counter + 1;
            new_slug := generate_event_slug(NEW.name, NEW.city, event_year) || '-' || counter;
        END LOOP;
        
        NEW.slug := new_slug;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS events_auto_slug_trigger ON events;
CREATE TRIGGER events_auto_slug_trigger
    BEFORE INSERT OR UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_event_slug();
