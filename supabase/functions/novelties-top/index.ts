import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NoveltyFilters {
  sector_ids?: string[];
  types?: string[];
  months?: number[];
  region_codes?: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const searchParams = url.searchParams;

    // Parse filters from query params
    const filters: NoveltyFilters = {};
    
    const sectorIds = searchParams.get('sector_ids');
    if (sectorIds) {
      filters.sector_ids = sectorIds.split(',');
    }
    
    const types = searchParams.get('types');
    if (types) {
      filters.types = types.split(',');
    }
    
    const months = searchParams.get('months');
    if (months) {
      filters.months = months.split(',').map(m => parseInt(m));
    }
    
    const regionCodes = searchParams.get('region_codes');
    if (regionCodes) {
      filters.region_codes = regionCodes.split(',');
    }

    console.log('Fetching top novelties with filters:', filters);

    // If no filters, get top 1 novelty per event using the DB function
    if (Object.keys(filters).length === 0) {
      const { data, error } = await supabase.rpc('get_top_novelties_per_event');

      if (error) {
        console.error('Error fetching top novelties:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch novelties' }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('Found top novelties:', data?.length || 0);

      return new Response(
        JSON.stringify({ 
          novelties: data || [],
          total: data?.length || 0
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If filters are applied, build filtered query
    let query = supabase
      .from('novelties')
      .select(`
        *,
        exhibitors:exhibitor_id (
          id,
          name,
          slug,
          logo_url
        ),
        novelty_stats:id (
          novelty_id,
          route_users_count,
          popularity_score,
          saves_count,
          reminders_count,
          updated_at
        ),
        events:event_id (
          id,
          slug,
          nom_event,
          ville,
          date_debut,
          date_fin,
          secteur
        )
      `)
      .eq('status', 'published');

    // Apply event-based filters
    if (filters.sector_ids || filters.types || filters.months || filters.region_codes) {
      query = query.filter('events.visible', 'eq', true);
      query = query.gte('events.date_debut', new Date().toISOString().split('T')[0]);

      // Filter by sectors (check events.secteur JSONB)
      if (filters.sector_ids && filters.sector_ids.length > 0) {
        // Get sector names from IDs
        const { data: sectors } = await supabase
          .from('sectors')
          .select('id, name')
          .in('id', filters.sector_ids);
        
        if (sectors && sectors.length > 0) {
          const sectorNames = sectors.map(s => s.name);
          // Use overlaps operator for JSONB array
          query = query.overlaps('events.secteur', sectorNames);
        }
      }

      // Filter by event types
      if (filters.types && filters.types.length > 0) {
        query = query.in('events.type_event', filters.types);
      }

      // Filter by months
      if (filters.months && filters.months.length > 0) {
        const monthConditions = filters.months.map(month => 
          `extract(month from events.date_debut) = ${month}`
        ).join(' OR ');
        query = query.or(monthConditions);
      }

      // Filter by regions (check postal code prefix)
      if (filters.region_codes && filters.region_codes.length > 0) {
        // This would need a proper region mapping, for now skip
        console.log('Region filtering not yet implemented');
      }
    }

    // Order by popularity and limit
    query = query.order('novelty_stats.popularity_score', { ascending: false, nullsFirst: false });
    query = query.order('created_at', { ascending: false });
    query = query.limit(50); // Reasonable limit

    const { data: novelties, error } = await query;

    if (error) {
      console.error('Error fetching filtered novelties:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch novelties' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Found filtered novelties:', novelties?.length || 0);

    return new Response(
      JSON.stringify({ 
        novelties: novelties || [],
        total: novelties?.length || 0,
        filters_applied: filters
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});