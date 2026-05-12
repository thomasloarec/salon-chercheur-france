// Generate a downloadable .ics calendar file for an event

export interface IcsEvent {
  uid: string;
  title: string;
  start: string; // YYYY-MM-DD
  end?: string | null; // YYYY-MM-DD (inclusive)
  location?: string | null;
  description?: string | null;
}

const fmt = (iso: string) => iso.replace(/-/g, '');
const escape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export function buildIcs(ev: IcsEvent): string {
  const dtStart = fmt(ev.start);
  const endDate = ev.end ? new Date(ev.end) : new Date(ev.start);
  endDate.setDate(endDate.getDate() + 1); // DTEND is exclusive for VALUE=DATE
  const dtEnd = fmt(endDate.toISOString().slice(0, 10));
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lotexpo//Radar CRM//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.uid}@lotexpo.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escape(ev.title)}`,
    ev.location ? `LOCATION:${escape(ev.location)}` : '',
    ev.description ? `DESCRIPTION:${escape(ev.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

export function downloadIcs(ev: IcsEvent) {
  const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ev.title.replace(/[^a-z0-9-]+/gi, '-').slice(0, 60)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}