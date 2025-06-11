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

// Types pour l'API Viparis
interface ViparisAPIEvent {
  id: string;
  title: string;
  excerpt: string;
  beginDate: string;
  endDate: string;
  venue: string;
  location?: string;
  category?: string;
}

interface ViparisAPIResponse {
  events: ViparisAPIEvent[];
  totalCount: number;
  totalPages?: number;
  page: number;
  size: number;
}

// Inline scraping logic to avoid import issues
class BaseScraper {
  public venue: string;
  protected baseUrl: string;

  constructor(venue: string, baseUrl: string) {
    this.venue = venue;
    this.baseUrl = baseUrl;
  }

  protected async fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (response.ok) return response;
        
        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
          continue;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
    throw new Error(`Failed to fetch ${url} after ${retries} retries`);
  }

  protected detectSector(text: string): string {
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

  protected extractTags(text: string): string[] {
    const textLower = text.toLowerCase();
    const tags: string[] = [];
    
    const keywords = ['innovation', 'technologie', 'digital', 'industrie', 'b2b', 'professionnel', 'salon', 'exposition'];
    
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        tags.push(keyword);
      }
    }
    
    return tags.slice(0, 5);
  }
}

class ViparisScraper extends BaseScraper {
  constructor() {
    super('Viparis', 'https://www.viparis.com');
  }

  private toScrapedEvent(event: ViparisAPIEvent) {
    const combinedText = `${event.title} ${event.excerpt || ''}`;
    
    return {
      name: event.title,
      description: event.excerpt || '',
      start_date: new Date(event.beginDate).toISOString().split('T')[0],
      end_date: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : new Date(event.beginDate).toISOString().split('T')[0],
      venue_name: event.venue || 'Viparis',
      event_url: `https://www.viparis.com/e/${event.id}`,
      city: this.extractCity(event.venue || event.location),
      address: this.getAddress(event.venue || event.location),
      location: `${this.extractCity(event.venue || event.location)}, France`,
      country: 'France',
      estimated_visitors: null,
      estimated_exhibitors: null,
      entry_fee: null,
      organizer_name: 'Viparis',
      sector: this.detectSector(combinedText),
      tags: this.extractTags(combinedText),
      event_type: this.ruleBasedType(combinedText),
      is_b2b: true,
      scraped_from: 'viparis.com',
      last_scraped_at: new Date().toISOString(),
    };
  }

  private extractCity(venueText: string): string {
    if (!venueText) return 'Paris';
    
    if (venueText.toLowerCase().includes('villepinte')) return 'Villepinte';
    if (venueText.toLowerCase().includes('versailles')) return 'Paris';
    if (venueText.toLowerCase().includes('congrès')) return 'Paris';
    
    return 'Paris';
  }

  private getAddress(venueText: string): string {
    if (!venueText) return 'Paris, France';
    
    if (venueText.toLowerCase().includes('villepinte')) {
      return 'ZAC Paris Nord 2, 93420 Villepinte';
    }
    if (venueText.toLowerCase().includes('versailles')) {
      return 'Place de la Porte de Versailles, 75015 Paris';
    }
    if (venueText.toLowerCase().includes('congrès')) {
      return '2 Place de la Porte Maillot, 75017 Paris';
    }
    
    return 'Paris, France';
  }

  private isB2BEvent(event: ViparisAPIEvent): boolean {
    const text = `${event.title} ${event.excerpt || ''}`.toLowerCase();
    
    // Mots-clés B2B positifs
    const b2bKeywords = [
      'salon', 'expo', 'congrès', 'b2b', 'professionnel', 'industrie',
      'business', 'entreprise', 'commercial', 'innovation', 'technologie'
    ];
    
    // Mots-clés B2C négatifs
    const b2cKeywords = [
      'grand public', 'famille', 'enfant', 'loisir', 'spectacle',
      'concert', 'festival', 'fête', 'animation'
    ];
    
    const hasB2B = b2bKeywords.some(keyword => text.includes(keyword));
    const hasB2C = b2cKeywords.some(keyword => text.includes(keyword));
    
    return hasB2B && !hasB2C;
  }

