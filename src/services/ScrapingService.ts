
import { createClient } from '@supabase/supabase-js';

interface ScrapedEventData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  city: string;
  address: string;
  country: string;
  venueName: string;
  websiteUrl: string;
  imageUrl: string;
  sector: string;
  eventType: string;
  entryFee: string;
  source: string;
  location?: string;
}

export class ScrapingService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async fetchHtmlContent(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; YourBot/1.0; +http://www.example.com/bot)'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error('Error fetching HTML content:', error);
      throw error;
    }
  }

  parseHtmlContent(html: string): Document {
    // Use DOMParser for browser environments instead of jsdom
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  async uploadImage(imageUrl: string, imageName: string): Promise<string | null> {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const { data, error } = await this.supabase.storage
        .from('event-images')
        .upload(`${imageName}`, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: blob.type
        });

      if (error) {
        console.error('Error uploading image:', error);
        return null;
      }

      const publicUrl = `https://utouffwvjqwpsaoeqvho.supabase.co/storage/v1/object/public/${data.path}`;
      console.log('Image uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      return null;
    }
  }

  async saveEvent(eventData: ScrapedEventData): Promise<string | null> {
    try {
      console.log('Saving event:', eventData);
      
      // Transform the scraped data to match our database schema
      const transformedData = {
        nom_event: eventData.name,
        description_event: eventData.description,
        date_debut: eventData.startDate,
        date_fin: eventData.endDate,
        nom_lieu: eventData.venueName,
        ville: eventData.city,
        rue: eventData.address,
        location: eventData.location || `${eventData.venueName || ''} ${eventData.address || ''} ${eventData.city}`.trim(),
        pays: eventData.country || 'France',
        event_url: eventData.websiteUrl,
        url_image: eventData.imageUrl,
        secteur: eventData.sector,
        type_event: eventData.eventType,
        tarif: eventData.entryFee,
        is_b2b: true,
        visible: false,
        scraped_from: eventData.source,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_scraped_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('events')
        .insert(transformedData)
        .select('id')
        .single();

      if (error) {
        console.error('Error saving event:', error);
        return null;
      }

      console.log('Event saved successfully:', data.id);
      return data.id;
    } catch (error) {
      console.error('Error in saveEvent:', error);
      return null;
    }
  }

  async attachSectors(eventId: string, sectors: string[]): Promise<void> {
    try {
      // Fetch existing sectors to avoid duplicates
      const { data: existingSectors, error: existingSectorsError } = await this.supabase
        .from('sectors')
        .select('id, name')
        .in('name', sectors);

      if (existingSectorsError) {
        console.error('Error fetching existing sectors:', existingSectorsError);
        return;
      }

      const existingSectorNames = existingSectors.map(sector => sector.name);
      const newSectors = sectors.filter(sector => !existingSectorNames.includes(sector));

      // Insert new sectors
      let newSectorIds: any[] = [];
      if (newSectors.length > 0) {
        const { data: insertedSectors, error: insertError } = await this.supabase
          .from('sectors')
          .insert(newSectors.map(name => ({ name })))
          .select('id');

        if (insertError) {
          console.error('Error inserting new sectors:', insertError);
          return;
        }
        newSectorIds = insertedSectors;
      }

      // Combine existing and new sector IDs
      const allSectorIds = [...existingSectors.map(sector => ({ id: sector.id })), ...newSectorIds];

      // Attach sectors to the event
      const eventSectorsToInsert = allSectorIds.map(sector => ({
        event_id: eventId,
        sector_id: sector.id
      }));

      const { error: attachError } = await this.supabase
        .from('event_sectors')
        .insert(eventSectorsToInsert);

      if (attachError) {
        console.error('Error attaching sectors to event:', attachError);
      } else {
        console.log('Sectors attached to event successfully.');
      }
    } catch (error) {
      console.error('Error in attachSectors:', error);
    }
  }
}
