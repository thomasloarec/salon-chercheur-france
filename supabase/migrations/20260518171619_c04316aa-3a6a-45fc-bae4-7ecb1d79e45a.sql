
WITH base AS (
  SELECT e.id, e.date_debut, e.secteur, e.description_event
  FROM public.events e
  WHERE e.visible = true
    AND coalesce(e.is_test, false) = false
    AND e.slug IS NOT NULL AND e.slug <> ''
    AND e.date_debut >= CURRENT_DATE
    AND e.enrichissement_score IS NULL
),
prio AS (
  SELECT b.*,
    (SELECT count(*) FROM public.participation p WHERE p.id_event = b.id) AS exhibitors_count,
    (b.date_debut >= '2026-01-01' AND b.date_debut < '2027-01-01')::int AS is_2026,
    (EXISTS (SELECT 1 FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(b.secteur)='array' THEN b.secteur ELSE '[]'::jsonb END) s
      WHERE lower(s) ~ '(santé|medical|médical|tourisme|événementiel|evenementiel|industrie|production|btp|construction|agroalimentaire|agriculture|boisson)'))::int AS sector_priority,
    char_length(coalesce(b.description_event,'')) AS desc_len
  FROM base b
),
ranked AS (
  SELECT id FROM prio
  ORDER BY (exhibitors_count > 0)::int DESC, is_2026 DESC, sector_priority DESC, desc_len ASC, date_debut ASC
  LIMIT 20
),
scored AS (
  SELECT id, public.compute_event_enrichissement_score(id) AS s FROM ranked
)
UPDATE public.events ev
SET enrichissement_score = s.s,
    enrichissement_niveau = CASE
      WHEN s.s >= 65 THEN 'premium'
      WHEN s.s >= 35 THEN 'standard'
      ELSE 'minimal'
    END,
    updated_at = now()
FROM scored s
WHERE ev.id = s.id;
