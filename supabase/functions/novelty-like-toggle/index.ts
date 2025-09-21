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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    
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

    // Check if user has already liked this novelty
    const { data: existingLike } = await supabaseClient
      .from('novelty_likes')
      .select('novelty_id')
      .eq('novelty_id', novelty_id)
      .eq('user_id', user.id)
      .single();

    let liked = false;

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
        .insert([
          {
            novelty_id,
            user_id: user.id,
          },
        ]);
      liked = true;
    }

    // Get updated count
    const { count } = await supabaseClient
      .from('novelty_likes')
      .select('*', { count: 'exact', head: true })
      .eq('novelty_id', novelty_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        liked, 
        count: count || 0 
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});