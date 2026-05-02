import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { ANTHROPIC_API_URL, buildAnthropicHeaders, getAnthropicModelFast } from '../_shared/anthropic.ts';

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
    const model = getAnthropicModelFast();
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: buildAnthropicHeaders(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          { role: 'user', content: buildUserPrompt(nom, website, description) }
        ],
        system: SYSTEM_PROMPT,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ENRICH] Claude API error for "${nom}" model=${model} status=${response.status}: ${errText.slice(0, 300)}`);
      // Tag specific recoverable failures so the orchestrator can short-circuit.
      const lower = errText.toLowerCase();
      if (lower.includes('credit balance is too low') || lower.includes('credit_balance')) {
        const err = new Error('ANTHROPIC_CREDIT_EXHAUSTED');
        (err as any).code = 'ANTHROPIC_CREDIT_EXHAUSTED';
        (err as any).providerStatus = response.status;
        (err as any).providerMessage = errText.slice(0, 300);
        throw err;
      }
      if (response.status === 401 || response.status === 403) {
        const err = new Error('ANTHROPIC_AUTH_ERROR');
        (err as any).code = 'ANTHROPIC_AUTH_ERROR';
        (err as any).providerStatus = response.status;
        (err as any).providerMessage = errText.slice(0, 300);
        throw err;
      }
      if (response.status === 429) {
        const err = new Error('ANTHROPIC_RATE_LIMITED');
        (err as any).code = 'ANTHROPIC_RATE_LIMITED';
        (err as any).providerStatus = response.status;
        (err as any).providerMessage = errText.slice(0, 300);
        throw err;
      }
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
    // Re-throw tagged provider errors so the batch loop can stop early.
    if (err instanceof Error && (err as any).code) {
      throw err;
    }
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

    // --- Diagnostic stats (pre-batch) ---
    const { data: preStats, error: statsErr } = await supabaseAdmin
      .rpc('get_exhibitor_ai_enrichment_stats');
    if (statsErr) {
      console.error('[ENRICH] Stats RPC error:', statsErr.message);
    } else {
      console.log('[ENRICH] Pre-batch stats:', preStats);
    }

    // --- SQL anti-join: exposants with website AND no valid exhibitor_ai row ---
    // LIMIT is applied AFTER the NOT-EXISTS filter (server-side, stable order).
    const { data: toProcessRaw, error: listErr } = await supabaseAdmin
      .rpc('list_exposants_to_enrich', { p_limit: BATCH_SIZE });

    if (listErr) {
      console.error('[ENRICH] list_exposants_to_enrich error:', listErr.message);
      throw new Error(listErr.message);
    }

    const toProcess = (toProcessRaw ?? []) as Array<{
      id_exposant: string;
      nom_exposant: string | null;
      website_exposant: string | null;
      exposant_description: string | null;
    }>;

    console.log(`[ENRICH] Selected ${toProcess.length} exposants for this batch (BATCH_SIZE=${BATCH_SIZE})`);

    if (toProcess.length === 0) {
      const remaining = (preStats as { remaining_with_site?: number } | null)?.remaining_with_site ?? 0;
      return new Response(JSON.stringify({
        processed: 0, success: 0, errors: 0, remaining,
        message: remaining === 0
          ? 'All exhibitors with a website are already enriched'
          : 'No exposants matched the SQL filter (check logs)'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let successCount = 0;
    let errorCount = 0;
    let fatalProviderError: { code: string; status?: number; message?: string } | null = null;

    for (const exposant of toProcess) {
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = await callClaude(
          anthropicKey,
          exposant.nom_exposant ?? 'Inconnu',
          exposant.website_exposant,
          exposant.exposant_description
        );
      } catch (err) {
        const code = (err as any)?.code as string | undefined;
        if (code === 'ANTHROPIC_CREDIT_EXHAUSTED' || code === 'ANTHROPIC_AUTH_ERROR' || code === 'ANTHROPIC_RATE_LIMITED') {
          fatalProviderError = {
            code,
            status: (err as any).providerStatus,
            message: (err as any).providerMessage,
          };
          errorCount++;
          console.error(`[ENRICH] Fatal provider error (${code}) — aborting batch.`);
          break;
        }
        console.error(`[ENRICH] Unexpected error for "${exposant.nom_exposant}":`, err);
        errorCount++;
        continue;
      }

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

    // --- Post-batch stats (truthful counters) ---
    const { data: postStats } = await supabaseAdmin
      .rpc('get_exhibitor_ai_enrichment_stats');
    const remaining = (postStats as { remaining_with_site?: number } | null)?.remaining_with_site ?? 0;

    console.log(`[ENRICH] Batch done: ${successCount} success, ${errorCount} errors, ${remaining} remaining (with site).`);
    console.log('[ENRICH] Post-batch stats:', postStats);

    const report = {
      processed: toProcess.length,
      success: successCount,
      errors: errorCount,
      remaining,
      stats: postStats ?? null,
      error_code: fatalProviderError?.code ?? (successCount === 0 && errorCount > 0 ? 'ALL_ERRORS' : null),
      error_detail: fatalProviderError
        ? (fatalProviderError.code === 'ANTHROPIC_CREDIT_EXHAUSTED'
            ? "Crédit Anthropic épuisé : ajoutez du crédit sur console.anthropic.com (Plans & Billing) pour relancer l'enrichissement."
            : fatalProviderError.code === 'ANTHROPIC_AUTH_ERROR'
            ? "Clé API Anthropic invalide ou révoquée : vérifiez le secret ANTHROPIC_API_KEY."
            : "Anthropic a renvoyé une limite de débit (429). Réessayez dans quelques minutes.")
        : null,
    };

    // --- Self-recall if more to process AND no systemic failure ---
    const shouldStop = !!fatalProviderError || (successCount === 0 && errorCount === toProcess.length);
    if (remaining > 0 && !shouldStop) {
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
    } else if (shouldStop) {
      console.log('[ENRICH] Skipping self-recall: systemic failure detected.');
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
