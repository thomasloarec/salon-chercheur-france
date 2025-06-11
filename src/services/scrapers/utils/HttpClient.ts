
export class HttpClient {
  public async fetchWithRetry(url: string, retries = 3): Promise<Response> {
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

  public async request(url: string): Promise<string> {
    const response = await this.fetchWithRetry(url);
    return response.text();
  }

  public randomUA(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  public async sleepRandom(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
