
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-primary">
              Salons<span className="text-accent">Pro</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/" 
              className={`transition-colors duration-200 ${
                location.pathname === '/' ? 'text-primary font-medium' : 'text-gray-700 hover:text-primary'
              }`}
            >
              Accueil
            </Link>
            <Link 
              to="/events" 
              className={`transition-colors duration-200 ${
                location.pathname === '/events' ? 'text-primary font-medium' : 'text-gray-700 hover:text-primary'
              }`}
            >
              Rechercher
            </Link>
            <a href="#secteurs" className="text-gray-700 hover:text-primary transition-colors duration-200">
              Secteurs
            </a>
            <a href="#calendrier" className="text-gray-700 hover:text-primary transition-colors duration-200">
              Calendrier
            </a>
            <a href="#fonctionnalites" className="text-gray-700 hover:text-primary transition-colors duration-200">
              Fonctionnalités
            </a>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden animate-fade-in-up">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t border-gray-200">
              <Link 
                to="/" 
                className="block px-3 py-2 text-gray-700 hover:text-primary"
                onClick={() => setIsMenuOpen(false)}
              >
                Accueil
              </Link>
              <Link 
                to="/events" 
                className="block px-3 py-2 text-gray-700 hover:text-primary"
                onClick={() => setIsMenuOpen(false)}
              >
                Rechercher
              </Link>
              <a href="#secteurs" className="block px-3 py-2 text-gray-700 hover:text-primary">
                Secteurs
              </a>
              <a href="#calendrier" className="block px-3 py-2 text-gray-700 hover:text-primary">
                Calendrier
              </a>
              <a href="#fonctionnalites" className="block px-3 py-2 text-gray-700 hover:text-primary">
                Fonctionnalités
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
