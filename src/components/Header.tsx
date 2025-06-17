
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Menu, X, Calendar, Search, Users, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserMenu from './UserMenu';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, session } = useAuth();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  // Check if current user is admin
  const isAdmin = user?.email === 'admin@salonspro.com';

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Calendar className="h-8 w-8 text-primary" />
            <div className="text-xl font-bold">
              Salons<span className="text-accent">Pro</span>
            </div>
          </Link>

          {/* Navigation Desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            <NavLink 
              to="/" 
              className={({ isActive }) => 
                `text-gray-700 hover:text-primary transition-colors flex items-center space-x-1 ${
                  isActive ? 'text-primary font-medium' : ''
                }`
              }
            >
              <Search className="h-4 w-4" />
              <span>Accueil</span>
            </NavLink>
            <NavLink 
              to="/events" 
              className={({ isActive }) => 
                `text-gray-700 hover:text-primary transition-colors flex items-center space-x-1 ${
                  isActive ? 'text-primary font-medium' : ''
                }`
              }
            >
              <Calendar className="h-4 w-4" />
              <span>Événements</span>
            </NavLink>
            {session && isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => 
                  `text-gray-700 hover:text-primary transition-colors flex items-center space-x-1 ${
                    isActive ? 'text-primary font-medium' : ''
                  }`
                }
              >
                <Settings className="h-4 w-4" />
                <span>Admin</span>
                <Badge variant="secondary" className="ml-1 text-xs">dev</Badge>
              </NavLink>
            )}
          </nav>

          {/* Auth/User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <UserMenu />
            ) : (
              <Link to="/auth">
                <Button>Se connecter</Button>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button variant="ghost" size="sm" onClick={toggleMenu}>
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t">
              <NavLink
                to="/"
                className={({ isActive }) => 
                  `block px-3 py-2 text-gray-700 hover:text-primary transition-colors ${
                    isActive ? 'text-primary font-medium' : ''
                  }`
                }
                onClick={() => setIsMenuOpen(false)}
              >
                Accueil
              </NavLink>
              <NavLink
                to="/events"
                className={({ isActive }) => 
                  `block px-3 py-2 text-gray-700 hover:text-primary transition-colors ${
                    isActive ? 'text-primary font-medium' : ''
                  }`
                }
                onClick={() => setIsMenuOpen(false)}
              >
                Événements
              </NavLink>
              {session && isAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => 
                    `block px-3 py-2 text-gray-700 hover:text-primary transition-colors flex items-center space-x-1 ${
                      isActive ? 'text-primary font-medium' : ''
                    }`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span>Admin</span>
                  <Badge variant="secondary" className="ml-1 text-xs">dev</Badge>
                </NavLink>
              )}
              <div className="border-t pt-2">
                {user ? (
                  <div className="px-3 py-2">
                    <p className="text-sm text-gray-600 mb-2">{user.email}</p>
                    <UserMenu />
                  </div>
                ) : (
                  <Link
                    to="/auth"
                    className="block px-3 py-2"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Button className="w-full">Se connecter</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
