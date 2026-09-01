-- ============================================================================
-- LOT 1b — Fusion des organisateurs par domaine racine + synchronisation
-- Appliquée en production le 2026-09-01 via Supabase MCP.
-- Deux migrations enregistrées dans supabase_migrations.schema_migrations :
--   lot1b_fusion_organisateurs_par_domaine_racine
--   lot1b_execution_fusion_et_sync_organisateurs
-- Ce fichier réunit les deux.
--
-- Contexte : le seed du Lot 1 regroupait par domaine exact. Les organisateurs
-- qui déclinent leurs salons par ville en sous-domaines (SEPEM, Age 3,
-- Petite Enfance, Handi 4, Autonomic, Hexagone) se retrouvaient éclatés en
-- autant d'organisateurs distincts, donc autant d'emails vers la même
-- personne. La clé de regroupement devient le domaine racine.
--
-- Le bloc d'exécution est idempotent : relancé, il ne trouve plus de groupe
-- à fusionner et ne fait rien. Il refuse en revanche de s'exécuter si un
-- email est déjà parti.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Suffixes publics et plateformes mutualisees : jamais regroupables
--    Sans cette table, handica.eventmaker.io et
--    zero-impact-packaging.eventmaker.io, qui sont deux evenements sans lien
--    heberges par la meme billetterie, seraient fusionnes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizer_non_groupable_domains (
  domain     text PRIMARY KEY,
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizer_non_groupable_domains IS
  'Domaines racines qui ne designent pas un organisateur : suffixes publics et plateformes mutualisees. Deux sous-domaines partageant une de ces racines restent des organisateurs distincts.';

ALTER TABLE public.organizer_non_groupable_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage non groupable domains" ON public.organizer_non_groupable_domains;
CREATE POLICY "Admins can manage non groupable domains" ON public.organizer_non_groupable_domains
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "service_role_full_access_non_groupable" ON public.organizer_non_groupable_domains;
CREATE POLICY "service_role_full_access_non_groupable" ON public.organizer_non_groupable_domains
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.organizer_non_groupable_domains (domain, reason) VALUES
  ('asso.fr',        'suffixe public'),
  ('gouv.fr',        'suffixe public'),
  ('co.uk',          'suffixe public'),
  ('org.uk',         'suffixe public'),
  ('com.br',         'suffixe public'),
  ('eventmaker.io',  'plateforme de billetterie mutualisee'),
  ('eventbrite.fr',  'plateforme de billetterie mutualisee'),
  ('eventbrite.com', 'plateforme de billetterie mutualisee'),
  ('helloasso.com',  'plateforme mutualisee'),
  ('wixsite.com',    'hebergeur mutualise'),
  ('wordpress.com',  'hebergeur mutualise'),
  ('blogspot.com',   'hebergeur mutualise'),
  ('google.com',     'hebergeur mutualise'),
  ('canva.site',     'hebergeur mutualise')
ON CONFLICT (domain) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Extraction du domaine racine
--    Deux labels par defaut. Trois si la racine a deux labels est un suffixe
--    public ou une plateforme (anpde.asso.fr reste anpde.asso.fr).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organizer_root_domain(_domain text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH c AS (
    SELECT
      lower(btrim(_domain)) AS dom,
      (regexp_match(lower(btrim(_domain)), '([^.]+[.][^.]+)$'))[1] AS r2,
      (regexp_match(lower(btrim(_domain)), '([^.]+[.][^.]+[.][^.]+)$'))[1] AS r3
  )
  SELECT CASE
    WHEN c.r2 IS NULL THEN c.dom
    WHEN NOT EXISTS (SELECT 1 FROM organizer_non_groupable_domains n WHERE n.domain = c.r2) THEN c.r2
    WHEN c.r3 IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM organizer_non_groupable_domains n WHERE n.domain = c.r3) THEN c.r3
    ELSE c.dom
  END
  FROM c;
$function$;

COMMENT ON FUNCTION public.organizer_root_domain(text) IS
  'Domaine racine servant de cle de regroupement des organisateurs. Remonte a trois labels si la racine a deux labels est un suffixe public ou une plateforme mutualisee.';

-- ---------------------------------------------------------------------------
-- 3. Garde-fou : aucune fusion si un email est deja parti
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_sent integer;
BEGIN
  SELECT count(*) INTO v_sent
  FROM organizer_outreach_campaigns
  WHERE last_sent_at IS NOT NULL OR claim_step > 0;

  IF v_sent > 0 THEN
    RAISE EXCEPTION 'FUSION REFUSEE : % campagne(s) ont deja envoye un email', v_sent;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Determination du gardien de chaque groupe
--    Priorite au porteur du domaine racine nu, sinon ordre alphabetique.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE tmp_merge ON COMMIT DROP AS
WITH r AS (
  SELECT o.id, o.primary_domain, o.outreach_blocked,
         public.organizer_root_domain(o.primary_domain) AS root
  FROM organizers o
),
grp AS (
  SELECT root FROM r GROUP BY root HAVING count(*) > 1
),
ranked AS (
  SELECT r.*,
         row_number() OVER (
           PARTITION BY r.root
           ORDER BY (r.primary_domain = r.root) DESC, r.primary_domain
         ) AS rn
  FROM r JOIN grp g ON g.root = r.root
)
SELECT
  ranked.root,
  ranked.id,
  ranked.primary_domain,
  ranked.outreach_blocked,
  (ranked.rn = 1) AS is_keeper,
  first_value(ranked.id) OVER (PARTITION BY ranked.root ORDER BY ranked.rn) AS keeper_id
FROM ranked;

-- ---------------------------------------------------------------------------
-- 5. Propagation du blocage : un refus sur un sous-domaine bloque le groupe
-- ---------------------------------------------------------------------------
UPDATE organizers o
SET outreach_blocked = true,
    blocked_reason   = COALESCE(o.blocked_reason, 'Blocage herite lors de la fusion par domaine racine'),
    blocked_at       = COALESCE(o.blocked_at, now())
WHERE o.id IN (
  SELECT DISTINCT m.keeper_id FROM tmp_merge m
  WHERE EXISTS (SELECT 1 FROM tmp_merge x WHERE x.root = m.root AND x.outreach_blocked)
);

-- ---------------------------------------------------------------------------
-- 6. Rattachement des domaines au gardien, puis suppression des absorbes
-- ---------------------------------------------------------------------------
UPDATE organizer_domains od
SET organizer_id = m.keeper_id
FROM tmp_merge m
WHERE od.organizer_id = m.id
  AND NOT m.is_keeper;

DELETE FROM organizer_outreach_campaigns c
USING tmp_merge m
WHERE c.organizer_id = m.id AND NOT m.is_keeper;

DELETE FROM organizers o
USING tmp_merge m
WHERE o.id = m.id AND NOT m.is_keeper;

-- ---------------------------------------------------------------------------
-- 7. Normalisation du domaine principal sur la racine
--    Beneficie aussi aux organisateurs isoles : Hunter interrogera
--    messefrankfurt.com plutot que texworld-paris.fr.messefrankfurt.com.
-- ---------------------------------------------------------------------------
UPDATE organizers o
SET primary_domain = public.organizer_root_domain(o.primary_domain),
    name           = public.organizer_root_domain(o.primary_domain),
    website        = 'https://' || public.organizer_root_domain(o.primary_domain)
WHERE o.primary_domain <> public.organizer_root_domain(o.primary_domain)
  AND NOT EXISTS (
    SELECT 1 FROM organizers x
    WHERE x.id <> o.id
      AND x.primary_domain = public.organizer_root_domain(o.primary_domain)
  );

-- ---------------------------------------------------------------------------
-- 8. Synchronisation continue
--    Rattache les domaines des evenements nouvellement importes en
--    respectant le regroupement par racine. A appeler depuis WF1.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_organizers_from_events()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r              record;
  v_root         text;
  v_organizer_id uuid;
  v_created      integer := 0;
  v_attached     integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT e.url_site_officiel_domain AS domain
    FROM events e
    LEFT JOIN organizer_domains od ON od.domain = e.url_site_officiel_domain
    WHERE e.visible = true
      AND COALESCE(e.is_test, false) = false
      AND btrim(COALESCE(e.url_site_officiel_domain, '')) <> ''
      AND od.id IS NULL
  LOOP
    v_root := public.organizer_root_domain(r.domain);

    SELECT o.id INTO v_organizer_id
    FROM organizers o
    WHERE o.primary_domain = v_root
    LIMIT 1;

    IF v_organizer_id IS NULL THEN
      SELECT od.organizer_id INTO v_organizer_id
      FROM organizer_domains od
      WHERE public.organizer_root_domain(od.domain) = v_root
      LIMIT 1;
    END IF;

    IF v_organizer_id IS NULL THEN
      INSERT INTO organizers (name, primary_domain, website)
      VALUES (v_root, v_root, 'https://' || v_root)
      ON CONFLICT (primary_domain) DO NOTHING
      RETURNING id INTO v_organizer_id;

      IF v_organizer_id IS NULL THEN
        SELECT o.id INTO v_organizer_id FROM organizers o WHERE o.primary_domain = v_root;
      ELSE
        v_created := v_created + 1;
      END IF;
    END IF;

    INSERT INTO organizer_domains (organizer_id, domain)
    VALUES (v_organizer_id, r.domain)
    ON CONFLICT (domain) DO NOTHING;

    v_attached := v_attached + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'organizers_created', v_created,
    'domains_attached', v_attached
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_organizers_from_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_organizers_from_events() FROM anon;
REVOKE ALL ON FUNCTION public.sync_organizers_from_events() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_organizers_from_events() TO service_role;
