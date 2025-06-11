
export class DomHelper {
  extractTextContent(element: Element | null, fallback = ''): string {
    return element?.textContent?.trim() || fallback;
  }

  makeAbsoluteUrl(url: string, baseUrl: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return new URL(url, baseUrl).toString();
  }
}
