
import dayjs from 'dayjs';

export const renderClusterPopup = (events: any[], count: number): string => {
  const eventsHtml = events
    .map((event) => `
      <div style="margin: 4px 0; padding: 4px 0; border-bottom: 1px solid #eee;">
        <div style="font-size: 11px; color: #0366d6; margin-bottom: 2px;">
          📅 ${dayjs(event.start_date).format('DD/MM/YY')}
          ${event.start_date !== event.end_date ? ` - ${dayjs(event.end_date).format('DD/MM/YY')}` : ''}
        </div>
        <div style="font-weight: 500; font-size: 12px; color: #333; margin-bottom: 2px;">
          ${event.name || 'Événement sans nom'}
        </div>
        <div style="font-size: 11px; color: #666; margin-bottom: 2px;">
          ${event.city || ''}
        </div>
        <div style="font-size: 11px; color: #0366d6;">
          ${event.sector || ''}
        </div>
        ${event.event_url ? `
          <a href="${event.event_url}" target="_blank" rel="noopener noreferrer" 
             style="font-size: 11px; color: #0366d6; text-decoration: underline;">
            Voir le salon →
          </a>
        ` : ''}
      </div>
    `)
    .join('');

  return `
    <div style="max-width: 320px; max-height: 300px; overflow-y: auto;">
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #333;">
        ${count} événement(s)
      </div>
      ${eventsHtml}
    </div>
  `;
};

export const renderEventPopup = (event: any): string => {
  return `
    <div style="width: 280px;">
      <img 
        src="${event.image_url || '/placeholder.svg'}" 
        alt="${event.name || 'Événement'}"
        style="height: 64px; width: 100%; object-fit: cover; border-radius: 4px; margin-bottom: 8px;"
      />
      <div style="font-size: 11px; color: #0366d6; margin-bottom: 4px;">
        📅 ${dayjs(event.start_date).format('DD/MM/YY')}
        ${event.start_date !== event.end_date ? ` - ${dayjs(event.end_date).format('DD/MM/YY')}` : ''}
      </div>
      <div style="font-weight: 500; font-size: 13px; color: #333; margin-bottom: 4px;">
        ${event.name || 'Événement sans nom'}
      </div>
      <div style="font-size: 11px; color: #666; margin-bottom: 4px;">
        ${event.city || ''}
      </div>
      <div style="font-size: 11px; color: #0366d6; margin-bottom: 4px;">
        ${event.sector || ''}
      </div>
      ${event.event_url ? `
        <a 
          href="${event.event_url}" 
          target="_blank" 
          rel="noopener noreferrer" 
          style="color: #0366d6; font-size: 11px; text-decoration: underline;"
        >
          Voir le salon →
        </a>
      ` : ''}
    </div>
  `;
};
