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
import {
  Copy,
  ExternalLink,
  ChevronDown,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { ReconGroup, ReconGroupIdentity } from '@/hooks/useReconciliationPreview';
import { STATUS_META, CATEGORY_META, statusConclusion, riskLabel } from './reconciliationLabels';

const copy = (value: string | null | undefined, label: string) => {
  if (!value) return;
  navigator.clipboard.writeText(value);
  toast({ title: 'Copié', description: `${label} copié dans le presse-papiers.` });
};

const FIELD_ROWS: { key: keyof ReconGroupIdentity; label: string }[] = [
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

function IdentityCard({
  profile,
  tone,
}: {
  profile: ReconGroupIdentity;
  tone: 'keep' | 'deactivate';
}) {
  const slugUrl = profile.public_slug ? `/exposants/${profile.public_slug}` : null;
  const reason = tone === 'keep' ? profile.keep_reason : profile.deactivation_reason;
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === 'keep' ? 'border-emerald-300 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="font-semibold flex items-center gap-2 text-sm">
          {tone === 'keep' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          {profile.canonical_name || profile.public_slug || '—'}
        </h4>
        <div className="flex gap-1">
          {slugUrl && (
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Ouvrir la fiche publique" asChild>
              <a href={slugUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          {profile.public_slug && (
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
      {reason && (
        <p className="text-[11px] text-muted-foreground mb-2 italic">{reason}</p>
      )}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {FIELD_ROWS.map(({ key, label }) => (
          <React.Fragment key={String(key)}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-all">{fmt(profile[key])}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value ?? 0}</div>
    </div>
  );
}

export default function ReconciliationGroupDetail({
  group,
  open,
  onOpenChange,
  loading = false,
}: {
  group: ReconGroup | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading?: boolean;
}) {
  if (loading && !group) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Calcul du détail du groupe…</DialogTitle>
            <DialogDescription>
              Le détail complet (recommandations, dépendances, plan théorique) est calculé à la
              demande pour éviter les timeouts.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement du détail…
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  if (!group) return null;
  const statusMeta =
    STATUS_META[group.status_group] ?? { label: group.status_group, variant: 'outline' as const };
  const catMeta =
    CATEGORY_META[group.category_group] ?? { label: group.category_group, hint: '' };
  const risk = riskLabel(group.risk_level);
  const keep = group.recommended_keep_identity;
  const deactivatable = group.identities_potentially_deactivatable ?? [];
  const warnings = group.warnings ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {group.main_name || 'Groupe'}
            <Badge variant={statusMeta.variant} className={statusMeta.className}>
              {statusMeta.label}
            </Badge>
            <Badge variant="secondary" title={catMeta.hint}>
              {catMeta.label}
            </Badge>
            <Badge variant="outline" className={risk.className}>
              Risque : {risk.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>{statusConclusion(group.status_group)}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-7rem)] px-6 pb-6">
          <div className="space-y-5">
            {/* A. Synthèse */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Synthèse du groupe</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <Total label="Identités" value={group.identities_count} />
                <Total label="Participations" value={group.total_participations} />
                <Total label="Nouveautés" value={group.total_novelties} />
                <Total label="Leads" value={group.total_leads} />
                <Total label="Owners/équipe" value={group.total_teams} />
                <Total label="CRM" value={group.total_crm} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>group_key</span>
                <code className="bg-muted px-1 rounded break-all">{group.group_key}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => copy(group.group_key, 'group_key')}
                  title="Copier group_key"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <span>·</span>
                <span>Sources : {(group.sources ?? []).join(', ') || '—'}</span>
                <span>·</span>
                <span>Domaine principal : {group.main_domain || '—'}</span>
              </div>
              {warnings.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* B. Identité recommandée à garder */}
            {keep && (
              <section>
                <h3 className="text-sm font-semibold mb-2">Identité recommandée à conserver</h3>
                <IdentityCard profile={keep} tone="keep" />
              </section>
            )}

            {/* C. Identités potentiellement doublons */}
            {deactivatable.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2">
                  Identités potentiellement doublons ({deactivatable.length})
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {deactivatable.map((p) => (
                    <IdentityCard key={p.identity_id ?? p.public_slug} profile={p} tone="deactivate" />
                  ))}
                </div>
              </section>
            )}

            {/* D. Plan théorique */}
            <section className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Ce que le système ferait plus tard, si validé
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {group.plan_text_group || '—'}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Aucune action n'est exécutée. Ceci est une prévisualisation en lecture seule.
              </p>
            </section>

            {/* E. Données brutes */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  <ChevronDown className="h-3.5 w-3.5" />
                  Voir données brutes
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 text-[10px] bg-muted p-3 rounded overflow-auto max-h-72">
                  {JSON.stringify(group, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
