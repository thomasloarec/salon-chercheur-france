import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

const BATCH_SIZE = 50;

const SYSTEM_PROMPT = `Tu es un expert en analyse d'entreprises B2B dans le secteur des salons professionnels.
À partir des informations fournies sur une entreprise exposante, génère une fiche d'enrichissement structurée.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication, sans backticks.
La langue de sortie doit être le français.`;

function buildUserPrompt(nom: string, website: string | null, description: string | null): string {
  return `Entreprise : ${nom}
Site web : ${website ?? 'Non disponible'}
Description originale : ${description ?? 'Non disponible'}

Génère un objet JSON avec exactement ces clés :
{
  "resume_court": "2 à 3 phrases maximum présentant l'entreprise, ses activités principales et sa valeur ajoutée pour un visiteur de salon professionnel",
  "secteur_principal": "secteur d'activité principal en 2-4 mots",
  "sous_secteurs": ["sous-secteur 1", "sous-secteur 2"],
  "produits_services": ["produit ou service 1", "produit ou service 2", "produit ou service 3"],
  "mots_cles_metier": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4"],
  "profils_visiteurs": ["profil visiteur 1", "profil visiteur 2"],
  "type_interet": ["achat", "partenariat", "veille"]
}

Pour type_interet, choisis parmi : achat, partenariat, veille, recrutement, formation, innovation.
Si les informations sont insuffisantes pour un champ, utilise un tableau vide [] ou une chaîne vide "".`;
}

async function callClaude(apiKey: string, nom: string, website: string | null, description: string | null): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: buildUserPrompt(nom, website, description) }
        ],
        system: SYSTEM_PROMPT,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ENRICH] Claude API error for "${nom}": ${response.status} ${errText}`);
      return null;
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text;
    if (!text) {
      console.error(`[ENRICH] Empty Claude response for "${nom}"`);
      return null;
    }

    // Clean potential markdown wrapping
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    console.error(`[ENRICH] Claude call/parse failed for "${nom}":`, err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // --- Authentication: service_role or admin only ---
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey || !anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing server configuration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  // Accept service_role key directly
  const isServiceRole = token === serviceRoleKey;

  // If not service_role, verify admin via JWT
  if (!isServiceRole) {
    const supabaseAuth = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role via service client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log('[ENRICH] Starting enrichment batch...');

    // --- Phase 1: Exposants WITH website ---
    const { data: withWebsite, error: err1 } = await supabaseAdmin
      .from('exposants')
      .select('id_exposant, nom_exposant, website_exposant, exposant_description')
      .not('website_exposant', 'is', null)
      .neq('website_exposant', '')
      .not('id_exposant', 'is', null)
      .limit(BATCH_SIZE);

    if (err1) {
      console.error('[ENRICH] Query error (with website):', err1.message);
      throw new Error(err1.message);
    }

    // Filter out those that already have an exhibitor_ai entry
    let toProcess: typeof withWebsite = [];
    if (withWebsite && withWebsite.length > 0) {
      const ids = withWebsite.map(e => e.id_exposant!);
      const { data: existingAi } = await supabaseAdmin
        .from('exhibitor_ai')
        .select('exhibitor_id')
        .in('exhibitor_id', ids);

      const existingSet = new Set((existingAi ?? []).map(r => r.exhibitor_id));
      toProcess = withWebsite.filter(e => !existingSet.has(e.id_exposant!));
    }

    // --- Phase 2: If not enough, fill with exposants WITHOUT website ---
    if (toProcess.length < BATCH_SIZE) {
      const remaining = BATCH_SIZE - toProcess.length;
      const { data: withoutWebsite } = await supabaseAdmin
        .from('exposants')
        .select('id_exposant, nom_exposant, website_exposant, exposant_description')
        .not('id_exposant', 'is', null)
        .or('website_exposant.is.null,website_exposant.eq.')
        .limit(remaining);

      if (withoutWebsite && withoutWebsite.length > 0) {
        const ids2 = withoutWebsite.map(e => e.id_exposant!);
        const { data: existingAi2 } = await supabaseAdmin
          .from('exhibitor_ai')
          .select('exhibitor_id')
          .in('exhibitor_id', ids2);

        const existingSet2 = new Set((existingAi2 ?? []).map(r => r.exhibitor_id));
        const filtered2 = withoutWebsite.filter(e => !existingSet2.has(e.id_exposant!));
        toProcess = [...toProcess, ...filtered2];
      }
    }

    console.log(`[ENRICH] Found ${toProcess.length} exposants to enrich`);

    if (toProcess.length === 0) {
      return new Response(JSON.stringify({
        processed: 0, success: 0, errors: 0, remaining: 0,
        message: 'All exhibitors already enriched'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let successCount = 0;
    let errorCount = 0;

    for (const exposant of toProcess) {
      const parsed = await callClaude(
        anthropicKey,
        exposant.nom_exposant ?? 'Inconnu',
        exposant.website_exposant,
        exposant.exposant_description
      );

      if (!parsed) {
        errorCount++;
        continue;
      }

      const { error: insertError } = await supabaseAdmin
        .from('exhibitor_ai')
        .insert({
          exhibitor_id: exposant.id_exposant!,
          resume_court: (parsed.resume_court as string) || '',
          secteur_principal: (parsed.secteur_principal as string) || null,
          sous_secteurs: (parsed.sous_secteurs as string[]) ?? [],
          produits_services: (parsed.produits_services as string[]) ?? [],
          mots_cles_metier: (parsed.mots_cles_metier as string[]) ?? [],
          profils_visiteurs: (parsed.profils_visiteurs as string[]) ?? [],
          type_interet: (parsed.type_interet as string[]) ?? [],
          source_url: exposant.website_exposant || null,
          source_table: 'exposants',
          enriched_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error(`[ENRICH] Insert failed for "${exposant.nom_exposant}":`, insertError.message);
        errorCount++;
      } else {
        successCount++;
      }
    }

    // --- Check remaining ---
    const { count: remainingCount } = await supabaseAdmin
      .from('exposants')
      .select('id_exposant', { count: 'exact', head: true })
      .not('id_exposant', 'is', null);

    const { count: enrichedCount } = await supabaseAdmin
      .from('exhibitor_ai')
      .select('id', { count: 'exact', head: true });

    const remaining = Math.max(0, (remainingCount ?? 0) - (enrichedCount ?? 0));

    console.log(`[ENRICH] Batch done: ${successCount} success, ${errorCount} errors, ${remaining} remaining`);

    const report = {
      processed: toProcess.length,
      success: successCount,
      errors: errorCount,
      remaining,
    };

    // --- Self-recall if more to process ---
    if (remaining > 0) {
      console.log(`[ENRICH] ${remaining} remaining — triggering next batch...`);
      try {
        const enrichUrl = `${supabaseUrl}/functions/v1/enrich-exposants-ai`;
        fetch(enrichUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ triggered_by: 'self-recall', batch: 'next' }),
        }).catch(() => {});
      } catch (_) {
        // Silence — self-recall failure shouldn't affect report
      }
    }

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ENRICH] Fatal error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
