
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SBEE_KEY = Deno.env.get('SBEE_API_KEY')!;
const BASE_BEE = 'https://app.scrapingbee.com/api/v1/';

function beeUrl(target: string) {
  return BASE_BEE + '?' + new URLSearchParams({
    api_key: SBEE_KEY,
    url: target,
    render_js: 'false'
  });
}

function detectSector(text: string): string {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('tech') || textLower.includes('digital') || textLower.includes('numérique')) return 'Technologie';
  if (textLower.includes('industrie') || textLower.includes('manufacturing')) return 'Industrie';
  if (textLower.includes('médical') || textLower.includes('santé') || textLower.includes('pharma')) return 'Santé';
  if (textLower.includes('btp') || textLower.includes('construction') || textLower.includes('bâtiment')) return 'BTP';
  if (textLower.includes('agro') || textLower.includes('alimentaire') || textLower.includes('agriculture')) return 'Agroalimentaire';
  if (textLower.includes('énergie') || textLower.includes('environnement')) return 'Énergie';
  if (textLower.includes('transport') || textLower.includes('automobile') || textLower.includes('logistique')) return 'Transport';
  if (textLower.includes('finance') || textLower.includes('banque') || textLower.includes('assurance')) return 'Finance';
  
  return 'Autre';
}

function ruleBasedType(text: string): string {
  const textLower = text.toLowerCase();

  if (textLower.includes('salon')) return 'salon';
  if (textLower.includes('convention')) return 'convention';
  if (textLower.includes('congres')) return 'congres';
  if (textLower.includes('conference')) return 'conference';
  if (textLower.includes('ceremonie')) return 'ceremonie';

  return 'inconnu';
}

async function fetchViparis() {
  console.log('🚀 Starting Viparis scraping with ScrapingBee...');
  
  const sites = ['paris-expo', 'paris-nord-villepinte', 'palais-des-congres'];
  const all: any[] = [];

  for (const site of sites) {
    let page = 0;
    console.log(`📍 Scraping site: ${site}`);
    
    while (true) {
      try {
        const target = `https://www.viparis.com/v3/api/events?lang=fr&page=${page}&limit=100&site=${site}`;
        console.log(`🔍 Fetching page ${page} for ${site}: ${target}`);
        
        const res = await fetch(beeUrl(target));
        
        if (!res.ok) {
          console.log(`❌ ScrapingBee error for ${site} page ${page}:`, res.status);
          break;
        }
        
        const data = await res.json();
        const eventsPage = data.events ?? [];
        
        console.log(`📄 SITE ${site} PAGE ${page}: ${eventsPage.length} events found`);
        
        if (!eventsPage.length) {
          console.log(`✅ No more events for ${site}, moving to next site`);
          break;
        }
        
        const mappedEvents = eventsPage.map(toScraped);
        all.push(...mappedEvents);
        
        page++;
        
        // Friendly delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Safety limit per site
        if (page > 10) {
          console.log(`⚠️ Reached safety limit for ${site}, moving to next site`);
          break;
        }
        
      } catch (error) {
        console.error(`❌ Error fetching ${site} page ${page}:`, error);
        break;
      }
    }
  }
  
  console.log(`🎉 TOTAL COLLECTED: ${all.length} events`);
  return all;
}

