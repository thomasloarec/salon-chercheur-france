import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  ArrowLeftRight,
  ExternalLink,
  Info,
  Trophy,
  Globe,
  Linkedin,
} from 'lucide-react';

type IdentitySide = {
  public_identity_id: string;
  public_slug: string;
  display_name: string;
  source_type: string;
  exhibitor_id: string | null;
  legacy_exposant_id: string | null;
  website: string | null;
  linkedin_url: string | null;
  is_claimed: boolean;
  is_verified: boolean;
  seo_indexable: boolean;
};

type MergePreview = {
  preview_only: boolean;
  message: string;
  winner: IdentitySide;
  loser: IdentitySide;
  participations: {
    winner_participations: number;
    loser_participations: number;
    participations_to_repoint: number;
    potential_duplicate_participations: number;
    common_events: number;
  };
  seo: {
    winner_slug_kept: string;
    loser_slug_to_redirect: string;
    winner_website: string | null;
    loser_website: string | null;
    loser_in_sitemap: boolean;
    winner_in_sitemap: boolean;
    duplicate_content_risk: 'high' | 'medium' | 'low';
    proposed_future_canonical: string;
    recommended_future_canonical: string;
  };
  novelties: {
    winner_novelties: number;
    loser_novelties: number;
    winner_published_novelties: number;
    loser_published_novelties: number;
    conflict: boolean;
    note: string;
  };
  claim: {
    winner_claimed: boolean;
    loser_claimed: boolean;
    conflict_signal: string;
    has_conflict: boolean;
  };
  analytics: {
    winner_analytics_events: number;
    loser_analytics_events: number;
    note: string;
  };
  recommendation: {
    recommended_winner_identity_id: string;
    recommended_matches_proposed: boolean;
    reasons: string[];
  };
};

const CLAIM_SIGNAL_LABELS: Record<string, string> = {
  no_owner_conflict: 'Aucun gestionnaire',
  winner_claimed_only: 'Gagnant revendiqué uniquement',
  loser_claimed_only: 'Perdant revendiqué uniquement',
  both_claimed_same_owner: 'Revendiqués par le même gestionnaire',
  both_claimed_overlapping_owners: 'Gestionnaires partiellement communs',
  both_claimed_different_owner: 'Gestionnaires différents',
};

const REASON_LABELS: Record<string, string> = {
  claimed: 'Fiche revendiquée',
  verified: 'Fiche vérifiée',
  source_modern_or_linked: 'Source modern/linked',
  more_future_participations: 'Plus de participations futures',
  seo_indexable: 'Indexable (sitemap)',
  cleaner_slug: 'Slug plus propre',
};

