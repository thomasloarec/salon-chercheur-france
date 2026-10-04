import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Menu, X, Search, Users, Settings, Radar, Sparkles, Lightbulb, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAdminPendingCounts } from '@/hooks/useAdminPendingCounts';
import UserMenu from './UserMenu';
import MobileNavDrawer from './MobileNavDrawer';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
} from '@/components/ui/navigation-menu';
import { LotexpoWordmark } from '@/components/LotexpoWordmark';
import { NAV_SOLUTION_GROUPS, AGENDA_NAV_ITEM } from '@/config/navSolutions';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, session, signOut, isRealUser } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: adminCounts } = useAdminPendingCounts();
  const adminPendingTotal =
    (adminCounts?.novelties ?? 0) +
    (adminCounts?.claims ?? 0) +
    (adminCounts?.organisateurs ?? 0);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const navLinkClass = (isActive: boolean) =>
    `text-sm text-muted-foreground hover:text-primary transition-colors flex items-center space-x-1 ${
      isActive ? 'text-primary font-medium' : ''
    }`;

  return (
    <header className="bg-background border-b border-border/60 sticky top-0 z-50">
      <div className="w-full px-6 mx-auto">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <LotexpoWordmark aria-label="Lotexpo" className="h-8 w-auto text-foreground [--logo-accent:hsl(var(--primary))]" />
          </Link>

          {/* Navigation Desktop */}
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    type="button"
                    className="h-auto bg-transparent px-0 py-0 text-sm text-muted-foreground hover:text-primary hover:bg-transparent focus:bg-transparent focus:text-primary data-[state=open]:bg-transparent data-[state=open]:text-primary font-normal"
                  >
                    Solutions
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid w-[560px] grid-cols-2 gap-x-2 gap-y-3 p-3">
                      {NAV_SOLUTION_GROUPS.map((group) => (
                        <div key={group.title}>
                          <p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.title}
                          </p>
                          <ul className="mt-1 grid gap-1">
                            {group.items.map((item) => (
                              <li key={item.to}>
                                <Link
                                  to={item.to}
                                  className="flex items-start gap-3 rounded-md p-3 hover:bg-primary/10 transition-colors"
                                >
                                  <item.icon className="h-5 w-5 text-foreground mt-0.5 shrink-0" />
                                  <span className="flex flex-col">
                                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                                    <span className="text-xs text-muted-foreground">{item.description}</span>
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
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
              to="/nouveautes"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Lightbulb className="h-4 w-4" />
              <span>Avant-première</span>
            </NavLink>
            <NavLink
              to={AGENDA_NAV_ITEM.to}
              end
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <AGENDA_NAV_ITEM.icon className="h-4 w-4" />
              <span>Mon Agenda</span>
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
              <Link to="/auth?tab=signin">
                <Button variant="ghost" type="button">Se connecter</Button>
              </Link>
            )}
            <Link to="/recherche-ia">
              <Button
                type="button"
                className="rounded-xl shadow-[0_4px_14px_-4px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_18px_-4px_rgba(0,0,0,0.3)] transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Essayer l'IA
                <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={toggleMenu}
              aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={isMenuOpen}
              className="h-11 w-11"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation : tiroir plein écran */}
        <MobileNavDrawer
          open={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          groups={NAV_SOLUTION_GROUPS}
          isRealUser={!!isRealUser}
          email={user?.email}
          isAdmin={!!(session && isAdmin)}
          adminPendingTotal={adminPendingTotal}
          onSignOut={signOut}
        />
      </div>
    </header>
  );
};

export default Header;
