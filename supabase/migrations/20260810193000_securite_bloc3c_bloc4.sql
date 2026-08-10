-- BLOC 3c : fermeture de la lecture publique de public.profiles.
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_admin());

-- BLOC 4 : public_novelties en security_invoker (teste, 61 lignes inchangees).
ALTER VIEW public.public_novelties SET (security_invoker = on);

-- public_exhibitor_profiles reste en SECURITY DEFINER : la bascule echoue
-- (permission denied for table exhibitors) a cause du Column-Level Security
-- masquant des colonnes a anon. Choix delibere et documente.
COMMENT ON VIEW public.public_exhibitor_profiles IS
  'Vue publique des profils exposants. SECURITY DEFINER DELIBERE : bascule en invoker impossible (colonnes de exhibitors masquees a anon par CLS). N''expose aucune donnee CRM.';

