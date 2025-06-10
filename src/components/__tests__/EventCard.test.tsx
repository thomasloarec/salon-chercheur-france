
import { render, screen } from '@testing-library/react';
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
  test('should render salon badge for salon event', () => {
    render(<EventCard event={mockSalonEvent} />);
    
    expect(screen.getByText('Salon Test')).toBeInTheDocument();
    expect(screen.getByText('salon')).toBeInTheDocument();
    
    // Check that the salon badge has the destructive variant (red)
    const salonBadge = screen.getByText('salon');
    expect(salonBadge).toHaveClass('bg-destructive');
  });

  test('should not render event type badge for loisir event', () => {
    render(<EventCard event={mockLoisirEvent} />);
    
    expect(screen.getByText('Concert Rock')).toBeInTheDocument();
    expect(screen.queryByText('loisir')).not.toBeInTheDocument();
  });

  test('should render convention badge for convention event', () => {
    render(<EventCard event={mockConventionEvent} />);
    
    expect(screen.getByText('Convention Tech')).toBeInTheDocument();
    expect(screen.getByText('convention')).toBeInTheDocument();
    
    // Check that the convention badge has the secondary variant
    const conventionBadge = screen.getByText('convention');
    expect(conventionBadge).toHaveClass('bg-secondary');
  });

  test('should render event details correctly', () => {
    render(<EventCard event={mockSalonEvent} />);
    
    expect(screen.getByText('Salon Test')).toBeInTheDocument();
    expect(screen.getByText('Technologie')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('Description du salon')).toBeInTheDocument();
  });

  test('should render calendar buttons', () => {
    render(<EventCard event={mockSalonEvent} />);
    
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Outlook')).toBeInTheDocument();
  });
});
