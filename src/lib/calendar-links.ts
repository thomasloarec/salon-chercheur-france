
import { format, addDays } from 'date-fns';
import type { Event } from '@/types/event';

export const getGoogleCalUrl = (event: Event): string => {
  const start = new Date(event.date_debut);
  const endExclusive = addDays(new Date(event.date_fin), 1);
  
  const gStart = format(start, 'yyyyMMdd');
  const gEnd = format(endExclusive, 'yyyyMMdd');
  
  const encodedTitle = encodeURIComponent(event.name_event);
  const encodedLocation = encodeURIComponent(`${event.nom_lieu || ''} ${event.rue || ''} ${event.ville}`.trim());
  const encodedDetails = encodeURIComponent(event.description_event || '');
  
  return `https://calendar.google.com/calendar/render` +
    `?action=TEMPLATE` +
    `&text=${encodedTitle}` +
    `&dates=${gStart}/${gEnd}` +
    `&details=${encodedDetails}` +
    `&location=${encodedLocation}`;
};

export const getOutlookCalUrl = (event: Event): string => {
  const start = new Date(event.date_debut);
  const endExclusive = addDays(new Date(event.date_fin), 1);
  
  const isoStart = format(start, 'yyyy-MM-dd');
  const isoEnd = format(endExclusive, 'yyyy-MM-dd');
  
  const encodedTitle = encodeURIComponent(event.name_event);
  const encodedLocation = encodeURIComponent(`${event.nom_lieu || ''} ${event.rue || ''} ${event.ville}`.trim());
  const encodedBody = encodeURIComponent(event.description_event || '');
  
  return `https://outlook.office.com/calendar/0/deeplink/compose` +
    `?path=/calendar/action/compose` +
    `&rru=addevent` +
    `&subject=${encodedTitle}` +
    `&body=${encodedBody}` +
    `&location=${encodedLocation}` +
    `&allday=true` +
    `&startdt=${isoStart}` +
    `&enddt=${isoEnd}`;
};
