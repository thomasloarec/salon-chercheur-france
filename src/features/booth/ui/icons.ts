import {
  Ban,
  CalendarCheck,
  Camera,
  FileText,
  Flame,
  Handshake,
  HelpCircle,
  Mail,
  Mic,
  MinusCircle,
  MoreHorizontal,
  PenLine,
  Phone,
  QrCode,
  Receipt,
  Search,
  Star,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Interaction } from '@/lib/booth/types';

/** Une seule icône par notion dans tout le mode salon. */
export const POTENTIAL_ICON: Record<NonNullable<Interaction['potential']>, LucideIcon> = {
  hot: Flame,
  good: Star,
  explore: Search,
  none: MinusCircle,
};

export const RELATIONSHIP_ICON: Record<Interaction['relationship'], LucideIcon> = {
  new_prospect: UserPlus,
  customer: Handshake,
  partner: Users,
  other: HelpCircle,
};

export const ACTION_ICON: Record<Interaction['next_action'], LucideIcon> = {
  call: Phone,
  send_doc: FileText,
  quote: Receipt,
  meeting: CalendarCheck,
  email: Mail,
  other: MoreHorizontal,
  none: Ban,
};

export const CAPTURE_ICON = {
  voice: Mic,
  qr: QrCode,
  card: Camera,
  manual: PenLine,
} as const satisfies Record<string, LucideIcon>;
