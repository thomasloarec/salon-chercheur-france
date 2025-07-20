
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AirtableConfig {
  baseId: string;
  pat: string;
  tablesConfig: {
    events: string;
    exposants: string;
    participation: string;
  };
}

/**
 * Normalizes URL for comparison by removing protocol, www, and trailing slash
 * Examples:
 * - https://www.example.com/ → example.com
 * - http://example.com → example.com
 * - www.example.com → example.com
 * @param url - URL to normalize
 * @returns normalized URL in lowercase
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

class AirtableClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private tablesConfig: AirtableConfig['tablesConfig'];

  constructor(config: AirtableConfig) {
    this.baseUrl = `https://api.airtable.com/v0/${config.baseId}`;
    this.headers = {
      'Authorization': `Bearer ${config.pat}`,
      'Content-Type': 'application/json',
    };
    this.tablesConfig = config.tablesConfig;
  }

  async listAllRecords(tableName: string) {
    const records: any[] = [];
    let offset: string | undefined;

    do {
      const url = new URL(`${this.baseUrl}/${tableName}`);
      if (offset) url.searchParams.set('offset', offset);

      const response = await fetch(url.toString(), {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      records.push(...data.records);
      offset = data.offset;

      // Rate limiting: 5 requests per second
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (offset);

    return records;
  }

  async createRecords(tableName: string, records: any[]) {
    const chunks = this.chunkArray(records, 10); // Airtable limit: 10 records per batch
    const results = [];

    for (const chunk of chunks) {
      const response = await fetch(`${this.baseUrl}/${tableName}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ records: chunk.map(r => ({ fields: r })) }),
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      results.push(...data.records);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
  }

  async upsertRecords(tableName: string, records: any[], uniqueField: string) {
    const toUpdate: any[] = [];
    const toCreate: any[] = [];

    // For each record, check if it exists using the unique field
    for (const record of records) {
      const uniqueValue = record[uniqueField];
      if (!uniqueValue) {
        console.warn(`Record missing unique field ${uniqueField}, will create new record`);
        toCreate.push(record);
        continue;
      }

      let existing = null;
      
      // Special handling for URL-based unique fields (website_exposant, urlexpo_event)
      if (uniqueField === 'website_exposant' || uniqueField === 'urlexpo_event') {
        const normalizedValue = normalizeUrl(uniqueValue);
        const filterFormula = `LOWER(REGEX_REPLACE(REGEX_REPLACE({${uniqueField}}, "^https?://", ""), "^www\\.", "")) = "${normalizedValue}"`;
        
        existing = await this.findRecordByFilter(tableName, filterFormula);
      } else {
        // For non-URL fields, use exact match
        existing = await this.findRecordByUniqueField(tableName, uniqueField, uniqueValue);
      }

      if (existing) {
        toUpdate.push({ id: existing.id, fields: record });
      } else {
        toCreate.push(record);
      }
    }

    const results = { created: [], updated: [] };

    // Create new records
    if (toCreate.length > 0) {
      const created = await this.createRecords(tableName, toCreate);
      results.created = created;
    }

    // Update existing records
    if (toUpdate.length > 0) {
      const chunks = this.chunkArray(toUpdate, 10);
      for (const chunk of chunks) {
        const response = await fetch(`${this.baseUrl}/${tableName}`, {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify({ records: chunk }),
        });

        if (!response.ok) {
          throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        results.updated.push(...data.records);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  async findRecordByFilter(tableName: string, filterFormula: string) {
    const response = await fetch(
      `${this.baseUrl}/${tableName}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.records[0] || null;
  }

  async findRecordByUniqueField(tableName: string, fieldName: string, value: string) {
    const response = await fetch(
      `${this.baseUrl}/${tableName}?filterByFormula={${fieldName}}="${value}"`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.records[0] || null;
  }

  async deleteRecords(tableName: string, recordIds: string[]) {
    const chunks = this.chunkArray(recordIds, 10);
    const results = [];

    for (const chunk of chunks) {
      const url = new URL(`${this.baseUrl}/${tableName}`);
      chunk.forEach(id => url.searchParams.append('records[]', id));

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      results.push(...data.records);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for required environment variables
    const REQUIRED_VARS = [
      'AIRTABLE_PAT',
      'AIRTABLE_BASE_ID',
      'EVENTS_TABLE_NAME',
      'EXHIBITORS_TABLE_NAME',
      'PARTICIPATION_TABLE_NAME'
    ];
    
    const missing = REQUIRED_VARS.filter(key => !Deno.env.get(key));
    
    if (missing.length > 0) {
      console.error('Missing required environment variables:', missing);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'missing_env', 
          missing,
          message: `Missing required environment variables: ${missing.join(', ')}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get environment variables
    const airtableConfig: AirtableConfig = {
      baseId: Deno.env.get('AIRTABLE_BASE_ID') || '',
      pat: Deno.env.get('AIRTABLE_PAT') || '',
      tablesConfig: {
        events: Deno.env.get('EVENTS_TABLE_NAME') || 'All_Events',
        exposants: Deno.env.get('EXHIBITORS_TABLE_NAME') || 'All_Exposants',
        participation: Deno.env.get('PARTICIPATION_TABLE_NAME') || 'Participation',
      }
    };

    const client = new AirtableClient(airtableConfig);
    const { action, table, payload, uniqueField } = await req.json();

    console.log(`Airtable proxy: ${action} on ${table}`, uniqueField ? `(unique: ${uniqueField})` : '');

    let result;
    switch (action) {
      case 'LIST':
        result = await client.listAllRecords(table);
        break;
      case 'CREATE':
        result = await client.createRecords(table, payload);
        break;
      case 'UPSERT':
        result = await client.upsertRecords(table, payload, uniqueField);
        break;
      case 'FIND':
        result = await client.findRecordByUniqueField(table, payload.fieldName, payload.value);
        break;
      case 'DELETE':
        result = await client.deleteRecords(table, payload);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Airtable proxy error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
