
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import RecentEventsSection from '../RecentEventsSection';
import * as useEventsHook from '@/hooks/useEvents';
import type { Event } from '@/types/event';

// Mock the useEvents hook
jest.mock('@/hooks/useEvents');

// Mock event data
const mockEvents: Event[] = [
  {
    id: '1',
    name: 'Salon Test 1',
    description: 'Description du salon 1',
    start_date: '2024-03-15',
    end_date: '2024-03-17',
    sector: 'Technologie',
    location: 'Paris',
    city: 'Paris',
    country: 'France',
    is_b2b: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    event_type: 'salon',
    image_url: '/test-image-1.jpg'
  },
  {
    id: '2',
    name: 'Convention Tech 2',
    description: 'Description de la convention 2',
    start_date: '2024-04-10',
    end_date: '2024-04-12',
    sector: 'Informatique',
    location: 'Lyon',
    city: 'Lyon',
    country: 'France',
    is_b2b: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    event_type: 'convention',
    image_url: '/test-image-2.jpg'
  },
  {
    id: '3',
    name: 'Salon Innovation 3',
    description: 'Description du salon 3',
    start_date: '2024-05-20',
    end_date: '2024-05-22',
    sector: 'Innovation',
    location: 'Marseille',
    city: 'Marseille',
    country: 'France',
    is_b2b: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    event_type: 'salon',
    image_url: '/test-image-3.jpg'
  }
];

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('RecentEventsSection', () => {
  const mockUseEvents = useEventsHook.useEvents as jest.MockedFunction<typeof useEventsHook.useEvents>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render section title', () => {
    mockUseEvents.mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    renderWithProviders(<RecentEventsSection />);
    
    expect(screen.getByText('Événements à venir')).toBeInTheDocument();
  });

  test('should render 3 event cards when 3 events are provided', async () => {
    mockUseEvents.mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    renderWithProviders(<RecentEventsSection />);
    
    const images = await screen.findAllByRole('img');
    expect(images).toHaveLength(3);
    
    expect(screen.getByText('Salon Test 1')).toBeInTheDocument();
    expect(screen.getByText('Convention Tech 2')).toBeInTheDocument();
    expect(screen.getByText('Salon Innovation 3')).toBeInTheDocument();
  });

  test('should show loading state', () => {
    mockUseEvents.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    } as any);

    renderWithProviders(<RecentEventsSection />);
    
    const loadingCards = document.querySelectorAll('.animate-pulse');
    expect(loadingCards).toHaveLength(8);
  });

  test('should show empty state when no events', () => {
    mockUseEvents.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    renderWithProviders(<RecentEventsSection />);
    
    expect(screen.getByText('Aucun événement à venir pour le moment')).toBeInTheDocument();
  });

  test('should limit events to 8 maximum', () => {
    const manyEvents = Array.from({ length: 12 }, (_, i) => ({
      ...mockEvents[0],
      id: `${i + 1}`,
      name: `Event ${i + 1}`
    }));

    mockUseEvents.mockReturnValue({
      data: manyEvents,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    renderWithProviders(<RecentEventsSection />);
    
    // Should only render 8 cards maximum
    const eventCards = document.querySelectorAll('[class*="rounded-2xl"]');
    expect(eventCards.length).toBeLessThanOrEqual(8);
  });

  test('should render "Voir tous les événements" button', () => {
    mockUseEvents.mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    renderWithProviders(<RecentEventsSection />);
    
    const buttons = screen.getAllByText('Voir tous les événements');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
