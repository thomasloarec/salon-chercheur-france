
import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateRange } from '@/utils/dateUtils';
import type { Event } from '@/types/event';

interface FavoriteRowProps {
  event: Event;
}

const FavoriteRow = ({ event }: FavoriteRowProps) => {
  return (
    <Link
      to={`/events/${event.slug || event.id}`}
      className="flex items-center gap-3 py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      {/* Thumbnail */}
      {event.image_url ? (
        <img
          src={event.image_url}
          alt={`Affiche de ${event.name}`}
          className="h-14 w-14 rounded-md object-cover flex-shrink-0"
        />
      ) : (
        <div className="h-14 w-14 rounded-md bg-gray-200 flex items-center justify-center flex-shrink-0">
          <Calendar className="h-6 w-6 text-gray-400" />
        </div>
      )}

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-gray-900 group-hover:text-primary transition-colors">
          {event.name}
        </p>
        <div className="text-sm text-muted-foreground flex flex-wrap gap-3 mt-1">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDateRange(event.start_date, event.end_date)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {event.city}
          </span>
          {event.sector && (
            <Badge variant="outline" className="text-xs">
              {event.sector}
            </Badge>
          )}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
    </Link>
  );
};

export default FavoriteRow;
