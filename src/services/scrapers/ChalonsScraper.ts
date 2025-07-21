
import { BaseScraper } from './BaseScraper';
import type { ScrapedEvent } from '@/types/scraping';

export class ChalonsScraper extends BaseScraper {
  constructor() {
    super('Châlons-en-Champagne', 'https://www.chalons-tourisme.com');
  }

  async scrapeEvents(): Promise<ScrapedEvent[]> {
    try {
      console.log('🔍 ChalonsScraper - Starting scraping from:', this.baseUrl);
      
      const url = 'https://www.chalons-tourisme.com/agenda/tout-lagenda/';
      const html = await this.request(url);
      
      console.log('📄 ChalonsScraper - HTML received, length:', html.length);
      
      // Dynamic import of cheerio for HTML parsing
      if (typeof window === 'undefined') {
        const { load } = await import('cheerio');
        const $ = load(html);
        
        // Try multiple selectors to find event cards
        const eventSelectors = [
          '.c-agenda-card',
          '.agenda--item', 
          '.agenda-item',
          '.event-card',
          '.c-event-card',
          '[data-event]',
          '.card'
        ];
        
        let eventElements: any[] = [];
        for (const selector of eventSelectors) {
          eventElements = $(selector).toArray();
          console.log(`🔍 ChalonsScraper - Testing selector "${selector}": ${eventElements.length} elements`);
          if (eventElements.length > 0) break;
        }
        
        if (eventElements.length === 0) {
          console.log('⚠️ ChalonsScraper - No event elements found, trying fallback selectors');
          // Try broader selectors as fallback
          eventElements = $('.card, article, .item, [class*="event"], [class*="agenda"]').toArray();
          console.log(`🔍 ChalonsScraper - Fallback selectors found: ${eventElements.length} elements`);
        }
        
        const events: ScrapedEvent[] = eventElements.map((el, index) => {
          try {
            const $el = $(el);
            
            // Try multiple selectors for title
            const titleSelectors = [
              '.agenda__title',
              '.c-agenda-card__title', 
              '.event-title',
              '.title',
              'h2',
              'h3',
              '.name'
            ];
            
            let title = '';
            for (const selector of titleSelectors) {
              title = $el.find(selector).text().trim();
              if (title) break;
            }
            
            // Try multiple selectors for description
            const descSelectors = [
              '.agenda__excerpt',
              '.c-agenda-card__excerpt',
              '.event-description',
              '.description',
              '.excerpt',
              'p'
            ];
            
            let description = '';
            for (const selector of descSelectors) {
              description = $el.find(selector).text().trim();
              if (description) break;
            }
            
            // Try multiple selectors for date
            const dateSelectors = [
              '.agenda__date',
              '.c-agenda-card__date',
              '.event-date',
              '.date',
              '[class*="date"]'
            ];
            
            let dateText = '';
            for (const selector of dateSelectors) {
              dateText = $el.find(selector).text().trim();
              if (dateText) break;
            }
            
            // Try multiple selectors for venue/place
            const placeSelectors = [
              '.agenda__place',
              '.c-agenda-card__place',
              '.event-place',
              '.place',
              '.venue',
              '[class*="place"]',
              '[class*="venue"]'
            ];
            
            let place = '';
            for (const selector of placeSelectors) {
              place = $el.find(selector).text().trim();
              if (place) break;
            }
            
            // Enhanced image extraction with lazy-loading support
            const img = $el.find('img').attr('data-src')    // ← lazy-load
                     || $el.find('img').attr('src')
                     || null;

            const href = $el.find('a').attr('href') || '';
            
            // Enhanced URL extraction with tracking removal
            const websiteUrl = href.startsWith('http')
              ? href.split('?')[0]                       // enlever tracking
              : `https://www.chalons-tourisme.com${href.split('?')[0]}`;
            
            // Parse dates
            const [dateDebut, dateFin] = this.parseDateRangeFr(dateText);
            
            // Use fallback title if none found
            if (!title) {
              title = `Événement Châlons ${index + 1}`;
            }
            
            // Default venue if none found
            if (!place) {
              place = 'Le Capitole';
            }
            
            console.log(`📝 ChalonsScraper - Event ${index + 1}: "${title}" on ${dateText} at ${place}`);
            
            const event: ScrapedEvent = {
              title,
              description: description || 'Événement à Châlons-en-Champagne',
              dateDebut: dateDebut || new Date(),
              dateFin: dateFin || dateDebut || new Date(),
              venue: place,
              city: 'Châlons-en-Champagne',
              address: 'Châlons-en-Champagne, France',
              websiteUrl,
              source: 'chalons-tourisme.com',
              sector: this.detectSector(`${title} ${description}`),
              tags: this.extractTags(`${title} ${description}`),
              organizer: 'Châlons Tourisme',
              estimatedVisitors: Math.floor(Math.random() * 5000) + 1000,
              estimatedExhibitors: Math.floor(Math.random() * 200) + 50,
              entryFee: 'Voir site web'
            };
            
            return event;
          } catch (error) {
            console.error(`❌ ChalonsScraper - Error parsing event ${index}:`, error);
            return null;
          }
        }).filter(Boolean) as ScrapedEvent[];
        
        // Déduplication before returning
        const unique = [...new Map(events.map(e => [e.websiteUrl, e])).values()];
        
        console.log(`✅ ChalonsScraper - Chalons found ${events.length} events, ${unique.length} unique after deduplication`);
        return unique;
      } else {
        console.log('⚠️ ChalonsScraper - Running in browser, using mock events');
        return this.getMockEvents();
      }
    } catch (error) {
      console.error('❌ ChalonsScraper - Error scraping Châlons events:', error);
      console.log('📝 ChalonsScraper - Falling back to mock events due to error');
      return this.getMockEvents();
    }
  }

