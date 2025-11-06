import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { novelty_id } = await req.json();

    if (!novelty_id) {
      return new Response(
        JSON.stringify({ error: 'novelty_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get novelty with exhibitor ownership info
    const { data: novelty, error: noveltyError } = await supabase
      .from('novelties')
      .select(`
        id, 
        is_premium, 
        created_by,
        exhibitors!inner (
          owner_user_id
        )
      `)
      .eq('id', novelty_id)
      .single();

    if (noveltyError || !novelty) {
      return new Response(
        JSON.stringify({ error: 'Novelty not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    const isAdmin = !!userRoles;

    // Check authorization: must be exhibitor owner, novelty creator, or admin
    const isOwner = novelty.exhibitors.owner_user_id === user.id;
    const isCreator = novelty.created_by === user.id;

    if (!isOwner && !isCreator && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized to view these leads' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all leads for this novelty
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('novelty_id', novelty_id)
      .order('created_at', { ascending: false });

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leads' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side masking: apply same logic as frontend paywall
    let filteredLeads = leads || [];
    const totalLeads = leads?.length || 0;
    let blurredCount = 0;
    let hiddenCount = 0;
    
    if (!novelty.is_premium && !isAdmin) {
      // Visible: first 3 leads (full data)
      const visibleLeads = filteredLeads.slice(0, 3);
      
      // Blurred: leads 4-6 (partial masking)
      const blurredLeads = filteredLeads.slice(3, 6).map((lead) => ({
        ...lead,
        first_name: lead.first_name.slice(0, 2) + '***',
        last_name: lead.last_name.charAt(0) + '***',
        email: lead.email.slice(0, 2) + '***@***.***',
        phone: lead.phone ? lead.phone.slice(0, 2) + ' ** ** ** **' : null,
        company: lead.company ? lead.company.slice(0, 2) + '***' : null,
        role: lead.role ? lead.role.slice(0, 2) + '***' : null,
        notes: null
      }));
      
      // Hidden: leads 7+ (not returned at all)
      filteredLeads = [...visibleLeads, ...blurredLeads];
      blurredCount = Math.min(blurredLeads.length, 3);
      hiddenCount = Math.max(0, totalLeads - 6);
      
      console.log('[premium_masking_applied]', { 
        total: totalLeads, 
        visible: visibleLeads.length, 
        blurred: blurredCount, 
        hidden: hiddenCount 
      });
    }

    return new Response(
      JSON.stringify({ 
        leads: filteredLeads,
        total: totalLeads,
        blurredCount,
        hiddenCount,
        is_premium: novelty.is_premium
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Novelty leads error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
