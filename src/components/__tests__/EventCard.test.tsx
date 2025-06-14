
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventCard from '../EventCard';
import type { Event } from '@/types/event';

// Mock event data
const mockSalonEvent: Event = {
  id: '1',
  name: 'Salon Test',
  description: 'Description du salon',
  start_date: '2024-03-15',
  end_date: '2024-03-17',
  sector: 'Technologie',
  location: 'Paris',
  city: 'Paris',
  country: 'France',
  is_b2b: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  event_type: 'salon'
};

const mockLoisirEvent: Event = {
  id: '2',
  name: 'Concert Rock',
  description: 'Concert de musique rock',
  start_date: '2024-03-15',
  end_date: '2024-03-15',
  sector: 'Musique',
  location: 'Lyon',
  city: 'Lyon',
  country: 'France',
  is_b2b: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  event_type: 'loisir'
};

const mockConventionEvent: Event = {
  id: '3',
  name: 'Convention Tech',
  description: 'Convention technologique',
  start_date: '2024-04-10',
  end_date: '2024-04-12',
  sector: 'Informatique',
  location: 'Marseille',
  city: 'Marseille',
  country: 'France',
  is_b2b: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  event_type: 'convention'
};

describe('EventCard', () => {
  test('should render sector badge in grid view', () => {
    const { getByText } = render(<EventCard event={mockSalonEvent} view="grid" />);
    
    expect(getByText('Salon Test')).toBeInTheDocument();
    expect(getByText('Technologie')).toBeInTheDocument();
  });

  test('should render event details correctly in grid view', () => {
    const { getByText } = render(<EventCard event={mockSalonEvent} view="grid" />);
    
    expect(getByText('Salon Test')).toBeInTheDocument();
    expect(getByText('Technologie')).toBeInTheDocument();
    expect(getByText(/Paris/)).toBeInTheDocument();
  });

  test('should render calendar buttons in grid view', () => {
    const { getByText } = render(<EventCard event={mockSalonEvent} view="grid" />);
    expect(getByText('Google')).toBeInTheDocument();
    expect(getByText('Outlook')).toBeInTheDocument();
  });

  test('should render sector badge for different event types', () => {
    const { getByText } = render(<EventCard event={mockConventionEvent} view="grid" />);
    
    expect(getByText('Convention Tech')).toBeInTheDocument();
    expect(getByText('Informatique')).toBeInTheDocument();
  });
});
