
import { describe, it, expect } from '@jest/globals';
import { groupEventsByMonth } from '../eventGrouping';
import type { Event } from '@/types/event';

const mockEvent: Event = {
  id: '1',
  nom_event: 'Test Event',
  date_debut: '2024-01-15',
  date_fin: '2024-01-17',
  ville: 'Paris',
  secteur: 'Test',
  country: 'France',
  is_b2b: true,
  type_event: 'salon',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  visible: true,
  sectors: []
};

describe('eventGrouping', () => {
  describe('groupEventsByMonth', () => {
    it('should group events by month', () => {
      const events: Event[] = [
        { ...mockEvent, id: '1', date_debut: '2024-01-15' },
        { ...mockEvent, id: '2', date_debut: '2024-01-20' },
        { ...mockEvent, id: '3', date_debut: '2024-02-10' },
      ];

      const grouped = groupEventsByMonth(events);

      expect(grouped).toHaveLength(2);
      expect(grouped[0].monthLabel).toBe('janvier 2024');
      expect(grouped[0].events).toHaveLength(2);
      expect(grouped[1].monthLabel).toBe('février 2024');
      expect(grouped[1].events).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = groupEventsByMonth([]);
      expect(grouped).toHaveLength(0);
    });

    it('should sort events within each month by date', () => {
      const events: Event[] = [
        { ...mockEvent, id: '1', date_debut: '2024-01-20' },
        { ...mockEvent, id: '2', date_debut: '2024-01-10' },
        { ...mockEvent, id: '3', date_debut: '2024-01-15' },
      ];

      const grouped = groupEventsByMonth(events);

      expect(grouped[0].events[0].date_debut).toBe('2024-01-10');
      expect(grouped[0].events[1].date_debut).toBe('2024-01-15');
      expect(grouped[0].events[2].date_debut).toBe('2024-01-20');
    });
  });
});
