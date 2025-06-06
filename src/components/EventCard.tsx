
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MapPin, Users, Building, ExternalLink, Calendar } from 'lucide-react';
import type { Event } from '@/types/event';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EventCardProps {
  event: Event;
}

const EventCard = ({ event }: EventCardProps) => {
  const handleAddToCalendar = (type: 'google' | 'outlook') => {
    const startDate = new Date(event.start_date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = new Date(event.end_date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const title = encodeURIComponent(event.name);
    const description = encodeURIComponent(event.description || '');
    const location = encodeURIComponent(`${event.venue_name || ''} ${event.address || ''} ${event.city}`);

    if (type === 'google') {
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}&location=${location}`;
      window.open(googleUrl, '_blank');
    } else {
      const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${description}&location=${location}`;
      window.open(outlookUrl, '_blank');
    }
  };

  return (
    <Card className="h-full hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
      <CardContent className="p-6">
        {event.image_url && (
          <div className="w-full h-48 mb-4 rounded-lg overflow-hidden">
            <img 
              src={event.image_url} 
              alt={event.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-primary mb-2 line-clamp-2">
              {event.name}
            </h3>
            <Badge variant="secondary" className="mb-2">
              {event.sector}
            </Badge>
            {event.description && (
              <p className="text-gray-600 text-sm line-clamp-3">
                {event.description}
              </p>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center text-gray-600">
              <CalendarDays className="h-4 w-4 mr-2 text-accent" />
              <span>
                {format(new Date(event.start_date), 'dd MMM yyyy', { locale: fr })}
                {event.start_date !== event.end_date && (
                  <> - {format(new Date(event.end_date), 'dd MMM yyyy', { locale: fr })}</>
                )}
              </span>
            </div>

            <div className="flex items-center text-gray-600">
              <MapPin className="h-4 w-4 mr-2 text-accent" />
              <span>{event.city}{event.region && `, ${event.region}`}</span>
            </div>

            {event.venue_name && (
              <div className="flex items-center text-gray-600">
                <Building className="h-4 w-4 mr-2 text-accent" />
                <span>{event.venue_name}</span>
              </div>
            )}

            {event.estimated_visitors && (
              <div className="flex items-center text-gray-600">
                <Users className="h-4 w-4 mr-2 text-accent" />
                <span>{event.estimated_visitors.toLocaleString()} visiteurs estimés</span>
              </div>
            )}
          </div>

          {event.tags && event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {event.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {event.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{event.tags.length - 3} autres
                </Badge>
              )}
            </div>
          )}

          <div className="pt-4 space-y-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddToCalendar('google')}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Google
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddToCalendar('outlook')}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Outlook
              </Button>
            </div>
            
            {event.event_url && (
              <Button 
                variant="default" 
                size="sm" 
                className="w-full bg-accent hover:bg-accent/90"
                onClick={() => window.open(event.event_url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Voir le salon
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EventCard;
