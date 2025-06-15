
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';
import type { Event } from '@/types/event';

interface CalBtnProps {
  type: 'gcal' | 'outlook';
  event: Event;
  crmProspects?: Array<{ name: string; stand?: string }>;
}

const CalBtn = ({ type, event, crmProspects = [] }: CalBtnProps) => {
  const handleAddToCalendar = () => {
    // Prepare dates for all-day events
    const start = new Date(event.start_date);
    const endExclusive = addDays(new Date(event.end_date), 1);
    
    // Build dynamic description
    let details = event.description || '';
    
    // Add CRM prospects if available
    if (crmProspects.length > 0) {
      const prospects = crmProspects
        .map(p => `- ${p.name}${p.stand ? ` – Stand ${p.stand}` : ''}`)
        .join('\n');
      details += `\n\n🎯 Vos prospects exposants :\n${prospects}`;
    }
    
    const encodedTitle = encodeURIComponent(event.name);
    const encodedLocation = encodeURIComponent(`${event.venue_name || ''} ${event.address || ''} ${event.city}`.trim());

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
      // Outlook Web compose event URL with compact description
      const isoStart = format(start, 'yyyy-MM-dd');
      const isoEnd = format(endExclusive, 'yyyy-MM-dd');
      
      // Build compact description for Outlook
      let outlookDescription = event.description || '';
      
      if (crmProspects.length > 0) {
        const compactProspectsList = crmProspects
          .map(p => `- ${p.name}${p.stand ? ` – Stand ${p.stand}` : ''}`)
          .join(' // ');
        
        outlookDescription += ` 🎯 Vos prospects exposants : ${compactProspectsList}`;
      }
      
      const outlookBody = encodeURIComponent(outlookDescription);
      
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
