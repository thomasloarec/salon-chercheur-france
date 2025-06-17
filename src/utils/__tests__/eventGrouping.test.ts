
import { groupEventsByMonth } from '../eventGrouping';
import type { Event } from '@/types/event';

// Mock data for testing
const mockEvents: Event[] = [
  {
    id: '1',
    name: 'Salon Tech Janvier',
    start_date: '2024-01-15',
    end_date: '2024-01-17',
    sector: 'Technologie',
    location: 'Paris',
    city: 'Paris',
    is_b2b: true,
    event_type: 'salon',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as Event,
  {
    id: '2',
    name: 'Convention Janvier',
    start_date: '2024-01-25',
    end_date: '2024-01-27',
    sector: 'Business',
    location: 'Lyon',
    city: 'Lyon',
    is_b2b: true,
    event_type: 'convention',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as Event,
  {
    id: '3',
    name: 'Salon Février',
    start_date: '2024-02-10',
    end_date: '2024-02-12',
    sector: 'Mode',
    location: 'Marseille',
    city: 'Marseille',
    is_b2b: true,
    event_type: 'salon',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as Event,
];

describe('groupEventsByMonth', () => {
  test('should group events by month correctly', () => {
    const grouped = groupEventsByMonth(mockEvents);
    
    expect(grouped).toHaveLength(2);
    expect(grouped[0].monthLabel).toBe('janvier 2024');
    expect(grouped[0].events).toHaveLength(2);
    expect(grouped[1].monthLabel).toBe('février 2024');
    expect(grouped[1].events).toHaveLength(1);
  });

  test('should return empty array for no events', () => {
    const grouped = groupEventsByMonth([]);
    expect(grouped).toHaveLength(0);
  });

  test('should handle single event', () => {
    const singleEvent = [mockEvents[0]];
    const grouped = groupEventsByMonth(singleEvent);
    
    expect(grouped).toHaveLength(1);
    expect(grouped[0].monthLabel).toBe('janvier 2024');
    expect(grouped[0].events).toHaveLength(1);
  });
});
