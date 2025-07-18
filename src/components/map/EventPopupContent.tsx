
import dayjs from 'dayjs';

interface EventPopupContentProps {
  event: {
    id: string;
    name_event: string;
    date_debut: string;
    date_fin: string;
    ville: string;
    secteur: string;
    url_site_officiel?: string;
    url_image?: string;
  };
}

export const EventPopupContent = ({ event }: EventPopupContentProps) => {
  const formatDate = (dateStr: string) => {
    return dayjs(dateStr).format('DD/MM/YY');
  };

  return (
    <div className="w-[280px]">
      <img 
        src={event.url_image || '/placeholder.svg'} 
        alt={event.name_event}
        className="h-16 w-full object-cover rounded mb-2"
      />
      <div className="text-xs text-blue-600 mb-1">
        📅 {formatDate(event.date_debut)}
        {event.date_debut !== event.date_fin ? ` - ${formatDate(event.date_fin)}` : ''}
      </div>
      <div className="font-medium text-sm text-gray-900 mb-1">{event.name_event}</div>
      <div className="text-xs text-gray-600 mb-1">{event.ville}</div>
      <div className="text-xs text-blue-600 mb-1">{event.secteur}</div>
      {event.url_site_officiel && (
        <a 
          href={event.url_site_officiel} 
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
