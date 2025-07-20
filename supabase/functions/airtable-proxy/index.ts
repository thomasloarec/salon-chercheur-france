import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { AIRTABLE_CONFIG } from '../../../src/config/airtable.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for required environment variables with fallbacks
    const REQUIRED_VARS = [
      'AIRTABLE_PAT',
      'AIRTABLE_BASE_ID', 
      'EVENTS_TABLE_NAME',
      'EXHIBITORS_TABLE_NAME',
      'PARTICIPATION_TABLE_NAME'
    ];

    const missing = REQUIRED_VARS.filter(key => {
      const envValue = Deno.env.get(key);
      if (envValue) return false;
      
      // Check if we have a fallback value from config
      switch (key) {
        case 'AIRTABLE_BASE_ID':
          return !AIRTABLE_CONFIG.BASE_ID;
        case 'EVENTS_TABLE_NAME':
          return !AIRTABLE_CONFIG.TABLES.EVENTS;
        case 'EXHIBITORS_TABLE_NAME':
          return !AIRTABLE_CONFIG.TABLES.EXHIBITORS;
        case 'PARTICIPATION_TABLE_NAME':
          return !AIRTABLE_CONFIG.TABLES.PARTICIPATION;
        default:
          return true; // No fallback for sensitive vars like PAT
      }
    });

    if (missing.length > 0) {
      console.error(`Missing required environment variables: ${JSON.stringify(missing)}`);
      return new Response(
        JSON.stringify({ 
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

    // Get values with fallbacks
    const getConfigValue = (key: string): string => {
      const envValue = Deno.env.get(key);
      if (envValue) return envValue;
      
      switch (key) {
        case 'AIRTABLE_BASE_ID':
          return AIRTABLE_CONFIG.BASE_ID;
        case 'EVENTS_TABLE_NAME':
          return AIRTABLE_CONFIG.TABLES.EVENTS;
        case 'EXHIBITORS_TABLE_NAME':
          return AIRTABLE_CONFIG.TABLES.EXHIBITORS;
        case 'PARTICIPATION_TABLE_NAME':
          return AIRTABLE_CONFIG.TABLES.PARTICIPATION;
        default:
          throw new Error(`No fallback available for ${key}`);
      }
    };

    const AIRTABLE_PAT = getConfigValue('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = getConfigValue('AIRTABLE_BASE_ID');
    const EVENTS_TABLE_NAME = getConfigValue('EVENTS_TABLE_NAME');
    const EXHIBITORS_TABLE_NAME = getConfigValue('EXHIBITORS_TABLE_NAME');
    const PARTICIPATION_TABLE_NAME = getConfigValue('PARTICIPATION_TABLE_NAME');

    const apiKey = req.headers.get('apikey');
    if (apiKey !== Deno.env.get('SUPABASE_ANON_KEY')) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Invalid API key' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { table, method, data, uniqueField } = await req.json();

    if (!table) {
      return new Response(
        JSON.stringify({ error: 'missing_table', message: 'Table name is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!method) {
      return new Response(
        JSON.stringify({ error: 'missing_method', message: 'Method is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`;

    let response;
    switch (method) {
      case 'list':
        response = await fetch(`${airtableUrl}`, {
          headers: {
            Authorization: `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json',
          },
        });
        break;
      case 'create':
        response = await fetch(`${airtableUrl}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records: data.map((item: any) => ({ fields: item })) }),
        });
        break;
      case 'update':
        response = await fetch(`${airtableUrl}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records: data.map((item: any) => ({ id: item.id, fields: item.fields })) }),
        });
        break;
      case 'delete':
        response = await fetch(`${airtableUrl}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records: data.map((item: any) => ({ id: item.id })) }),
        });
        break;
      case 'upsert':
        if (!uniqueField) {
          return new Response(
            JSON.stringify({ error: 'missing_unique_field', message: 'Unique field is required for upsert' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // 1. Find existing records
        const findUrl = `${airtableUrl}?filterByFormula=OR(${data
          .map((item: any) => `({${uniqueField}}="${item[uniqueField]}")`)
          .join(',')})`;

        const findResponse = await fetch(findUrl, {
          headers: {
            Authorization: `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json',
          },
        });

        if (!findResponse.ok) {
          console.error('Airtable find error:', await findResponse.text());
          throw new Error(`Airtable find failed: ${findResponse.statusText}`);
        }

        const findResult = await findResponse.json();
        const existingRecords = findResult.records || [];

        const toCreate = data.filter(
          (item: any) => !existingRecords.find((record: any) => record.fields[uniqueField] === item[uniqueField])
        );
        const toUpdate = data.filter((item: any) =>
          existingRecords.find((record: any) => record.fields[uniqueField] === item[uniqueField])
        );

        const createPromises = toCreate.length > 0
          ? [
              fetch(`${airtableUrl}`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${AIRTABLE_PAT}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ records: toCreate.map((item: any) => ({ fields: item })) }),
              }).then(res => res.json())
            ]
          : [];

        const updatePromises = toUpdate.length > 0
          ? [
              fetch(`${airtableUrl}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${AIRTABLE_PAT}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  records: toUpdate.map((item: any) => {
                    const existingRecord = existingRecords.find((record: any) => record.fields[uniqueField] === item[uniqueField]);
                    return { id: existingRecord.id, fields: item };
                  }),
                }),
              }).then(res => res.json())
            ]
          : [];

        const [createResult, updateResult] = await Promise.all(createPromises.concat(updatePromises));

        const created = createResult ? createResult.records || [] : [];
        const updated = updateResult ? updateResult.records || [] : [];

        return new Response(
          JSON.stringify({
            created,
            updated,
            toCreate: toCreate.length,
            toUpdate: toUpdate.length,
            existing: existingRecords.length,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );

      case 'findRecordByUniqueField':
        if (!uniqueField) {
          return new Response(
            JSON.stringify({ error: 'missing_unique_field', message: 'Unique field is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        if (!data || !data.uniqueValue) {
          return new Response(
            JSON.stringify({ error: 'missing_unique_value', message: 'Unique value is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const findByUrl = `${airtableUrl}?filterByFormula=({${uniqueField}}="${data.uniqueValue}")`;

        const findByResponse = await fetch(findByUrl, {
          headers: {
            Authorization: `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json',
          },
        });

        if (!findByResponse.ok) {
          console.error('Airtable find error:', await findByResponse.text());
          throw new Error(`Airtable find failed: ${findByResponse.statusText}`);
        }

        const findByResult = await findByResponse.json();
        const foundRecord = findByResult.records && findByResult.records.length > 0 ? findByResult.records[0] : null;

        return new Response(
          JSON.stringify(foundRecord),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'invalid_method', message: 'Invalid method' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }

    if (!response.ok) {
      console.error('Airtable error:', await response.text());
      throw new Error(`Airtable request failed: ${response.statusText}`);
    }

    const result = await response.json();

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Airtable proxy error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
