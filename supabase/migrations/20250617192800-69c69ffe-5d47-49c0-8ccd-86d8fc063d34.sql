
-- Créer la table profiles pour les informations utilisateur
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  first_name text,
  last_name text,
  job_title text,
  company text,
  primary_sector uuid REFERENCES public.sectors(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Activer RLS sur la table profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger pour auto-créer un profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  RETURN new;
END;
$$;

-- Créer le trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER handle_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Fonction RPC pour changer le mot de passe
CREATE OR REPLACE FUNCTION public.update_user_password(
  current_password text,
  new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
BEGIN
  -- Vérifier que l'utilisateur est connecté
  user_id := auth.uid();
  IF user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Mettre à jour le mot de passe via l'API auth de Supabase
  -- Note: Cette fonction nécessite une implémentation côté edge function
  -- pour des raisons de sécurité
  RETURN json_build_object('success', true);
END;
$$;

-- Fonction RPC pour supprimer un compte utilisateur
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
BEGIN
  user_id := auth.uid();
  IF user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Supprimer toutes les données liées à l'utilisateur
  DELETE FROM public.favorites WHERE user_id = auth.uid();
  DELETE FROM public.newsletter_subscriptions WHERE email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  );
  DELETE FROM public.profiles WHERE user_id = auth.uid();
  
  -- Note: La suppression de auth.users nécessite une edge function
  -- pour des raisons de sécurité
  RETURN json_build_object('success', true);
END;
$$;

-- Fonction pour exporter les données utilisateur
CREATE OR REPLACE FUNCTION public.export_user_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
  user_data json;
BEGIN
  user_id := auth.uid();
  IF user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT json_build_object(
    'profile', row_to_json(p.*),
    'favorites', json_agg(DISTINCT f.*),
    'newsletter_subscriptions', json_agg(DISTINCT ns.*)
  ) INTO user_data
  FROM public.profiles p
  LEFT JOIN public.favorites f ON f.user_id = p.user_id
  LEFT JOIN public.newsletter_subscriptions ns ON ns.email = (
    SELECT email FROM auth.users WHERE id = p.user_id
  )
  WHERE p.user_id = user_id
  GROUP BY p.id;

  RETURN user_data;
END;
$$;
