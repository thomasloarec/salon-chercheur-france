import { User, Bell, CalendarRange, Radar, type LucideIcon } from 'lucide-react';

export interface UserMenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shows the unread notifications badge next to this item. */
  showUnreadBadge?: boolean;
}

/**
 * Single shared source of truth for the authenticated user menu items.
 * Used by both the desktop dropdown (UserMenu) and the mobile menu (Header)
 * so the two stay in sync.
 */
export const USER_MENU_ITEMS: UserMenuItem[] = [
  { to: '/profile', label: 'Mon profil', icon: User },
  { to: '/notifications', label: 'Notifications', icon: Bell, showUnreadBadge: true },
  { to: '/agenda', label: 'Mon agenda', icon: CalendarRange },
  { to: '/radar-crm/results', label: 'Radar CRM', icon: Radar },
];