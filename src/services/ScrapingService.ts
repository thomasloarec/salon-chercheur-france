
import { supabase } from '@/integrations/supabase/client';
import { BaseScraper } from './scrapers/BaseScraper';
import { VipariseScraper } from './scrapers/VipariseScraper';
import { ExpoNantesScraper } from './scrapers/ExpoNantesScraper';
import { ChalonsScraper } from './scrapers/ChalonsScraper';
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
      new ChalonsScraper(),
    ];
  }

  async scrapeAllSources(): Promise<ScrapingResult[]> {
    console.log('🚀 ScrapingService - Starting scraping process...');
    const results: ScrapingResult[] = [];
    
    for (const scraper of this.scrapers) {
      try {
        console.log(`🔍 ScrapingService - Scraping ${scraper.venue}...`);
        const events = await scraper.scrapeEvents();
        
        let eventsProcessed = 0;
        let eventsSaved = 0;
        const errors: string[] = [];
        
        console.log(`📊 ScrapingService - ${scraper.venue} found ${events.length} events`);
        
        for (const event of events) {
          try {
            console.log(`🔄 ScrapingService - Processing: "${event.title}"`);
            
            // AI Classification
            const classification = AIClassifier.classifyEvent(event);
            console.log(`🤖 ScrapingService - AI Classification - Professional: ${classification.isProfessional} (${(classification.professionalScore * 100).toFixed(0)}%), Sector: ${classification.sector}, Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
            
            // Event type classification using keyword rules
            const eventType = classifyEvent(event.title, event.description);
            console.log(`🏷️ ScrapingService - Event type: ${eventType}`);
            
            // Only save professional events with decent confidence
            if (classification.isProfessional && classification.confidence > 0.5) {
              console.log(`✅ ScrapingService - Event qualifies for saving`);
              const saved = await this.saveEvent({
                ...event,
                sector: classification.sector,
                tags: classification.tags,
                event_type: eventType !== 'inconnu' ? eventType : undefined
              });
              
              if (saved) {
                eventsSaved++;
                console.log(`💾 ScrapingService - Event saved successfully`);
              } else {
                console.log(`❌ ScrapingService - Event save failed`);
              }
            } else {
              console.log(`⚠️ ScrapingService - Event rejected - Professional: ${classification.isProfessional}, Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
            }
            eventsProcessed++;
          } catch (error) {
            const errorMsg = `Error processing event "${event.title}": ${error}`;
            console.error(`❌ ScrapingService - ${errorMsg}`);
            errors.push(errorMsg);
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
        
        console.log(`📈 ScrapingService - ${scraper.venue} summary: Found=${events.length}, Processed=${eventsProcessed}, Saved=${eventsSaved}`);
        
        // Pause between sources to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ ScrapingService - Error scraping ${scraper.venue}:`, error);
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
    
    console.log('🏁 ScrapingService - Scraping process completed');
    return results;
  }

  private async saveEvent(event: ScrapedEvent & { event_type?: string }): Promise<boolean> {
    try {
      console.log(`💾 ScrapingService - Attempting to save: "${event.title}"`);
      
      // Check if event already exists (deduplication using website_url)
      const { data: existing, error: selectError } = await supabase
        .from('events')
        .select('id')
        .eq('website_url', event.websiteUrl)
        .maybeSingle();

      if (selectError) {
        console.error('❌ ScrapingService - Error checking existing event:', selectError);
        return false;
      }

      if (existing) {
        console.log(`🔄 ScrapingService - Updating existing event: ${event.title}`);
        
        // Update existing event
        const { error: updateError } = await supabase
          .from('events')
          .update({
            name: event.title,
            description: event.description,
            start_date: event.startDate.toISOString().split('T')[0],
            end_date: event.endDate?.toISOString().split('T')[0],
            venue_name: event.venue,
            city: event.city,
            address: event.address,
            location: `${event.city}, France`,
            country: 'France',
            event_url: event.websiteUrl,
            website_url: event.websiteUrl,
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
          console.error('❌ ScrapingService - Error updating event:', updateError);
          return false;
        }
        
        console.log(`✅ ScrapingService - Updated existing event: ${event.title} (type: ${event.event_type || 'non classifié'})`);
      } else {
        console.log(`➕ ScrapingService - Creating new event: ${event.title}`);
        
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
            website_url: event.websiteUrl,
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
          console.error('❌ ScrapingService - Error inserting event:', insertError);
          console.error('❌ ScrapingService - Insert error details:', JSON.stringify(insertError, null, 2));
          return false;
        }
        
        console.log(`✅ ScrapingService - Created new event: ${event.title} (type: ${event.event_type || 'non classifié'})`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ ScrapingService - Error saving event:', error);
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
