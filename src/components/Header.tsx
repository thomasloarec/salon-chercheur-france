import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Menu, X, Calendar, Search, Users, Settings, HelpCircle, LogOut, Radar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAdminPendingCounts } from '@/hooks/useAdminPendingCounts';
import UserMenu from './UserMenu';
import { USER_MENU_ITEMS } from '@/config/userMenuItems';
import logoLotexpo from '@/assets/logo-lotexpo.png';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, session, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: adminCounts } = useAdminPendingCounts();
  const adminPendingTotal = (adminCounts?.novelties ?? 0) + (adminCounts?.claims ?? 0);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const navLinkClass = (isActive: boolean) =>
    `text-muted-foreground hover:text-accent transition-colors flex items-center space-x-1 ${
      isActive ? 'text-accent font-medium' : ''
    }`;

  const mobileNavLinkClass = (isActive: boolean) =>
    `block px-3 py-2 text-muted-foreground hover:text-accent transition-colors ${
      isActive ? 'text-accent font-medium' : ''
    }`;

  return (
    <header className="bg-background border-b border-border/60 sticky top-0 z-50">
      <div className="w-full px-6 mx-auto">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src={logoLotexpo} alt="LotExpo" className="h-8" />
          </Link>

          {/* Navigation Desktop */}
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <NavLink 
              to="/" 
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Search className="h-4 w-4" />
              <span>Salons</span>
            </NavLink>
            <NavLink 
              to="/nouveautes" 
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Calendar className="h-4 w-4" />
              <span>Nouveautés</span>
            </NavLink>
            <NavLink 
              to="/radar-crm" 
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Radar className="h-4 w-4" />
              <span>Radar CRM</span>
              <Badge variant="secondary" className="ml-1 text-[10px] uppercase">Beta</Badge>
            </NavLink>
            <NavLink 
              to="/exposants" 
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Users className="h-4 w-4" />
              <span>Exposants</span>
            </NavLink>
            <NavLink 
              to="/comment-ca-marche" 
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <HelpCircle className="h-4 w-4" />
              <span>Comment ça marche</span>
            </NavLink>
            {session && isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => navLinkClass(isActive)}
              >
                <Settings className="h-4 w-4" />
                <span>Admin</span>
                <Badge variant="secondary" className="ml-1 text-xs">dev</Badge>
                {adminPendingTotal > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 h-5 min-w-[1.25rem] px-1.5 rounded-full text-[10px] font-semibold flex items-center justify-center"
                    aria-label={`${adminPendingTotal} notification(s) en attente`}
                  >
                    {adminPendingTotal > 99 ? '99+' : adminPendingTotal}
                  </Badge>
                )}
              </NavLink>
            )}
          </nav>

          {/* Auth/User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <UserMenu />
            ) : (
              <>
                <Link to="/auth?tab=signin">
                  <Button variant="ghost">Se connecter</Button>
                </Link>
                <Link to="/auth?tab=signup">
                  <Button>S'inscrire</Button>
                </Link>
              </>
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
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-border/60">
              <NavLink
                to="/"
                className={({ isActive }) => mobileNavLinkClass(isActive)}
                onClick={() => setIsMenuOpen(false)}
              >
                Salons
              </NavLink>
              <NavLink
                to="/nouveautes"
                className={({ isActive }) => mobileNavLinkClass(isActive)}
                onClick={() => setIsMenuOpen(false)}
              >
                Nouveautés
              </NavLink>
              <NavLink
                to="/radar-crm"
                className={({ isActive }) => mobileNavLinkClass(isActive)}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="inline-flex items-center gap-2">
                  Radar CRM
                  <Badge variant="secondary" className="text-[10px] uppercase">Beta</Badge>
                </span>
              </NavLink>
              <NavLink
                to="/exposants"
                className={({ isActive }) => mobileNavLinkClass(isActive)}
                onClick={() => setIsMenuOpen(false)}
              >
                Exposants
              </NavLink>
              <NavLink
                to="/comment-ca-marche"
                className={({ isActive }) => mobileNavLinkClass(isActive)}
                onClick={() => setIsMenuOpen(false)}
              >
                Comment ça marche
              </NavLink>
              {session && isAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `block px-3 py-2 text-muted-foreground hover:text-accent transition-colors flex items-center space-x-1 ${
                      isActive ? 'text-accent font-medium' : ''
                    }`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span>Admin</span>
                  <Badge variant="secondary" className="ml-1 text-xs">dev</Badge>
                  {adminPendingTotal > 0 && (
                    <Badge
                      variant="destructive"
                      className="ml-1 h-5 min-w-[1.25rem] px-1.5 rounded-full text-[10px] font-semibold flex items-center justify-center"
                      aria-label={`${adminPendingTotal} notification(s) en attente`}
                    >
                      {adminPendingTotal > 99 ? '99+' : adminPendingTotal}
                    </Badge>
                  )}
                </NavLink>
              )}
              <div className="border-t border-border/60 pt-2">
                {user ? (
                  <div className="space-y-1">
                    <p className="px-3 py-2 text-sm text-muted-foreground">{user.email}</p>
                    {USER_MENU_ITEMS.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `block px-3 py-2 pl-6 text-muted-foreground hover:text-accent transition-colors ${isActive ? 'text-accent font-medium' : ''}`
                        }
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <span className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </span>
                      </NavLink>
                    ))}
                    <button
                      onClick={() => { setIsMenuOpen(false); signOut(); }}
                      className="block w-full text-left px-3 py-2 pl-6 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        Se déconnecter
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="px-3 py-2 flex flex-col gap-2">
                    <Link
                      to="/auth?tab=signin"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Button variant="ghost" className="w-full">Se connecter</Button>
                    </Link>
                    <Link
                      to="/auth?tab=signup"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Button className="w-full">S'inscrire</Button>
                    </Link>
                  </div>
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
