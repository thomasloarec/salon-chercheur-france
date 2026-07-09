import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Menu, X, Calendar, Search, Users, Settings, LogOut, Radar, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAdminPendingCounts } from '@/hooks/useAdminPendingCounts';
import UserMenu from './UserMenu';
import { USER_MENU_ITEMS } from '@/config/userMenuItems';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
} from '@/components/ui/navigation-menu';
import logoLotexpo from '@/assets/logo-lotexpo.png';

const FEATURE_ITEMS = [
  { to: '/recherche-ia', label: 'Recherche IA', icon: Sparkles, description: 'Trouvez le bon salon avec l’IA' },
  { to: '/radar-crm', label: 'Radar CRM', icon: Radar, description: 'Suivez vos comptes sur les salons' },
  { to: '/nouveautes', label: 'Nouveautés', icon: Calendar, description: 'Les dernières innovations exposées' },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, session, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: adminCounts } = useAdminPendingCounts();
  const adminPendingTotal = (adminCounts?.novelties ?? 0) + (adminCounts?.claims ?? 0);
  // Un utilisateur anonyme (session Recherche IA) ne doit pas apparaître comme connecté.
  const isRealUser = !!user && user.is_anonymous !== true;

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
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-auto bg-transparent px-0 py-0 text-muted-foreground hover:text-accent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-accent font-normal">
                    Fonctionnalités
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[320px] gap-1 p-2">
                      {FEATURE_ITEMS.map((item) => (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            className="flex items-start gap-3 rounded-md p-3 hover:bg-accent/10 transition-colors"
                          >
                            <item.icon className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                            <span className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">{item.label}</span>
                              <span className="text-xs text-muted-foreground">{item.description}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
            <NavLink
              to="/salons"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Search className="h-4 w-4" />
              <span>Salons</span>
            </NavLink>
            <NavLink
              to="/exposants"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Users className="h-4 w-4" />
              <span>Exposants</span>
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
            {isRealUser ? (
              <UserMenu />
            ) : (
              <>
                <Link to="/auth?tab=signin">
                  <Button variant="ghost">Se connecter</Button>
                </Link>
                <Link to="/recherche-ia">
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                    Essayer l'IA
                    <Sparkles className="ml-2 h-4 w-4" />
                  </Button>
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
              <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Fonctionnalités
              </p>
              {FEATURE_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `${mobileNavLinkClass(isActive)} pl-6`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="inline-flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </NavLink>
              ))}
              <NavLink
                to="/salons"
                className={({ isActive }) => mobileNavLinkClass(isActive)}
                onClick={() => setIsMenuOpen(false)}
              >
                Salons
              </NavLink>
              <NavLink
                to="/exposants"
                className={({ isActive }) => mobileNavLinkClass(isActive)}
                onClick={() => setIsMenuOpen(false)}
              >
                Exposants
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
                {isRealUser ? (
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
                      to="/recherche-ia"
                      onClick={() => setIsMenuOpen(false)}
                    >
                    <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                      Essayer l'IA
                      <Sparkles className="ml-2 h-4 w-4" />
                    </Button>
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
