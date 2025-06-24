
import type { Event } from '@/types/event';
import dayjs from 'dayjs';

export const getGoogleCalUrl = (event: Event) => {
  const start = dayjs(event.start_date).utc().format("YYYYMMDDTHHmmss[Z]");
  const end = dayjs(event.end_date).utc().format("YYYYMMDDTHHmmss[Z]");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.name,
    dates: `${start}/${end}`,
    location: event.city ?? "",
    details: event.description ?? "",
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
};

export const getOutlookCalUrl = (event: Event) => {
  const start = dayjs(event.start_date).toISOString();
  const end = dayjs(event.end_date).toISOString();
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    startdt: start,
    enddt: end,
    subject: event.name,
    body: event.description ?? "",
    location: event.city ?? "",
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
};
