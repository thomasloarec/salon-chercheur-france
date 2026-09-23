import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import Header from '@/components/Header';
import Footer from '@/components/Footer';

import { supabase } from '@/integrations/supabase/client';
import { track } from '@/lib/analytics';
import { InvitationInactiveView, InvitationPageView } from '@/components/invitation/InvitationPageView';
import type { InvitationPageData, MeetingRequestInput, MeetingRequestResult } from '@/components/invitation/types';

/**
 * Page publique d'invitation exposant : /invitation/:slug (lot 5).
 * Données : RPC get_invitation_page (ouverte à anon, lot 1 + lot 4).
 * Envoi : edge leads-create forme B avec invitation_slug (lot 2).
 * Non indexée (décision D5). Aperçu LinkedIn servi aux robots par /api/invitation-og (lot 6).
 */
export default function InvitationPublic() {
  const { slug = '' } = useParams<{ slug: string }>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['invitation-page', slug],
    queryFn: async (): Promise<InvitationPageData> => {
      const { data, error } = await supabase.rpc('get_invitation_page' as never, { p_slug: slug } as never);
      if (error) throw error;
      return data as unknown as InvitationPageData;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data) track('invitation_page_view', { slug, active: data.active, reason: data.reason });
  }, [data, slug]);

  const submit = async (input: MeetingRequestInput): Promise<MeetingRequestResult> => {
    if (!data?.exhibitor?.id || !data.event?.id) return 'error';
    const { data: res, error } = await supabase.functions.invoke('leads-create', {
      body: {
        lead_type: 'meeting_request',
        exhibitor_ref: data.exhibitor.id,
        event_id: data.event.id,
        invitation_slug: slug,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        email: input.email.trim(),
        company: input.company.trim() || undefined,
        role: input.role.trim() || undefined,
        phone: input.phone.trim() || undefined,
        notes: input.notes.trim() || undefined,
        preferred_slot: input.preferred_slot ?? undefined,
      },
    });

    if (error) {
      const status = (error as { context?: { status?: number } })?.context?.status;
      track('invitation_request_failed', { slug, status: status ?? null });
      // 403 : invitation plus active ou exposant plus éligible.
      return status === 403 ? 'inactive' : 'error';
    }
    const result: MeetingRequestResult = (res as { duplicate?: boolean })?.duplicate ? 'duplicate' : 'created';
    track('invitation_request_sent', { slug, duplicate: result === 'duplicate', has_slot: !!input.preferred_slot });
    return result;
  };

  const title = data?.active
    ? `${data.exhibitor?.name} vous invite sur ${data.event?.name}`
    : 'Invitation | Lotexpo';
  const description = data?.active
    ? `${data.novelty?.title ? `${data.novelty.title}. ` : ''}Réservez votre rendez-vous sur le stand${data.stand ? ` ${data.stand}` : ''}.`
    : undefined;

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="robots" content="noindex, nofollow" />
        {description && <meta name="description" content={description} />}
        <meta property="og:title" content={title} />
        {description && <meta property="og:description" content={description} />}
      </Helmet>

      {isLoading ? (
        // Chargement neutre : on ne sait pas encore si la page est active (sans menu) ou non (avec menu).
        <div className="min-h-screen flex items-center justify-center bg-surface-inverse">
          <Loader2 className="h-8 w-8 animate-spin text-inverse-primary" aria-label="Chargement" />
        </div>
      ) : data?.active ? (
        // Page d'invitation active : mise en page dédiée (hero + pied propres), validée telle quelle.
        <InvitationPageView data={data} onSubmit={submit} />
      ) : (
        // Erreur, lien introuvable ou page inactive : menu et pied du site.
        <div className="min-h-screen bg-background flex flex-col">
          <Header />
          <main className="flex-1">
            {isError || !data ? (
              <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
                <p className="text-muted-foreground">Impossible de charger cette invitation pour le moment.</p>
                <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-primary hover:underline">
                  Réessayer
                </button>
              </div>
            ) : (
              <InvitationInactiveView data={data} />
            )}
          </main>
          <Footer />
        </div>
      )}
    </>
  );
}
