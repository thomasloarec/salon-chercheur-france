// Utilitaires partagés pour l'exécution en tranches reprenables (Lot A).
// Aucune règle métier ici : uniquement le découpage de l'exécution.

export const MAX_AIRTABLE_PAGES_PER_CHUNK = 80;
export const CHUNK_TIME_BUDGET_MS = 60_000;
export const SUPABASE_BATCH_SIZE = 500;

/** Levée quand Airtable refuse un offset de pagination expiré (422 / iterator). */
export class AirtableOffsetExpiredError extends Error {
  constructor(message = 'airtable_offset_expired') {
    super(message);
    this.name = 'AirtableOffsetExpiredError';
  }
}

export interface ChunkOptions {
  offset?: string;
  maxPages?: number;
  timeBudgetMs?: number;
  startedAt?: number;
}

export interface ChunkResult<TError = { record_id: string; reason: string }> {
  processed: number;
  errors: TError[];
  done: boolean;
  offset?: string;
}

/**
 * Récupère une tranche bornée de pages Airtable à partir d'un offset.
 * Séquentiel (limite Airtable 5 req/s), jamais parallélisé.
 */
export async function fetchAirtablePageRange<T>(
  table: string,
  airtableConfig: { pat: string; baseId: string },
  opts: ChunkOptions,
): Promise<{ records: T[]; nextOffset?: string; pagesFetched: number }> {
  const maxPages = opts.maxPages ?? MAX_AIRTABLE_PAGES_PER_CHUNK;
  const timeBudgetMs = opts.timeBudgetMs ?? CHUNK_TIME_BUDGET_MS;
  const startedAt = opts.startedAt ?? Date.now();

  const records: T[] = [];
  let offset: string | undefined = opts.offset;
  let pagesFetched = 0;
  let isProvidedOffset = Boolean(opts.offset);

  while (true) {
    const url = new URL(`https://api.airtable.com/v0/${airtableConfig.baseId}/${table}`);
    if (offset) url.searchParams.set('offset', offset);

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${airtableConfig.pat}` },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (response.status === 422 || /iterator/i.test(body)) {
        throw new AirtableOffsetExpiredError(`Airtable offset expiré (${response.status}): ${body}`);
      }
      throw new Error(`Fetch ${table} failed: ${response.status} - ${body}`);
    }

    const data = await response.json() as { records: T[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
    pagesFetched++;
    isProvidedOffset = false;

    if (!offset) {
      return { records, nextOffset: undefined, pagesFetched };
    }
    if (pagesFetched >= maxPages) break;
    if (Date.now() - startedAt > timeBudgetMs) break;
  }

  void isProvidedOffset;
  return { records, nextOffset: offset, pagesFetched };
}

/** Upsert par lots, sans .select() (compte batch.length en cas de succès). */
export async function batchUpsertCounted(
  supabaseClient: any,
  tableName: string,
  records: any[],
  conflictColumn: string,
  batchSize: number = SUPABASE_BATCH_SIZE,
): Promise<{ inserted: number; errors: string[] }> {
  let totalInserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(records.length / batchSize);

    try {
      const { error } = await supabaseClient
        .from(tableName)
        .upsert(batch, { onConflict: conflictColumn });

      if (error) {
        console.error(`[BATCH ${batchNum}/${totalBatches}] Erreur:`, error.message);
        errors.push(`Batch ${batchNum}: ${error.message}`);
      } else {
        totalInserted += batch.length;
        if (batchNum % 5 === 0 || batchNum === totalBatches) {
          console.log(`[BATCH ${batchNum}/${totalBatches}] ${totalInserted} insérés`);
        }
      }
    } catch (e) {
      errors.push(`Batch ${batchNum}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { inserted: totalInserted, errors };
}
