
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
  console.log('🔍 Parsing slug:', slug);
  
  const parts = slug.split('-');
  console.log('🔍 Slug parts:', parts);
  
  if (parts.length < 3) {
    console.log('❌ Not enough parts in slug');
    return null;
  }
  
  // Find the year (should be a 4-digit number)
  let yearIndex = -1;
  let year = 0;
  
  for (let i = parts.length - 2; i >= 0; i--) {
    const potentialYear = parseInt(parts[i]);
    if (potentialYear >= 2020 && potentialYear <= 2030 && parts[i].length === 4) {
      yearIndex = i;
      year = potentialYear;
      break;
    }
  }
  
  if (yearIndex === -1) {
    console.log('❌ No valid year found in slug');
    return null;
  }
  
  // Everything before the year is the name
  const name = parts.slice(0, yearIndex).join('-');
  // Everything after the year is the city
  const city = parts.slice(yearIndex + 1).join('');
  
  console.log('✅ Parsed result:', { name, year, city });
  
  return { name, year, city };
};
