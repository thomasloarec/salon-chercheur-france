import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { clearPendingClaim, readPendingClaim } from './claim';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PARAM_RE = new RegExp(`^(${UUID})\\.(${UUID})$`, 'i');

/** Aucun rendu. Rattache au compte l'assistant créé en session anonyme, une fois connecté. */
export default function AssistantClaimHandler() {
  const { isRealUser, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    if (!isRealUser || !session || done.current) return;

    const params = new URLSearchParams(location.search);
    const m = (params.get('claim') ?? '').match(PARAM_RE);
    const pending = m ? { profile_id: m[1], claim_token: m[2] } : readPendingClaim();
    if (!pending) return;
    done.current = true;

    const cleanUrl = (alsoAssistant: boolean) => {
      const p = new URLSearchParams(window.location.search);
      if (!p.has('claim') && !(alsoAssistant && p.has('assistant'))) return;
      p.delete('claim');
      if (alsoAssistant) p.delete('assistant');
      const qs = p.toString();
      navigate(`${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`, { replace: true });
    };

    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('assistant_claim_profile', {
          p_profile_id: pending.profile_id,
          p_claim_token: pending.claim_token,
        });
        if (error) throw error;
        const res = (typeof data === 'string' ? JSON.parse(data) : data) ?? {};
        clearPendingClaim();
        if (res.ok) {
          cleanUrl(true);
          await qc.invalidateQueries({ queryKey: ['assistant-feed'] });
          const feeds = qc.getQueriesData<any>({ queryKey: ['assistant-feed'] });
          const optIn = feeds.some(([, d]) => d?.profile?.email_alerts_opt_in === true);
          toast({
            title: 'Votre assistant veille',
            description: optIn
              ? 'Je relis les salons pour vous. Je vous écris dès que quelque chose vaut le déplacement.'
              : 'Je relis les salons pour vous. Mes suggestions arrivent dans votre agenda.',
          });
        } else {
          cleanUrl(false);
          console.warn('[assistant] rattachement refusé', res);
        }
      } catch (e) {
        clearPendingClaim();
        cleanUrl(false);
        console.warn('[assistant] rattachement impossible', e);
      }
    })();
  }, [isRealUser, session, location.search, navigate, qc]);

  return null;
}
