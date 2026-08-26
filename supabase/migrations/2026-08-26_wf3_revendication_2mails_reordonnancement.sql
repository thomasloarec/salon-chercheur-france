-- =====================================================================
-- WF3 Revendication exposant : passage 2 mails + reordonnancement file
-- Date        : 2026-08-26
-- Appliquee   : OUI (via Supabase apply_migration, projet vxivdvzzhebobveedxbj)
-- Objet       : v_eligibles_revendication
-- =====================================================================
--
-- CONTEXTE
-- Le workflow WF3 s'auto-limite a ~50 envois par jour ouvre (cron */14, 8h-17h,
-- lundi-vendredi, limit=1). Ce plafond est le facteur limitant. La file des
-- premiers contacts (E1) jamais envoyes est massive :
--   - 11 459 campagnes 'pending' au step 0 (E1 jamais parti)
--   - dont 3 433 immediatement actionnables (Hunter 'ready' + email primaire)
--   - dont 2 212 eligibles maintenant (salon dans la fenetre J+3 a J+90)
--   - contre seulement 852 entreprises ayant deja recu un E1
--
-- DEUX CHANGEMENTS, LE RESTE DE LA DEFINITION EST REPRIS A L'IDENTIQUE :
--   1. WHERE : claim_step < 3  devient  claim_step < 2
--      => la sequence s'arrete apres la relance unique. L'E3 (urgence) ne part
--         plus. Chaque entreprise consomme 2 envois au lieu de 3, ce qui augmente
--         d'environ 50 % le nombre de nouvelles entreprises entrees a budget
--         d'envoi constant, et libere ~371 relances deja engagees.
--   2. ORDER BY : relances d'abord (claim_step DESC, inchange), puis salon le plus
--      proche (e.date_debut), en gardant les lignes d'un meme salon contigues
--      (oc.event_id). But : concentrer la capacite salon par salon pour franchir
--      le seuil de 10 revendications qui active la preuve sociale forte de la
--      relance, et ne jamais gaspiller d'envoi sur un salon deja passe.
--
-- REVERSIBILITE
-- Pour revenir a 3 mails : remettre claim_step < 3 et l'ancien ORDER BY
--   (ORDER BY oc.claim_step DESC, oc.next_send_at NULLS FIRST, oc.id).
--
-- SANS REGRESSION VERIFIEE
--   - Colonnes de sortie identiques (memes noms, meme ordre) => aucun dependant casse.
--   - Comptage inchange apres application : 2 212 lignes, toutes step 0.
-- =====================================================================

CREATE OR REPLACE VIEW public.v_eligibles_revendication AS
 SELECT oc.id,
    c.contact_email,
    c.first_name,
    oc.company_name,
    e.nom_event,
    slug.public_slug,
    oc.claim_step,
    ( SELECT count(*) AS count
           FROM outreach_campaigns oc2
          WHERE oc2.event_id = oc.event_id AND oc2.claim_status = 'claimed'::text) AS claimed_count,
    oc.next_send_at
   FROM outreach_campaigns oc
     JOIN events e ON e.id = oc.event_id
     LEFT JOIN participation p ON p.id_participation = oc.participation_id
     LEFT JOIN outreach_contacts c ON c.outreach_campaign_id = oc.id AND c.is_primary = true
     LEFT JOIN LATERAL ( SELECT COALESCE(( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.exhibitor_id = oc.exhibitor_id AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.exhibitor_id = p.exhibitor_id AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.legacy_exposant_id = oc.id_exposant_legacy AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.legacy_exposant_id = p.id_exposant AND epi.is_active = true
                 LIMIT 1)) AS public_slug) slug ON true
  WHERE oc.hunter_status = 'ready'::text
    AND c.contact_email IS NOT NULL
    AND (oc.claim_status = ANY (ARRAY['pending'::text, 'active'::text]))
    AND oc.opt_out = false
    AND NOT is_email_blacklisted(c.contact_email)
    AND oc.claim_step < 2
    AND (oc.next_send_at IS NULL OR oc.next_send_at <= now())
    AND e.date_debut >= (CURRENT_DATE + 3)
    AND e.date_debut <= (CURRENT_DATE + 90)
    AND e.visible = true
    AND e.is_test = false
    AND slug.public_slug IS NOT NULL
  ORDER BY oc.claim_step DESC, e.date_debut, oc.event_id, oc.next_send_at NULLS FIRST, oc.id;
