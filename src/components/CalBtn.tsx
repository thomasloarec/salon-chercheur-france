
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import type { Event } from '@/types/event';

interface CalBtnProps {
  type: 'gcal' | 'outlook';
  event: Event;
}

const CalBtn = ({ type, event }: CalBtnProps) => {
  const handleAddToCalendar = () => {
    const startDate = new Date(event.start_date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = new Date(event.end_date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const title = encodeURIComponent(event.name);
    const description = encodeURIComponent(event.description || '');
    const location = encodeURIComponent(`${event.venue_name || ''} ${event.address || ''} ${event.city}`);

    if (type === 'gcal') {
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}&location=${location}`;
      window.open(googleUrl, '_blank');
    } else {
      const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${description}&location=${location}`;
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
