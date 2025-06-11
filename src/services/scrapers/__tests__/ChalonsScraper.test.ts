
import { ChalonsScraper } from '../ChalonsScraper';

describe('ChalonsScraper', () => {
  let scraper: ChalonsScraper;

  beforeEach(() => {
    scraper = new ChalonsScraper();
  });

  test('should scrape events successfully', async () => {
    const events = await scraper.scrapeEvents();
    
    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(10);
  });

  test('should have properly formatted events', async () => {
    const events = await scraper.scrapeEvents();
    
    if (events.length > 0) {
      const event = events[0];
      expect(event.title).toBeDefined();
      expect(event.city).toBe('Châlons-en-Champagne');
      expect(event.venue).toBe('Le Capitole');
      expect(event.source).toBe('chalons-tourisme.com');
      expect(event.startDate).toBeInstanceOf(Date);
    }
  });

  test('should include foire events', async () => {
    const events = await scraper.scrapeEvents();
    
    const foireEvents = events.filter(event => 
      event.title.toLowerCase().includes('foire')
    );
    
    expect(foireEvents.length).toBeGreaterThan(0);
  });

  test('should classify events correctly', async () => {
    const events = await scraper.scrapeEvents();
    
    events.forEach(event => {
      expect(event.sector).toBeDefined();
      expect(event.tags).toBeDefined();
      expect(Array.isArray(event.tags)).toBe(true);
    });
  });
});
