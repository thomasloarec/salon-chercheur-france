import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { z } from 'https://deno.land/x/zod@v3.20.2/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Schéma de validation avec messages détaillés
const noveltyCreateSchema = z.object({
  event_id: z.string().min(1, "ID événement requis"),
  exhibitor_id: z.string().min(1, "ID exposant requis"),
  
  user: z.object({
    email: z.string().email("Format email invalide"),
    first_name: z.string().min(1, "Prénom requis"),
    last_name: z.string().min(1, "Nom requis"),
    phone: z.string().nullable().optional(),
    role: z.string().nullable().optional()
  }).optional(),
  
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères").max(200, "Titre trop long"),
  novelty_type: z.string().min(1, "Type de nouveauté requis"),
  reason: z.string().min(10, "La description doit contenir au moins 10 caractères").max(2000, "Description trop longue"),
  
  images: z.array(z.string().url("URL d'image invalide"))
    .min(1, "Au moins une image requise")
    .max(3, "Maximum 3 images autorisées"),
  brochure_pdf: z.string().url("URL du PDF invalide").optional().nullable(),
  
  stand_info: z.string().optional().nullable(),
  created_by: z.string().min(1, "Utilisateur requis")
});

serve(async (req) => {
  const startTime = Date.now();
  
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    })
  }

  try {
    console.log('🚀 [DEBUT] novelties-create - ', new Date().toISOString());
    
    // 1. Vérification méthode
    if (req.method !== 'POST') {
      console.log('❌ Méthode non autorisée:', req.method);
      return new Response(
        JSON.stringify({ message: 'Méthode non autorisée' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Vérification auth
    const authHeader = req.headers.get('Authorization')
    console.log('🔑 Auth header present:', !!authHeader);
    console.log('🔑 Auth header preview:', authHeader?.substring(0, 20) + '...');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ message: 'Token d\'authentification manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Parse du body avec debug détaillé
    let body;
    let bodyText;
    try {
      bodyText = await req.text();
      console.log('📥 Raw body length:', bodyText.length);
      console.log('📥 Raw body preview:', bodyText.substring(0, 500));
      
      body = JSON.parse(bodyText);
      console.log('📥 Parsed body keys:', Object.keys(body));
      console.log('📥 Body structure:', {
        event_id: typeof body.event_id,
        exhibitor_id: typeof body.exhibitor_id,
        title: typeof body.title,
        novelty_type: typeof body.novelty_type,
        reason: typeof body.reason,
        images: Array.isArray(body.images) ? `array[${body.images.length}]` : typeof body.images,
        brochure_pdf: typeof body.brochure_pdf,
        user: typeof body.user,
        stand_info: typeof body.stand_info,
        created_by: typeof body.created_by
      });
      
    } catch (e) {
      console.error('❌ Erreur parsing JSON:', e.message);
      console.error('📄 Body brut:', bodyText);
      return new Response(
        JSON.stringify({ 
          message: 'Corps de requête JSON invalide',
          error: e.message,
          received: bodyText?.substring(0, 200)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Debug détaillé des champs
    console.log('🔍 [VALIDATION] Analyse détaillée des champs:');
    console.log('- event_id:', {
      value: body.event_id,
      type: typeof body.event_id,
      length: body.event_id?.length,
      valid: typeof body.event_id === 'string' && body.event_id.length > 0
    });
    
    console.log('- exhibitor_id:', {
      value: body.exhibitor_id,
      type: typeof body.exhibitor_id,
      length: body.exhibitor_id?.length,
      valid: typeof body.exhibitor_id === 'string' && body.exhibitor_id.length > 0
    });
    
    console.log('- title:', {
      value: body.title,
      type: typeof body.title,
      length: body.title?.length,
      valid: typeof body.title === 'string' && body.title.length >= 3
    });
    
    console.log('- novelty_type:', {
      value: body.novelty_type,
      type: typeof body.novelty_type,
      valid: typeof body.novelty_type === 'string' && body.novelty_type.length > 0
    });
    
    console.log('- reason:', {
      value: body.reason?.substring(0, 50) + '...',
      type: typeof body.reason,
      length: body.reason?.length,
      valid: typeof body.reason === 'string' && body.reason.length >= 10
    });
    
    console.log('- images:', {
      type: typeof body.images,
      isArray: Array.isArray(body.images),
      length: body.images?.length,
      items: body.images?.map((img, i) => ({
        index: i,
        type: typeof img,
        isUrl: typeof img === 'string' && img.startsWith('http'),
        preview: typeof img === 'string' ? img.substring(0, 50) + '...' : img
      }))
    });
    
    console.log('- brochure_pdf:', {
      value: body.brochure_pdf ? body.brochure_pdf.substring(0, 50) + '...' : null,
      type: typeof body.brochure_pdf,
      isUrl: typeof body.brochure_pdf === 'string' && body.brochure_pdf.startsWith('http')
    });

    console.log('- created_by:', {
      value: body.created_by,
      type: typeof body.created_by,
      valid: typeof body.created_by === 'string' && body.created_by.length > 0
    });

    // 5. Validation Zod avec capture d'erreurs détaillée
    let validatedData;
    try {
      console.log('⚡ [VALIDATION] Début validation Zod...');
      validatedData = noveltyCreateSchema.parse(body);
      console.log('✅ [VALIDATION] Validation Zod réussie');
    } catch (error) {
      console.error('❌ [VALIDATION] Erreur validation Zod:', error);
      
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string[]> = {};
        
        console.log('📋 [VALIDATION] Détail des erreurs Zod:');
        error.errors.forEach((err, index) => {
          console.log(`  ${index + 1}. Path: ${err.path.join('.')} - Message: ${err.message} - Code: ${err.code}`);
          
          const field = err.path.join('.');
          if (!fieldErrors[field]) {
            fieldErrors[field] = [];
          }
          fieldErrors[field].push(err.message);
        });

        return new Response(
          JSON.stringify({
            message: 'Données de validation invalides',
            errors: fieldErrors,
            zodErrors: error.errors,
            receivedData: {
              ...body,
              // Masquer les données sensibles dans les logs
              user: body.user ? { ...body.user, email: '***' } : undefined
            }
          }),
          { 
            status: 422, 
            headers: { 
              ...corsHeaders,
              'Content-Type': 'application/json'
            } 
          }
        );
      }
      
      throw error;
    }

    // 6. Connexion Supabase avec service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 [DB] Vérification événement...');
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('id, nom_event, visible')
      .eq('id', validatedData.event_id)
      .single();

    if (eventError) {
      console.error('❌ [DB] Erreur requête événement:', eventError);
      return new Response(
        JSON.stringify({ 
          message: 'Erreur lors de la vérification de l\'événement',
          error: eventError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!event) {
      console.error('❌ [DB] Événement introuvable:', validatedData.event_id);
      return new Response(
        JSON.stringify({ message: 'Événement introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [DB] Événement trouvé:', event.nom_event);

    if (!event.visible) {
      console.error('❌ [DB] Événement non visible:', event.id);
      return new Response(
        JSON.stringify({ message: 'Événement non accessible' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Vérification exposant
    console.log('🔍 [DB] Vérification exposant...');
    const { data: exhibitor, error: exhibitorError } = await supabaseClient
      .from('exhibitors')
      .select('id, name, approved')
      .eq('id', validatedData.exhibitor_id)
      .single();

    if (exhibitorError || !exhibitor) {
      console.error('❌ [DB] Exposant introuvable:', validatedData.exhibitor_id, exhibitorError);
      return new Response(
        JSON.stringify({ message: 'Exposant introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [DB] Exposant trouvé:', exhibitor.name);

    // 8. Déterminer le statut basé sur l'approbation de l'exposant
    const status = exhibitor.approved ? 'published' : 'pending';
    console.log('📊 [STATUS] Statut de la nouveauté:', status);

    // 9. Création de la nouveauté
    const noveltyData = {
      event_id: validatedData.event_id,
      exhibitor_id: validatedData.exhibitor_id,
      title: validatedData.title,
      type: validatedData.novelty_type,
      reason_1: validatedData.reason,
      images: validatedData.images,
      brochure_pdf_url: validatedData.brochure_pdf,
      stand_info: validatedData.stand_info,
      status: status,
      created_by: validatedData.created_by,
      created_at: new Date().toISOString(),
      images_count: validatedData.images?.length || 0
    };

    console.log('💾 [DB] Création nouveauté avec data:', {
      ...noveltyData,
      reason_1: noveltyData.reason_1.substring(0, 50) + '...',
      images: `${noveltyData.images.length} images`
    });

    const { data: novelty, error: createError } = await supabaseClient
      .from('novelties')
      .insert(noveltyData)
      .select(`
        *,
        exhibitors!inner(id, name, slug, logo_url, approved)
      `)
      .single();

    if (createError) {
      console.error('❌ [DB] Erreur création nouveauté:', createError);
      return new Response(
        JSON.stringify({ 
          message: 'Erreur lors de la création de la nouveauté',
          error: createError.message,
          details: createError
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [DB] Nouveauté créée avec ID:', novelty.id);

    // 10. Initialiser les statistiques
    await supabaseClient
      .from('novelty_stats')
      .insert({
        novelty_id: novelty.id,
        likes: 0,
        saves: 0,
        resource_downloads: 0,
        meeting_requests: 0
      });

    const duration = Date.now() - startTime;
    console.log(`🏁 [FIN] novelties-create réussie en ${duration}ms`);

    return new Response(
      JSON.stringify({
        message: 'Nouveauté créée avec succès',
        novelty: novelty
      }),
      { 
        status: 201, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`🚨 [ERREUR] novelties-create échouée après ${duration}ms:`, error);
    
    return new Response(
      JSON.stringify({
        message: 'Erreur interne du serveur',
        error: error.message,
        stack: error.stack?.substring(0, 500)
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  }
});