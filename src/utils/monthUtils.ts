
import { format, addMonths, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface MonthOption {
  label: string;   // « juillet 2025 »
  month: number;   // 1-12
  year: number;    // 4 digits
}

export function getRollingMonths(count = 12): MonthOption[] {
  const today = startOfMonth(new Date());     // 1er jour courant
  return Array.from({ length: count }).map((_, idx) => {
    const d = addMonths(today, idx);
    return {
      label: format(d, 'LLLL yyyy', { locale: fr }),
      month: d.getMonth() + 1,   // JS 0-based → 1-12
      year: d.getFullYear(),
    };
  });
}
