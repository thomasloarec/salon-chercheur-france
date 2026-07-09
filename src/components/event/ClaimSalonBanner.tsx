import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BadgeCheck, Clock, ShieldCheck } from 'lucide-react';
import type { Event } from '@/types/event';

interface ClaimSalonBannerProps {
  event: Event;
}

const ClaimSalonBanner = ({ event }: ClaimSalonBannerProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [justRequested, setJustRequested] = useState(false);

  const ownerId = event.owner_user_id ?? null;
  const isOwner = !!user && ownerId === user.id;
  const claimedByOther = !!ownerId && ownerId !== user?.id;

  // Existing pending claim for the current user (RLS-safe).
  const { data: existingClaim } = useQuery({
    queryKey: ['event-claim-status', event.id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('event_claim_requests')
        .select('id, status')
        .eq('event_id', event.id)
        .eq('requester_user_id', user.id)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user && !ownerId,
  });

  // Salon already managed by someone else → show nothing.
  if (claimedByOther) return null;

  // Current user is the owner → discreet indicator, no claim button.
  if (isOwner) {
    return (
      <div className="rounded-lg bg-muted px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
        <span>Vous gérez ce salon.</span>
      </div>
    );
  }

  const pending = justRequested || existingClaim?.status === 'pending';

  const handleClaim = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('event-claim-manage', {
        body: { action: 'create', event_id: event.id },
      });
      if (error) throw error;
      setJustRequested(true);
      toast.success(data?.message || 'Votre demande a bien été envoyée.');
      queryClient.invalidateQueries({ queryKey: ['event-claim-status', event.id, user.id] });
    } catch (err: any) {
      toast.error(err?.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg bg-muted px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">Vous organisez ce salon ?</span>
      {pending ? (
        <Button variant="outline" size="sm" disabled>
          <Clock className="h-3.5 w-3.5 mr-1.5" />
          Demande de revendication en cours
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={handleClaim} disabled={submitting}>
          <BadgeCheck className="h-3.5 w-3.5 mr-1.5" />
          {submitting ? 'Envoi…' : 'Revendiquer cette page'}
        </Button>
      )}
    </div>
  );
};

export default ClaimSalonBanner;
