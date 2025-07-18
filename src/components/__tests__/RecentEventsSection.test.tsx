
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
    nom_event: 'Salon Test 1',
    description_event: 'Description du salon 1',
    date_debut: '2024-03-15',
    date_fin: '2024-03-17',
    secteur: 'Technologie',
    ville: 'Paris',
    country: 'France',
    is_b2b: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    type_event: 'salon',
    url_image: '/test-image-1.jpg'
  },
  {
    id: '2',
    nom_event: 'Convention Tech 2',
    description_event: 'Description de la convention 2',
    date_debut: '2024-04-10',
    date_fin: '2024-04-12',
    secteur: 'Informatique',
    ville: 'Lyon',
    country: 'France',
    is_b2b: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    type_event: 'convention',
    url_image: '/test-image-2.jpg'
  },
  {
    id: '3',
    nom_event: 'Salon Innovation 3',
    description_event: 'Description du salon 3',
    date_debut: '2024-05-20',
    date_fin: '2024-05-22',
    secteur: 'Innovation',
    ville: 'Marseille',
    country: 'France',
    is_b2b: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    type_event: 'salon',
    url_image: '/test-image-3.jpg'
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

  test('should render sector badges instead of event type', () => {
    mockUseEvents.mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    renderWithProviders(<RecentEventsSection />);
    
    expect(screen.getByText('Technologie')).toBeInTheDocument();
    expect(screen.getByText('Informatique')).toBeInTheDocument();
    expect(screen.getByText('Innovation')).toBeInTheDocument();
  });

  test('should not display descriptions in grid view', () => {
    mockUseEvents.mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    renderWithProviders(<RecentEventsSection />);
    
    expect(screen.queryByText('Description du salon 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Description de la convention 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Description du salon 3')).not.toBeInTheDocument();
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
      nom_event: `Event ${i + 1}`,
      secteur: `Sector ${i + 1}`
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
