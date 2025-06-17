
import { startOfMonth, addMonths, formatISO } from 'date-fns';

export function getMonthRange(year: number, monthIndexZeroBased: number) {
  const from = startOfMonth(new Date(year, monthIndexZeroBased));
  const to = addMonths(from, 1); // premier jour du mois suivant
  
  return {
    fromISO: formatISO(from, { representation: 'date' }), // 'YYYY-MM-DD'
    toISO: formatISO(to, { representation: 'date' }),
  };
}
