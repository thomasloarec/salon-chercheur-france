
import dayjs from 'dayjs';

interface ClusterEvent {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  city: string;
  sector: string;
  event_url?: string;
}

interface ClusterPopupContentProps {
  events: ClusterEvent[];
  count: number;
}

export const ClusterPopupContent = ({ events, count }: ClusterPopupContentProps) => {
  const sortedEvents = events.sort((a, b) =>
    dayjs(a.start_date).isAfter(dayjs(b.start_date)) ? 1 : -1
  );

  return (
    <div className="max-w-[320px] max-h-[300px] overflow-y-auto">
      <div className="font-medium text-sm mb-2 text-gray-900">{count} événement(s)</div>
      {sortedEvents.map((ev) => (
        <div key={ev.id} className="mb-2 pb-2 border-b border-gray-200 last:border-b-0">
          <div className="text-xs text-blue-600 mb-1">
            📅 {dayjs(ev.start_date).format('DD/MM/YY')}
            {ev.start_date !== ev.end_date ? ` - ${dayjs(ev.end_date).format('DD/MM/YY')}` : ''}
          </div>
          <div className="font-medium text-sm text-gray-900 mb-1">{ev.name}</div>
          <div className="text-xs text-gray-600 mb-1">{ev.city}</div>
          <div className="text-xs text-blue-600 mb-1">{ev.sector}</div>
          {ev.event_url && (
            <a 
              href={ev.event_url} 
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
