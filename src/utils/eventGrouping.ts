
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event } from '@/types/event';

export interface GroupedEvents {
  monthLabel: string;
  events: Event[];
}

export const groupEventsByMonth = (events: Event[]): GroupedEvents[] => {
  const grouped = events.reduce((acc, event) => {
    const eventDate = new Date(event.date_debut);
    const monthKey = format(eventDate, 'yyyy-MM');
    const monthLabel = format(eventDate, 'MMMM yyyy', { locale: fr });
    
    if (!acc[monthKey]) {
      acc[monthKey] = {
        monthLabel,
        events: []
      };
    }
    
    acc[monthKey].events.push(event);
    return acc;
  }, {} as Record<string, GroupedEvents>);
  
  // Convert to array and sort by month
  return Object.values(grouped).sort((a, b) => {
    const dateA = new Date(a.events[0].date_debut);
    const dateB = new Date(b.events[0].date_debut);
    return dateA.getTime() - dateB.getTime();
  });
};