function toScraped(e: any): any {
  return {
    name: e.title || 'Événement sans titre',
    description: e.excerpt || '',
    start_date: e.beginDate ? new Date(e.beginDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    end_date: e.endDate ? new Date(e.endDate).toISOString().split('T')[0] : null,
    venue_name: e.venue || 'Viparis',
    city: e.city || 'Paris',
    address: e.address || 'Paris, France',
    location: `${e.city || 'Paris'}, France`,
    country: 'France',
    estimated_visitors: null,
    estimated_exhibitors: null,
    entry_fee: null,
    organizer_name: 'Viparis',
    event_url: `https://www.viparis.com/e/${e.slug || e.id}`,
    image_url: e.image || null,
    sector: detectSector((e.title || '') + ' ' + (e.excerpt || '')),
    tags: [],
    event_type: ruleBasedType((e.title || '') + ' ' + (e.excerpt || '')),
    is_b2b: true,
    scraped_from: 'viparis.com',
    last_scraped_at: new Date().toISOString(),
  };
}

class ExpoNantesScraper {
  async scrapeEvents() {
    try {
      console.log('🔄 Running ExpoNantes mock scraper...');
      
      // Mock events for now
      const mockEvents = [
        {
          name: 'Salon TECH OUEST 2025',
          description: 'Salon des technologies et innovations de l\'Ouest',
          start_date: new Date(new Date().getFullYear() + 1, 4, 20).toISOString().split('T')[0],
          end_date: new Date(new Date().getFullYear() + 1, 4, 22).toISOString().split('T')[0],
          venue_name: 'Parc des Expositions de Nantes',
          event_url: 'https://www.tech-ouest.com',
          city: 'Nantes',
          address: 'Route de Saint-Joseph de Porterie, 44300 Nantes',
          location: 'Nantes, France',
          country: 'France',
          estimated_visitors: 25000,
          estimated_exhibitors: 800,
          entry_fee: 'Gratuit sur inscription',
          organizer_name: 'Exponantes',
          sector: detectSector('technologie innovation'),
          tags: [],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'exponantes.com',
          last_scraped_at: new Date().toISOString(),
        }
      ];

      return mockEvents;
    } catch (error) {
      console.error('Error scraping ExpoNantes:', error);
      return [];
    }
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting scraping process with ScrapingBee...');
    
    const allEvents = [];
    let totalErrors = 0;

    // Scrape Viparis with ScrapingBee
    try {
      console.log('🔄 Running Viparis scraper with ScrapingBee...');
      const viparisEvents = await fetchViparis();
      console.log(`✅ Viparis found ${viparisEvents.length} events`);
      allEvents.push(...viparisEvents);
    } catch (error) {
      console.error('❌ Error with Viparis:', error);
      totalErrors++;
    }

    // Scrape ExpoNantes (mock)
    try {
      const expoNantesScraper = new ExpoNantesScraper();
      const expoEvents = await expoNantesScraper.scrapeEvents();
      console.log(`✅ ExpoNantes found ${expoEvents.length} events`);
      allEvents.push(...expoEvents);
    } catch (error) {
      console.error('❌ Error with ExpoNantes:', error);
      totalErrors++;
    }

    console.log(`📊 Total events to save: ${allEvents.length}`);

    // Save events to database with upsert using event_url as unique key
    let savedCount = 0;
    let saveErrors = [];

    if (allEvents.length > 0) {
      try {
        const { data, error } = await supabaseAdmin
          .from('events')
          .upsert(
            allEvents.map(event => ({
              ...event,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })),
            { 
              onConflict: 'event_url',
              ignoreDuplicates: false
            }
          )
          .select('id');

        if (error) {
          console.error('Upsert error:', error);
          saveErrors.push(error.message);
        } else {
          savedCount = data?.length || allEvents.length;
          console.log(`💾 Successfully saved/updated ${savedCount} events`);
        }
      } catch (error) {
        console.error('Save error:', error);
        saveErrors.push(String(error));
      }
    }

    const result = {
      found: allEvents.length,
      saved: savedCount,
      scrapingErrors: totalErrors,
      saveErrors: saveErrors.slice(0, 5), // Limit error list
      success: totalErrors === 0 && saveErrors.length === 0
    };

    console.log('🏁 Scraping completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      status: result.success ? 200 : 207 // 207 = Multi-Status (partial success)
    });

  } catch (error) {
    console.error('💥 Fatal scraping error:', error);
    
    return new Response(JSON.stringify({
      found: 0,
      saved: 0,
      scrapingErrors: 1,
      saveErrors: [String(error)],
      success: false
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      status: 500
    });
  }
});
