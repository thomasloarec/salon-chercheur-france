
import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import type { ScrapedEvent } from '@/types/scraping';

export class ViparisScraper extends BaseScraper {
  private source = 'viparis.com';

  constructor() {
    super('Viparis', 'https://www.viparis.com');
  }

  private agendaUrls = [
    '/fr/site/paris-expo-porte-de-versailles/agenda',
    '/fr/site/paris-nord-villepinte/agenda',
    '/fr/site/palais-des-congres-paris/agenda',
  ];

  async scrapeEvents(): Promise<ScrapedEvent[]> {
    const allEvents: ScrapedEvent[] = [];
    
    for (const path of this.agendaUrls) {
      try {
        console.log(`Scraping Viparis: ${this.baseUrl}${path}`);
        const events = await this.scrapeVenuePage(path);
        allEvents.push(...events);
        
        // Wait between venues to avoid rate limiting
        await this.sleepRandom(800, 1600);
      } catch (error) {
        console.error(`Error scraping ${path}:`, error);
      }
    }
    
    console.log(`Viparis scraper found ${allEvents.length} events`);
    return allEvents;
  }

  private async scrapeVenuePage(path: string): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];
    const url = this.baseUrl + path;
    
    try {
      const html = await this.request(url);
      const $ = cheerio.load(html);
      
      // Try multiple possible selectors for event cards
      const eventSelectors = [
        '.c-event-card',
        '.event-card',
        '.agenda-item',
        '.event-item',
        '[data-event]',
        '.card'
      ];
      
      let eventElements: cheerio.Cheerio = $('<div>'); // Initialize with empty element
      
      for (const selector of eventSelectors) {
        eventElements = $(selector);
        if (eventElements.length > 0) {
          console.log(`Found ${eventElements.length} events with selector: ${selector}`);
          break;
        }
      }
      
      if (eventElements.length === 0) {
        // Fallback: look for any elements containing event-like content
        eventElements = $('[class*="event"], [class*="agenda"], .card, .item').filter((_, el) => {
          const text = $(el).text().toLowerCase();
          return text.includes('salon') || text.includes('expo') || text.includes('congrès') || 
                 text.includes('convention') || text.includes('forum');
        });
        console.log(`Fallback found ${eventElements.length} potential event elements`);
      }
      
      eventElements.each((_, el) => {
        try {
          const $el = $(el);
          
          // Extract title - try multiple selectors
          let title = this.extractText($el, [
            '.c-event-card__title',
            '.event-title',
            '.title',
            'h1', 'h2', 'h3', 'h4',
            '.name'
          ]);
          
          // Extract description
          let description = this.extractText($el, [
            '.c-event-card__description',
            '.description',
            '.excerpt',
            '.summary',
            'p'
          ]);
          
          // Extract URL
          let eventUrl = '';
          const linkEl = $el.find('a').first();
          if (linkEl.length > 0) {
            eventUrl = this.makeAbsoluteUrl(linkEl.attr('href') || '');
          }
          
          // Extract date
          let dateStr = this.extractText($el, [
            'time',
            '.date',
            '.event-date',
            '[datetime]'
          ]);
          
          // Also try datetime attribute
          if (!dateStr) {
            const timeEl = $el.find('time[datetime]').first();
            if (timeEl.length > 0) {
              dateStr = timeEl.attr('datetime') || '';
            }
          }
          
          // Extract location/venue
          let venue = this.extractText($el, [
            '.c-event-card__location',
            '.location',
            '.venue',
            '.place'
          ]);
          
          // If no specific venue found, determine from URL path
          if (!venue) {
            if (path.includes('villepinte')) {
              venue = 'Parc des Expositions Paris Nord Villepinte';
            } else if (path.includes('versailles')) {
              venue = 'Paris Expo Porte de Versailles';
            } else if (path.includes('congres')) {
              venue = 'Palais des Congrès de Paris';
            } else {
              venue = 'Viparis';
            }
          }
          
          // Skip if no title found
          if (!title) {
            return;
          }
          
          // Parse dates
          const dates = this.parseDateRange(dateStr);
          
          // Determine city from path
          const city = path.includes('villepinte') ? 'Villepinte' : 'Paris';
          const address = path.includes('villepinte') 
            ? 'ZAC Paris Nord 2, 93420 Villepinte'
            : path.includes('versailles')
            ? 'Place de la Porte de Versailles, 75015 Paris'
            : '2 Place de la Porte Maillot, 75017 Paris';
          
          const event: ScrapedEvent = {
            title: title.trim(),
            description: description.trim() || '',
            startDate: dates.start || new Date(),
            endDate: dates.end,
            venue: venue.trim(),
            websiteUrl: eventUrl || url,
            source: this.source,
            city,
            address,
            estimatedVisitors: null,
            estimatedExhibitors: null,
            entryFee: null,
            organizer: 'Viparis',
            sector: this.detectSector(title + ' ' + description),
            tags: this.extractTags(title + ' ' + description)
          };
          
          events.push(event);
          
        } catch (error) {
          console.error('Error parsing event element:', error);
        }
      });
      
    } catch (error) {
      console.error(`Error scraping venue page ${url}:`, error);
    }
    
    return events;
  }

  private extractText($el: cheerio.Cheerio, selectors: string[]): string {
    for (const selector of selectors) {
      const text = $el.find(selector).first().text().trim();
      if (text) return text;
    }
    
    // Fallback: get the element's own text if it matches the selector
    for (const selector of selectors) {
      if ($el.is(selector)) {
        return $el.text().trim();
      }
    }
    
    return '';
  }

  private parseDateRange(dateStr: string): { start: Date | null, end: Date | null } {
    if (!dateStr) {
      return { start: null, end: null };
    }
    
    // Handle date ranges like "15/03/2024 - 17/03/2024" or "15/03/2024"
    const rangeSeparators = [' - ', ' au ', ' / ', ' to '];
    
    for (const separator of rangeSeparators) {
      if (dateStr.includes(separator)) {
        const [startStr, endStr] = dateStr.split(separator);
        return {
          start: this.parseFrDate(startStr.trim()),
          end: this.parseFrDate(endStr.trim())
        };
      }
    }
    
    // Single date
    const date = this.parseFrDate(dateStr);
    return { start: date, end: date };
  }
}
