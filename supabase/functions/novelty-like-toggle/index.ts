import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabaseClient = createClient(supabaseUrl, serviceKey);
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Create client with user auth for RLS
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await userClient.auth.getUser();
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { novelty_id } = await req.json();

    if (!novelty_id) {
      return new Response(
        JSON.stringify({ error: 'novelty_id is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get novelty with event info
    const { data: novelty, error: noveltyError } = await supabaseClient
      .from('novelties')
      .select('id, event_id')
      .eq('id', novelty_id)
      .single();

    if (noveltyError || !novelty) {
      return new Response(
        JSON.stringify({ error: 'Novelty not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if user has already liked this novelty
    const { data: existingLike } = await supabaseClient
      .from('novelty_likes')
      .select('novelty_id')
      .eq('novelty_id', novelty_id)
      .eq('user_id', user.id)
      .maybeSingle();

    let liked = false;
    let eventFavorited = false;

    if (existingLike) {
      // Remove like
      await supabaseClient
        .from('novelty_likes')
        .delete()
        .eq('novelty_id', novelty_id)
        .eq('user_id', user.id);
    } else {
      // Add like
      await supabaseClient
        .from('novelty_likes')
        .insert([{
          novelty_id,
          user_id: user.id,
        }]);
      liked = true;

      // Check if event is already favorited
      const { data: existingFavorite } = await supabaseClient
        .from('favorites')
        .select('id')
        .eq('event_id', novelty.event_id)
        .eq('user_id', user.id)
        .maybeSingle();

      // Add event to favorites if not already there
      if (!existingFavorite) {
        const { error: favoriteError } = await supabaseClient
          .from('favorites')
          .insert([{
            event_id: novelty.event_id,
            event_uuid: novelty.event_id, // Compatibility
            user_id: user.id,
          }]);
        
        if (!favoriteError) {
          eventFavorited = true;
        }
      }
    }

    // Get updated like count
    const { count } = await supabaseClient
      .from('novelty_likes')
      .select('*', { count: 'exact', head: true })
      .eq('novelty_id', novelty_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        liked, 
        likesCount: count || 0,
        eventFavorited
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in novelty-like-toggle:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});