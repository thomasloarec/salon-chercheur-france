import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// deno-lint-ignore no-explicit-any
const maskLead = (lead: any) => ({
  ...lead,
  first_name: (lead.first_name ?? '').slice(0, 2) + '***',
  last_name: (lead.last_name ?? '').charAt(0) + '***',
  email: (lead.email ?? '').slice(0, 2) + '***@***.***',
  phone: lead.phone ? lead.phone.slice(0, 2) + ' ** ** ** **' : null,
  company: lead.company ? lead.company.slice(0, 2) + '***' : null,
  role: lead.role ? lead.role.slice(0, 2) + '***' : null,
  notes: null,
  masked: true,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    // User client (RLS + auth.uid() for RPC)
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Service role client (reads after authorization)
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { novelty_id } = await req.json();
    if (!novelty_id) {
      return json({ error: 'novelty_id is required' }, 400);
    }

    const { data: novelty, error: noveltyError } = await admin
      .from('novelties')
      .select('id, exhibitor_id, event_id, created_by')
      .eq('id', novelty_id)
      .maybeSingle();

    if (noveltyError || !novelty) {
      return json({ error: 'Novelty not found' }, 404);
    }

    const exhibitorId = novelty.exhibitor_id as string;
    const eventId = novelty.event_id as string;

    // Platform admin?
    const { data: adminRole } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    const isAdmin = !!adminRole;

    // Active team member? (evaluated with auth.uid() -> user client)
    let isTeamMember = false;
    if (exhibitorId) {
      const { data: teamOk, error: teamErr } = await supabase.rpc('is_team_member', {
        _exhibitor_id: exhibitorId,
      });
      if (teamErr) console.error('[novelty-leads] is_team_member error:', teamErr);
      isTeamMember = teamOk === true;
    }

    const isCreator = novelty.created_by === user.id;

    if (!isTeamMember && !isCreator && !isAdmin) {
      return json({ error: 'Unauthorized to view these leads' }, 403);
    }

    // Premium is per (exhibitor, event)
    let isPremium = false;
    if (exhibitorId && eventId) {
      const { data: ent, error: entError } = await admin
        .from('premium_entitlements')
        .select('leads_unlimited')
        .eq('exhibitor_id', exhibitorId)
        .eq('event_id', eventId)
        .is('revoked_at', null)
        .maybeSingle();
      if (entError) console.error('[novelty-leads] entitlement error:', entError);
      isPremium = !!ent?.leads_unlimited;
    }

    const { data: rawLeads, error: leadsError } = await admin
      .from('leads')
      .select('*')
      .eq('novelty_id', novelty_id)
      .order('created_at', { ascending: true });

    if (leadsError) {
      console.error('[novelty-leads] Error fetching leads:', leadsError);
      return json({ error: 'Failed to fetch leads' }, 500);
    }

    const allLeads = rawLeads ?? [];
    const total = allLeads.length;

    let leads;
    let maskedCount = 0;

    if (isPremium || isAdmin) {
      leads = allLeads.map((l) => ({ ...l, masked: false }));
    } else {
      leads = allLeads.map((l, i) => (i < 3 ? { ...l, masked: false } : maskLead(l)));
      maskedCount = Math.max(0, total - 3);
    }

    console.log('[novelty-leads]', { novelty_id, total, maskedCount, isPremium, isAdmin });

    return json({
      leads,
      total,
      total_count: total,
      maskedCount,
      blurredCount: maskedCount,
      is_premium: isPremium,
    });
  } catch (error) {
    console.error('Novelty leads error:', error);
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
});
