
export class DateParser {
  parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Clean the date string
    const cleanDateStr = dateStr.trim().replace(/\s+/g, ' ');
    
    // French date patterns
    const patterns = [
      // DD/MM/YYYY or DD-MM-YYYY
      /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
      // DD mois YYYY (15 mars 2025)
      /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i,
      // mois DD, YYYY (mars 15, 2025)
      /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{1,2}),?\s+(\d{4})/i
    ];

    const monthMap: { [key: string]: number } = {
      'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
      'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
    };

    for (const pattern of patterns) {
      const match = cleanDateStr.match(pattern);
      if (match) {
        try {
          if (pattern === patterns[0]) {
            // DD/MM/YYYY format
            const [, day, month, year] = match;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else if (pattern === patterns[1]) {
            // DD mois YYYY format
            const [, day, monthName, year] = match;
            const monthIndex = monthMap[monthName.toLowerCase()];
            if (monthIndex !== undefined) {
              return new Date(parseInt(year), monthIndex, parseInt(day));
            }
          } else if (pattern === patterns[2]) {
            // mois DD, YYYY format
            const [, monthName, day, year] = match;
            const monthIndex = monthMap[monthName.toLowerCase()];
            if (monthIndex !== undefined) {
              return new Date(parseInt(year), monthIndex, parseInt(day));
            }
          }
        } catch {
          continue;
        }
      }
    }

    // Fallback to Date.parse
    try {
      const parsed = new Date(cleanDateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }

  parseFrDate(dateStr: string): Date | null {
    return this.parseDate(dateStr);
  }

  parseDateRangeFr(dateStr: string): [Date | null, Date | null] {
    if (!dateStr) return [null, null];

    const cleanDateStr = dateStr.trim();
    
    // Pattern for French date ranges like "14 – 16 oct. 2025" or "14 au 16 octobre 2025"
    const rangePattern = /(\d{1,2})\s*[–\-au]+\s*(\d{1,2})\s+(jan\.|fév\.|mar\.|avr\.|mai|juin|juil\.|août|sep\.|oct\.|nov\.|déc\.|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i;
    
    const match = cleanDateStr.match(rangePattern);
    if (match) {
      const [, startDay, endDay, monthStr, year] = match;
      
      const monthMap: { [key: string]: number } = {
        'jan.': 0, 'janvier': 0,
        'fév.': 1, 'février': 1,
        'mar.': 2, 'mars': 2,
        'avr.': 3, 'avril': 3,
        'mai': 4,
        'juin': 5,
        'juil.': 6, 'juillet': 6,
        'août': 7,
        'sep.': 8, 'septembre': 8,
        'oct.': 9, 'octobre': 9,
        'nov.': 10, 'novembre': 10,
        'déc.': 11, 'décembre': 11
      };

      const monthIndex = monthMap[monthStr.toLowerCase()];
      if (monthIndex !== undefined) {
        const startDate = new Date(parseInt(year), monthIndex, parseInt(startDay));
        const endDate = new Date(parseInt(year), monthIndex, parseInt(endDay));
        return [startDate, endDate];
      }
    }

    // Single date pattern
    const singleDate = this.parseDate(cleanDateStr);
    return [singleDate, singleDate];
  }
}
