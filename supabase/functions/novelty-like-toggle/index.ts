import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

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
      .select('id, event_id, exhibitor_id, title')
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

    // Fire in-app notification only when a like was just created
    if (liked && novelty.exhibitor_id) {
      try {
        const { data: members } = await supabaseClient
          .from('exhibitor_team_members')
          .select('user_id')
          .eq('exhibitor_id', novelty.exhibitor_id)
          .eq('status', 'active');

        const recipients = (members ?? [])
          .map((m: any) => m.user_id)
          .filter((uid: string) => uid && uid !== user.id);

        if (recipients.length === 0) {
          console.log('[novelty_like_notification] no active recipients', { novelty_id, exhibitor_id: novelty.exhibitor_id });
        } else {
          // Resolve actor info
          const { data: actorProfile } = await supabaseClient
            .from('profiles')
            .select('first_name, last_name, company')
            .eq('user_id', user.id)
            .maybeSingle();
          const actorName = [actorProfile?.first_name, actorProfile?.last_name]
            .filter(Boolean).join(' ').trim() || 'Un utilisateur';
          const actorEmail = user.email ?? undefined;
          const actorCompany = actorProfile?.company ?? undefined;

          const notifUrl = `${supabaseUrl}/functions/v1/notifications-create`;
          await Promise.all(recipients.map(async (recipient: string) => {
            try {
              const r = await fetch(notifUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({
                  type: 'like',
                  user_id: recipient,
                  novelty_id,
                  exhibitor_id: novelty.exhibitor_id,
                  event_id: novelty.event_id,
                  actor_user_id: user.id,
                  actor_name: actorName,
                  actor_email: actorEmail,
                  actor_company: actorCompany,
                }),
              });
              if (!r.ok) {
                console.error('[novelty_like_notification] create failed', { recipient_user_id: recipient, novelty_id, status: r.status, body: await r.text().catch(() => '') });
              } else {
                console.log('[novelty_like_notification] sent', { recipient_user_id: recipient, novelty_id, actor_user_id: user.id, actor_email: actorEmail });
              }
            } catch (e) {
              console.error('[novelty_like_notification] exception', { recipient_user_id: recipient, novelty_id, error: String(e) });
            }
          }));
        }
      } catch (e) {
        // Never fail the like because of notification issues
        console.error('[novelty_like_notification] outer exception', { novelty_id, error: String(e) });
      }
    }

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
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});