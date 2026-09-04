-- ============================================================
-- WF5 — Lot 1 : resolution du destinataire reel de la piste activation.
--
-- Principe : le destinataire n'est PAS le contact prospecte par Hunter
-- (piste claim), c'est le compte utilisateur qui a effectivement
-- revendique le ou les salons (events.owner_user_id).
--
-- La fonction est SECURITY DEFINER car elle lit auth.users, qui ne doit
-- jamais etre expose via une vue.
-- ============================================================

-- Boites generiques : on n'en derive jamais un prenom.
CREATE OR REPLACE FUNCTION public.is_generic_mailbox(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT split_part(lower(btrim(COALESCE(p_email, ''))), '@', 1) = ANY (ARRAY[
    'contact','contacts','info','infos','direction','admin','administration',
    'hello','bonjour','commercial','commerciale','marketing','communication',
    'com','presse','press','service','services','accueil','secretariat',
    'secretaire','no-reply','noreply','ne-pas-repondre','salon','salons',
    'expo','event','events','evenement','evenements','organisation',
    'inscription','inscriptions','support','office','team','equipe','sales'
  ]);
$$;

-- Derivation prudente du prenom depuis la partie locale de l'email.
-- Retourne NULL des que le moindre doute existe : mieux vaut "Bonjour,"
-- qu'un prenom invente.
CREATE OR REPLACE FUNCTION public.derive_first_name_from_email(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_local text;
  v_cand  text;
BEGIN
  IF p_email IS NULL OR public.is_generic_mailbox(p_email) THEN
    RETURN NULL;
  END IF;

  v_local := split_part(lower(btrim(p_email)), '@', 1);

  -- prenom.nom / prenom-nom / prenom_nom -> on garde le premier segment
  v_cand := split_part(split_part(split_part(v_local, '.', 1), '-', 1), '_', 1);

  -- Rejet des initiales (j.dupont), des chiffres et des formes trop courtes
  IF v_cand !~ '^[a-zàâäéèêëîïôöùûüç]{3,20}$' THEN
    RETURN NULL;
  END IF;

  RETURN initcap(v_cand);
END;
$$;

-- ------------------------------------------------------------
-- Resolution du destinataire d'une campagne d'activation.
-- Retourne 0 ligne si aucun destinataire exploitable.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_organizer_activation_recipient(p_campaign_id uuid)
RETURNS TABLE (
  owner_user_id      uuid,
  recipient_email    text,
  first_name         text,
  is_generic         boolean,
  nb_owners          integer,
  is_internal        boolean,
  is_blacklisted     boolean,
  block_reason       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner   uuid;
  v_nb      integer;
  v_email   text;
  v_fname   text;
BEGIN
  SELECT s.primary_owner_user_id, s.nb_owners_distincts
    INTO v_owner, v_nb
  FROM public.v_organizer_activation_state s
  WHERE s.campaign_id = p_campaign_id;

  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  SELECT lower(btrim(u.email)) INTO v_email
  FROM auth.users u
  WHERE u.id = v_owner;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  -- Prenom : le profil renseigne fait toujours autorite sur la derivation.
  SELECT NULLIF(btrim(p.first_name), '') INTO v_fname
  FROM public.profiles p
  WHERE p.user_id = v_owner;

  IF v_fname IS NULL THEN
    v_fname := public.derive_first_name_from_email(v_email);
  ELSE
    v_fname := initcap(v_fname);
  END IF;

  RETURN QUERY
  SELECT
    v_owner,
    v_email,
    v_fname,
    public.is_generic_mailbox(v_email),
    v_nb,
    (v_email LIKE '%@lotexpo.com'),
    public.is_email_blacklisted(v_email),
    CASE
      WHEN v_email LIKE '%@lotexpo.com'          THEN 'compte_interne'
      WHEN public.is_email_blacklisted(v_email)  THEN 'blacklist'
      WHEN v_nb > 1                              THEN 'multi_owners'
      ELSE NULL
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_organizer_activation_recipient(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_organizer_activation_recipient(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_organizer_activation_recipient(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_organizer_activation_recipient(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.derive_first_name_from_email(text) FROM anon;
REVOKE ALL ON FUNCTION public.is_generic_mailbox(text) FROM anon;
