import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Flame, Star, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import {
  type RelationshipStatus, RELATIONSHIP_ORDER, RELATIONSHIP_META, triggerClassFor,
} from '@/lib/radarCrm/relationship';
import { type Company } from '@/types/radar';

export const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const eventInitials = (name: string | null | undefined) => {
  if (!name) return '??';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
};

export const companyInitials = (name: string) =>
  name.split(/[\s\-_]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const priorityFor = (n: number): { label: string; tone: string; icon?: React.ReactNode } | null => {
  // Échelle unique : l'orange est réservé à la vraie priorité forte ; le reste reste neutre/atténué.
  if (n >= 3) return { label: `Priorité forte · ${n} comptes`, tone: 'bg-primary text-primary-foreground', icon: <Flame className="h-3 w-3 mr-1" /> };
  if (n === 2) return { label: '2 comptes détectés', tone: 'bg-muted text-muted-foreground' };
  if (n === 1) return { label: '1 compte détecté', tone: 'bg-muted text-muted-foreground' };
  return null;
};

/** Statut relationnel (lecture seule) — point 8px + libellé neutre, sans pilule colorée. */
export const RelationshipBadge: React.FC<{ status: RelationshipStatus; className?: string }> = ({ status, className }) => {
  const meta = RELATIONSHIP_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        meta.badge,
        className,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  );
};

/** Sélecteur compact de statut relationnel — tactile, s'applique immédiatement. */
export const RelationshipSelect: React.FC<{
  status: RelationshipStatus;
  onChange: (next: RelationshipStatus) => void;
}> = ({ status, onChange }) => {
  const meta = RELATIONSHIP_META[status];
  return (
  <Select value={status} onValueChange={(v) => onChange(v as RelationshipStatus)}>
    <SelectTrigger
      aria-label="Statut relationnel du compte"
      className={cn(
        'h-8 w-auto min-w-0 gap-1.5 rounded-md px-2.5 shadow-none focus:ring-1 focus:ring-ring focus:ring-offset-0',
        '[&>span]:line-clamp-none',
        triggerClassFor(status),
      )}
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', meta.dot)} aria-hidden="true" />
      <span className={cn('truncate text-xs font-medium', meta.badge)}>{meta.label}</span>
    </SelectTrigger>
    <SelectContent>
      {RELATIONSHIP_ORDER.map((s) => (
        <SelectItem
          key={s}
          value={s}
          className="py-2 focus:bg-muted focus:text-foreground data-[state=checked]:bg-muted"
        >
          <RelationshipBadge status={s} />
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  );
};

/** Logo d'entreprise — petit carré propre (coins légèrement arrondis), jamais un grand cercle. */
export const CompanyAvatar: React.FC<{ company: Company; size?: 'xs' | 'sm' | 'md' }> = ({ company, size = 'sm' }) => {
  const url = getExhibitorLogoUrl(null, company.website_raw ?? company.normalized_domain ?? null);
  const cls = size === 'xs' ? 'h-6 w-6 text-[10px]' : size === 'md' ? 'h-10 w-10 text-sm' : 'h-7 w-7 text-[11px]';
  return (
    <Avatar className={`${cls} rounded-md border bg-background`}>
      {url && <AvatarImage src={url} alt={company.company_name} className="rounded-md" />}
      <AvatarFallback className="rounded-md bg-primary/10 text-primary font-bold">
        {companyInitials(company.company_name)}
      </AvatarFallback>
    </Avatar>
  );
};

/** Ligne entreprise cliquable — logo carré + nom fort, sans pilule. */
export const CompanyChip: React.FC<{
  company: Company;
  stand?: string | null;
  nomExposant?: string | null;
  needsReview?: boolean;
  starred?: boolean;
  relationship?: RelationshipStatus;
  onClick: () => void;
  /** Si fourni, le badge statut devient un sélecteur autonome (modifiable partout). */
  onSetRelationship?: (next: RelationshipStatus) => void;
}> = ({ company, stand, nomExposant, needsReview, starred, relationship, onClick, onSetRelationship }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
    }}
    className={cn(
      // Mobile : pleine largeur → empilement vertical propre. Desktop : puce compacte.
      'group flex w-full sm:w-auto sm:max-w-xs items-center gap-2.5 max-w-full bg-card border border-border rounded-lg px-2.5 py-2 cursor-pointer text-left transition-colors hover:bg-muted/40 hover:border-primary/40',
      starred && 'border-primary/40',
    )}
    title={nomExposant && nomExposant !== company.company_name ? `CRM : ${company.company_name}` : undefined}
  >
    <CompanyAvatar company={company} size="xs" />
    <span className="flex min-w-0 flex-1 flex-col items-start gap-1 leading-tight">
      {/* Ligne 1 : nom (tronqué proprement) */}
      <span className="flex min-w-0 max-w-full items-center gap-1.5">
        {starred && <Star className="h-3 w-3 text-foreground fill-primary shrink-0" aria-label="Compte prioritaire" />}
        <span className="truncate font-display text-sm font-semibold text-foreground group-hover:text-primary">
          {nomExposant ?? company.company_name}
        </span>
      </span>
      {nomExposant && nomExposant !== company.company_name && (
        <span className="max-w-full truncate text-[10px] text-foreground/60">CRM : {company.company_name}</span>
      )}
      {/* Ligne 2 : statut + stand + à vérifier (wrap, jamais de chevauchement) */}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {onSetRelationship ? (
          // Le clic sur le statut ne déclenche jamais la navigation/ouverture parente.
          <span
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <RelationshipSelect status={relationship ?? 'a_qualifier'} onChange={onSetRelationship} />
          </span>
        ) : (
          <RelationshipBadge status={relationship ?? 'a_qualifier'} />
        )}
        {stand && (
          <span className="shrink-0 text-xs font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded">
            {stand}
          </span>
        )}
        {needsReview && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-primary whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" /> À vérifier
          </span>
        )}
      </span>
    </span>
    {/* Indicateur d'action : la puce ouvre la préparation de mission. */}
    <span className="ml-0.5 shrink-0 self-center flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground group-hover:text-primary transition-colors">
      <span className="hidden sm:inline">Préparer ma visite</span>
      <ChevronRight className="h-3.5 w-3.5" />
    </span>
  </div>
);

export const Th: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ children, ...p }) => (
  <th {...p} className="text-left px-3 py-2 font-semibold text-foreground/70 whitespace-nowrap">{children}</th>
);
export const Td: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ children, className = '', ...p }) => (
  <td {...p} className={`px-3 py-2 ${className}`}>{children}</td>
);
export const EmptyText: React.FC<{ label: string }> = ({ label }) => (
  <div className="text-center text-foreground/60 py-12">{label}</div>
);
