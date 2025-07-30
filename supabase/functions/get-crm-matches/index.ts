import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CrmMatch {
  id: string;
  name: string;
  website: string;
  provider: 'hubspot'|'salesforce'|'pipedrive'|'zoho';
  eventsCount: number;
  upcomingEvents: Array<{
    id: string;
    nom_event: string;
    date_debut: string;
    ville: string;
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log(`Fetching CRM matches for user: ${user.id}`);

    // Get user's CRM companies with matching events
    const { data: matches, error } = await supabase.rpc('get_user_crm_matches', {
      p_user_id: user.id
    });

    if (error) {
      console.error('Error fetching CRM matches:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch CRM matches' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Group by company and aggregate events
    const crmMatches: CrmMatch[] = [];
    const companyMap = new Map();

    for (const match of matches || []) {
      const companyKey = `${match.company_id}_${match.provider}`;
      
      if (!companyMap.has(companyKey)) {
        companyMap.set(companyKey, {
          id: match.company_id,
          name: match.company_name,
          website: match.company_website,
          provider: match.provider,
          eventsCount: 0,
          upcomingEvents: []
        });
      }

      const company = companyMap.get(companyKey);
      
      if (match.event_id) {
        company.eventsCount++;
        company.upcomingEvents.push({
          id: match.event_id,
          nom_event: match.event_name,
          date_debut: match.event_date_debut,
          ville: match.event_ville
        });
      }
    }

    const result = Array.from(companyMap.values());

    console.log(`Found ${result.length} CRM matches for user ${user.id}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});