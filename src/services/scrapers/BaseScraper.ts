
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
            'User-Agent': this.randomUA()
          }
        });
        
        if (response.ok) return response;
        
        // Handle rate limiting
        if (response.status === 429) {
          await this.sleepRandom(2000, 4000);
          continue;
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
    throw new Error(`Failed to fetch ${url} after ${retries} retries`);
  }

  protected async request(url: string): Promise<string> {
    const response = await this.fetchWithRetry(url);
    return response.text();
  }

  protected randomUA(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  protected async sleepRandom(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
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

  protected parseFrDate(dateStr: string): Date | null {
    return this.parseDate(dateStr);
  }

  protected parseDateRangeFr(dateStr: string): [Date | null, Date | null] {
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

  protected detectSector(text: string): string {
    const textLower = text.toLowerCase();
    
    if (textLower.includes('tech') || textLower.includes('digital') || textLower.includes('numérique')) return 'Technologie';
    if (textLower.includes('industrie') || textLower.includes('manufacturing')) return 'Industrie';
    if (textLower.includes('médical') || textLower.includes('santé') || textLower.includes('pharma')) return 'Santé';
    if (textLower.includes('btp') || textLower.includes('construction') || textLower.includes('bâtiment')) return 'BTP';
    if (textLower.includes('agro') || textLower.includes('alimentaire') || textLower.includes('agriculture')) return 'Agroalimentaire';
    if (textLower.includes('énergie') || textLower.includes('environnement')) return 'Énergie';
    if (textLower.includes('transport') || textLower.includes('automobile') || textLower.includes('logistique')) return 'Transport';
    if (textLower.includes('finance') || textLower.includes('banque') || textLower.includes('assurance')) return 'Finance';
    
    return 'Autre';
  }

  protected ruleBasedType(text: string): string {
    const textLower = text.toLowerCase();

    if (textLower.includes('salon')) return 'salon';
    if (textLower.includes('foire')) return 'salon';
    if (textLower.includes('convention')) return 'convention';
    if (textLower.includes('congres')) return 'congres';
    if (textLower.includes('conference')) return 'conference';
    if (textLower.includes('ceremonie')) return 'ceremonie';

    return 'inconnu';
  }

  protected extractTags(text: string): string[] {
    const textLower = text.toLowerCase();
    const tags: string[] = [];
    
    const keywords = ['innovation', 'technologie', 'digital', 'industrie', 'b2b', 'professionnel', 'salon', 'exposition'];
    
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        tags.push(keyword);
      }
    }
    
    return tags.slice(0, 5);
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
