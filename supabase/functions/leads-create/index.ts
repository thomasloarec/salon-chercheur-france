import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

// Frontend schema
const schema = z.object({
  novelty_id: z.string().uuid(),
  lead_type: z.enum(['brochure_download', 'meeting_request']),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

// Map frontend types to database types
const leadTypeMapping = {
  'brochure_download': 'resource_download',
  'meeting_request': 'meeting_request'
} as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }),
        { status: 422, headers: corsHeaders }
      );
    }

    const data = parsed.data;
    const admin = createClient(supabaseUrl, serviceKey);

    // Map frontend type to database type
    const dbLeadType = leadTypeMapping[data.lead_type];

    // Verify novelty exists and get brochure URL
    const { data: novelty, error: noveltyError } = await admin
      .from('novelties')
      .select('id, title, doc_url')
      .eq('id', data.novelty_id)
      .single();

    if (noveltyError || !novelty) {
      return new Response(
        JSON.stringify({ error: "Novelty not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // For brochure downloads, verify doc_url exists
    if (data.lead_type === 'brochure_download' && !novelty.doc_url) {
      return new Response(
        JSON.stringify({ error: "No brochure available for this novelty" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Deduplication check: case-insensitive email matching
    const { data: existingLead, error: dedupError } = await admin
      .from('leads')
      .select('id')
      .eq('novelty_id', data.novelty_id)
      .ilike('email', data.email)
      .maybeSingle();

    if (dedupError) {
      console.error('Deduplication check error:', dedupError);
    }

    if (existingLead) {
      console.log('[lead_duplicate_detected]', { 
        novelty_id: data.novelty_id, 
        email: data.email, 
        existing_id: existingLead.id 
      });
      
      const duplicateResponse: { 
        success: boolean; 
        duplicate: boolean; 
        lead_id: string; 
        message: string;
        download_url?: string;
      } = {
        success: true,
        duplicate: true,
        lead_id: existingLead.id,
        message: 'Lead already exists'
      };

      // Still provide download URL if brochure request
      if (data.lead_type === 'brochure_download' && novelty.doc_url) {
        duplicateResponse.download_url = novelty.doc_url;
      }

      return new Response(
        JSON.stringify(duplicateResponse),
        { status: 200, headers: corsHeaders }
      );
    }

    // Create lead with mapped type
    const { data: lead, error: leadError } = await admin
      .from('leads')
      .insert([{
        novelty_id: data.novelty_id,
        lead_type: dbLeadType,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        company: data.company || null,
        role: data.role || null,
        phone: data.phone || null,
        notes: data.notes || null,
      }])
      .select()
      .single();

    if (leadError) {
      console.error('Lead creation error:', leadError);
      return new Response(
        JSON.stringify({ error: "Failed to create lead", details: leadError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    const response: { 
      success: boolean; 
      duplicate: boolean;
      lead_id: any; 
      message: string; 
      download_url?: string;
    } = { 
      success: true,
      duplicate: false,
      lead_id: lead.id,
      message: data.lead_type === 'brochure_download' ? 'Brochure download recorded' : 'Meeting request created'
    };

    // Include download URL for brochure requests
    if (data.lead_type === 'brochure_download' && novelty.doc_url) {
      response.download_url = novelty.doc_url;
    }

    return new Response(
      JSON.stringify(response),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});