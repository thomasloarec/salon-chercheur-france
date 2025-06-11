
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Events from '@/pages/Events';
import { useEvents } from '@/hooks/useEvents';

// Mock the hooks
jest.mock('@/hooks/useEvents');
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: any) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );
};

const mockEvents = [
  {
    id: '1',
    name: 'Test Event 1',
    start_date: '2024-12-15',
    end_date: '2024-12-17',
    city: 'Paris',
    sector: 'Technology',
    location: 'Test Location',
    is_b2b: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Test Event 2',
    start_date: '2024-12-20',
    end_date: '2024-12-22',
    city: 'Lyon',
    sector: 'Health',
    location: 'Test Location 2',
    is_b2b: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

describe('Events Page', () => {
  beforeEach(() => {
    (useEvents as jest.Mock).mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
    });
  });

  test('renders events page with sidebar and content', () => {
    render(<Events />, { wrapper: createWrapper() });
    
    expect(screen.getByText('2 salon(s) trouvé(s)')).toBeInTheDocument();
    expect(screen.getByText('Filtres')).toBeInTheDocument();
    expect(screen.getByText('Grille')).toBeInTheDocument();
    expect(screen.getByText('Liste')).toBeInTheDocument();
    expect(screen.getByText('Carte')).toBeInTheDocument();
  });

  test('shows mobile menu button on mobile', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(<Events />, { wrapper: createWrapper() });
    
    const mobileMenuButton = screen.getAllByText('Filtres')[0];
    expect(mobileMenuButton).toBeInTheDocument();
  });

  test('displays loading state', () => {
    (useEvents as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    render(<Events />, { wrapper: createWrapper() });
    
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  test('displays error state', () => {
    (useEvents as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Test error'),
    });

    render(<Events />, { wrapper: createWrapper() });
    
    expect(screen.getByText('Erreur lors du chargement des événements')).toBeInTheDocument();
  });
});
