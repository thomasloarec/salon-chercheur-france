
import { ViparisScraper } from '../ViparisScraper';
import fs from 'fs';
import path from 'path';

// Mock the request method
jest.mock('../BaseScraper');

describe('ViparisScraper', () => {
  let scraper: ViparisScraper;
  
  beforeEach(() => {
    scraper = new ViparisScraper();
    
    // Mock the request method to return our fixture
    (scraper as any).request = jest.fn().mockResolvedValue(
      fs.readFileSync(path.join(__dirname, '../__fixtures__/viparis-sample.html'), 'utf8')
    );
  });

  it('should parse events from HTML fixture', async () => {
    const events = await scraper.scrapeEvents();
    
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThanOrEqual(3); // We have 3 events in our fixture
    
    // Check first event
    const firstEvent = events[0];
    expect(firstEvent.title).toContain('INDUSTRIE');
    expect(firstEvent.description).toBeTruthy();
    expect(firstEvent.venue).toBeTruthy();
    expect(firstEvent.dateDebut).toBeInstanceOf(Date);
    expect(firstEvent.source).toBe('viparis.com');
    expect(firstEvent.sector).toBeTruthy();
  });

  it('should extract correct venue information', async () => {
    const events = await scraper.scrapeEvents();
    
    const industrieEvent = events.find(e => e.title.includes('INDUSTRIE'));
    expect(industrieEvent?.venue).toContain('Villepinte');
    
    const btpEvent = events.find(e => e.title.includes('BTP'));
    expect(btpEvent?.venue).toContain('Versailles');
    
    const techEvent = events.find(e => e.title.includes('TECH'));
    expect(techEvent?.venue).toContain('Congrès');
  });

  it('should detect sectors correctly', async () => {
    const events = await scraper.scrapeEvents();
    
    const industrieEvent = events.find(e => e.title.includes('INDUSTRIE'));
    expect(industrieEvent?.sector).toBe('Industrie');
    
    const btpEvent = events.find(e => e.title.includes('BTP'));
    expect(btpEvent?.sector).toBe('BTP');
    
    const techEvent = events.find(e => e.title.includes('TECH'));
    expect(techEvent?.sector).toBe('Technologie');
  });

  it('should extract tags from title and description', async () => {
    const events = await scraper.scrapeEvents();
    
    events.forEach(event => {
      expect(Array.isArray(event.tags)).toBe(true);
      expect(event.tags.length).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle date parsing', async () => {
    const events = await scraper.scrapeEvents();
    
    events.forEach(event => {
      expect(event.dateDebut).toBeInstanceOf(Date);
      expect(event.dateDebut.getTime()).not.toBeNaN();
      
      if (event.dateFin) {
        expect(event.dateFin).toBeInstanceOf(Date);
        expect(event.dateFin.getTime()).not.toBeNaN();
        expect(event.dateFin.getTime()).toBeGreaterThanOrEqual(event.dateDebut.getTime());
      }
    });
  });
});
