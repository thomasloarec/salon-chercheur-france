
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';
import type { Event } from '@/types/event';

interface CalBtnProps {
  type: 'gcal' | 'outlook';
  event: Event;
}

const CalBtn = ({ type, event }: CalBtnProps) => {
  const handleAddToCalendar = () => {
    // Prepare dates for all-day events
    const start = new Date(event.date_debut);
    const endExclusive = addDays(new Date(event.date_fin), 1);
    
    const details = event.description_event || '';
    
    const encodedTitle = encodeURIComponent(event.nom_event);
    const encodedLocation = encodeURIComponent(`${event.nom_lieu || ''} ${event.rue || ''} ${event.ville}`.trim());

    if (type === 'gcal') {
      // Google Calendar URL for all-day events
      const gStart = format(start, 'yyyyMMdd');
      const gEnd = format(endExclusive, 'yyyyMMdd');
      
      const encodedDetails = encodeURIComponent(details);
      
      const googleUrl = 
        `https://calendar.google.com/calendar/render` +
        `?action=TEMPLATE` +
        `&text=${encodedTitle}` +
        `&dates=${gStart}/${gEnd}` +
        `&details=${encodedDetails}` +
        `&location=${encodedLocation}`;
      
      window.open(googleUrl, '_blank');
    } else {
      // Outlook Web compose event URL
      const isoStart = format(start, 'yyyy-MM-dd');
      const isoEnd = format(endExclusive, 'yyyy-MM-dd');
      
      const outlookBody = encodeURIComponent(details);
      
      // Using outlook.office.com for Office 365 accounts
      // For personal accounts, could use outlook.live.com but office.com works for both
      const outlookUrl = 
        `https://outlook.office.com/calendar/0/deeplink/compose` +
        `?path=/calendar/action/compose` +
        `&rru=addevent` +
        `&subject=${encodedTitle}` +
        `&body=${outlookBody}` +
        `&location=${encodedLocation}` +
        `&allday=true` +
        `&startdt=${isoStart}` +
        `&enddt=${isoEnd}`;
      
      window.open(outlookUrl, '_blank');
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleAddToCalendar}
      className="flex-1"
    >
      <Calendar className="h-4 w-4 mr-1" />
      {type === 'gcal' ? 'Google' : 'Outlook'}
    </Button>
  );
};

export default CalBtn;