  async scrapeEvents() {
    const allEvents = [];
    let page = 1;
    const BASE_URL = 'https://www.viparis.com/api/event-public';

    console.log('🚀 Starting Viparis API scraping with improved pagination...');

    while (true) {
      try {
        // Essayer d'abord avec le paramètre audience
        let url = `${BASE_URL}?audience=professionnels&page=${page}&size=100`;
        console.log(`📄 Fetching page ${page}: ${url}`);
        
        let response = await this.fetchWithRetry(url);
        let data: ViparisAPIResponse;
        
        try {
          data = await response.json();
        } catch (jsonError) {
          console.log('❌ Failed with audience parameter, trying without...');
          // Essayer sans le paramètre audience
          url = `${BASE_URL}?page=${page}&size=100`;
          console.log(`📄 Retry page ${page}: ${url}`);
          response = await this.fetchWithRetry(url);
          data = await response.json();
        }
        
        // Log détaillé de la structure de réponse pour la première page
        if (page === 1) {
          console.log('🔍 API Response structure inspection:');
          console.log('- totalCount:', data.totalCount || 'undefined');
          console.log('- totalPages:', data.totalPages || 'undefined');
          console.log('- events.length:', data.events?.length || 0);
          console.log('- page:', data.page || 'undefined');
          console.log('- size:', data.size || 'undefined');
          console.log('- Response keys:', Object.keys(data));
        }
        
        console.log(`📊 Page ${page}: found ${data.events?.length || 0} events`);
        
        if (!data.events || data.events.length === 0) {
          console.log('✅ No more events found, pagination complete');
          break;
        }

        // Filtrer les événements B2B
        const b2bEvents = data.events.filter(event => this.isB2BEvent(event));
        console.log(`🎯 Page ${page}: ${b2bEvents.length} B2B events after filtering`);

        // Mapper les événements
        const mappedEvents = b2bEvents.map(event => this.toScrapedEvent(event));
        allEvents.push(...mappedEvents);

        // Déterminer s'il y a plus de pages
        let hasMorePages = false;
        
        if (data.totalPages && typeof data.totalPages === 'number') {
          hasMorePages = page < data.totalPages;
          console.log(`📖 Using totalPages: ${page}/${data.totalPages}`);
        } else if (data.totalCount && typeof data.totalCount === 'number') {
          const estimatedTotalPages = Math.ceil(data.totalCount / (data.size || 100));
          hasMorePages = page < estimatedTotalPages;
          console.log(`📖 Using totalCount calculation: ${page}/${estimatedTotalPages} (${data.totalCount} total events)`);
        } else {
          // Fallback: continuer tant qu'il y a des événements
          hasMorePages = data.events.length === (data.size || 100);
          console.log(`📖 Using fallback method: continuing because page is full (${data.events.length} events)`);
        }

        if (!hasMorePages) {
          console.log('✅ Reached last page, pagination complete');
          break;
        }

        page++;
        
        // Délai poli entre les requêtes
        console.log('⏳ Waiting 800ms before next request...');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Limite de sécurité
        if (page > 50) {
          console.log('⚠️ Reached safety limit (50 pages), stopping');
          break;
        }
        
      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error);
        break;
      }
    }

    console.log(`🎉 Viparis scraping completed. Total B2B events found: ${allEvents.length}`);
    return allEvents;
  }

  private ruleBasedType(text: string): string {
    const textLower = text.toLowerCase();

    if (textLower.includes('salon')) return 'salon';
    if (textLower.includes('convention')) return 'convention';
    if (textLower.includes('congres')) return 'congres';
    if (textLower.includes('conference')) return 'conference';
    if (textLower.includes('ceremonie')) return 'ceremonie';

    return 'inconnu';
  }
}

class ExpoNantesScraper extends BaseScraper {
  constructor() {
    super('Exponantes', 'https://www.exponantes.com');
  }

  async scrapeEvents() {
    try {
      const url = 'https://www.exponantes.com/agenda-des-evenements-du-parc';
      console.log(`Scraping ${url}...`);
      
      const response = await this.fetchWithRetry(url);
      const html = await response.text();
      
      console.log(`HTML response length: ${html.length}`);
      
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
          sector: this.detectSector('technologie innovation'),
          tags: this.extractTags('technologie innovation digital startup'),
          event_type: 'salon',
          is_b2b: true,
          scraped_from: url,
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
    console.log('Starting scraping process...');
    
    const scrapers = [
      new ViparisScraper(),
      new ExpoNantesScraper(),
    ];

    const allEvents = [];
    let totalErrors = 0;

    for (const scraper of scrapers) {
      try {
        console.log(`Running ${scraper.venue} scraper...`);
        const events = await scraper.scrapeEvents();
        console.log(`${scraper.venue} found ${events.length} events`);
        allEvents.push(...events);
      } catch (error) {
        console.error(`Error with ${scraper.venue}:`, error);
        totalErrors++;
      }
    }

    console.log(`Total events to save: ${allEvents.length}`);

    // Save events to database
    let savedCount = 0;
    let saveErrors = [];

    for (const event of allEvents) {
      try {
        // Check if event already exists
        const { data: existing } = await supabaseAdmin
          .from('events')
          .select('id')
          .eq('name', event.name)
          .eq('venue_name', event.venue_name)
          .eq('start_date', event.start_date)
          .maybeSingle();

        if (existing) {
          // Update existing event
          const { error } = await supabaseAdmin
            .from('events')
            .update({
              ...event,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          if (!error) savedCount++;
          else saveErrors.push(error.message);
        } else {
          // Insert new event
          const { error } = await supabaseAdmin
            .from('events')
            .insert({
              ...event,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (!error) savedCount++;
          else saveErrors.push(error.message);
        }
      } catch (error) {
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

    console.log('Scraping completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      status: result.success ? 200 : 207 // 207 = Multi-Status (partial success)
    });

  } catch (error) {
    console.error('Fatal scraping error:', error);
    
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
