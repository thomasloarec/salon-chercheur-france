
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Header from '../Header';

// Mock useAuth hook
const mockUseAuth = {
  user: null,
  session: null,
  signOut: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => mockUseAuth,
}));

const renderWithProviders = (component: React.ReactElement) => {
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
    mockUseAuth.user = null;
    mockUseAuth.session = null;
  });

  test('should not show Admin link when user is not authenticated', () => {
    const { queryByText } = renderWithProviders(<Header />);
    expect(queryByText('Admin')).not.toBeInTheDocument();
  });

  test('should show Admin link when user is authenticated', () => {
    mockUseAuth.user = { id: '1', email: 'test@example.com' };
    mockUseAuth.session = { user: mockUseAuth.user };
    
    const { getByText } = renderWithProviders(<Header />);
    expect(getByText('Admin')).toBeInTheDocument();
  });

  test('should render navigation links', () => {
    const { getByText } = renderWithProviders(<Header />);
    expect(getByText('Accueil')).toBeInTheDocument();
    expect(getByText('Événements')).toBeInTheDocument();
  });
});
