import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Event } from '@/types/event';

interface EventBreadcrumbProps {
  event: Pick<Event, 'nom_event' | 'slug'>;
}

/**
 * Visible breadcrumb for event pages.
 * Uses the same muted typography as the rest of the site.
 */
export const EventBreadcrumb = ({ event }: EventBreadcrumbProps) => {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
      <Link to="/" className="hover:text-foreground transition-colors whitespace-nowrap">
        Accueil
      </Link>
      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
      <Link to="/events" className="hover:text-foreground transition-colors whitespace-nowrap">
        Salons professionnels
      </Link>
      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-none">
        {event.nom_event}
      </span>
    </nav>
  );
};
