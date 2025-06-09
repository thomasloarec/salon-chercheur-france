import type { ScrapedEvent } from '@/types/scraping';

export abstract class BaseScraper {
  public venue: string;
  protected baseUrl: string;

  constructor(venue: string, baseUrl: string) {
    this.venue = venue;
    this.baseUrl = baseUrl;
  }

  abstract scrapeEvents(): Promise<ScrapedEvent[]>;

  protected async fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (response.ok) return response;
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
    throw new Error(`Failed to fetch ${url} after ${retries} retries`);
  }

  protected parseDate(dateStr: string): Date | null {
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

  protected extractTextContent(element: Element | null, fallback = ''): string {
    return element?.textContent?.trim() || fallback;
  }

  protected makeAbsoluteUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return new URL(url, this.baseUrl).toString();
  }
}
