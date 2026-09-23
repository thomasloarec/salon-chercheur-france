-- =====================================================================
-- Lot 1 : page d'invitation exposant (backend SQL)
-- Cadrage : claude/Page_Invitation_Exposant_Cadrage_23092026.md (D1 a D7 valides le 23/09/2026)
--
-- Contenu :
--   1. exhibitor_staff             : annuaire des personnes presentes sur les stands (par exposant)
--   2. exhibitor_invitation_pages       : une page d'invitation par (exposant, salon)
--   3. exhibitor_invitation_page_staff  : personnes selectionnees pour une invitation
--   4. leads                       : + preferred_slot (D3), + source
--   5. bucket exhibitor-staff      : photos, ecriture limitee au prefixe {exhibitor_id}/
--   6. RPC upsert_invitation_page        (managers, refuse sans Nouveaute publiee)
--   7. RPC get_invitation_pages_overview (managers, etats de l'onglet Invitations)
--   8. RPC get_invitation_page                (anon, VOLONTAIREMENT public)
--   9. RPC get_exhibitor_leads                (managers, liste unifiee + floutage serveur, D1)
--
-- Ne touche pas : resolve_meeting_target, novelty-leads, policies existantes de leads.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Annuaire des personnes sur stand
-- ---------------------------------------------------------------------
CREATE TABLE public.exhibitor_staff (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibitor_id  uuid NOT NULL REFERENCES public.exhibitors(id) ON DELETE CASCADE,
  first_name    text NOT NULL CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 60),
  last_name     text NOT NULL CHECK (char_length(btrim(last_name)) BETWEEN 1 AND 60),
  job_title     text CHECK (job_title IS NULL OR char_length(job_title) <= 80),
  photo_url     text CHECK (photo_url IS NULL OR photo_url ~ '^https://'),
  linkedin_url  text CHECK (linkedin_url IS NULL OR linkedin_url ~* '^https://([a-z]{2,3}\.)?linkedin\.com/'),
  sort_order    integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_exhibitor_staff_exhibitor ON public.exhibitor_staff (exhibitor_id, sort_order);
CREATE TRIGGER update_exhibitor_staff_updated_at
  BEFORE UPDATE ON public.exhibitor_staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.exhibitor_staff ENABLE ROW LEVEL SECURITY;
-- CRUD direct pour les managers de la fiche (formulaire simple cote front).
CREATE POLICY "Managers read staff"   ON public.exhibitor_staff FOR SELECT
  USING (public.is_team_member(exhibitor_id) OR public.is_admin());
CREATE POLICY "Managers insert staff" ON public.exhibitor_staff FOR INSERT
  WITH CHECK (public.is_team_member(exhibitor_id) OR public.is_admin());
CREATE POLICY "Managers update staff" ON public.exhibitor_staff FOR UPDATE
  USING (public.is_team_member(exhibitor_id) OR public.is_admin())
  WITH CHECK (public.is_team_member(exhibitor_id) OR public.is_admin());
CREATE POLICY "Managers delete staff" ON public.exhibitor_staff FOR DELETE
  USING (public.is_team_member(exhibitor_id) OR public.is_admin());

-- ---------------------------------------------------------------------
-- 2. Pages d'invitation
--    NB : la table exhibitor_invitations EXISTE DEJA (invitations de collaborateurs a gerer
--    la fiche). Elle n'est pas touchee ; d'ou le nom exhibitor_invitation_pages.
-- ---------------------------------------------------------------------
CREATE TABLE public.exhibitor_invitation_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibitor_id  uuid NOT NULL REFERENCES public.exhibitors(id) ON DELETE CASCADE,
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- Nouveaute mise en avant. SET NULL si supprimee : la page devient inactive, la config est gardee.
  novelty_id    uuid REFERENCES public.novelties(id) ON DELETE SET NULL,
  slug          text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  headline      text CHECK (headline IS NULL OR char_length(headline) <= 80),
  message       text CHECK (message IS NULL OR char_length(message) <= 400),
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at  timestamptz,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exhibitor_invitation_pages_exhibitor_event_key UNIQUE (exhibitor_id, event_id)
);
CREATE INDEX idx_exhibitor_invitation_pages_event ON public.exhibitor_invitation_pages (event_id);
CREATE TRIGGER update_exhibitor_invitation_pages_updated_at
  BEFORE UPDATE ON public.exhibitor_invitation_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.exhibitor_invitation_pages ENABLE ROW LEVEL SECURITY;
