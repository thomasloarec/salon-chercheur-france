-- Step 1: Delete orphan claim_request on A
DELETE FROM public.exhibitor_claim_requests 
WHERE id = '9286ee5b-2784-465b-a1c2-b8386123c7aa';

-- Step 2: Swap slugs via temp value
UPDATE public.exhibitors SET slug = '__archived_coveris__' WHERE id = '6c2e6530-e46c-4964-989e-b3eadecefd3a';
UPDATE public.exhibitors SET slug = 'coveris-group' WHERE id = '28607e4d-587c-4bd7-9c6f-0ac507fdee35';

-- Step 3: Archive fiche A
UPDATE public.exhibitors 
SET name = '[ARCHIVED] Coveris Group',
    slug = NULL,
    approved = false,
    description = '[Doublon archivé – fiche canonique: 28607e4d] ' || COALESCE(description, '')
WHERE id = '6c2e6530-e46c-4964-989e-b3eadecefd3a';

-- Step 4: Remove orphan legacy exposant entry for A
DELETE FROM public.exposants WHERE id_exposant = '6c2e6530-e46c-4964-989e-b3eadecefd3a';

-- Step 5: Fix description typo on canonical fiche B
UPDATE public.exhibitors
SET description = 'Coveris is a leading European packaging company that manufactures paper and plastic based flexible packaging solutions for some of the world''s most respected brands. The company develops packaging that protects all types of products - from food to pet food, from medical devices to industrial and agricultural products. Through a broad level of technical expertise, their high-quality packaging extends the shelf life of products hence helping to reduce waste and resource wastage. Together with customers Coveris is constantly working on new attractive and sustainable packaging solutions. With its corporate office in Vienna, Coveris operates 29 sites in the EMEA region with a total of 4,100 employees.'
WHERE id = '28607e4d-587c-4bd7-9c6f-0ac507fdee35';