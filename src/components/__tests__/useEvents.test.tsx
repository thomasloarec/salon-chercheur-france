
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEvents } from '../../hooks/useEvents';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
    })),
  },
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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useEvents hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should build correct query for multiple sectors and months', () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
    };

    (supabase.from as jest.Mock).mockReturnValue(mockQuery);

    renderHook(() => 
      useEvents({
        sectors: ['tech', 'health'],
        months: [3, 4, 5],
        city: 'Paris'
      }), 
      { wrapper: createWrapper() }
    );

    // Vérifier que les bonnes méthodes sont appelées
    expect(supabase.from).toHaveBeenCalledWith('events');
    expect(mockQuery.select).toHaveBeenCalledWith('*');
    expect(mockQuery.eq).toHaveBeenCalledWith('is_b2b', true);
    expect(mockQuery.gte).toHaveBeenCalledWith('start_date', expect.any(String));
    expect(mockQuery.in).toHaveBeenCalledWith('sector', ['tech', 'health']);
    expect(mockQuery.filter).toHaveBeenCalledWith('extract(month from start_date)::int', 'in', '(3,4,5)');
    expect(mockQuery.ilike).toHaveBeenCalledWith('city', '%Paris%');
    expect(mockQuery.order).toHaveBeenCalledWith('start_date', { ascending: true });
  });

  test('should exclude past events', () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    };

    (supabase.from as jest.Mock).mockReturnValue(mockQuery);

    renderHook(() => useEvents({}), { wrapper: createWrapper() });

    const today = new Date().toISOString().split('T')[0];
    expect(mockQuery.gte).toHaveBeenCalledWith('start_date', today);
  });

  test('should not apply filters when arrays are empty', () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
    };

    (supabase.from as jest.Mock).mockReturnValue(mockQuery);

    renderHook(() => 
      useEvents({
        sectors: [],
        months: []
      }), 
      { wrapper: createWrapper() }
    );

    // Ne doit pas appeler in() ou filter() pour des tableaux vides
    expect(mockQuery.in).not.toHaveBeenCalled();
    expect(mockQuery.filter).not.toHaveBeenCalled();
  });
});
