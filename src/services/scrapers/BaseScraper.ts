
import type { ScrapedEvent } from '@/types/scraping';
import { HttpClient } from './utils/HttpClient';
import { DateParser } from './utils/DateParser';
import { TextClassifier } from './utils/TextClassifier';
import { DomHelper } from './utils/DomHelper';

export abstract class BaseScraper {
  public venue: string;
  protected baseUrl: string;
  protected httpClient: HttpClient;
  protected dateParser: DateParser;
  protected textClassifier: TextClassifier;
  protected domHelper: DomHelper;

  constructor(venue: string, baseUrl: string) {
    this.venue = venue;
    this.baseUrl = baseUrl;
    this.httpClient = new HttpClient();
    this.dateParser = new DateParser();
    this.textClassifier = new TextClassifier();
    this.domHelper = new DomHelper();
  }

  abstract scrapeEvents(): Promise<ScrapedEvent[]>;

  // Delegate to HttpClient
  protected async fetchWithRetry(url: string, retries = 3): Promise<Response> {
    return this.httpClient.fetchWithRetry(url, retries);
  }

  protected async request(url: string): Promise<string> {
    return this.httpClient.request(url);
  }

  protected randomUA(): string {
    return this.httpClient.randomUA();
  }

  protected async sleepRandom(min: number, max: number): Promise<void> {
    return this.httpClient.sleepRandom(min, max);
  }

  // Delegate to DateParser
  protected parseDate(dateStr: string): Date | null {
    return this.dateParser.parseDate(dateStr);
  }

  protected parseFrDate(dateStr: string): Date | null {
    return this.dateParser.parseFrDate(dateStr);
  }

  protected parseDateRangeFr(dateStr: string): [Date | null, Date | null] {
    return this.dateParser.parseDateRangeFr(dateStr);
  }

  // Delegate to TextClassifier
  protected detectSector(text: string): string {
    return this.textClassifier.detectSector(text);
  }

  protected ruleBasedType(text: string): string {
    return this.textClassifier.ruleBasedType(text);
  }

  protected extractTags(text: string): string[] {
    return this.textClassifier.extractTags(text);
  }

  // Delegate to DomHelper
  protected extractTextContent(element: Element | null, fallback = ''): string {
    return this.domHelper.extractTextContent(element, fallback);
  }

  protected makeAbsoluteUrl(url: string): string {
    return this.domHelper.makeAbsoluteUrl(url, this.baseUrl);
  }
}
