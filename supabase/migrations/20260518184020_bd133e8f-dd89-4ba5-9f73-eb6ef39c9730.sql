UPDATE public.events
SET description_enrichie = replace(description_enrichie, 'crère', 'crée')
WHERE id = '784a4c86-5225-424c-8cd6-128875d3ad78'
  AND description_enrichie LIKE '%crère%';