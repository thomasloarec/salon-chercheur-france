-- First, drop the old constraint
ALTER TABLE public.novelties DROP CONSTRAINT IF EXISTS novelties_type_check;

-- Update existing data to match the new type values
UPDATE public.novelties SET type = 'Demo' WHERE type = 'LiveDemo';
UPDATE public.novelties SET type = 'Update' WHERE type = 'MajorUpdate';
UPDATE public.novelties SET type = 'Update' WHERE type = 'Prototype';
UPDATE public.novelties SET type = 'Special_Offer' WHERE type = 'Offer';
UPDATE public.novelties SET type = 'Innovation' WHERE type = 'Talk';

-- Now add the new constraint with the correct values
ALTER TABLE public.novelties ADD CONSTRAINT novelties_type_check 
CHECK (type = ANY (ARRAY['Launch'::text, 'Update'::text, 'Demo'::text, 'Special_Offer'::text, 'Partnership'::text, 'Innovation'::text]));