-- Lecture managers ; AUCUNE policy d'ecriture : toute ecriture passe par upsert_invitation_page.
CREATE POLICY "Managers read invitations" ON public.exhibitor_invitation_pages FOR SELECT
  USING (public.is_team_member(exhibitor_id) OR public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Personnes selectionnees par invitation
--    (remplace le nom provisoire exhibitor_event_staff du cadrage : une invitation = un couple exposant/salon)
-- ---------------------------------------------------------------------
CREATE TABLE public.exhibitor_invitation_page_staff (
  invitation_id uuid NOT NULL REFERENCES public.exhibitor_invitation_pages(id) ON DELETE CASCADE,
  staff_id      uuid NOT NULL REFERENCES public.exhibitor_staff(id) ON DELETE CASCADE,
  sort_order    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (invitation_id, staff_id)
);
CREATE INDEX idx_exhibitor_invitation_page_staff_staff ON public.exhibitor_invitation_page_staff (staff_id);

ALTER TABLE public.exhibitor_invitation_page_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read invitation staff" ON public.exhibitor_invitation_page_staff FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exhibitor_invitation_pages i
    WHERE i.id = invitation_id
      AND (public.is_team_member(i.exhibitor_id) OR public.is_admin())
  ));

-- ---------------------------------------------------------------------
-- 4. leads : creneau souhaite (texte libre affiche a l'exposant) + origine
-- ---------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN preferred_slot text CHECK (preferred_slot IS NULL OR char_length(preferred_slot) <= 60),
  ADD COLUMN source text CHECK (source IS NULL OR source IN ('site', 'invitation_page'));

-- ---------------------------------------------------------------------
-- 5. Bucket photos equipe
--    Public en lecture par URL. Pas de policy SELECT : aucune enumeration des fichiers.
--    Ecriture : premier dossier du chemin = exhibitor_id dont l'utilisateur est manager.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exhibitor-staff', 'exhibitor-staff', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_manage_staff_object(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       public.is_admin()
       -- CASE et non AND : SQL ne garantit pas l'ordre d'evaluation, le cast doit etre protege.
       OR CASE
            WHEN (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN public.is_team_member(((storage.foldername(p_name))[1])::uuid)
            ELSE false
          END
     );
$$;
REVOKE ALL ON FUNCTION public.can_manage_staff_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_staff_object(text) TO authenticated;

CREATE POLICY "Managers upload staff photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exhibitor-staff' AND public.can_manage_staff_object(name));
CREATE POLICY "Managers update staff photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'exhibitor-staff' AND public.can_manage_staff_object(name))
  WITH CHECK (bucket_id = 'exhibitor-staff' AND public.can_manage_staff_object(name));
CREATE POLICY "Managers delete staff photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'exhibitor-staff' AND public.can_manage_staff_object(name));

-- ---------------------------------------------------------------------
-- 6. Creer / modifier / publier une invitation
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_invitation_page(
  p_exhibitor_id uuid,
  p_event_id     uuid,
  p_headline     text,
  p_message      text,
  p_staff_ids    uuid[],
  p_publish      boolean
)
RETURNS public.exhibitor_invitation_pages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_novelty_id uuid;
  v_event      record;
  v_inv        public.exhibitor_invitation_pages;
  v_base_slug  text;
  v_slug       text;
  v_bad_staff  int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_team_member(p_exhibitor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT e.id, e.slug, e.date_debut, e.date_fin, e.visible, COALESCE(e.is_test, false) AS is_test
    INTO v_event
  FROM public.events e WHERE e.id = p_event_id;
  IF NOT FOUND OR v_event.visible IS NOT TRUE OR v_event.is_test THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;
  IF COALESCE(v_event.date_fin, v_event.date_debut) < CURRENT_DATE THEN
    RAISE EXCEPTION 'event_over';
  END IF;

  -- REGLE METIER : pas de Nouveaute publiee = pas de page d'invitation.
  SELECT n.id INTO v_novelty_id
  FROM public.novelties n
  WHERE n.exhibitor_id = p_exhibitor_id
    AND n.event_id = p_event_id
    AND n.status = 'published'
    AND n.is_test = false
  ORDER BY n.updated_at DESC NULLS LAST
  LIMIT 1;
  IF v_novelty_id IS NULL THEN
    RAISE EXCEPTION 'no_published_novelty';
  END IF;

  -- Les personnes doivent appartenir a CET exposant et etre actives.
  SELECT count(*) INTO v_bad_staff
  FROM unnest(COALESCE(p_staff_ids, '{}'::uuid[])) AS s(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.exhibitor_staff st
    WHERE st.id = s.id AND st.exhibitor_id = p_exhibitor_id AND st.is_active
  );
  IF v_bad_staff > 0 THEN
    RAISE EXCEPTION 'invalid_staff';
  END IF;

  SELECT * INTO v_inv FROM public.exhibitor_invitation_pages
  WHERE exhibitor_id = p_exhibitor_id AND event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Slug lisible (D4) : {slug-exposant}-{slug-salon}. Jamais regenere ensuite.
    SELECT COALESCE(
             (SELECT epi.public_slug FROM public.exhibitor_public_identities epi
               WHERE epi.exhibitor_id = p_exhibitor_id AND epi.is_active
               ORDER BY epi.created_at LIMIT 1),
             (SELECT NULLIF(public.slugify(COALESCE(x.slug, x.name)), '') FROM public.exhibitors x WHERE x.id = p_exhibitor_id),
             'exposant')
        || '-' || COALESCE(NULLIF(public.slugify(v_event.slug), ''), 'salon')
      INTO v_base_slug;
    v_base_slug := trim(both '-' from regexp_replace(lower(v_base_slug), '[^a-z0-9]+', '-', 'g'));
    v_slug := v_base_slug;
    WHILE EXISTS (SELECT 1 FROM public.exhibitor_invitation_pages WHERE slug = v_slug) LOOP
      v_slug := v_base_slug || '-' || substr(md5(random()::text), 1, 4);
    END LOOP;

    INSERT INTO public.exhibitor_invitation_pages
      (exhibitor_id, event_id, novelty_id, slug, headline, message, status, published_at, created_by)
    VALUES
      (p_exhibitor_id, p_event_id, v_novelty_id, v_slug,
       NULLIF(btrim(p_headline), ''), NULLIF(btrim(p_message), ''),
       CASE WHEN p_publish THEN 'published' ELSE 'draft' END,
       CASE WHEN p_publish THEN now() END,
       auth.uid())
    RETURNING * INTO v_inv;
  ELSE
    UPDATE public.exhibitor_invitation_pages SET
      novelty_id   = v_novelty_id,
      headline     = NULLIF(btrim(p_headline), ''),
      message      = NULLIF(btrim(p_message), ''),
      status       = CASE WHEN p_publish THEN 'published' ELSE 'draft' END,
      published_at = CASE WHEN p_publish THEN COALESCE(published_at, now()) ELSE published_at END
    WHERE id = v_inv.id
    RETURNING * INTO v_inv;
  END IF;

  DELETE FROM public.exhibitor_invitation_page_staff WHERE invitation_id = v_inv.id;
  INSERT INTO public.exhibitor_invitation_page_staff (invitation_id, staff_id, sort_order)
  SELECT v_inv.id, s.id, s.ord::int
  FROM unnest(COALESCE(p_staff_ids, '{}'::uuid[])) WITH ORDINALITY AS s(id, ord)
  ON CONFLICT DO NOTHING;

  RETURN v_inv;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_invitation_page(uuid, uuid, text, text, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_invitation_page(uuid, uuid, text, text, uuid[], boolean) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Vue d'ensemble de l'onglet Invitations
--    state : locked | pending | ready | draft | online | suspended | ended
--      suspended = invitation publiee mais Nouveaute plus publiee (page publique inactive)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invitation_pages_overview(p_exhibitor_id uuid)
RETURNS TABLE (
  event_id           uuid,
  event_name         text,
  event_slug         text,
  date_debut         date,
  date_fin           date,
  ville              text,
  state              text,
  novelty_id         uuid,
  novelty_title      text,
  novelty_status     text,
  invitation_id      uuid,
  invitation_slug    text,
  invitation_status  text,
  requests_count     integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  v_legacy text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_team_member(p_exhibitor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT epi.legacy_exposant_id INTO v_legacy
  FROM public.exhibitor_public_identities epi
  WHERE epi.exhibitor_id = p_exhibitor_id AND epi.legacy_exposant_id IS NOT NULL
  LIMIT 1;

  RETURN QUERY
  WITH ev AS (
    -- salons a venir ou l'exposant participe
    SELECT e.id FROM public.participation pa
    JOIN public.events e ON e.id = pa.id_event
    WHERE (pa.exhibitor_id = p_exhibitor_id
           OR pa.id_exposant = p_exhibitor_id::text
           OR (v_legacy IS NOT NULL AND pa.id_exposant = v_legacy))
      AND COALESCE(e.date_fin, e.date_debut) >= CURRENT_DATE
    UNION
    -- salons a venir ou il a une Nouveaute
    SELECT n.event_id FROM public.novelties n
    JOIN public.events e ON e.id = n.event_id
    WHERE n.exhibitor_id = p_exhibitor_id AND n.is_test = false
      AND COALESCE(e.date_fin, e.date_debut) >= CURRENT_DATE
    UNION
    -- salons passes seulement s'il existe deja une invitation (etat "ended")
    SELECT i.event_id FROM public.exhibitor_invitation_pages i WHERE i.exhibitor_id = p_exhibitor_id
  ),
  nov AS (
    SELECT DISTINCT ON (n.event_id) n.event_id, n.id, n.title, n.status
    FROM public.novelties n
    WHERE n.exhibitor_id = p_exhibitor_id AND n.is_test = false AND n.status <> 'rejected'
    ORDER BY n.event_id, (n.status = 'published') DESC, n.updated_at DESC NULLS LAST
  )
  SELECT
    e.id, e.nom_event, e.slug, e.date_debut, e.date_fin, e.ville,
    CASE
      WHEN COALESCE(e.date_fin, e.date_debut) < CURRENT_DATE THEN 'ended'
      WHEN i.status = 'published' AND nov.status = 'published' THEN 'online'
      WHEN i.status = 'published' THEN 'suspended'
      WHEN nov.status = 'published' AND i.id IS NOT NULL THEN 'draft'
      WHEN nov.status = 'published' THEN 'ready'
      WHEN nov.id IS NOT NULL THEN 'pending'
      ELSE 'locked'
    END,
    nov.id, nov.title, nov.status,
    i.id, i.slug, i.status,
    COALESCE((SELECT count(*)::int FROM public.leads l
              WHERE l.exhibitor_id = p_exhibitor_id AND l.event_id = e.id
                AND l.source = 'invitation_page'), 0)
  FROM ev
  JOIN public.events e ON e.id = ev.id
  LEFT JOIN nov ON nov.event_id = e.id
  LEFT JOIN public.exhibitor_invitation_pages i
         ON i.exhibitor_id = p_exhibitor_id AND i.event_id = e.id
  WHERE e.visible = true AND COALESCE(e.is_test, false) = false
  ORDER BY e.date_debut;
END;
$$;
REVOKE ALL ON FUNCTION public.get_invitation_pages_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_pages_overview(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 8. Page publique. SEULE RPC OUVERTE A anon, VOLONTAIREMENT.
--    Une invitation en brouillon ou inexistante renvoie not_found (aucune fuite).
--    Une invitation publiee mais inactive renvoie le minimum pour la page "plus active".
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invitation_page(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv     public.exhibitor_invitation_pages;
  v_ex      record;
  v_event   record;
  v_nov     record;
  v_stand   text;
  v_legacy  text;
  v_reason  text := 'ok';
BEGIN
  SELECT * INTO v_inv FROM public.exhibitor_invitation_pages
  WHERE slug = lower(p_slug) AND status = 'published';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'reason', 'not_found');
  END IF;

  SELECT p.display_name, p.logo_url, p.public_slug, COALESCE(p.is_test, false) AS is_test
    INTO v_ex
  FROM public.public_exhibitor_profiles p
  WHERE p.exhibitor_id = v_inv.exhibitor_id
  LIMIT 1;
  IF NOT FOUND OR v_ex.is_test THEN
    RETURN jsonb_build_object('active', false, 'reason', 'not_found');
  END IF;

  SELECT e.id, e.nom_event, e.slug, e.date_debut, e.date_fin, e.ville, e.nom_lieu, e.url_image,
         e.visible, COALESCE(e.is_test, false) AS is_test
    INTO v_event
  FROM public.events e WHERE e.id = v_inv.event_id;
  IF NOT FOUND OR v_event.visible IS NOT TRUE OR v_event.is_test THEN
    RETURN jsonb_build_object('active', false, 'reason', 'not_found');
  END IF;

  SELECT n.id, n.title, n.type, n.summary, n.reason_1, n.reason_2, n.reason_3,
         n.media_urls, n.slug, n.stand_info, n.status
    INTO v_nov
  FROM public.novelties n
  WHERE n.id = v_inv.novelty_id AND n.is_test = false;

  IF COALESCE(v_event.date_fin, v_event.date_debut) < CURRENT_DATE THEN
    v_reason := 'event_over';
  ELSIF v_nov.id IS NULL OR v_nov.status <> 'published' THEN
    v_reason := 'novelty_unavailable';
  END IF;

  IF v_reason <> 'ok' THEN
    RETURN jsonb_build_object(
      'active', false,
      'reason', v_reason,
      'exhibitor', jsonb_build_object('name', v_ex.display_name, 'public_slug', v_ex.public_slug),
      'event', jsonb_build_object('name', v_event.nom_event, 'slug', v_event.slug)
    );
  END IF;

  SELECT epi.legacy_exposant_id INTO v_legacy
  FROM public.exhibitor_public_identities epi
  WHERE epi.exhibitor_id = v_inv.exhibitor_id AND epi.legacy_exposant_id IS NOT NULL
  LIMIT 1;

  SELECT NULLIF(btrim(pa.stand_exposant), '') INTO v_stand
  FROM public.participation pa
  WHERE pa.id_event = v_inv.event_id
    AND (pa.exhibitor_id = v_inv.exhibitor_id
         OR pa.id_exposant = v_inv.exhibitor_id::text
         OR (v_legacy IS NOT NULL AND pa.id_exposant = v_legacy))
    AND NULLIF(btrim(pa.stand_exposant), '') IS NOT NULL
  LIMIT 1;

  RETURN jsonb_build_object(
    'active', true,
    'reason', 'ok',
    'slug', v_inv.slug,
    'headline', v_inv.headline,
    'message', v_inv.message,
    'exhibitor', jsonb_build_object(
      'name', v_ex.display_name, 'logo_url', v_ex.logo_url, 'public_slug', v_ex.public_slug),
    'event', jsonb_build_object(
      'id', v_event.id, 'name', v_event.nom_event, 'slug', v_event.slug,
      'date_debut', v_event.date_debut, 'date_fin', v_event.date_fin,
      'ville', v_event.ville, 'nom_lieu', v_event.nom_lieu, 'image_url', v_event.url_image),
    'stand', COALESCE(v_stand, NULLIF(btrim(v_nov.stand_info), '')),
    'novelty', jsonb_build_object(
      'title', v_nov.title, 'type', v_nov.type, 'summary', v_nov.summary,
      'reasons', to_jsonb(array_remove(ARRAY[v_nov.reason_1, v_nov.reason_2, v_nov.reason_3], NULL)),
      'image_url', v_nov.media_urls[1], 'slug', v_nov.slug),
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'first_name', st.first_name, 'last_name', st.last_name,
               'job_title', st.job_title, 'photo_url', st.photo_url,
               'linkedin_url', st.linkedin_url)
             ORDER BY eis.sort_order, st.sort_order)
      FROM public.exhibitor_invitation_page_staff eis
      JOIN public.exhibitor_staff st ON st.id = eis.staff_id AND st.is_active
      WHERE eis.invitation_id = v_inv.id), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_invitation_page(text) FROM PUBLIC;
-- Ouverture publique INTENTIONNELLE : page destinee a des visiteurs non connectes.
GRANT EXECUTE ON FUNCTION public.get_invitation_page(text) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Onglet Rendez-vous : liste unifiee, floutage calcule cote serveur (D1)
--    - page d'invitation, ou rendez-vous ancre exposant+salon : jamais floute
--    - lead ancre Nouveaute : regle existante de novelty-leads (3 premiers par
--      Nouveaute visibles, sauf Premium leads_unlimited ou admin)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_exhibitor_leads(p_exhibitor_id uuid)
RETURNS TABLE (
  id             uuid,
  lead_type      text,
  origin         text,
  status         text,
  created_at     timestamptz,
  event_id       uuid,
  event_name     text,
  event_slug     text,
  novelty_id     uuid,
  novelty_title  text,
  preferred_slot text,
  first_name     text,
  last_name      text,
  email          text,
  phone          text,
  company        text,
  role           text,
  notes          text,
  masked         boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  v_is_admin boolean := public.is_admin();
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_team_member(p_exhibitor_id) OR v_is_admin) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT l.*,
           row_number() OVER (PARTITION BY l.novelty_id ORDER BY l.created_at) AS rn,
           EXISTS (SELECT 1 FROM public.premium_entitlements pe
                   WHERE pe.exhibitor_id = l.exhibitor_id AND pe.event_id = l.event_id
                     AND pe.revoked_at IS NULL AND pe.leads_unlimited) AS premium
    FROM public.leads l
    WHERE l.exhibitor_id = p_exhibitor_id
  ),
  m AS (
    SELECT b.*,
           (b.novelty_id IS NOT NULL
            AND COALESCE(b.source, 'site') <> 'invitation_page'
            AND NOT v_is_admin
            AND NOT b.premium
            AND b.rn > 3) AS is_masked
    FROM base b
  )
  SELECT
    m.id,
    m.lead_type,
    CASE WHEN m.source = 'invitation_page' THEN 'invitation_page'
         WHEN m.novelty_id IS NOT NULL THEN 'novelty'
         ELSE 'visitor_journey' END,
    COALESCE(m.status, 'new'),
    m.created_at,
    m.event_id, e.nom_event, e.slug,
    m.novelty_id, n.title,
    m.preferred_slot,
    CASE WHEN m.is_masked THEN left(m.first_name, 2) || '***' ELSE m.first_name END,
    CASE WHEN m.is_masked THEN left(m.last_name, 1) || '***' ELSE m.last_name END,
    CASE WHEN m.is_masked THEN left(m.email, 2) || '***@***.***' ELSE m.email END,
    CASE WHEN m.is_masked AND m.phone IS NOT NULL THEN left(m.phone, 2) || ' ** ** ** **' ELSE m.phone END,
    CASE WHEN m.is_masked AND m.company IS NOT NULL THEN left(m.company, 2) || '***' ELSE m.company END,
    CASE WHEN m.is_masked AND m.role IS NOT NULL THEN left(m.role, 2) || '***' ELSE m.role END,
    CASE WHEN m.is_masked THEN NULL ELSE m.notes END,
    m.is_masked
  FROM m
  LEFT JOIN public.events e ON e.id = m.event_id
  LEFT JOIN public.novelties n ON n.id = m.novelty_id
  ORDER BY m.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_exhibitor_leads(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exhibitor_leads(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
