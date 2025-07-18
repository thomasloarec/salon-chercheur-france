
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventCard from '../EventCard';
import type { Event } from '@/types/event';

// Mock event data
const mockSalonEvent: Event = {
  id: '1',
  name_event: 'Salon Test',
  description_event: 'Description du salon',
  date_debut: '2024-03-15',
  date_fin: '2024-03-17',
  secteur: 'Technologie',
  ville: 'Paris',
  country: 'France',
  is_b2b: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  type_event: 'salon'
};

const mockConventionEvent: Event = {
  id: '3',
  name_event: 'Convention Tech',
  description_event: 'Convention technologique',
  date_debut: '2024-04-10',
  date_fin: '2024-04-12',
  secteur: 'Informatique',
  ville: 'Marseille',
  country: 'France',
  is_b2b: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  type_event: 'convention'
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
