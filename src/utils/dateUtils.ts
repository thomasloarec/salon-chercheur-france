
import { startOfMonth, addMonths, formatISO } from 'date-fns';

export function getMonthRange(year: number, monthIndexZeroBased: number) {
  const from = startOfMonth(new Date(year, monthIndexZeroBased));
  const to = addMonths(from, 1); // premier jour du mois suivant
  
  return {
    fromISO: formatISO(from, { representation: 'date' }), // 'YYYY-MM-DD'
    toISO: formatISO(to, { representation: 'date' }),
  };
}

// Utility function for date formatting
export function formatDateRange(dateDebut: string, dateFin: string) {
  const opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  const sd = new Date(dateDebut).toLocaleDateString('fr-FR', opt);
  const ed = new Date(dateFin).toLocaleDateString('fr-FR', opt);
  return dateDebut === dateFin ? sd : `${sd} – ${ed}`;
}
