
import { groupEventsByMonth } from '../eventGrouping';
import type { Event } from '@/types/event';

const mockEvent: Event = {
  id: '1',
  nom_event: 'Test Event',
  date_debut: '2024-03-15',
  date_fin: '2024-03-17',
  secteur: 'Technology',
  nom_lieu: 'Test Venue',
  ville: 'Paris',
  is_b2b: true,
  type_event: 'salon',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  region: 'Île-de-France',
  country: 'France',
  url_image: null,
  url_site_officiel: null,
  description_event: null,
  tags: null,
  tarif: null,
  affluence: null,
  estimated_exhibitors: null,
  last_scraped_at: null,
  scraped_from: null,
  rue: null,
  code_postal: null,
  visible: true,
  slug: 'test-event-2024-paris',
  sectors: []
};

describe('eventGrouping', () => {
  describe('groupEventsByMonth', () => {
    it('should group events by month correctly', () => {
      const events: Event[] = [
        { ...mockEvent, id: '1', date_debut: '2024-03-15' },
        { ...mockEvent, id: '2', date_debut: '2024-03-20' },
        { ...mockEvent, id: '3', date_debut: '2024-04-10' },
      ];

      const result = groupEventsByMonth(events);

      expect(result).toHaveLength(2);
      expect(result[0].monthLabel).toBe('mars 2024');
      expect(result[0].events).toHaveLength(2);
      expect(result[1].monthLabel).toBe('avril 2024');
      expect(result[1].events).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const result = groupEventsByMonth([]);
      expect(result).toEqual([]);
    });

    it('should sort events within months by date', () => {
      const events: Event[] = [
        { ...mockEvent, id: '1', date_debut: '2024-03-20' },
        { ...mockEvent, id: '2', date_debut: '2024-03-10' },
        { ...mockEvent, id: '3', date_debut: '2024-03-15' },
      ];

      const result = groupEventsByMonth(events);

      expect(result).toHaveLength(1);
      expect(result[0].events[0].id).toBe('2'); // March 10
      expect(result[0].events[1].id).toBe('3'); // March 15
      expect(result[0].events[2].id).toBe('1'); // March 20
    });
  });
});
