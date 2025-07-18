
import dayjs from 'dayjs';

interface ClusterEvent {
  id: string;
  name_event: string;
  date_debut: string;
  date_fin: string;
  ville: string;
  secteur: string;
  url_site_officiel?: string;
}

interface ClusterPopupContentProps {
  events: ClusterEvent[];
  count: number;
}

export const ClusterPopupContent = ({ events, count }: ClusterPopupContentProps) => {
  const sortedEvents = events.sort((a, b) =>
    dayjs(a.date_debut).isAfter(dayjs(b.date_debut)) ? 1 : -1
  );

  return (
    <div className="max-w-[320px] max-h-[300px] overflow-y-auto">
      <div className="font-medium text-sm mb-2 text-gray-900">{count} événement(s)</div>
      {sortedEvents.map((ev) => (
        <div key={ev.id} className="mb-2 pb-2 border-b border-gray-200 last:border-b-0">
          <div className="text-xs text-blue-600 mb-1">
            📅 {dayjs(ev.date_debut).format('DD/MM/YY')}
            {ev.date_debut !== ev.date_fin ? ` - ${dayjs(ev.date_fin).format('DD/MM/YY')}` : ''}
          </div>
          <div className="font-medium text-sm text-gray-900 mb-1">{ev.name_event}</div>
          <div className="text-xs text-gray-600 mb-1">{ev.ville}</div>
          <div className="text-xs text-blue-600 mb-1">{ev.secteur}</div>
          {ev.url_site_officiel && (
            <a 
              href={ev.url_site_officiel} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary text-xs underline"
            >
              Voir le salon →
            </a>
          )}
        </div>
      ))}
    </div>
  );
};
