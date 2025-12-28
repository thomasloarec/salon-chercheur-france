
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Menu, X, Calendar, Search, Users, Settings, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import UserMenu from './UserMenu';
import logoLotexpo from '@/assets/logo-lotexpo.png';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, session } = useAuth();
  const { isAdmin } = useIsAdmin();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="w-full px-6 mx-auto">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src={logoLotexpo} alt="LotExpo" className="h-8" />
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
              to="/nouveautes" 
              className={({ isActive }) => 
                `text-gray-700 hover:text-primary transition-colors flex items-center space-x-1 ${
                  isActive ? 'text-primary font-medium' : ''
                }`
              }
            >
              <Calendar className="h-4 w-4" />
              <span>Nouveautés</span>
            </NavLink>
            <NavLink 
              to="/exposants" 
              className={({ isActive }) => 
                `text-gray-700 hover:text-primary transition-colors flex items-center space-x-1 ${
                  isActive ? 'text-primary font-medium' : ''
                }`
              }
            >
              <Users className="h-4 w-4" />
              <span>Exposants</span>
            </NavLink>
            <NavLink 
              to="/comment-ca-marche" 
              className={({ isActive }) => 
                `text-gray-700 hover:text-primary transition-colors flex items-center space-x-1 ${
                  isActive ? 'text-primary font-medium' : ''
                }`
              }
            >
              <HelpCircle className="h-4 w-4" />
              <span>Comment ça marche</span>
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
                to="/nouveautes"
                className={({ isActive }) => 
                  `block px-3 py-2 text-gray-700 hover:text-primary transition-colors ${
                    isActive ? 'text-primary font-medium' : ''
                  }`
                }
                onClick={() => setIsMenuOpen(false)}
              >
                Nouveautés
              </NavLink>
              <NavLink
                to="/exposants"
                className={({ isActive }) => 
                  `block px-3 py-2 text-gray-700 hover:text-primary transition-colors ${
                    isActive ? 'text-primary font-medium' : ''
                  }`
                }
                onClick={() => setIsMenuOpen(false)}
              >
                Exposants
              </NavLink>
              <NavLink
                to="/comment-ca-marche"
                className={({ isActive }) => 
                  `block px-3 py-2 text-gray-700 hover:text-primary transition-colors ${
                    isActive ? 'text-primary font-medium' : ''
                  }`
                }
                onClick={() => setIsMenuOpen(false)}
              >
                Comment ça marche
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
