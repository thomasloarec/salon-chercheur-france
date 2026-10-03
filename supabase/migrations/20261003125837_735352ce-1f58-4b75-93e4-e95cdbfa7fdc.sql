-- 20261003170000_assistant_promesse_concrete.sql
-- Assistant « Pépites » : critère « promesse concrète ».
-- Une session dont on ne peut pas dire ce qu'on y apprendra, verra ou pratiquera (ni qui on y entendra)
-- n'est plus suggérée : nouvelle raison « sans_promesse ». Chaque session et chaque Nouveauté suggérable
-- reçoit une phrase « promesse », affichée plus tard sous le titre de la pépite.
-- Aucune donnée existante n'est supprimée.

alter table public.session_enrichment add column if not exists promise text;
alter table public.novelty_enrichment add column if not exists promise text;

alter table public.session_enrichment drop constraint if exists session_enrichment_reason_chk;
alter table public.session_enrichment add constraint session_enrichment_reason_chk
  check (unsuggestible_reason is null or unsuggestible_reason in
    ('type_non_contenu','logistique','protocolaire','titre_vague','contenu_insuffisant','sans_promesse'));

notify pgrst, 'reload schema';