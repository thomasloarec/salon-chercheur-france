
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event } from '@/types/event';

export interface GroupedEvents {
  monthLabel: string;
  events: Event[];
}

export function groupEventsByMonth(events: Event[]): GroupedEvents[] {
  return events.reduce((acc: GroupedEvents[], evt: Event) => {
    const label = format(new Date(evt.start_date), 'LLLL yyyy', { locale: fr });
    const bucket = acc.find(b => b.monthLabel === label);
    
    if (bucket) {
      bucket.events.push(evt);
    } else {
      acc.push({ monthLabel: label, events: [evt] });
    }
    
    return acc;
  }, []);
}
