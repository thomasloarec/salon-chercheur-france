export const config = {
  runtime: 'edge',
}

export default async function handler(req) {
  const url = new URL(req.url)
  const targetUrl = new URL(
    'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/events-public'
  )

  // Transférer tous les query params
  url.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value)
  })

  const response = await fetch(targetUrl.toString(), {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const data = await response.text()

  return new Response(data, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
