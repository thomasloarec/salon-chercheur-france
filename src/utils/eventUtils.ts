
import type { Event } from '@/types/event';

export const generateEventSlug = (event: Event): string => {
  if (event.slug) return event.slug;
  
  const eventName = event.nom_event || '';
  const city = event.ville || '';
  const year = new Date(event.date_debut).getFullYear();
  
  const cleanName = eventName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  const cleanCity = city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  
  return `${cleanName}-${year}-${cleanCity}`;
};

export const formatEventTitle = (event: Event): string => {
  return event.nom_event || 'Événement sans nom';
};

export const formatEventDescription = (event: Event): string => {
  if (!event.description_event) return '';
  
  // Strip HTML tags for meta descriptions
  return event.description_event
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
};

export const isEventUpcoming = (event: Event): boolean => {
  const today = new Date();
  const eventDate = new Date(event.date_debut);
  return eventDate >= today;
};

export const isEventActive = (event: Event): boolean => {
  const today = new Date();
  const startDate = new Date(event.date_debut);
  const endDate = new Date(event.date_fin);
  return today >= startDate && today <= endDate;
};

export const getEventStatus = (event: Event): 'upcoming' | 'active' | 'past' => {
  const today = new Date();
  const startDate = new Date(event.date_debut);
  const endDate = new Date(event.date_fin);
  
  if (today < startDate) return 'upcoming';
  if (today >= startDate && today <= endDate) return 'active';
  return 'past';
};
