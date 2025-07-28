
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { z } from 'https://esm.sh/zod@3.23.8'
import { CORS_HEADERS } from '../_shared/cors.ts'

interface EventImport {
  id: string;
  id_event: string;
  nom_event: string | null;
  status_event: string | null;
  ai_certainty: string | null;
  type_event: string | null;
  date_debut: string | null;
  date_fin: string | null;
  date_complete: string | null;
  secteur: string | null;
  url_image: string | null;
  url_site_officiel: string | null;
  description_event: string | null;
  affluence: string | null;
  tarifs: string | null;
  nom_lieu: string | null;
  adresse: string | null;
  chatgpt_prompt: string | null;
  created_at: string;
  updated_at: string | null;
  ville: string | null;
  rue: string | null;
  code_postal: string | null;
}

const schema = z.object({ 
  id_event: z.string().uuid() 
});

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: CORS_HEADERS,
      status: 204 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔵 Début publication événement en attente');

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
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    if (!eventImport) {
      console.error('❌ Aucun événement trouvé avec cet ID');
      return new Response(
        JSON.stringify({ error: 'Événement non trouvé' }),
        { 
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    console.log('✅ Événement import trouvé:', eventImport.nom_event);

    // 2. Mapper vers le format events
    const productionEvent = {
      id_event: eventImport.id,
      nom_event: eventImport.nom_event || '',
      visible: true,
      type_event: eventImport.type_event || 'salon',
      date_debut: eventImport.date_debut || '1970-01-01',
      date_fin: eventImport.date_fin || eventImport.date_debut || '1970-01-01',
      secteur: eventImport.secteur ? [eventImport.secteur] : ['Autre'],
      ville: eventImport.ville || 'Inconnue',
      rue: eventImport.rue || null,
      code_postal: eventImport.code_postal || null,
      pays: 'France',
      url_image: eventImport.url_image || null,
      url_site_officiel: eventImport.url_site_officiel || null,
      description_event: eventImport.description_event || null,
      affluence: eventImport.affluence ? parseInt(eventImport.affluence) : null,
      tarif: eventImport.tarifs || null,
      nom_lieu: eventImport.nom_lieu || null,
      location: eventImport.ville || 'Inconnue'
    };

    console.log('🔧 Événement mappé pour production:', {
      id_event: productionEvent.id_event,
      nom_event: productionEvent.nom_event,
      ville: productionEvent.ville,
      date_debut: productionEvent.date_debut,
      date_fin: productionEvent.date_fin
    });

    // 🔍 DEBUG: Log complet de l'objet avant upsert
    console.log('🔧 FULL PAYLOAD:', JSON.stringify(productionEvent, null, 2));

    // 3. Mettre à jour l'événement existant pour le publier (visible = true)
    const { error: updateError } = await supabase
      .from('events')
      .update({ 
        visible: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('id_event', eventImport.id_event);

    if (updateError) {
      console.error('❌ Erreur update événement:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la publication de l\'événement',
          details: updateError.message 
        }),
        { 
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log('✅ Événement publié avec succès');

    // 4. Supprimer de staging_events_import
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
        event_id: productionEvent.id_event,
        event_name: productionEvent.nom_event
      }),
      { 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erreur générale publication:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message 
      }),
      { 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
