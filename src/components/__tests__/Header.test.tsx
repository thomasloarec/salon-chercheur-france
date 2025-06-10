import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Header from '../Header';

// Mock the AuthContext
const mockAuthContext = {
  user: null,
  session: null,
  loading: false,
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuthContext,
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Header', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockAuthContext.user = null;
    mockAuthContext.session = null;
  });

  test('does not show Admin link when user is not authenticated', () => {
    renderWithRouter(<Header />);
    
    // Admin link should not be present
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    
    // Other navigation links should be present
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Événements')).toBeInTheDocument();
    expect(screen.getByText('Se connecter')).toBeInTheDocument();
  });

  test('shows Admin link when user is authenticated', () => {
    // Mock authenticated user
    mockAuthContext.user = {
      id: 'test-user-id',
      email: 'test@example.com',
    } as any;
    mockAuthContext.session = {
      user: mockAuthContext.user,
      access_token: 'mock-token',
    } as any;

    renderWithRouter(<Header />);
    
    // Admin link should be present
    expect(screen.getByText('Admin')).toBeInTheDocument();
    
    // Dev badge should be present
    expect(screen.getByText('dev')).toBeInTheDocument();
    
    // Other navigation links should still be present
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Événements')).toBeInTheDocument();
    
    // Login button should not be present (replaced by user menu)
    expect(screen.queryByText('Se connecter')).not.toBeInTheDocument();
  });

  test('Admin link has correct href when authenticated', () => {
    // Mock authenticated user
    mockAuthContext.user = {
      id: 'test-user-id',
      email: 'test@example.com',
    } as any;
    mockAuthContext.session = {
      user: mockAuthContext.user,
      access_token: 'mock-token',
    } as any;

    renderWithRouter(<Header />);
    
    const adminLink = screen.getByText('Admin').closest('a');
    expect(adminLink).toHaveAttribute('href', '/admin');
  });
});
