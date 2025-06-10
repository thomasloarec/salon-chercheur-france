
import { BaseScraper } from './BaseScraper';
import type { ScrapedEvent } from '@/types/scraping';

export class ExpoNantesScraper extends BaseScraper {
  constructor() {
    super('Exponantes', 'https://www.exponantes.com');
  }

  async scrapeEvents(): Promise<ScrapedEvent[]> {
    try {
      const url = 'https://www.exponantes.com/agenda-des-evenements-du-parc';
      console.log('🔍 ExpoNantesScraper - Scraping URL:', url);
      
      const response = await this.fetchWithRetry(url);
      const html = await response.text();
      console.log(`📄 ExpoNantesScraper - HTML bytes received: ${html.length}`);
      
      // TODO: Parse the actual HTML response instead of returning mock events
      // For now, let's analyze what we get back
      
      if (html.length < 1000) {
        console.log('⚠️ ExpoNantesScraper - HTML response seems too short, might be blocked or redirected');
        console.log('📄 ExpoNantesScraper - HTML content preview:', html.substring(0, 500));
      }
      
      // Check if we got a proper HTML page
      if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
        console.log('⚠️ ExpoNantesScraper - Response doesn\'t look like HTML');
        return [];
      }
      
      // For now, return mock events but log that we're doing so
      console.log('📝 ExpoNantesScraper - Using mock events (real parsing not implemented yet)');
      
      // Mock events for now - in real implementation, parse the HTML response
      const mockEvents: ScrapedEvent[] = [
        {
          title: 'Salon TECH OUEST 2025',
          description: 'Salon des technologies et innovations de l\'Ouest',
          startDate: new Date(new Date().getFullYear() + 1, 4, 20), // May 20 next year
          endDate: new Date(new Date().getFullYear() + 1, 4, 22), // May 22 next year
          venue: 'Parc des Expositions de Nantes',
          websiteUrl: 'https://www.tech-ouest.com',
          source: 'https://www.exponantes.com/agenda-des-evenements-du-parc',
          city: 'Nantes',
          address: 'Route de Saint-Joseph de Porterie, 44300 Nantes',
          estimatedVisitors: 25000,
          estimatedExhibitors: 800,
          entryFee: 'Gratuit sur inscription',
          organizer: 'Exponantes',
          sector: 'Technologie',
          tags: ['technologie', 'innovation', 'digital', 'startup']
        },
        {
          title: 'Salon BTP ATLANTIQUE 2025',
          description: 'Salon professionnel du bâtiment et des travaux publics',
          startDate: new Date(new Date().getFullYear() + 1, 8, 10), // September 10 next year
          endDate: new Date(new Date().getFullYear() + 1, 8, 12), // September 12 next year
          venue: 'Parc des Expositions de Nantes',
          websiteUrl: 'https://www.btp-atlantique.com',
          source: 'https://www.exponantes.com/agenda-des-evenements-du-parc',
          city: 'Nantes',
          address: 'Route de Saint-Joseph de Porterie, 44300 Nantes',
          estimatedVisitors: 18000,
          estimatedExhibitors: 600,
          entryFee: 'Gratuit sur inscription',
          organizer: 'Exponantes',
          sector: 'BTP',
          tags: ['btp', 'construction', 'bâtiment', 'professionnel']
        }
      ];

      console.log(`✅ ExpoNantesScraper - Returning ${mockEvents.length} mock events`);
      return mockEvents;
    } catch (error) {
      console.error('❌ ExpoNantesScraper - Error scraping:', error);
      console.log('📝 ExpoNantesScraper - Returning empty array due to error');
      return [];
    }
  }
}
