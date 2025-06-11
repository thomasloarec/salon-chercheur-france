
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
  if (textLower.includes('foire')) return 'salon';
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

class ChalonsScraper {
  async scrapeEvents() {
    try {
      console.log('🔄 Running Châlons mock scraper...');
      
      // Mock events for Châlons-en-Champagne
      const mockEvents = [
        {
          name: 'Foire de Châlons 2025',
          description: 'La grande foire commerciale et artisanale de Châlons-en-Champagne',
          start_date: new Date(2025, 8, 15).toISOString().split('T')[0],
          end_date: new Date(2025, 8, 17).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/foire-de-chalons',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 15000,
          estimated_exhibitors: 200,
          entry_fee: '5€',
          organizer_name: 'Office de Tourisme de Châlons-en-Champagne',
          sector: detectSector('foire commerciale artisanale'),
          tags: ['foire', 'commerciale', 'artisanale', 'local'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        },
        {
          name: 'Salon de l\'Artisanat Champenois',
          description: 'Découvrez les artisans locaux et leurs créations uniques',
          start_date: new Date(2025, 9, 5).toISOString().split('T')[0],
          end_date: new Date(2025, 9, 7).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/salon-artisanat',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 8000,
          estimated_exhibitors: 80,
          entry_fee: 'Gratuit',
          organizer_name: 'Association des Artisans de Champagne',
          sector: detectSector('artisanat créations locales'),
          tags: ['artisanat', 'local', 'créations'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        },
        {
          name: 'Marché aux Vins de Champagne',
          description: 'Dégustation et vente directe des meilleurs champagnes de la région',
          start_date: new Date(2025, 10, 12).toISOString().split('T')[0],
          end_date: new Date(2025, 10, 14).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/marche-vins',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 12000,
          estimated_exhibitors: 150,
          entry_fee: '10€ (dégustation incluse)',
          organizer_name: 'Comité Interprofessionnel du Vin de Champagne',
          sector: detectSector('vin champagne gastronomie'),
          tags: ['vin', 'champagne', 'dégustation', 'gastronomie'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        },
        {
          name: 'Expo Habitat & Jardin Châlons',
          description: 'Salon dédié à l\'habitat, la décoration et l\'aménagement de jardins',
          start_date: new Date(2025, 3, 20).toISOString().split('T')[0],
          end_date: new Date(2025, 3, 22).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/expo-habitat-jardin',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 18000,
          estimated_exhibitors: 250,
          entry_fee: '7€',
          organizer_name: 'Châlons Expo',
          sector: detectSector('habitat jardin décoration'),
          tags: ['habitat', 'jardin', 'décoration', 'maison'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        },
        {
          name: 'Forum de l\'Emploi Châlons',
          description: 'Rencontres entre entreprises locales et demandeurs d\'emploi',
          start_date: new Date(2025, 2, 8).toISOString().split('T')[0],
          end_date: new Date(2025, 2, 8).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/forum-emploi',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 5000,
          estimated_exhibitors: 100,
          entry_fee: 'Gratuit',
          organizer_name: 'Pôle Emploi Champagne-Ardenne',
          sector: detectSector('emploi recrutement professionnel'),
          tags: ['emploi', 'recrutement', 'professionnel'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        },
        {
          name: 'Salon du Livre de Champagne',
          description: 'Rencontre avec les auteurs locaux et découverte de la littérature régionale',
          start_date: new Date(2025, 4, 15).toISOString().split('T')[0],
          end_date: new Date(2025, 4, 17).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/salon-livre',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 6000,
          estimated_exhibitors: 50,
          entry_fee: '3€',
          organizer_name: 'Association Littéraire de Champagne',
          sector: detectSector('livre littérature culture'),
          tags: ['livre', 'littérature', 'culture', 'auteurs'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        },
        {
          name: 'Foire Gastronomique Champenoise',
          description: 'Découverte des spécialités culinaires de la région Champagne-Ardenne',
          start_date: new Date(2025, 5, 10).toISOString().split('T')[0],
          end_date: new Date(2025, 5, 12).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/foire-gastronomique',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 20000,
          estimated_exhibitors: 180,
          entry_fee: '8€',
          organizer_name: 'Confrérie Gastronomique de Champagne',
          sector: detectSector('gastronomie cuisine spécialités'),
          tags: ['gastronomie', 'cuisine', 'spécialités', 'terroir'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        },
        {
          name: 'Salon des Métiers d\'Art',
          description: 'Exposition et démonstration des métiers d\'art traditionnels et contemporains',
          start_date: new Date(2025, 6, 5).toISOString().split('T')[0],
          end_date: new Date(2025, 6, 7).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/salon-metiers-art',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 9000,
          estimated_exhibitors: 70,
          entry_fee: '6€',
          organizer_name: 'Chambre des Métiers de la Marne',
          sector: detectSector('métiers art artisanat'),
          tags: ['métiers', 'art', 'artisanat', 'traditionnel'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        },
        {
          name: 'Expo Auto Moto Châlons',
          description: 'Exposition de véhicules neufs et d\'occasion, motos et accessoires',
          start_date: new Date(2025, 7, 25).toISOString().split('T')[0],
          end_date: new Date(2025, 7, 27).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/expo-auto-moto',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 16000,
          estimated_exhibitors: 120,
          entry_fee: '9€',
          organizer_name: 'Syndicat des Concessionnaires de la Marne',
          sector: detectSector('automobile transport véhicules'),
          tags: ['automobile', 'transport', 'véhicules', 'moto'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        },
        {
          name: 'Forum des Associations Châlons',
          description: 'Présentation des associations locales et de leurs activités',
          start_date: new Date(2025, 8, 1).toISOString().split('T')[0],
          end_date: new Date(2025, 8, 1).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/forum-associations',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 4000,
          estimated_exhibitors: 80,
          entry_fee: 'Gratuit',
          organizer_name: 'Mairie de Châlons-en-Champagne',
          sector: detectSector('associatif social culture'),
          tags: ['associations', 'social', 'culture', 'loisirs'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        },
        {
          name: 'Salon de la Formation et de l\'Orientation',
          description: 'Information et orientation pour les étudiants et demandeurs de formation',
          start_date: new Date(2025, 1, 18).toISOString().split('T')[0],
          end_date: new Date(2025, 1, 19).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/salon-formation',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 7000,
          estimated_exhibitors: 60,
          entry_fee: 'Gratuit',
          organizer_name: 'CIO de Châlons-en-Champagne',
          sector: detectSector('formation éducation orientation'),
          tags: ['formation', 'éducation', 'orientation', 'étudiants'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        },
        {
          name: 'Marché de Noël Artisanal',
          description: 'Marché de Noël avec créations artisanales et produits du terroir',
          start_date: new Date(2025, 11, 5).toISOString().split('T')[0],
          end_date: new Date(2025, 11, 24).toISOString().split('T')[0],
          venue_name: 'Le Capitole',
          event_url: 'https://www.chalons-tourisme.com/agenda/marche-noel',
          city: 'Châlons-en-Champagne',
          address: 'Place Foch, 51000 Châlons-en-Champagne',
          location: 'Châlons-en-Champagne, France',
          country: 'France',
          estimated_visitors: 25000,
          estimated_exhibitors: 100,
          entry_fee: 'Gratuit',
          organizer_name: 'Office de Tourisme de Châlons-en-Champagne',
          sector: detectSector('artisanat noël fêtes'),
          tags: ['noël', 'artisanat', 'fêtes', 'marché'],
          event_type: 'salon',
          is_b2b: true,
          scraped_from: 'chalons-tourisme.com',
          last_scraped_at: new Date().toISOString(),
        }
      ];

      return mockEvents;
    } catch (error) {
      console.error('Error scraping Châlons:', error);
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

    // Scrape Châlons (mock)
    try {
      const chalonsScraper = new ChalonsScraper();
      const chalonsEvents = await chalonsScraper.scrapeEvents();
      console.log(`✅ Châlons found ${chalonsEvents.length} events`);
      allEvents.push(...chalonsEvents);
    } catch (error) {
      console.error('❌ Error with Châlons:', error);
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
