-- 20261001173000_sante_site_domaines_exposants.sql
-- Ajoute 2 contrôles au tableau de bord « Santé du site » (admin, onglet Santé).
-- Ce contrôle tourne toutes les 30 min (cron site-health-sweep -> refresh_site_health())
-- et envoie une notification in-app aux admins à chaque nouvel incident.
--
--   1. exhibitor_domains : exposants avec un site valide mais sans domaine calculé
--      (invisibles pour Radar CRM), ou trigger trg_exposants_normalized_domain absent.
--      C'est le trou silencieux constaté le 01/10/2026 (15 058 fiches depuis mi-mai).
--   2. exhibitor_invalid_websites : exposants d'un salon à venir dont le site est
--      illisible (email, "htttps", "www;site.fr"...), à corriger dans Airtable.
--
-- Prérequis : appliquer d'abord 20261001160000_exposants_normalized_domain_auto.sql
-- (sinon le contrôle 1 passe en critique, ce qui est voulu, et le contrôle 2 compte à tort
-- les 15 000 fiches non rattrapées).
--
-- Méthode : on relit la définition actuelle de compute_site_health() et on insère les
-- 2 blocs juste avant la fin, sans retaper le reste de la fonction. Idempotent :
-- ne fait rien si les contrôles existent déjà. S'arrête si la fin attendue est introuvable.

DO $migration$
DECLARE
  v_def   text;
  v_tail  text := E'END;\n$function$';
  v_new   text;
  v_block text := $blk$
  -- RADAR CRM : exposants avec site valide mais sans domaine calculé (01/10/2026)
  RETURN QUERY
  SELECT 'exhibitor_domains','Qualité données','Domaines web exposants (Radar CRM)',
    CASE WHEN NOT x.trg THEN 'critical' WHEN x.n>100 THEN 'critical' WHEN x.n>0 THEN 'warn' ELSE 'ok' END,
    x.n::numeric,
    CASE WHEN NOT x.trg
      THEN 'Trigger trg_exposants_normalized_domain absent : les nouveaux exposants n''ont pas de domaine, Radar CRM ne les voit pas. '||x.n||' exposant(s) concerné(s)'
      ELSE x.n||' exposant(s) avec un site valide mais sans domaine calculé (invisibles pour Radar CRM)' END
  FROM (
    SELECT count(*) n,
      EXISTS(SELECT 1 FROM pg_trigger t
             WHERE t.tgname='trg_exposants_normalized_domain'
               AND t.tgrelid='public.exposants'::regclass
               AND t.tgenabled<>'D') AS trg
    FROM exposants ex
    WHERE (ex.normalized_domain IS NULL OR btrim(ex.normalized_domain)='')
      AND coalesce(btrim(ex.website_exposant),'')<>''
      AND public.web_domain(ex.website_exposant) IS NOT NULL
  ) x;

  -- Sites exposants illisibles sur les salons à venir (à corriger dans Airtable)
  RETURN QUERY
  SELECT 'exhibitor_invalid_websites','Qualité données','Sites exposants illisibles (salons à venir)',
    CASE WHEN x.n>0 THEN 'warn' ELSE 'ok' END,
    x.n::numeric,
    CASE WHEN x.n>0
      THEN x.n||' exposant(s) d''un salon à venir ont un site illisible, à corriger dans Airtable : '||x.names
           ||CASE WHEN x.n>10 THEN '...' ELSE '' END
      ELSE 'Tous les sites des exposants des salons à venir sont exploitables' END
  FROM (
    SELECT count(*) n, string_agg(s.nom||' ('||s.site||')', ', ' ORDER BY s.nom) FILTER (WHERE s.rn<=10) names
    FROM (
      SELECT ex.nom_exposant AS nom, left(ex.website_exposant, 40) AS site,
             row_number() OVER (ORDER BY ex.nom_exposant) AS rn
      FROM exposants ex
      -- Le trigger calcule le domaine à chaque écriture : un site renseigné sans
      -- domaine calculé est donc un site illisible (pas de web_domain() sur 30 000 lignes).
      WHERE coalesce(btrim(ex.website_exposant),'')<>''
        AND (ex.normalized_domain IS NULL OR btrim(ex.normalized_domain)='')
        AND coalesce(ex.dedup_status,'')<>'merged'
        AND EXISTS(SELECT 1 FROM participation p JOIN events e ON e.id=p.id_event
                   WHERE p.id_exposant=ex.id_exposant AND e.visible=true
                     AND coalesce(e.date_fin, e.date_debut)>=current_date)
    ) s
  ) x;
$blk$;
BEGIN
  v_def := pg_get_functiondef('public.compute_site_health'::regproc);

  IF position('exhibitor_domains' IN v_def) > 0 THEN
    RAISE NOTICE 'compute_site_health contient déjà exhibitor_domains : rien à faire';
    RETURN;
  END IF;

  IF right(rtrim(v_def, E'\n'), length(v_tail)) <> v_tail THEN
    RAISE EXCEPTION 'Fin de compute_site_health inattendue : migration arrêtée, rien n''a été modifié';
  END IF;

  v_new := left(rtrim(v_def, E'\n'), length(rtrim(v_def, E'\n')) - length(v_tail))
           || v_block || E'\n' || v_tail || E'\n';
  EXECUTE v_new;
END
$migration$;
