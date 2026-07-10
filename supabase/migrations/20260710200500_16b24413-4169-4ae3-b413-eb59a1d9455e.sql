CREATE TABLE IF NOT EXISTS public.sector_label_map (
  raw_label      text PRIMARY KEY,
  sector_id      uuid REFERENCES public.sectors(id),
  sub_sector_ids uuid[] NOT NULL DEFAULT '{}',
  confidence     numeric,
  source         text NOT NULL DEFAULT 'llm',
  mapped_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sector_label_map TO authenticated;
GRANT ALL ON public.sector_label_map TO service_role;

ALTER TABLE public.sector_label_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage sector_label_map" ON public.sector_label_map;

CREATE POLICY "Admins manage sector_label_map" ON public.sector_label_map FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());