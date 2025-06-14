
import dayjs from 'dayjs';

interface EventPopupContentProps {
  event: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    city: string;
    sector: string;
    event_url?: string;
    image_url?: string;
  };
}

export const EventPopupContent = ({ event }: EventPopupContentProps) => {
  const formatDate = (dateStr: string) => {
    return dayjs(dateStr).format('DD/MM/YY');
  };

  return (
    <div className="w-[280px]">
      <img 
        src={event.image_url || '/placeholder.svg'} 
        alt={event.name}
        className="h-16 w-full object-cover rounded mb-2"
      />
      <div className="text-xs text-blue-600 mb-1">
        📅 {formatDate(event.start_date)}
        {event.start_date !== event.end_date ? ` - ${formatDate(event.end_date)}` : ''}
      </div>
      <div className="font-medium text-sm text-gray-900 mb-1">{event.name}</div>
      <div className="text-xs text-gray-600 mb-1">{event.city}</div>
      <div className="text-xs text-blue-600 mb-1">{event.sector}</div>
      {event.event_url && (
        <a 
          href={event.event_url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-primary text-xs underline"
        >
          Voir le salon →
        </a>
      )}
    </div>
  );
};
