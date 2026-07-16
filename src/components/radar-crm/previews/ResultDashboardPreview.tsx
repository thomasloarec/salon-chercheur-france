import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Flame, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import RadarStatCard from '@/components/radar-crm/RadarStatCard';
import PreviewRelBadge from './PreviewRelBadge';
import { RELATIONSHIP_META, type RelationshipStatus } from '@/lib/radarCrm/relationship';

/**
 * Miroir présentationnel de la vue résultat / cockpit (RadarCrmResults) — garder synchronisé.
 * Réutilise directement RadarStatCard (props only, source partagée) pour les stats,
 * et reproduit la ligne de compte de CompanyChip / EventCard (mêmes classes/tokens :
 * carte bordée rounded-lg, nom font-display, badge relation, chip stand primary).
 * Le vrai cockpit dépend d'auth + RPC : ce miroir en copie le rendu, en statique.
 */

const initials = (name: string) =>
  name.split(/[\s\-_]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

interface AccountRowData {
  name: string;
  objective: string;
  status: RelationshipStatus;
  label: string;
  stand: string;
}

const ROWS: AccountRowData[] = [
  {
    name: 'Schneider Electric',
    objective: 'confirmer le budget sur leur projet de supervision énergétique',
    status: 'prospect_chaud',
    label: RELATIONSHIP_META.prospect_chaud.label,
    stand: 'A56',
  },
  {
    name: 'Legrand',
    objective: 'savoir si le projet de bornes de recharge est encore actif',
    status: 'prospect_froid',
    label: RELATIONSHIP_META.prospect_froid.label,
    stand: 'E35',
  },
  {
    name: 'SEB',
    objective: 'premier contact, identifier qui pilote la ligne Cookeo',
    status: 'a_qualifier',
    label: RELATIONSHIP_META.a_qualifier.label,
    stand: 'A39',
  },
];

// Miroir de CompanyChip (RadarCrmResults) — garder synchronisé.
const AccountRow: React.FC<AccountRowData> = ({ name, objective, status, label, stand }) => (
  <div className="group flex w-full items-center gap-2.5 bg-card border border-border rounded-lg px-2.5 py-2 text-left">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-primary/10 text-[10px] font-bold text-primary">
      {initials(name)}
    </span>
    <span className="flex min-w-0 flex-1 flex-col items-start gap-1 leading-tight">
      <span className="truncate font-display text-sm font-semibold text-foreground group-hover:text-primary">
        {name}
      </span>
      <span className="max-w-full truncate text-xs text-muted-foreground">Objectif : {objective}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PreviewRelBadge status={status} label={label} />
        <span className="shrink-0 text-xs font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded">
          Stand {stand}
        </span>
      </span>
    </span>
    <ChevronRight className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground group-hover:text-primary transition-colors" />
  </div>
);

const ResultDashboardPreview: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-4', className)}>
    {/* Stats — RadarStatCard partagé */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <RadarStatCard label="Entreprises analysées" value={310} />
      <RadarStatCard label="Détectées sur salons" value={60} accent="accent" />
      <RadarStatCard label="Participations futures" value={12} />
      <RadarStatCard label="Prochain salon" value="SEPEM Brest" sub="Dans 9 j" accent="primary" />
    </div>

    {/* Bloc « comptes à rencontrer » — miroir EventCard */}
    <Card className="border-border/60 shadow-none bg-card">
      <CardContent className="p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-lg leading-snug text-foreground">
              3 comptes à rencontrer · SEPEM Brest
            </h3>
            <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="h-3.5 w-3.5" /> Brest · Dans 9 jours
            </p>
          </div>
          <Badge className="bg-primary text-primary-foreground border-none whitespace-nowrap shrink-0">
            <Flame className="h-3 w-3 mr-1" /> Priorité forte · 3 comptes
          </Badge>
        </div>
        <div className="bg-muted/30 border border-border/60 rounded-lg p-4 md:p-5 space-y-2">
          {ROWS.map((r) => <AccountRow key={r.name} {...r} />)}
        </div>
      </CardContent>
    </Card>
  </div>
);

export default ResultDashboardPreview;
