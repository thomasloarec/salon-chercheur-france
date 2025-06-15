
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import type { Event } from '@/types/event';

interface CalBtnProps {
  type: 'gcal' | 'outlook';
  event: Event;
  crmProspects?: Array<{ name: string; stand?: string }>;
}

const CalBtn = ({ type, event, crmProspects = [] }: CalBtnProps) => {
  const handleAddToCalendar = () => {
    // Convert dates to proper format for all-day events
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    
    // Add one day to end date to include the last day for all-day events
    endDate.setDate(endDate.getDate() + 1);
    
    // Format dates for all-day events (YYYYMMDD format)
    const formatDateForCalendar = (date: Date) => {
      return date.toISOString().split('T')[0].replace(/-/g, '');
    };
    
    const startDateFormatted = formatDateForCalendar(startDate);
    const endDateFormatted = formatDateForCalendar(endDate);
    
    const title = encodeURIComponent(event.name);
    const location = encodeURIComponent(`${event.venue_name || ''} ${event.address || ''} ${event.city}`);
    
    // Build dynamic description
    let description = event.description || '';
    
    // Add CRM prospects if available
    if (crmProspects.length > 0) {
      description += '\n\n🎯 Vos prospects exposants sur cet événement :\n\n';
      crmProspects.forEach(prospect => {
        description += `- ${prospect.name}${prospect.stand ? ` – Stand ${prospect.stand}` : ''}\n`;
      });
    }
    
    const encodedDescription = encodeURIComponent(description);

    if (type === 'gcal') {
      // Google Calendar URL for all-day events
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateFormatted}/${endDateFormatted}&details=${encodedDescription}&location=${location}`;
      window.open(googleUrl, '_blank');
    } else {
      // Generate ICS file for Outlook
      generateICSFile({
        title: event.name,
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        description,
        location: `${event.venue_name || ''} ${event.address || ''} ${event.city}`,
      });
    }
  };

  const generateICSFile = ({ title, startDate, endDate, description, location }: {
    title: string;
    startDate: string;
    endDate: string;
    description: string;
    location: string;
  }) => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Event Calendar//Event//FR',
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
      `LOCATION:${location}`,
      `UID:${Date.now()}@eventcalendar.com`,
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
