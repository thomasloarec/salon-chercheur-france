
// Mock de l'API Viparis avec pagination
const mockViparisPage1 = {
  events: Array.from({ length: 100 }, (_, i) => ({
    id: `event-${i + 1}`,
    title: `Salon INDUSTRIE ${i + 1}`,
    excerpt: 'Le salon international de l\'industrie et des technologies innovantes',
    beginDate: '2025-03-15T09:00:00Z',
    endDate: '2025-03-17T18:00:00Z',
    venue: 'Paris Expo Porte de Versailles',
    category: 'Professionnel'
  })),
  totalCount: 250,
  totalPages: 3,
  page: 1,
  size: 100
};

const mockViparisPage2 = {
  events: Array.from({ length: 100 }, (_, i) => ({
    id: `event-${i + 101}`,
    title: `Expo TECH ${i + 101}`,
    excerpt: 'Exposition des dernières technologies B2B',
    beginDate: '2025-04-10T08:00:00Z',
    endDate: '2025-04-12T17:00:00Z',
    venue: 'Parc des Expositions Paris Nord Villepinte',
    category: 'Professionnel'
  })),
  totalCount: 250,
  totalPages: 3,
  page: 2,
  size: 100
};

const mockViparisPage3 = {
  events: Array.from({ length: 50 }, (_, i) => ({
    id: `event-${i + 201}`,
    title: `Congrès MEDICAL ${i + 201}`,
    excerpt: 'Congrès national des professionnels de santé',
    beginDate: '2025-05-20T08:00:00Z',
    endDate: '2025-05-22T17:00:00Z',
    venue: 'Palais des Congrès',
    category: 'Professionnel'
  })),
  totalCount: 250,
  totalPages: 3,
  page: 3,
  size: 100
};

// Mock fetch global
global.fetch = jest.fn();

describe('Viparis API Pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle pagination with totalPages', async () => {
    // Mock des 3 pages
    (global.fetch as jest.MockedFunction<typeof fetch>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockViparisPage1,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockViparisPage2,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockViparisPage3,
      } as Response);

    // Simulation de récupération de toutes les pages
    const allEvents = [];
    let page = 1;

    while (page <= 3) {
      const response = await fetch(`https://www.viparis.com/api/event-public?page=${page}&size=100`);
      const data = await response.json();
      allEvents.push(...data.events);
      page++;
    }

    expect(allEvents).toHaveLength(250); // 100 + 100 + 50
    expect(allEvents[0].title).toBe('Salon INDUSTRIE 1');
    expect(allEvents[100].title).toBe('Expo TECH 101');
    expect(allEvents[200].title).toBe('Congrès MEDICAL 201');
  });

  it('should handle pagination with totalCount calculation', async () => {
    const mockResponse = {
      events: Array.from({ length: 100 }, (_, i) => ({
        id: `event-${i}`,
        title: `Event ${i}`,
        excerpt: 'Description',
        beginDate: '2025-03-15T09:00:00Z',
        endDate: '2025-03-17T18:00:00Z',
        venue: 'Venue'
      })),
      totalCount: 350, // Indique qu'il y a 350 événements au total
      page: 1,
      size: 100
    };

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const response = await fetch('https://www.viparis.com/api/event-public?page=1&size=100');
    const data = await response.json();

    // Calcul du nombre total de pages
    const estimatedTotalPages = Math.ceil(data.totalCount / data.size);
    
    expect(estimatedTotalPages).toBe(4); // 350 / 100 = 3.5 → 4 pages
    expect(data.events).toHaveLength(100);
  });

  it('should filter B2B events correctly', () => {
    const testEvents = [
      {
        id: '1',
        title: 'Salon INDUSTRIE Professional',
        excerpt: 'Exposition B2B pour professionnels',
        beginDate: '2025-03-15T09:00:00Z',
        endDate: '2025-03-17T18:00:00Z',
        venue: 'Paris Expo'
      },
      {
        id: '2',
        title: 'Festival de Musique',
        excerpt: 'Concert grand public famille',
        beginDate: '2025-04-15T19:00:00Z',
        endDate: '2025-04-15T23:00:00Z',
        venue: 'Stade de France'
      },
      {
        id: '3',
        title: 'Congrès Médical',
        excerpt: 'Rencontre des professionnels de santé',
        beginDate: '2025-05-10T08:00:00Z',
        endDate: '2025-05-12T17:00:00Z',
        venue: 'Palais des Congrès'
      }
    ];

    const b2bEvents = testEvents.filter(event => isB2BEvent(event));
    
    expect(b2bEvents).toHaveLength(2);
    expect(b2bEvents[0].title).toBe('Salon INDUSTRIE Professional');
    expect(b2bEvents[1].title).toBe('Congrès Médical');
  });

  it('should map events correctly with all required fields', () => {
    const viparisEvent = {
      id: 'salon-test-2025',
      title: 'Salon TEST 2025',
      excerpt: 'Description du salon test',
      beginDate: '2025-06-15T09:00:00Z',
      endDate: '2025-06-17T18:00:00Z',
      venue: 'Paris Expo Porte de Versailles'
    };

    const mappedEvent = mapViparisEvent(viparisEvent);

    expect(mappedEvent).toEqual({
      name: 'Salon TEST 2025',
      description: 'Description du salon test',
      start_date: '2025-06-15',
      end_date: '2025-06-17',
      venue_name: 'Paris Expo Porte de Versailles',
      event_url: 'https://www.viparis.com/e/salon-test-2025',
      city: 'Paris',
      location: 'Paris, France',
      country: 'France',
      sector: 'Autre',
      event_type: 'salon',
      is_b2b: true,
      scraped_from: 'viparis.com'
    });
  });
});

// Fonctions utilitaires pour les tests
function isB2BEvent(event: any): boolean {
  const text = `${event.title} ${event.excerpt || ''}`.toLowerCase();
  
  const b2bKeywords = [
    'salon', 'expo', 'congrès', 'b2b', 'professionnel', 'industrie',
    'business', 'entreprise', 'commercial', 'innovation', 'technologie'
  ];
  
  const b2cKeywords = [
    'grand public', 'famille', 'enfant', 'loisir', 'spectacle',
    'concert', 'festival', 'fête', 'animation'
  ];
  
  const hasB2B = b2bKeywords.some(keyword => text.includes(keyword));
  const hasB2C = b2cKeywords.some(keyword => text.includes(keyword));
  
  return hasB2B && !hasB2C;
}

function mapViparisEvent(event: any) {
  return {
    name: event.title,
    description: event.excerpt || '',
    start_date: new Date(event.beginDate).toISOString().split('T')[0],
    end_date: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : new Date(event.beginDate).toISOString().split('T')[0],
    venue_name: event.venue || 'Viparis',
    event_url: `https://www.viparis.com/e/${event.id}`,
    city: 'Paris',
    location: 'Paris, France',
    country: 'France',
    sector: 'Autre',
    event_type: 'salon',
    is_b2b: true,
    scraped_from: 'viparis.com'
  };
}
