
import { supabase } from '@/integrations/supabase/client';
import { BaseScraper } from './scrapers/BaseScraper';
import { VipariseScraper } from './scrapers/VipariseScraper';
import { ExpoNantesScraper } from './scrapers/ExpoNantesScraper';
import { AIClassifier } from './aiClassifier';
import { classifyEvent } from './classifier/keywordRules';
import type { ScrapedEvent, ScrapingResult } from '@/types/scraping';

export class ScrapingService {
  private scrapers: BaseScraper[] = [];

  constructor() {
    this.initializeScrapers();
  }

  private initializeScrapers() {
    this.scrapers = [
      new VipariseScraper(),
      new ExpoNantesScraper(),
    ];
  }

  async scrapeAllSources(): Promise<ScrapingResult[]> {
    console.log('Starting scraping process...');
    const results: ScrapingResult[] = [];
    
    for (const scraper of this.scrapers) {
      try {
        console.log(`Scraping ${scraper.venue}...`);
        const events = await scraper.scrapeEvents();
        
        let eventsProcessed = 0;
        let eventsSaved = 0;
        const errors: string[] = [];
        
        for (const event of events) {
          try {
            // AI Classification
            const classification = AIClassifier.classifyEvent(event);
            
            // Event type classification using keyword rules
            const eventType = classifyEvent(event.title, event.description);
            
            // Only save professional events with decent confidence
            if (classification.isProfessional && classification.confidence > 0.5) {
              const saved = await this.saveEvent({
                ...event,
                sector: classification.sector,
                tags: classification.tags,
                event_type: eventType !== 'inconnu' ? eventType : undefined
              });
              
              if (saved) {
                eventsSaved++;
              }
            }
            eventsProcessed++;
          } catch (error) {
            errors.push(`Error processing event "${event.title}": ${error}`);
          }
        }
        
        results.push({
          success: true,
          eventsFound: events.length,
          eventsProcessed,
          eventsSaved,
          errors,
          source: scraper.venue
        });
        
        console.log(`Scraped ${events.length} events from ${scraper.venue}, saved ${eventsSaved}`);
        
        // Pause between sources to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error scraping ${scraper.venue}:`, error);
        results.push({
          success: false,
          eventsFound: 0,
          eventsProcessed: 0,
          eventsSaved: 0,
          errors: [String(error)],
          source: scraper.venue
        });
      }
    }
    
    console.log('Scraping process completed');
    return results;
  }

  private async saveEvent(event: ScrapedEvent & { event_type?: string }): Promise<boolean> {
    try {
      // Check if event already exists (deduplication)
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('name', event.title)
        .eq('venue_name', event.venue)
        .eq('start_date', event.startDate.toISOString().split('T')[0])
        .maybeSingle();

      if (existing) {
        // Update existing event
        const { error: updateError } = await supabase
          .from('events')
          .update({
            description: event.description,
            end_date: event.endDate?.toISOString().split('T')[0],
            event_url: event.websiteUrl,
            estimated_visitors: event.estimatedVisitors,
            estimated_exhibitors: event.estimatedExhibitors,
            entry_fee: event.entryFee,
            organizer_name: event.organizer,
            sector: event.sector,
            tags: event.tags,
            event_type: event.event_type,
            scraped_from: event.source,
            last_scraped_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Error updating event:', updateError);
          return false;
        }
        
        console.log(`Updated existing event: ${event.title} (type: ${event.event_type || 'non classifié'})`);
      } else {
        // Create new event
        const { error: insertError } = await supabase
          .from('events')
          .insert({
            name: event.title,
            description: event.description,
            start_date: event.startDate.toISOString().split('T')[0],
            end_date: event.endDate?.toISOString().split('T')[0],
            venue_name: event.venue,
            city: event.city,
            address: event.address,
            location: `${event.city}, France`,
            country: 'France',
            estimated_visitors: event.estimatedVisitors,
            estimated_exhibitors: event.estimatedExhibitors,
            entry_fee: event.entryFee,
            organizer_name: event.organizer,
            event_url: event.websiteUrl,
            sector: event.sector,
            tags: event.tags,
            event_type: event.event_type,
            is_b2b: true,
            scraped_from: event.source,
            last_scraped_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error inserting event:', insertError);
          return false;
        }
        
        console.log(`Created new event: ${event.title} (type: ${event.event_type || 'non classifié'})`);
      }
      
      return true;
    } catch (error) {
      console.error('Error saving event:', error);
      return false;
    }
  }

  async testClassification(eventData: Partial<ScrapedEvent>) {
    const aiClassification = AIClassifier.classifyEvent(eventData);
    const eventType = classifyEvent(eventData.title || '', eventData.description);
    
    return {
      ...aiClassification,
      eventType
    };
  }
}
