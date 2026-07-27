import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendResendEmail } from "../_shared/resend.ts";
import { renderEmailShell, heading, paragraph } from "../_shared/email-template.ts";

const schema = z.object({
  novelty_id: z.string().uuid(),
  next_status: z.enum(['under_review', 'published', 'rejected']),
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("[novelties-moderate] Missing env vars");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: corsHeaders() }
      );
    }

    // Admin client with service role (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Auth client to validate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error("[novelties-moderate] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    // Check if user is admin
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !userRoles) {
      console.error("[novelties-moderate] Not admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin role required" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const parsed = schema.safeParse(body);
    
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      console.error("[novelties-moderate] Validation error:", flat);
      return new Response(
        JSON.stringify({ 
          error: "Validation error", 
          details: flat.fieldErrors 
        }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const { novelty_id, next_status } = parsed.data;

    console.log(`[novelties-moderate] Admin ${user.id} updating novelty ${novelty_id} to ${next_status}`);

    // Récupérer la nouveauté actuelle pour vérifier s'il y a un exposant en attente
    const { data: novelty, error: fetchError } = await supabaseAdmin
      .from('novelties')
      .select('id, pending_exhibitor_id, exhibitor_id, created_by, event_id, stand_info, status, title, slug')
      .eq('id', novelty_id)
      .single();

    if (fetchError || !novelty) {
      console.error("[novelties-moderate] Novelty not found:", novelty_id, fetchError);
      return new Response(
        JSON.stringify({ error: "Novelty not found" }),
        { status: 404, headers: corsHeaders() }
      );
    }

    // Statut AVANT modification (sert à ne notifier que sur une vraie transition).
    const previousStatus: string | null = (novelty as any).status ?? null;

    // Update novelty status using service role (bypasses RLS)
    const { error: updateError } = await supabaseAdmin
      .from('novelties')
      .update({
        status: next_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', novelty_id);

    if (updateError) {
      console.error("[novelties-moderate] Update error:", updateError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to update novelty status",
          details: updateError.message 
        }),
        { status: 500, headers: corsHeaders() }
      );
    }

    console.log(`[novelties-moderate] Success: novelty ${novelty_id} → ${next_status}`);

    // ============================================
    // SI PUBLICATION: Approuver l'exposant en attente ET créer la participation
    // ============================================
    let exhibitorApproved = false;
    let participationCreated = false;
    let teamPromoted = false;
    let verifiedAtSet = false;
    
    if (next_status === 'published' && novelty.pending_exhibitor_id) {
      console.log(`[novelties-moderate] Approving pending exhibitor: ${novelty.pending_exhibitor_id}`);
      
      const { error: approveError } = await supabaseAdmin
        .from('exhibitors')
        .update({ 
          approved: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', novelty.pending_exhibitor_id);

      if (approveError) {
        console.error("[novelties-moderate] Failed to approve exhibitor:", approveError);
        // On ne fait pas échouer la modération pour ça, mais on log l'erreur
      } else {
        exhibitorApproved = true;
        console.log(`[novelties-moderate] Exhibitor ${novelty.pending_exhibitor_id} approved`);

        // NOTE: No auto-promotion of the novelty creator as owner.
        // Ownership/verified_at must only be granted via an explicitly approved
        // claim request (see exhibitors-manage `approve_claim`). Publishing a
        // novelty on behalf of a company must NOT make the creator its admin.
        
        // ✅ CRÉER LA PARTICIPATION maintenant que la nouveauté est publiée
        // Récupérer les infos de l'exposant et de l'événement
        const { data: exhibitorData } = await supabaseAdmin
          .from('exhibitors')
          .select('website, stand_info')
          .eq('id', novelty.pending_exhibitor_id)
          .single();
        
        const { data: noveltyData } = await supabaseAdmin
          .from('novelties')
          .select('event_id')
          .eq('id', novelty_id)
          .single();

        if (noveltyData?.event_id) {
          // Récupérer l'id_event_text depuis events
          const { data: eventData } = await supabaseAdmin
            .from('events')
            .select('id_event')
            .eq('id', noveltyData.event_id)
            .single();

          // Vérifier si une participation existe déjà
          const { data: existingParticipation } = await supabaseAdmin
            .from('participation')
            .select('id_participation')
            .eq('exhibitor_id', novelty.pending_exhibitor_id)
            .eq('id_event', noveltyData.event_id)
            .maybeSingle();

          if (!existingParticipation) {
            const { error: participationError } = await supabaseAdmin
              .from('participation')
              .insert({
                id_exposant: novelty.pending_exhibitor_id,
                exhibitor_id: novelty.pending_exhibitor_id,
                id_event: noveltyData.event_id,
                id_event_text: eventData?.id_event || null,
                website_exposant: exhibitorData?.website || null,
                stand_exposant: novelty.stand_info || exhibitorData?.stand_info || null,
                urlexpo_event: null
              });

            if (participationError) {
              console.error("[novelties-moderate] Failed to create participation:", participationError);
            } else {
              participationCreated = true;
              console.log(`[novelties-moderate] Participation created for exhibitor ${novelty.pending_exhibitor_id} on event ${noveltyData.event_id}`);
            }
          } else {
            console.log(`[novelties-moderate] Participation already exists for exhibitor ${novelty.pending_exhibitor_id}`);
            participationCreated = true;
          }
        }
        
        // Nettoyer le champ pending_exhibitor_id
        await supabaseAdmin
          .from('novelties')
          .update({ pending_exhibitor_id: null })
          .eq('id', novelty_id);
      }
    }

    // Si rejet et qu'il y avait un exposant en attente, on pourrait le supprimer
    // Mais pour l'instant on le laisse (l'admin peut le supprimer manuellement)
    if (next_status === 'rejected' && novelty.pending_exhibitor_id) {
      console.log(`[novelties-moderate] Note: Novelty rejected but pending exhibitor ${novelty.pending_exhibitor_id} kept for review`);
    }

    // ============================================
    // SI PUBLICATION + exposant existant (non pending) + stand_info fourni
    // → on force le numéro de stand de la participation à la valeur saisie
    //   dans le formulaire de nouveauté. Ce n'est appliqué qu'à l'approbation
    //   pour éviter qu'un spam non validé n'écrase la donnée publiée.
    // ============================================
    if (
      next_status === 'published' &&
      !novelty.pending_exhibitor_id &&
      novelty.exhibitor_id &&
      novelty.event_id &&
      novelty.stand_info &&
      novelty.stand_info.trim().length > 0
    ) {
      const newStand = novelty.stand_info.trim();
      const { data: updatedRows, error: standUpdateError } = await supabaseAdmin
        .from('participation')
        .update({ stand_exposant: newStand })
        .eq('exhibitor_id', novelty.exhibitor_id)
        .eq('id_event', novelty.event_id)
        .select('id_participation');

      if (standUpdateError) {
        console.error('[novelties-moderate] Failed to update participation stand:', standUpdateError);
      } else {
        console.log(`[novelties-moderate] Stand updated to "${newStand}" on ${updatedRows?.length ?? 0} participation row(s)`);
      }
    }
    
    // ============================================
    // NOTIFICATION AU CRÉATEUR (email transactionnel Resend)
    // Additif et JAMAIS bloquant.
    // ============================================
    if (
      previousStatus !== next_status &&
      (next_status === 'published' || next_status === 'rejected')
    ) {
      try {
        const PUBLIC_SITE_URL = 'https://lotexpo.com';
        const ADMIN_CONTACT_EMAIL = 'admin@lotexpo.com';

        let recipientUserId: string | null = novelty.created_by ?? null;
        if (!recipientUserId && novelty.exhibitor_id) {
          const { data: exOwner } = await supabaseAdmin
            .from('exhibitors')
            .select('owner_user_id')
            .eq('id', novelty.exhibitor_id)
            .maybeSingle();
          recipientUserId = exOwner?.owner_user_id ?? null;
        }

        if (!recipientUserId) {
          console.warn(`[novelties-moderate] Aucun destinataire pour la nouveauté ${novelty_id}, email ignoré`);
        } else {
          const { data: recipientAuth } = await supabaseAdmin.auth.admin.getUserById(recipientUserId);
          const recipientEmail = recipientAuth?.user?.email ?? null;

          if (!recipientEmail) {
            console.warn(`[novelties-moderate] Aucun email pour l'utilisateur ${recipientUserId}, email ignoré`);
          } else {
            const noveltyTitle =
              novelty.title && String(novelty.title).trim().length > 0
                ? String(novelty.title).trim()
                : 'votre nouveauté';

            let eventName = '';
            if (novelty.event_id) {
              const { data: evRow } = await supabaseAdmin
                .from('events')
                .select('nom_event')
                .eq('id', novelty.event_id)
                .maybeSingle();
              eventName = evRow?.nom_event ? String(evRow.nom_event) : '';
            }

            let subject: string;
            let html: string;

            if (next_status === 'published') {
              const noveltyUrl = novelty.slug
                ? `${PUBLIC_SITE_URL}/nouveautes/${novelty.slug}`
                : `${PUBLIC_SITE_URL}/nouveautes`;

              subject = `Votre nouveauté « ${noveltyTitle} » est en ligne sur Lotexpo`;
              html = renderEmailShell({
                title: subject,
                preheader: `« ${noveltyTitle} » est désormais publiée sur Lotexpo.`,
                bodyBlocks: [
                  heading(`Votre nouveauté est publiée 🎉`),
                  paragraph(
                    `Bonne nouvelle : votre nouveauté <strong>${noveltyTitle}</strong> a été validée par notre équipe et est maintenant visible publiquement sur Lotexpo${eventName ? `, auprès des visiteurs du salon <strong>${eventName}</strong>` : ''}.`
                  ),
                  paragraph(
                    `Les nouveautés publiées génèrent des contacts qualifiés auprès des visiteurs avant même le salon. Partagez la vôtre pour lui donner un maximum de visibilité.`
                  ),
                ],
                cta: { label: `Voir ma nouveauté`, href: noveltyUrl },
                footer: { extraHtml: `Ou copiez ce lien : ${noveltyUrl}` },
              });
            } else {
              const mailtoHref = `mailto:${ADMIN_CONTACT_EMAIL}?subject=${encodeURIComponent(
                `Nouveauté non retenue : ${noveltyTitle}`
              )}`;

              subject = `Votre nouveauté « ${noveltyTitle} » n'a pas été retenue`;
              html = renderEmailShell({
                title: subject,
                preheader: `Votre nouveauté ${noveltyTitle} n'a pas été validée pour le moment.`,
                bodyBlocks: [
                  heading(`Votre nouveauté n'a pas été validée`),
                  paragraph(
                    `Après examen par notre équipe, votre nouveauté <strong>${noveltyTitle}</strong> n'a pas été retenue pour publication sur Lotexpo pour le moment.`
                  ),
                  paragraph(
                    `Vous souhaitez comprendre cette décision, ou ajuster votre nouveauté pour la soumettre à nouveau ? Écrivez-nous à <strong>${ADMIN_CONTACT_EMAIL}</strong> : nous vous répondrons avec plaisir.`
                  ),
                ],
                cta: { label: `Contacter Lotexpo`, href: mailtoHref },
                footer: { extraHtml: `Vous pouvez nous joindre directement à ${ADMIN_CONTACT_EMAIL}` },
              });
            }

            try {
              const { id: emailId } = await sendResendEmail({ to: recipientEmail, subject, html });
              console.log(`[novelties-moderate] Email "${next_status}" envoyé à ${recipientEmail} (${emailId})`);
            } catch (sendErr) {
              console.error('[novelties-moderate] Echec envoi Resend (non bloquant) :', sendErr);
            }
          }
        }
      } catch (emailBlockErr) {
        console.error('[novelties-moderate] Bloc email en échec (non bloquant) :', emailBlockErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        ok: true,
        novelty_id,
        status: next_status,
        exhibitor_approved: exhibitorApproved,
        participation_created: participationCreated,
        team_promoted: teamPromoted,
        verified_at_set: verifiedAtSet,
        pending_exhibitor_id: novelty.pending_exhibitor_id
      }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (e) {
    console.error("[novelties-moderate] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: corsHeaders() }
    );
  }
});
