import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Copy, ExternalLink, ChevronDown, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { ReconPair, ReconSideProfile } from '@/hooks/useReconciliationPreview';
import {
  STATUS_META,
  CATEGORY_META,
  statusConclusion,
  confidenceLabel,
  readableReasons,
} from './reconciliationLabels';

const copy = (value: string | null | undefined, label: string) => {
  if (!value) return;
  navigator.clipboard.writeText(value);
  toast({ title: 'Copié', description: `${label} copié dans le presse-papiers.` });
};

const FIELD_ROWS: { key: keyof ReconSideProfile; label: string }[] = [
  { key: 'public_slug', label: 'Slug public' },
  { key: 'canonical_name', label: 'Nom' },
  { key: 'source_type', label: 'Source' },
  { key: 'exhibitor_id', label: 'exhibitor_id' },
  { key: 'legacy_exposant_id', label: 'legacy_exposant_id' },
  { key: 'airtable_real_id', label: 'ID Airtable réel' },
  { key: 'uuid_mirror_id', label: 'UUID miroir' },
  { key: 'normalized_domain', label: 'Domaine normalisé' },
  { key: 'participations_count', label: 'Participations' },
  { key: 'published_novelties_count', label: 'Nouveautés publiées' },
  { key: 'leads_count', label: 'Leads' },
  { key: 'active_team_count', label: 'Équipe active' },
  { key: 'crm_matches_count', label: 'Matches CRM' },
  { key: 'owner_present', label: 'Propriétaire' },
  { key: 'has_hard_deps', label: 'Dépendances dures' },
  { key: 'dep_score', label: 'Score dépendances' },
];

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  return String(v);
}

function SideCard({
  profile,
  title,
  tone,
}: {
  profile: ReconSideProfile | null;
  title: string;
  tone: 'keep' | 'deactivate';
}) {
  const slugUrl = profile?.public_slug ? `/exposants/${profile.public_slug}` : null;
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === 'keep' ? 'border-emerald-300 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-semibold flex items-center gap-2">
          {tone === 'keep' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          {title}
        </h4>
        <div className="flex gap-1">
          {slugUrl && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Ouvrir la fiche publique"
              asChild
            >
              <a href={slugUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          {profile?.public_slug && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Copier le slug"
              onClick={() => copy(profile.public_slug, 'Slug')}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {FIELD_ROWS.map(({ key, label }) => (
          <React.Fragment key={String(key)}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-all">{fmt(profile?.[key])}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

export default function ReconciliationPairDetail({
  pair,
  open,
  onOpenChange,
}: {
  pair: ReconPair | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!pair) return null;
  const statusMeta = STATUS_META[pair.status] ?? { label: pair.status, variant: 'outline' as const };
  const catMeta = CATEGORY_META[pair.category] ?? { label: pair.category, hint: '' };
  const reasons = readableReasons(pair.reasons);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Détail de la paire
            <Badge variant={statusMeta.variant} className={statusMeta.className}>
              {statusMeta.label}
            </Badge>
            <Badge variant="secondary" title={catMeta.hint}>
              {catMeta.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>{statusConclusion(pair.status)}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-7rem)] px-6 pb-6">
          <div className="space-y-5">
            {/* A. Infos générales */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Informations générales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">pair_key</span>
                  <code className="bg-muted px-1 rounded break-all">{pair.pair_key}</code>
                  <Button size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => copy(pair.pair_key, 'pair_key')} title="Copier pair_key">
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">group_key</span>
                  <code className="bg-muted px-1 rounded break-all">{pair.group_key}</code>
                </div>
                <div><span className="text-muted-foreground">Score :</span> {pair.score}</div>
                <div><span className="text-muted-foreground">Confiance :</span> {confidenceLabel(pair.confidence)}</div>
                <div className="sm:col-span-2 flex items-start gap-1.5">
                  <span className="text-muted-foreground">pair_identity_ids</span>
                  <code className="bg-muted px-1 rounded break-all flex-1">
                    {(pair.pair_identity_ids || []).join(', ')}
                  </code>
                  <Button size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => copy((pair.pair_identity_ids || []).join(','), 'IDs')} title="Copier les ids">
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {reasons.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground">Pourquoi c'est détecté : </span>
                  {reasons.map((r) => (
                    <Badge key={r} variant="outline" className="mr-1 text-[10px]">{r}</Badge>
                  ))}
                </div>
              )}
            </section>

            {/* B & C */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <SideCard profile={pair.side_keep} title="À garder" tone="keep" />
              <SideCard profile={pair.side_deactivate} title="Doublon potentiel" tone="deactivate" />
            </section>

            {/* D. Conclusion / plan */}
            <section className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Ce que le système proposerait plus tard
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {pair.plan_text || '—'}
              </p>
            </section>

            {/* Raw JSON */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  <ChevronDown className="h-3.5 w-3.5" />
                  Voir données brutes
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 text-[10px] bg-muted p-3 rounded overflow-auto max-h-72">
                  {JSON.stringify(pair, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
