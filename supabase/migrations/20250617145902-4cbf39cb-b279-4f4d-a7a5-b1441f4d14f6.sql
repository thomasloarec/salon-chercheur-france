
-- Create the favorites table
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

-- Enable Row Level Security
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own favorites
CREATE POLICY "Users can read their favorites"
  ON public.favorites
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add favorites
CREATE POLICY "Users can add favorites"
  ON public.favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their favorites
CREATE POLICY "Users can delete their favorites"
  ON public.favorites
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create the toggle_favorite RPC function
CREATE OR REPLACE FUNCTION public.toggle_favorite(p_event uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.favorites WHERE user_id = auth.uid() AND event_id = p_event) THEN
    DELETE FROM public.favorites WHERE user_id = auth.uid() AND event_id = p_event;
  ELSE
    INSERT INTO public.favorites(user_id, event_id) VALUES (auth.uid(), p_event);
  END IF;
END;
$$;