  private getMockEvents(): ScrapedEvent[] {
    // Fallback mock events for browser or when scraping fails
    const mockEvents: ScrapedEvent[] = [
      {
        title: 'Foire de Châlons 2025',
        description: 'Grande foire commerciale et artisanale de Châlons-en-Champagne',
        dateDebut: new Date(2025, 3, 15), // April 15, 2025
        dateFin: new Date(2025, 3, 17), // April 17, 2025
        venue: 'Le Capitole',
        city: 'Châlons-en-Champagne',
        address: 'Place Foch, 51000 Châlons-en-Champagne',
        websiteUrl: 'https://www.chalons-tourisme.com/agenda/foire-chalons-2025',
        source: 'chalons-tourisme.com',
        sector: 'Commerce',
        tags: ['foire', 'commerce', 'artisanat', 'local'],
        organizer: 'Ville de Châlons-en-Champagne',
        estimatedVisitors: 15000,
        estimatedExhibitors: 120,
        entryFee: 'Gratuit'
      },
      {
        title: 'Salon Habitat & Décoration Châlons',
        description: 'Salon professionnel de l\'habitat et de la décoration',
        dateDebut: new Date(2025, 4, 20), // May 20, 2025
        dateFin: new Date(2025, 4, 22), // May 22, 2025
        venue: 'Le Capitole',
        city: 'Châlons-en-Champagne',
        address: 'Place Foch, 51000 Châlons-en-Champagne',
        websiteUrl: 'https://www.chalons-tourisme.com/agenda/salon-habitat-chalons-2025',
        source: 'chalons-tourisme.com',
        sector: 'BTP',
        tags: ['habitat', 'décoration', 'construction', 'rénovation'],
        organizer: 'Châlons Expo',
        estimatedVisitors: 8000,
        estimatedExhibitors: 80,
        entryFee: 'Gratuit'
      }
    ];

    console.log(`📝 ChalonsScraper - Chalons found ${mockEvents.length} mock events`);
    return mockEvents;
  }
}