const SideCard: React.FC<{ side: IdentitySide; role: 'winner' | 'loser' }> = ({ side, role }) => (
  <div
    className={`flex-1 min-w-0 rounded-lg border p-3 space-y-2 ${
      role === 'winner' ? 'border-primary bg-primary/5' : 'bg-muted/30'
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1 text-xs font-semibold">
        {role === 'winner' ? (
          <>
            <Trophy className="h-3.5 w-3.5 text-primary" /> Gagnant proposé
          </>
        ) : (
          'Perdant proposé'
        )}
      </span>
      <Badge variant="outline" className="text-[10px]">
        {side.source_type}
      </Badge>
    </div>
    <p className="font-medium leading-tight break-words">{side.display_name}</p>
    <p className="text-xs text-muted-foreground break-all">/{side.public_slug}</p>
    <div className="flex flex-wrap gap-1.5">
      {side.is_claimed && <Badge variant="secondary" className="text-[10px]">Revendiquée</Badge>}
      {side.is_verified && <Badge variant="secondary" className="text-[10px]">Vérifiée</Badge>}
      <Badge variant={side.seo_indexable ? 'default' : 'outline'} className="text-[10px]">
        {side.seo_indexable ? 'Indexable' : 'Non indexable'}
      </Badge>
    </div>
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <a
        href={`/exposants/${side.public_slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Page publique
      </a>
      {side.website && (
        <a
          href={side.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <Globe className="h-3 w-3" />
          Site
        </a>
      )}
      {side.linkedin_url && (
        <a
          href={side.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <Linkedin className="h-3 w-3" />
          LinkedIn
        </a>
      )}
    </div>
  </div>
);

const StatRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 py-1 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value}</span>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-lg border p-3">
    <h4 className="text-sm font-semibold mb-1">{title}</h4>
    <div className="divide-y divide-border/50">{children}</div>
  </div>
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** initial winner / loser identity ids (proposed) */
  aId: string;
  bId: string;
  aName: string;
  bName: string;
}

const MergePreviewDialog: React.FC<Props> = ({ open, onOpenChange, aId, bId, aName, bName }) => {
  // proposed winner = first id by default; swappable
  const [winnerId, setWinnerId] = useState(aId);
  const [loserId, setLoserId] = useState(bId);

  useEffect(() => {
    if (open) {
      setWinnerId(aId);
      setLoserId(bId);
    }
  }, [open, aId, bId]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['merge-preview', winnerId, loserId],
    enabled: open && !!winnerId && !!loserId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>)('preview_exhibitor_identity_merge', {
        p_winner_identity_id: winnerId,
        p_loser_identity_id: loserId,
      });
      if (error) throw error;
      return data as MergePreview;
    },
  });

  const swap = () => {
    setWinnerId(loserId);
    setLoserId(winnerId);
  };

  const warnings: string[] = [];
  if (data) {
    if (data.claim.has_conflict) {
      warnings.push('Les deux fiches sont revendiquées par des gestionnaires non identiques.');
    }
    if (data.novelties.conflict) {
      warnings.push('Les deux fiches ont des nouveautés.');
    }
    if (data.participations.common_events > 0) {
      warnings.push(
        `${data.participations.common_events} événement(s) commun(s) — ${data.participations.potential_duplicate_participations} participation(s) potentiellement en doublon.`,
      );
    }
    if (data.seo.winner_in_sitemap && data.seo.loser_in_sitemap) {
      warnings.push('Les deux URLs sont actuellement indexables (risque de contenu dupliqué).');
    }
    if (data.seo.loser_in_sitemap) {
      warnings.push('Le slug perdant est actuellement indexé — perte potentielle d’un slug indexé.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prévisualisation de fusion</DialogTitle>
          <DialogDescription>
            Prévisualisation uniquement — aucune donnée ne sera modifiée.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground truncate">
              {aName} ↔ {bName}
            </p>
            <Button variant="outline" size="sm" onClick={swap} className="gap-2 shrink-0">
              <ArrowLeftRight className="h-4 w-4" />
              Inverser gagnant/perdant
            </Button>
          </div>

          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {isError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : 'Prévisualisation impossible.'}
              </AlertDescription>
            </Alert>
          )}

          {data && (
            <>
              <div className="flex flex-col gap-3 sm:flex-row">
                <SideCard side={data.winner} role="winner" />
                <SideCard side={data.loser} role="loser" />
              </div>

              {/* Recommendation */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>
                  Recommandation{' '}
                  {data.recommendation.recommended_matches_proposed
                    ? '(= gagnant proposé)'
                    : '(≠ gagnant proposé)'}
                </AlertTitle>
                <AlertDescription>
                  <span className="block mb-1">
                    Gagnant recommandé :{' '}
                    <strong>
                      {data.recommendation.recommended_winner_identity_id === data.winner.public_identity_id
                        ? data.winner.display_name
                        : data.loser.display_name}
                    </strong>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {data.recommendation.reasons.length === 0 && (
                      <span className="text-muted-foreground">Aucun signal distinctif fort.</span>
                    )}
                    {data.recommendation.reasons.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px]">
                        {REASON_LABELS[r] ?? r}
                      </Badge>
                    ))}
                  </span>
                </AlertDescription>
              </Alert>

              {/* Warnings */}
              {warnings.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Points de vigilance</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-1">
                      {warnings.map((wn, i) => (
                        <li key={i}>{wn}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Section title="Participations">
                  <StatRow label="Gagnant" value={data.participations.winner_participations} />
                  <StatRow label="Perdant" value={data.participations.loser_participations} />
                  <StatRow label="À repointer" value={data.participations.participations_to_repoint} />
                  <StatRow label="Événements communs" value={data.participations.common_events} />
                  <StatRow
                    label="Doublons potentiels"
                    value={data.participations.potential_duplicate_participations}
                  />
                </Section>

                <Section title="SEO">
                  <StatRow label="Slug conservé" value={`/${data.seo.winner_slug_kept}`} />
                  <StatRow label="Slug à rediriger" value={`/${data.seo.loser_slug_to_redirect}`} />
                  <StatRow
                    label="Risque duplicate content"
                    value={
                      <Badge
                        variant={
                          data.seo.duplicate_content_risk === 'high'
                            ? 'destructive'
                            : data.seo.duplicate_content_risk === 'medium'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="text-[10px]"
                      >
                        {data.seo.duplicate_content_risk}
                      </Badge>
                    }
                  />
                  <StatRow label="Gagnant indexable" value={data.seo.winner_in_sitemap ? 'Oui' : 'Non'} />
                  <StatRow label="Perdant indexable" value={data.seo.loser_in_sitemap ? 'Oui' : 'Non'} />
                  <StatRow
                    label="Canonical proposé"
                    value={<span className="text-xs break-all">{data.seo.proposed_future_canonical}</span>}
                  />
                  <StatRow
                    label="Canonical recommandé"
                    value={<span className="text-xs break-all">{data.seo.recommended_future_canonical}</span>}
                  />
                </Section>

                <Section title="Nouveautés">
                  <StatRow
                    label="Gagnant (publiées / total)"
                    value={`${data.novelties.winner_published_novelties} / ${data.novelties.winner_novelties}`}
                  />
                  <StatRow
                    label="Perdant (publiées / total)"
                    value={`${data.novelties.loser_published_novelties} / ${data.novelties.loser_novelties}`}
                  />
                  <StatRow
                    label="Conflit"
                    value={data.novelties.conflict ? 'Oui' : 'Non'}
                  />
                  <p className="pt-1 text-xs text-muted-foreground">{data.novelties.note}</p>
                </Section>

                <Section title="Gestionnaire & Analytics">
                  <StatRow
                    label="Signal de conflit"
                    value={
                      <Badge
                        variant={data.claim.has_conflict ? 'destructive' : 'outline'}
                        className="text-[10px]"
                      >
                        {CLAIM_SIGNAL_LABELS[data.claim.conflict_signal] ?? data.claim.conflict_signal}
                      </Badge>
                    }
                  />
                  <StatRow label="Analytics gagnant" value={data.analytics.winner_analytics_events} />
                  <StatRow label="Analytics perdant" value={data.analytics.loser_analytics_events} />
                  <p className="pt-1 text-xs text-muted-foreground">{data.analytics.note}</p>
                </Section>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Prévisualisation uniquement — aucune fusion, aucun slug modifié, aucune redirection
                  créée. La fusion manuelle sera traitée dans une phase ultérieure.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MergePreviewDialog;