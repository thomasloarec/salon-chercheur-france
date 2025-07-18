
import { supabase } from '@/integrations/supabase/client';
import { BaseScraper } from './scrapers/BaseScraper';
import { VipariseScraper } from './scrapers/VipariseScraper';
import { ExpoNantesScraper } from './scrapers/ExpoNantesScraper';
import { ChalonsScraper } from './scrapers/ChalonsScraper';
import { AIClassifier } from './aiClassifier';
import { classifyEvent } from './classifier/keywordRules';
import type { ScrapedEvent, ScrapingResult } from '@/types/scraping';

// Simple interface to avoid complex type inference
interface EnhancedScrapedEvent {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date | null;
  venue: string;
  websiteUrl: string;
  source: string;
  city: string;
  address: string;
  estimatedVisitors: number | null;
  estimatedExhibitors: number | null;
  entryFee: string | null;
  organizer: string;
  sector: string;
  tags: string[];
  event_type?: string;
}

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
              
              // Create enhanced event object with simple typing
              const enhancedEvent: EnhancedScrapedEvent = {
                title: event.title,
                description: event.description,
                startDate: event.startDate,
                endDate: event.endDate,
                venue: event.venue,
                websiteUrl: event.websiteUrl,
                source: event.source,
                city: event.city,
                address: event.address,
                estimatedVisitors: event.estimatedVisitors,
                estimatedExhibitors: event.estimatedExhibitors,
                entryFee: event.entryFee,
                organizer: event.organizer,
                sector: classification.sector,
                tags: classification.tags,
                event_type: eventType !== 'inconnu' ? eventType : undefined
              };
              
              const saved = await this.saveEvent(enhancedEvent);
              
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

  private async saveEvent(eventData: EnhancedScrapedEvent): Promise<boolean> {
    try {
      console.log(`💾 ScrapingService - Attempting to save: "${eventData.title}"`);
      
      // Check if event already exists (deduplication using url_site_officiel)
      const { data: existing, error: selectError } = await supabase
        .from('events')
        .select('id')
        .eq('url_site_officiel', eventData.websiteUrl)
        .maybeSingle();

      if (selectError) {
        console.error('❌ ScrapingService - Error checking existing event:', selectError);
        return false;
      }

      // Prepare data for database with explicit typing - using NEW column names
      const dbData = {
        nom_event: eventData.title,
        description_event: eventData.description,
        date_debut: eventData.startDate.toISOString().split('T')[0],
        date_fin: eventData.endDate?.toISOString().split('T')[0] || null,
        nom_lieu: eventData.venue,
        ville: eventData.city,
        rue: eventData.address,
        country: 'France',
        url_site_officiel: eventData.websiteUrl,
        affluence: eventData.estimatedVisitors,
        estimated_exhibitors: eventData.estimatedExhibitors,
        tarif: eventData.entryFee,
        secteur: eventData.sector,
        tags: eventData.tags,
        type_event: eventData.event_type,
        scraped_from: eventData.source,
        last_scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (existing) {
        console.log(`🔄 ScrapingService - Updating existing event: ${eventData.title}`);
        
        // Update existing event
        const { error: updateError } = await supabase
          .from('events')
          .update(dbData)
          .eq('id', existing.id);

        if (updateError) {
          console.error('❌ ScrapingService - Error updating event:', updateError);
          return false;
        }
        
        console.log(`✅ ScrapingService - Updated existing event: ${eventData.title} (type: ${eventData.event_type || 'non classifié'})`);
      } else {
        console.log(`➕ ScrapingService - Creating new event: ${eventData.title}`);
        
        // Create new event
        const { error: insertError } = await supabase
          .from('events')
          .insert({
            ...dbData,
            is_b2b: true,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('❌ ScrapingService - Error inserting event:', insertError);
          console.error('❌ ScrapingService - Insert error details:', JSON.stringify(insertError, null, 2));
          return false;
        }
        
        console.log(`✅ ScrapingService - Created new event: ${eventData.title} (type: ${eventData.event_type || 'non classifié'})`);
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
