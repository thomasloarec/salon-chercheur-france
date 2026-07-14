import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Users, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEventScorecard } from '@/hooks/useEventScorecard';

interface Props {
  event: { id: string; slug?: string; nom_event: string };
}

const OrganizerActivationKit: React.FC<Props> = ({ event }) => {
  const trackedLink = useMemo(
    () =>
      `https://lotexpo.com/events/${event.slug}?utm_source=organisateur&utm_medium=email&utm_campaign=${event.slug}`,
    [event.slug]
  );

  const { data: scorecard, isLoading: scLoading } = useEventScorecard(event.id);
  const completude = (scorecard as any)?.completude;
  const exposantsReferences = completude?.exposants_references ?? 0;
  const exposantsRevendiques = completude?.exposants_revendiques ?? 0;

  const { data: noveltiesCount, isLoading: nvLoading } = useQuery({
    queryKey: ['organizer-activation-novelties', event.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('novelties')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'published');
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<number | null>(null);

  const copy = async (text: string, onCopied: () => void, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied();
      toast.success(label);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const email1Subject = `${event.nom_event} — mettez en avant votre présence`;
  const email1Body = `Bonjour,

Vous exposez à ${event.nom_event}, et les visiteurs professionnels préparent déjà leur venue sur Lotexpo. Ils y recherchent les exposants et leurs nouveautés avant l'événement.

Prenez quelques minutes pour compléter votre présence :

Revendiquez et complétez votre fiche exposant.

Publiez vos nouveautés (produits, démonstrations, temps forts) pour être repéré en amont.

C'est gratuit, et cela renforce votre visibilité auprès des visiteurs qui préparent ${event.nom_event}.

Votre page salon : ${trackedLink}

Bien cordialement,
L'équipe ${event.nom_event}`;

  const email2Subject = `Plus que quelques semaines avant ${event.nom_event}`;
  const email2Body = `Bonjour,

${event.nom_event} approche, et les visiteurs affinent leur programme de visite en ce moment même.

Si ce n'est pas encore fait, complétez votre fiche exposant et publiez vos nouveautés sur Lotexpo. C'est gratuit et rapide, et cela vous rend visible avant l'événement.

Votre page salon : ${trackedLink}

À très bientôt sur ${event.nom_event},
L'équipe ${event.nom_event}`;

  const emails = [
    { key: 1, label: 'Email 1 — Annonce initiale', subject: email1Subject, body: email1Body },
    { key: 2, label: 'Email 2 — Relance J-30', subject: email2Subject, body: email2Body },
  ];

  return (
    <Card className="p-6 space-y-6">
      <p className="text-sm text-muted-foreground">
        Invitez vos exposants à compléter leur fiche et à publier leurs nouveautés. Plus ils sont actifs, plus votre salon gagne en visibilité auprès des visiteurs.
      </p>

      {/* Compteurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Pages revendiquées</span>
          </div>
          <div className="mt-1 text-sm">
            {scLoading ? (
              <Skeleton className="h-5 w-32" />
            ) : (
              <>
                <span className="text-lg font-semibold">
                  {exposantsRevendiques} / {exposantsReferences}
                </span>{' '}
                <span className="text-muted-foreground text-xs">
                  de vos exposants ont revendiqué leur page
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Sans revendication, vos exposants n'apparaissent pas pleinement sur Lotexpo.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>Nouveautés publiées</span>
          </div>
          <div className="mt-1 text-sm">
            {nvLoading ? (
              <Skeleton className="h-5 w-32" />
            ) : (
              <>
                <span className="text-lg font-semibold">{noveltiesCount ?? 0}</span>{' '}
                <span className="text-muted-foreground text-xs">
                  nouveautés publiées par vos exposants
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lien traqué */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Lien à partager</label>
        <div className="flex gap-2">
          <Input readOnly value={trackedLink} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button
            variant="outline"
            onClick={() => copy(trackedLink, () => {
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }, 'Lien copié')}
          >
            {copiedLink ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
            Copier le lien
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Partagez ce lien à vos exposants ; il nous permet de mesurer l'activation générée par votre salon.
        </p>
      </div>

      {/* Emails prêts à copier */}
      <div className="space-y-4">
        {emails.map((em) => (
          <div key={em.key} className="rounded-md border p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="text-sm font-semibold">{em.label}</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copy(
                    `Objet : ${em.subject}\n\n${em.body}`,
                    () => {
                      setCopiedEmail(em.key);
                      setTimeout(() => setCopiedEmail((v) => (v === em.key ? null : v)), 2000);
                    },
                    'Email copié'
                  )
                }
              >
                {copiedEmail === em.key ? (
                  <Check className="h-4 w-4 mr-1.5" />
                ) : (
                  <Copy className="h-4 w-4 mr-1.5" />
                )}
                Copier l'email
              </Button>
            </div>
            <div className="text-xs">
              <p className="font-medium text-foreground">Objet : {em.subject}</p>
            </div>
            <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80 leading-relaxed">
{em.body}
            </pre>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default OrganizerActivationKit;