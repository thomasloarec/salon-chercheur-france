import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=3600, s-maxage=3600',
  'Content-Type': 'application/json',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    )
  }

  const url = new URL(req.url)
  const params = url.searchParams

  const rawLimit = parseInt(params.get('limit') ?? '20')
  const limit = Math.min(Math.max(rawLimit, 1), 50)
  const offset = Math.max(parseInt(params.get('offset') ?? '0'), 0)
  const sector = params.get('sector')
  const ville = params.get('ville')
  const upcoming = params.get('upcoming')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let query = supabase
    .from('events')
    .select('id, nom_event, slug, date_debut, date_fin, ville, secteur, id_event', { count: 'exact' })
    .eq('visible', true)
    .eq('is_test', false)
    .order('date_debut', { ascending: true })
    .range(offset, offset + limit - 1)

  if (upcoming === 'true') {
    query = query.gte('date_fin', new Date().toISOString().split('T')[0])
  }

  if (ville) {
    query = query.ilike('ville', `%${ville}%`)
  }

  if (sector) {
    query = query.contains('secteur', [sector])
  }

  const { data, error, count } = await query

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }

  const events = (data ?? []).map((e: any) => ({
    name: e.nom_event,
    slug: e.slug,
    url: `https://lotexpo.com/events/${e.slug}`,
    date_debut: e.date_debut,
    date_fin: e.date_fin,
    ville: e.ville,
    secteur: e.secteur ?? [],
  }))

  const response = {
    source: 'Lotexpo',
    description: 'Catalogue des salons professionnels en France',
    api_doc: 'https://lotexpo.com/llms.txt',
    generated_at: new Date().toISOString(),
    total: count ?? 0,
    limit,
    offset,
    events,
  }

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: corsHeaders,
  })
})
