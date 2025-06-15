
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
    const gStart = format(start, 'yyyyMMdd');
    const gEnd = format(endExclusive, 'yyyyMMdd');
    
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
    const encodedDetails = encodeURIComponent(details);
    const encodedLocation = encodeURIComponent(`${event.venue_name || ''} ${event.address || ''} ${event.city}`.trim());

    if (type === 'gcal') {
      // Google Calendar URL for all-day events
      const googleUrl = 
        `https://calendar.google.com/calendar/render` +
        `?action=TEMPLATE` +
        `&text=${encodedTitle}` +
        `&dates=${gStart}/${gEnd}` +
        `&details=${encodedDetails}` +
        `&location=${encodedLocation}`;
      
      window.open(googleUrl, '_blank');
    } else {
      // Generate ICS file for Outlook/Apple Calendar
      generateICSFile({
        title: event.name,
        startDate: gStart,
        endDate: gEnd,
        description: details,
        location: `${event.venue_name || ''} ${event.address || ''} ${event.city}`.trim(),
        uid: event.id,
      });
    }
  };

  const generateICSFile = ({ title, startDate, endDate, description, location, uid }: {
    title: string;
    startDate: string;
    endDate: string;
    description: string;
    location: string;
    uid: string;
  }) => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SalonsPro//EN',
      'BEGIN:VEVENT',
      `UID:${uid}@salonspro.com`,
      `SUMMARY:${title}`,
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
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
