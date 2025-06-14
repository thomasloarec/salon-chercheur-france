
import type { Event } from '@/types/event';

export const generateEventSlug = (event: Event): string => {
  const name = event.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove duplicate hyphens
    .trim();
  
  const year = new Date(event.start_date).getFullYear();
  const city = event.city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  
  return `${name}-${year}-${city}`;
};

export const parseEventSlug = (slug: string) => {
  const parts = slug.split('-');
  if (parts.length < 3) return null;
  
  // Assume last two parts are year and city
  const year = parts[parts.length - 2];
  const city = parts[parts.length - 1];
  const name = parts.slice(0, -2).join('-');
  
  return { name, year: parseInt(year), city };
};
