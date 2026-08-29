-- =====================================================================
-- LOT 2 — Import PDF de Nouveauté : tables de suivi
-- Additif pur. Ne modifie AUCUNE table existante (novelties, novelty_images,
-- exhibitors, events, storage.*). Rollback = DROP des deux tables + vue.
-- Conventions reprises de l'existant : gen_random_uuid(), set_updated_at(),
-- is_admin(), pattern RLS owner + service_role (calqué sur leads).
-- =====================================================================

-- 1) Document source (le PDF importé) ----------------------------------
CREATE TABLE public.novelty_source_documents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by            uuid NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  exhibitor_id          uuid          REFERENCES public.exhibitors(id) ON DELETE SET NULL,
  event_id              uuid          REFERENCES public.events(id)     ON DELETE SET NULL,
  novelty_id            uuid          REFERENCES public.novelties(id)  ON DELETE SET NULL,

  storage_bucket        text NOT NULL DEFAULT 'novelty-resources',
  storage_path          text NOT NULL,
  original_filename     text,
  file_size_bytes       bigint,
  page_count            integer,

  status                text NOT NULL DEFAULT 'uploaded'
                          CHECK (status IN ('uploaded','extracting','extracted','failed','expired')),

  -- Provenance du texte : signal qui gouverne la fiabilité du verbatim.
  text_source           text NOT NULL DEFAULT 'none'
                          CHECK (text_source IN ('none','pdf_layer','vision','mixed')),
  text_char_count       integer,                         -- volume brut extractible (avant coupe 20k)
  text_truncated        boolean NOT NULL DEFAULT false,  -- vrai si coupé à MAX_TEXTE (20 000)
  extracted_text        text,                            -- texte sélectionné (<=20k) envoyé au cerveau
  image_candidate_count integer NOT NULL DEFAULT 0,

  error_code            text,
  extraction_ms         integer,

  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.novelty_source_documents.text_source IS
  'Obtention du texte: none=aucun, pdf_layer=couche texte native (verbatim fiable), vision=reconstruit par modele (verbatim NON garanti), mixed=les deux.';

CREATE INDEX idx_nsd_created_by ON public.novelty_source_documents(created_by);
CREATE INDEX idx_nsd_novelty    ON public.novelty_source_documents(novelty_id);
CREATE INDEX idx_nsd_status     ON public.novelty_source_documents(status);
CREATE INDEX idx_nsd_expires_at ON public.novelty_source_documents(expires_at);

CREATE TRIGGER trg_nsd_updated_at
  BEFORE UPDATE ON public.novelty_source_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Images candidates extraites du PDF --------------------------------
CREATE TABLE public.novelty_source_images (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id uuid NOT NULL REFERENCES public.novelty_source_documents(id) ON DELETE CASCADE,

  page_number        integer,
  pdf_xref           integer,
  source_filter      text,     -- DCT / JPX / FLATE / ... (telemetrie Version A)

  -- Candidat stocke en PRIVE jusqu'au consentement (jamais public avant selection).
  storage_bucket     text NOT NULL DEFAULT 'novelty-resources',
  storage_path       text NOT NULL,
  width              integer,
  height             integer,
  byte_size          integer,
  phash              text,     -- hash perceptuel pour la deduplication

  -- Qualification (Lot 4, passe vision).
  kind               text NOT NULL DEFAULT 'unknown'
                       CHECK (kind IN ('product_photo','ambiance','diagram','logo','badge','portrait','screenshot','decor','unknown')),
  score              numeric,

  selected           boolean NOT NULL DEFAULT false,
  position           integer,          -- ordre dans la galerie
  published_url      text,             -- rempli quand promu vers le bucket public a la creation

  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nsi_document ON public.novelty_source_images(source_document_id);
CREATE INDEX idx_nsi_selected ON public.novelty_source_images(source_document_id, selected);

-- 3) RLS ----------------------------------------------------------------
ALTER TABLE public.novelty_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novelty_source_images    ENABLE ROW LEVEL SECURITY;

-- Documents : admin total ; ecritures via EF service_role ; lecture proprietaire.
CREATE POLICY "nsd admin all" ON public.novelty_source_documents
  FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "nsd service_role writes" ON public.novelty_source_documents
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "nsd owner read" ON public.novelty_source_documents
  FOR SELECT TO authenticated USING (created_by = auth.uid());

-- Images : idem, propriete heritee du document parent.
CREATE POLICY "nsi admin all" ON public.novelty_source_images
  FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "nsi service_role writes" ON public.novelty_source_images
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "nsi owner read" ON public.novelty_source_images
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.novelty_source_documents d
    WHERE d.id = source_document_id AND d.created_by = auth.uid()
  ));

-- 4) Support de purge (colonne + vue ; le job cron + EF est en Lot 7) ---
CREATE VIEW public.v_novelty_sources_purgeable
  WITH (security_invoker = true) AS
  SELECT id, storage_bucket, storage_path, novelty_id, status, expires_at
  FROM public.novelty_source_documents
  WHERE expires_at < now();

COMMENT ON VIEW public.v_novelty_sources_purgeable IS
  'Documents source expires a purger (fichiers storage + lignes). Consommee par l''EF de purge planifiee (Lot 7).';
