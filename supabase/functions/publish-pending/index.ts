import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { z } from 'https://esm.sh/zod@3.24.1'
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts'

interface EventImport {
  id: string;
  id_event: string;
  nom_event: string | null;
  status_event: string | null;
  type_event: string | null;
  date_debut: string | null;
  date_fin: string | null;
  secteur: string[] | null;
  url_image: string | null;
  url_site_officiel: string | null;
  description_event: string | null;
  affluence: string | null;
  tarif: string | null;
  nom_lieu: string | null;
  rue: string | null;
  code_postal: string | null;
  ville: string | null;
  pays: string | null;
  location: string | null;
  is_b2b: boolean | null;
  created_at: string;
  updated_at: string | null;
}

const schema = z.object({ 
  id_event: z.string().nonempty() // Force redeploy v4 - fix tarif field
});

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    const corsResult = handleCors(req);
    if (corsResult instanceof Response) return corsResult;
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔵 Début publication événement en attente - v3');

    // Validation du payload avec Zod
    let id_event: string;
    try {
      const body = await req.json();
      const parsed = schema.parse(body);
      id_event = parsed.id_event;
    } catch (error) {
      console.error('❌ Erreur validation payload:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Données invalides', 
          details: error instanceof z.ZodError ? error.errors : 'Format JSON invalide'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    console.log(`🔍 Recherche événement import avec ID: ${id_event}`);

    // 1. Récupérer l'événement depuis staging_events_import via id_event logique
    const { data: eventImport, error: fetchError } = await supabase
      .from('staging_events_import')
      .select('*')
      .eq('id_event', id_event)
      .eq('status_event', 'Approved')
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Erreur récupération événement import:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Événement non trouvé ou non approuvé' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    if (!eventImport) {
      console.error('❌ Aucun événement trouvé avec cet ID');
      return new Response(
        JSON.stringify({ error: 'Événement non trouvé' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    console.log('✅ Événement import trouvé:', eventImport.nom_event);

    // 2. Publication atomique via RPC
    const { data: publishedEvent, error: rpcError } = await supabase
      .rpc('publish_pending_event_atomic', {
        p_id_event: eventImport.id_event,
        p_event_data: {
          nom_event: eventImport.nom_event,
          type_event: eventImport.type_event,
          description_event: eventImport.description_event,
          date_debut: eventImport.date_debut,
          date_fin: eventImport.date_fin,
          secteur: eventImport.secteur,
          url_image: eventImport.url_image,
          url_site_officiel: eventImport.url_site_officiel,
          affluence: eventImport.affluence,
          tarif: eventImport.tarif,
          nom_lieu: eventImport.nom_lieu,
          rue: eventImport.rue,
          code_postal: eventImport.code_postal,
          ville: eventImport.ville,
          pays: eventImport.pays || 'France',
          location: eventImport.location,
          is_b2b: eventImport.is_b2b || false
        }
      });

    if (rpcError) {
      console.error('❌ Erreur RPC publication:', rpcError);
      return new Response(JSON.stringify({
        error: 'Erreur lors de la publication',
        details: rpcError.message
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }

    // Vérifier si la RPC a retourné une erreur dans le JSON
    if (publishedEvent?.error) {
      console.error('❌ Erreur dans la fonction RPC:', publishedEvent.message);
      return new Response(JSON.stringify({
        error: 'Erreur lors de la publication',
        details: publishedEvent.message
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }

    console.log('✅ Événement publié avec succès');

    // 3b. Fire-and-forget : enrichissement SEO (meta_description_gen)
    // Récupérer l'UUID de l'événement publié pour l'enrichissement
    const publishedUuid = publishedEvent?.id;
    if (publishedUuid) {
      // Scan doublons (non bloquant)
      supabase.rpc('scan_event_duplicates', {
        p_kind: 'event', p_id: publishedUuid, p_persist: true,
      }).then(({ error }) => {
        if (error) console.warn('⚠️ Scan doublons non bloquant:', error.message);
        else console.log('🔍 Scan doublons effectué pour', eventImport.nom_event);
      });

      const enrichUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-event-meta`;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      
      // Fire-and-forget : on n'attend pas la réponse
      fetch(enrichUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_id: publishedUuid }),
      }).then(res => {
        console.log(`🤖 Enrichissement SEO déclenché pour ${eventImport.nom_event} → status ${res.status}`);
      }).catch(err => {
        console.warn('⚠️ Enrichissement SEO non déclenché (non bloquant):', err.message);
      });
    }

    // 4. Vérifier que les relations participation sont maintenues
    const { data: participationCount, error: participationError } = await supabase
      .from('participation')
      .select('id_participation')
      .eq('id_event', eventImport.id_event);

    if (participationError) {
      console.error('⚠️ Erreur vérification participation:', participationError);
    } else {
      console.log(`✅ ${participationCount?.length || 0} exposants liés à l'événement ${eventImport.id_event}`);
    }

    // 5. Supprimer de staging_events_import
    const { error: deleteError } = await supabase
      .from('staging_events_import')
      .delete()
      .eq('id_event', eventImport.id_event);

    if (deleteError) {
      console.error('⚠️ Erreur suppression événement import (mais publication OK):', deleteError);
      // On continue car l'événement est publié
    } else {
      console.log('✅ Événement supprimé de staging_events_import');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Événement publié avec succès',
        event_id: eventImport.id_event,
        event_name: eventImport.nom_event
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erreur générale publication:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error instanceof Error ? error.message : String(error) 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
