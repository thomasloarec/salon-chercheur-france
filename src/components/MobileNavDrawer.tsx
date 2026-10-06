import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Search, CalendarHeart, Lightbulb, LogOut, Settings, LogIn, type LucideIcon } from 'lucide-react';
import { ASSISTANT_ONBOARDING_PATH } from '@/components/assistant/config';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { USER_MENU_ITEMS } from '@/config/userMenuItems';
import { useNotifications } from '@/hooks/useNotifications';
import { useProfile } from '@/hooks/useProfile';
import { LotexpoWordmark } from '@/components/LotexpoWordmark';
import { cn } from '@/lib/utils';
import { AGENDA_NAV_ITEM, type NavSolutionGroup } from '@/config/navSolutions';

/**
 * Menu mobile du site : tiroir plein écran, une seule logique de lignes.
 * Bonnes pratiques appliquées : 1 niveau de regroupement maximum, titres de
 * section discrets, chaque ligne = icône + libellé, zone tactile >= 48 px,
 * mêmes entrées que sur ordinateur, compte et déconnexion en bas.
 */

interface MobileNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NavSolutionGroup[];
  isRealUser: boolean;
  email: string | null | undefined;
  isAdmin: boolean;
  adminPendingTotal: number;
  onSignOut: () => void;
}

const rowClass = (isActive: boolean) =>
  cn(
    'flex min-h-[48px] items-center gap-3 rounded-lg px-3 text-[15px] transition-colors',
    isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted',
  );

const CountBadge: React.FC<{ n: number; label: string }> = ({ n, label }) =>
  n > 0 ? (
    <span
      className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground"
      aria-label={label}
    >
      {n > 99 ? '99+' : n}
    </span>
  ) : null;

const Row: React.FC<{
  to: string;
  icon: LucideIcon;
  label: string;
  onNavigate: () => void;
  end?: boolean;
  children?: React.ReactNode;
}> = ({ to, icon: Icon, label, onNavigate, end, children }) => (
  <li>
    <NavLink to={to} end={end} onClick={onNavigate} className={({ isActive }) => rowClass(isActive)}>
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
      {children}
    </NavLink>
  </li>
);

const Section: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="py-2">
    {title && (
      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
    )}
    <ul className="space-y-0.5">{children}</ul>
  </div>
);

/** Section compte : rendue uniquement pour un utilisateur connecté (charge profil + notifications). */
const AccountSection: React.FC<{ email: string; onNavigate: () => void }> = ({ email, onNavigate }) => {
  const { data: profile } = useProfile();
  const { unreadCount } = useNotifications();
  const initial = profile?.first_name?.charAt(0).toUpperCase() || email.charAt(0).toUpperCase() || 'U';
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  const items = USER_MENU_ITEMS;

  return (
    <div className="py-2">
      <div className="flex items-center gap-3 px-3 pb-2 pt-2">
        <Avatar className="h-9 w-9">
          <AvatarImage src={profile?.avatar_url || undefined} alt="" />
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {displayName && <p className="truncate text-sm font-medium text-foreground">{displayName}</p>}
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <Row key={item.to} to={item.to} icon={item.icon} label={item.label} onNavigate={onNavigate}>
            {item.showUnreadBadge && (
              <CountBadge n={unreadCount} label={`${unreadCount} notification(s) non lue(s)`} />
            )}
          </Row>
        ))}
      </ul>
    </div>
  );
};

const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  open, onOpenChange, groups, isRealUser, email, isAdmin, adminPendingTotal, onSignOut,
}) => {
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <div className="flex h-16 shrink-0 items-center border-b border-border/60 px-5">
          <Link to="/" onClick={close} aria-label="Accueil Lotexpo">
            <LotexpoWordmark aria-hidden="true" className="h-7 w-auto text-foreground [--logo-accent:hsl(var(--primary))]" />
          </Link>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navigation principale de Lotexpo</SheetDescription>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Navigation principale">
          {!isRealUser && (
            <div className="px-3 pt-4 pb-2">
              <Button asChild className="w-full min-h-[48px] rounded-xl">
                <Link to={ASSISTANT_ONBOARDING_PATH} onClick={close}>
                  Créer mon agenda <CalendarHeart className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}

          <Section>
            <Row to="/salons" icon={Search} label="Salons" onNavigate={close} />
            <Row to="/nouveautes" icon={Lightbulb} label="Avant-première" onNavigate={close} />
            <Row to={AGENDA_NAV_ITEM.to} icon={AGENDA_NAV_ITEM.icon} label={AGENDA_NAV_ITEM.label} onNavigate={close} end />
          </Section>

          {groups.map((g) => (
            <React.Fragment key={g.title}>
              <div className="mx-3 border-t border-border/60" />
              <Section title={g.title}>
                {g.items.map((f) => (
                  <Row key={f.to} to={f.to} icon={f.icon} label={f.label} onNavigate={close} />
                ))}
              </Section>
            </React.Fragment>
          ))}

          {isRealUser && email && (
            <>
              <div className="mx-3 border-t border-border/60" />
              <AccountSection email={email} onNavigate={close} />
            </>
          )}

          {isRealUser && isAdmin && (
            <>
              <div className="mx-3 border-t border-border/60" />
              <Section title="Administration">
                <Row to="/admin" icon={Settings} label="Admin" onNavigate={close}>
                  <CountBadge n={adminPendingTotal} label={`${adminPendingTotal} élément(s) en attente`} />
                </Row>
              </Section>
            </>
          )}
        </nav>

        <div className="shrink-0 border-t border-border/60 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {isRealUser ? (
            <button
              type="button"
              onClick={() => { close(); onSignOut(); }}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-[15px] text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
              Se déconnecter
            </button>
          ) : (
            <Link
              to="/auth?tab=signin"
              onClick={close}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <LogIn className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              Se connecter
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNavDrawer;
