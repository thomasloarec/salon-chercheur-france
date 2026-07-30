import type {
  AirtableExposantRecord,
  ExposantImportResult,
  AirtableConfig,
} from '../_shared/types.ts';
import {
  fetchAirtablePageRange,
  batchUpsertCounted,
  SUPABASE_BATCH_SIZE,
  MAX_AIRTABLE_PAGES_PER_CHUNK,
  CHUNK_TIME_BUDGET_MS,
  type ChunkOptions,
  type ChunkResult,
} from './chunk-utils.ts';

// Sites génériques bloqués — un exposant avec un de ces websites est exclu
// SAUF si le nom normalisé de l'exposant correspond au propriétaire du site
const BLOCKED_GENERIC_SITES: Record<string, string[]> = {
  'google.com': ['google'],
  'linkedin.com': ['linkedin'],
  'facebook.com': ['facebook', 'meta'],
  'instagram.com': ['instagram', 'meta'],
  'twitter.com': ['twitter'],
  'x.com': ['x', 'twitter'],
  'pinterest.com': ['pinterest'],
  'youtube.com': ['youtube', 'google'],
  'tiktok.com': ['tiktok', 'bytedance'],
  'snapchat.com': ['snapchat', 'snap'],
  'reddit.com': ['reddit'],
  'wikipedia.org': ['wikipedia', 'wikimedia'],
  'amazon.com': ['amazon', 'aws'],
  'apple.com': ['apple'],
  'whatsapp.com': ['whatsapp', 'meta'],
};

function isBlockedGenericSite(normalizedWebsite: string, nomExposant: string): boolean {
  const nomNorm = nomExposant.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const [blockedDomain, ownerNames] of Object.entries(BLOCKED_GENERIC_SITES)) {
    if (normalizedWebsite === blockedDomain) {
      // Exception : le propriétaire légitime du site n'est pas bloqué
      if (ownerNames.some(owner => nomNorm.includes(owner))) {
        return false;
      }
      return true;
    }
  }
  return false;
}

function normalizeDomain(input?: string | null): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.split('/')[0].split('#')[0].split('?')[0];
  s = s.replace(/\.$/, '').replace(/:\d+$/, '');
  return s || null;
}

async function loadEventWebsites(supabaseClient: any): Promise<Set<string>> {
  const { data: eventRows } = await supabaseClient
    .from('events')
    .select('url_site_officiel')
    .not('url_site_officiel', 'is', null);

  const eventWebsites = new Set<string>();
  for (const row of eventRows || []) {
    const norm = normalizeDomain(row.url_site_officiel);
    if (norm) eventWebsites.add(norm);
  }
  console.log(`[FILTER] ${eventWebsites.size} websites d'événements chargés pour blocage dynamique`);
  return eventWebsites;
}

/**
 * Traite UNE tranche bornée d'exposants (80 pages Airtable max, budget 60 s).
 * Les règles de filtrage sont identiques au comportement monolithique.
 */
export async function importExposantsChunk(
  supabaseClient: any,
  airtableConfig: AirtableConfig,
  opts: ChunkOptions = {},
): Promise<ChunkResult> {
  const startedAt = opts.startedAt ?? Date.now();
  const eventWebsites = await loadEventWebsites(supabaseClient);

  const { records: allExposants, nextOffset, pagesFetched } = await fetchAirtablePageRange<AirtableExposantRecord>(
    'All_Exposants',
    airtableConfig,
    {
      offset: opts.offset,
      maxPages: opts.maxPages ?? MAX_AIRTABLE_PAGES_PER_CHUNK,
      timeBudgetMs: opts.timeBudgetMs ?? CHUNK_TIME_BUDGET_MS,
      startedAt,
    },
  );
  console.log(`[FETCH] Tranche exposants: ${allExposants.length} enregistrements sur ${pagesFetched} pages`);

  const exposantErrors: Array<{ record_id: string; reason: string }> = [];

  // Filtrer les tests internes
  const exposantsRaw = allExposants.filter((r: any) => {
    const nom = (r.fields.nom_exposant || '').toLowerCase().trim();
    const website = (r.fields.website_exposant || '').toLowerCase().trim();

    const isInternalTest =
      (nom === 'test' || nom === 'test special' || nom.endsWith(' test')) &&
      (website === 'google.com' || website === 'example.com' || !website);

    return !isInternalTest;
  });

  const exposantsToUpsert = [];
  let skippedInvalidWebsite = 0;

  for (const r of exposantsRaw) {
    const f = r.fields;

    if (!f['id_exposant']?.trim()) {
      exposantErrors.push({ record_id: r.id, reason: 'id_exposant manquant' });
      continue;
    }

    if (!f['nom_exposant']?.trim()) {
      exposantErrors.push({ record_id: r.id, reason: 'nom_exposant manquant' });
      continue;
    }

    const normalizedWebsite = normalizeDomain(f['website_exposant']);
    const nomExposant = f['nom_exposant'].trim();

    // Exclure les exposants sans website
    if (!normalizedWebsite) {
      skippedInvalidWebsite++;
      continue;
    }

    // Exclure les sites génériques (sauf propriétaire légitime)
    if (isBlockedGenericSite(normalizedWebsite, nomExposant)) {
      skippedInvalidWebsite++;
      continue;
    }

    // Exclure les websites correspondant au site d'un événement
    if (eventWebsites.has(normalizedWebsite)) {
      skippedInvalidWebsite++;
      continue;
    }

    exposantsToUpsert.push({
      id_exposant: f['id_exposant'].trim(),
      nom_exposant: nomExposant,
      website_exposant: normalizedWebsite,
      exposant_description: f['exposant_description']?.trim() || null,
    });
  }

  console.log(`[PREP] ${exposantsToUpsert.length} exposants à insérer, ${skippedInvalidWebsite} exclus (website invalide), ${exposantErrors.length} erreurs`);

  let processed = 0;
  if (exposantsToUpsert.length > 0) {
    const { inserted, errors } = await batchUpsertCounted(
      supabaseClient,
      'exposants',
      exposantsToUpsert,
      'id_exposant',
      SUPABASE_BATCH_SIZE,
    );
    processed = inserted;
    errors.forEach(err => exposantErrors.push({ record_id: 'BATCH', reason: err }));
  }

  return {
    processed,
    errors: exposantErrors,
    done: !nextOffset,
    offset: nextOffset,
  };
}

/**
 * Chemin legacy : boucle sur les tranches jusqu'à épuisement.
 * Fonctionnellement équivalent à l'implémentation monolithique précédente.
 */
export async function importExposants(
  supabaseClient: any,
  airtableConfig: AirtableConfig,
): Promise<ExposantImportResult> {
  console.log('[EXPOSANTS] Début import (legacy)...');
  let exposantsImported = 0;
  const exposantErrors: Array<{ record_id: string; reason: string }> = [];
  let offset: string | undefined = undefined;

  while (true) {
    const chunk = await importExposantsChunk(supabaseClient, airtableConfig, {
      offset,
      maxPages: MAX_AIRTABLE_PAGES_PER_CHUNK,
      timeBudgetMs: Number.MAX_SAFE_INTEGER,
      startedAt: Date.now(),
    });
    exposantsImported += chunk.processed;
    exposantErrors.push(...chunk.errors);
    if (chunk.done) break;
    offset = chunk.offset;
  }

  console.log(`[DONE] Import terminé: ${exposantsImported} insérés/mis à jour, ${exposantErrors.length} erreurs`);
  return { exposantsImported, exposantErrors };
}
