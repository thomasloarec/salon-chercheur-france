
import { Popup } from 'maplibre-gl';
import type { Map as MaplibreMap } from 'maplibre-gl';
import dayjs from 'dayjs';
import { generateEventSlug } from './eventUtils';

export const renderClusterPopup = (map: MaplibreMap, coordinates: [number, number], events: any[]) => {
  const eventsHtml = events
    .map((event) => {
      const slug = generateEventSlug(event);
      return `
        <div style="margin: 4px 0; padding: 4px 0; border-bottom: 1px solid #eee;">
          <div style="font-size: 11px; color: #0366d6; margin-bottom: 2px;">
            📅 ${dayjs(event.date_debut).format('DD/MM/YY')}
            ${event.date_debut !== event.date_fin ? ` - ${dayjs(event.date_fin).format('DD/MM/YY')}` : ''}
          </div>
          <div style="font-weight: 500; font-size: 12px; color: #333; margin-bottom: 2px;">
            <a href="/events/${slug}" style="color: #333; text-decoration: none;">
              ${event.name || 'Événement sans nom'}
            </a>
          </div>
          <div style="font-size: 11px; color: #666; margin-bottom: 2px;">
            ${event.city || ''}
          </div>
          <div style="font-size: 11px; color: #0366d6;">
            ${event.sector || ''}
          </div>
        </div>
      `;
    })
    .join('');

  const popupHtml = `
    <div style="max-width: 320px; max-height: 300px; overflow-y: auto;">
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #333;">
        ${events.length} événement(s)
      </div>
      ${eventsHtml}
    </div>
  `;

  new Popup()
    .setLngLat(coordinates)
    .setHTML(popupHtml)
    .addTo(map);
};

export const renderEventPopup = (map: MaplibreMap, coordinates: [number, number], event: any) => {
  const slug = generateEventSlug(event);
  
  const popupHtml = `
    <div style="width: 280px;">
      <img 
        src="${event.image_url || '/placeholder.svg'}" 
        alt="${event.name || 'Événement'}"
        style="height: 64px; width: 100%; object-fit: cover; border-radius: 4px; margin-bottom: 8px;"
      />
      <div style="font-size: 11px; color: #0366d6; margin-bottom: 4px;">
        📅 ${dayjs(event.date_debut).format('DD/MM/YY')}
        ${event.date_debut !== event.date_fin ? ` - ${dayjs(event.date_fin).format('DD/MM/YY')}` : ''}
      </div>
      <div style="font-weight: 500; font-size: 13px; color: #333; margin-bottom: 4px;">
        <a href="/events/${slug}" style="color: #333; text-decoration: none;">
          ${event.name || 'Événement sans nom'}
        </a>
      </div>
      <div style="font-size: 11px; color: #666; margin-bottom: 4px;">
        ${event.city || ''}
      </div>
      <div style="font-size: 11px; color: #0366d6; margin-bottom: 4px;">
        ${event.sector || ''}
      </div>
      <a 
        href="/events/${slug}" 
        style="color: #0366d6; font-size: 11px; text-decoration: underline;"
      >
        Voir les détails →
      </a>
    </div>
  `;

  new Popup()
    .setLngLat(coordinates)
    .setHTML(popupHtml)
    .addTo(map);
};
