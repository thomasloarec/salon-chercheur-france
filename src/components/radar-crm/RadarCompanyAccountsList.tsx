import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Star, EyeOff, Eye, ChevronDown, ChevronUp, ExternalLink, Target, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type RelationshipStatus, RELATIONSHIP_META } from '@/lib/radarCrm/relationship';
import { type Company, type EventGroup, type Pref } from '@/types/radar';
import { formatDate, EmptyText, CompanyAvatar, RelationshipSelect } from './RadarShared';

/** Company "account" cards — modern CRM look */
const CompanyAccountsList: React.FC<{
  groups: EventGroup[]; companies: Company[]; onClickEvent: (g: EventGroup) => void;
  getPref: (companyId: string) => Pref;
  onSetPref: (companyId: string, next: Pref) => void;
  getRel: (company: Company) => RelationshipStatus;
  onSetRel: (company: Company, next: RelationshipStatus) => void;
  onOpenMission: (company: Company, g: EventGroup) => void;
}> = ({ groups, companies, onClickEvent, getPref, onSetPref, getRel, onSetRel, onOpenMission }) => {
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  if (companies.length === 0) {
    return (
      <EmptyText label="Aucun mouvement détecté pour l'instant — Radar continue de surveiller vos comptes. Dès qu'un de vos comptes s'inscrit à un salon, vous le verrez ici et serez alerté." />
    );
  }

  const enriched = companies.map((c) => {
    const compGroups = groups.filter((g) => g.companies.some((x) => x.company.id === c.id));
    const future = compGroups.filter((g) => g.is_future).sort((a, b) => (a.days_until ?? 9999) - (b.days_until ?? 9999));
    const past = compGroups.filter((g) => !g.is_future).sort((a, b) => (b.date_debut ?? '').localeCompare(a.date_debut ?? ''));
    return { c, future, past };
  }).sort((a, b) => {
    // Tri par imminence : le compte avec le salon futur le plus proche d'abord.
    // Les comptes sans salon futur passent en bas.
    const aHas = a.future.length > 0;
    const bHas = b.future.length > 0;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return (a.future[0]?.days_until ?? 9999) - (b.future[0]?.days_until ?? 9999);
  });

  // Trois groupes dérivés du statut effectif (override ?? base).
  const starred = enriched.filter((e) => getPref(e.c.id) === 'starred');
  const ignored = enriched.filter((e) => getPref(e.c.id) === 'ignored');
  const following = enriched.filter((e) => getPref(e.c.id) === 'normal');

  const Grid: React.FC<{ items: typeof enriched; dimmed?: boolean }> = ({ items, dimmed }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map(({ c, future, past }) => (
        <CompanyAccountCard
          key={c.id}
          company={c}
          future={future}
          past={past}
          onClickEvent={onClickEvent}
          pref={getPref(c.id)}
          onSetPref={(next) => onSetPref(c.id, next)}
          relationship={getRel(c)}
          onSetRelationship={(next) => onSetRel(c, next)}
          onOpenMission={(g) => onOpenMission(c, g)}
          dimmed={dimmed}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Prioritaires (étoilés) */}
      {starred.length > 0 && (
        <section className="space-y-5">
          <div className="space-y-2">
            <div className="h-[3px] w-10 rounded-full bg-primary" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-foreground fill-primary" />
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Prioritaires <span className="text-muted-foreground font-normal">({starred.length})</span>
              </h2>
            </div>
          </div>
          <Grid items={starred} />
        </section>
      )}

      {/* À suivre */}
      {following.length > 0 ? (
        <section className="space-y-5">
          {starred.length > 0 && (
            <div className="space-y-2">
              <div className="h-[3px] w-10 rounded-full bg-border" aria-hidden="true" />
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                À suivre <span className="text-muted-foreground font-normal">({following.length})</span>
              </h2>
            </div>
          )}
          <Grid items={following} />
        </section>
      ) : (
        starred.length === 0 && (
          <EmptyText label="Tous vos comptes sont rangés." />
        )
      )}

      {/* Ignorés (repliés par défaut) */}
      {ignored.length > 0 && (
        <section className="space-y-4 pt-2">
          <button
            type="button"
            onClick={() => setIgnoredOpen((o) => !o)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {ignoredOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <EyeOff className="h-4 w-4" />
            {ignored.length} compte{ignored.length > 1 ? 's' : ''} ignoré{ignored.length > 1 ? 's' : ''}
          </button>
          {ignoredOpen && <Grid items={ignored} dimmed />}
        </section>
      )}
    </div>
  );
};

/** Account card with collapsible event lists */
const CompanyAccountCard: React.FC<{
  company: Company;
  future: EventGroup[];
  past: EventGroup[];
  onClickEvent: (g: EventGroup) => void;
  pref: Pref;
  onSetPref: (next: Pref) => void;
  relationship: RelationshipStatus;
  onSetRelationship: (next: RelationshipStatus) => void;
  onOpenMission: (g: EventGroup) => void;
  dimmed?: boolean;
}> = ({ company, future, past, onClickEvent, pref, onSetPref, relationship, onSetRelationship, onOpenMission, dimmed }) => {
  // Reste des salons (hors prochain) — replié par défaut.
  const [expRest, setExpRest] = useState(false);
  // Édition du statut : ouvre le sélecteur complet à la place de la pastille / des choix rapides.
  const [editStatus, setEditStatus] = useState(false);

  const needsQualification = relationship === 'a_qualifier';
  const next = future[0] ?? null;
  const restFuture = future.slice(1);
  const meta = RELATIONSHIP_META[relationship];

  const applyStatus = (s: RelationshipStatus) => {
    onSetRelationship(s);
    setEditStatus(false);
  };

  const standFor = (g: EventGroup) =>
    g.companies.find((x) => x.company.id === company.id)?.stand ?? null;

  // Seuil d'imminence : l'accent est réservé aux salons très proches.
  const IMMINENT_DAYS = 10;

  const renderRow = (g: EventGroup, tone: 'future' | 'past') => {
    const stand = standFor(g);
    return (
      <button
        key={g.event_id}
        type="button"
        onClick={() => onClickEvent(g)}
        disabled={!g.slug}
        className="w-full text-left rounded-lg px-3 py-2.5 transition-colors disabled:opacity-60 hover:bg-muted/50"
      >
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-sm truncate', tone === 'future' ? 'text-foreground' : 'text-muted-foreground')} title={g.nom_event}>
            {g.nom_event}
          </p>
          {tone === 'future' && g.days_until != null && (
            <Badge className="shrink-0 border-none bg-muted text-muted-foreground">
              J-{Math.max(0, g.days_until)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {formatDate(g.date_debut)}{g.ville ? ` · ${g.ville}` : ''}
          {stand && <span className="ml-2 text-foreground font-medium">Stand {stand}</span>}
        </p>
      </button>
    );
  };

  const restSegments = [
    restFuture.length > 0
      ? `${restFuture.length} autre${restFuture.length > 1 ? 's' : ''} salon${restFuture.length > 1 ? 's' : ''} à venir`
      : null,
    past.length > 0 ? `${past.length} passé${past.length > 1 ? 's' : ''}` : null,
  ].filter(Boolean) as string[];

  return (
    <Card className={cn(
      'h-full transition-all border-border/60 shadow-none',
      dimmed
        ? 'opacity-70 grayscale hover:opacity-100 hover:grayscale-0'
        : 'hover:border-border hover:shadow-sm',
      pref === 'starred' && 'border-primary/40',
    )}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <CompanyAvatar company={company} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-display font-semibold text-base text-foreground truncate min-w-0" title={company.company_name}>
                {company.company_name}
              </p>
              {!needsQualification && (
                editStatus ? (
                  <span className="shrink-0">
                    <RelationshipSelect status={relationship} onChange={applyStatus} />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditStatus(true)}
                    title="Modifier le statut"
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 hover:bg-muted/70 transition-colors"
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden="true" />
                    <span className="text-[11px] font-medium text-foreground">{meta.label}</span>
                  </button>
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <ExternalLink className="h-3 w-3" />
              {company.normalized_domain ?? company.website_raw ?? ''}
            </p>
          </div>
          {/* Contrôles triage étoile / ignorer */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              aria-label={pref === 'starred' ? 'Retirer des prioritaires' : 'Marquer comme prioritaire'}
              title={pref === 'starred' ? 'Retirer des prioritaires' : 'Marquer comme prioritaire'}
              onClick={() => onSetPref(pref === 'starred' ? 'normal' : 'starred')}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <Star className={cn('h-4 w-4', pref === 'starred' ? 'text-primary fill-primary' : 'text-foreground/40')} />
            </button>
            <button
              type="button"
              aria-label={pref === 'ignored' ? 'Ne plus ignorer' : 'Ignorer ce compte'}
              title={pref === 'ignored' ? 'Ne plus ignorer' : 'Ignorer ce compte'}
              onClick={() => onSetPref(pref === 'ignored' ? 'normal' : 'ignored')}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              {pref === 'ignored'
                ? <Eye className="h-4 w-4 text-foreground/50" />
                : <EyeOff className="h-4 w-4 text-foreground/40" />}
            </button>
          </div>
        </div>

        {/* Bande de qualification — uniquement tant que le compte n'est pas qualifié. */}
        {needsQualification && (
          <div className="rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="flex items-start gap-1.5 text-xs text-foreground">
              <AlertCircle className="h-[15px] w-[15px] shrink-0 text-primary" />
              Quelle relation avez-vous avec ce compte ?
            </p>
            {editStatus ? (
              <RelationshipSelect status={relationship} onChange={applyStatus} />
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {(['client_actif', 'prospect_chaud', 'prospect_froid'] as RelationshipStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => applyStatus(s)}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      {RELATIONSHIP_META[s].label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEditStatus(true)}
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  Autre statut
                </button>
              </>
            )}
          </div>
        )}

        {dimmed && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onSetPref('normal')}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Ne plus ignorer
          </Button>
        )}

        {/* Prochain salon */}
        {next && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Prochain salon</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onClickEvent(next)}
                disabled={!next.slug}
                title={next.nom_event}
                className="group min-w-0 flex-1 flex items-center gap-1 text-left text-sm font-medium text-foreground hover:underline disabled:opacity-60 disabled:hover:no-underline"
              >
                <span className="truncate">{next.nom_event}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              {next.days_until != null && (
                <Badge className={cn(
                  'shrink-0 border-none',
                  next.days_until < IMMINENT_DAYS
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}>
                  J-{Math.max(0, next.days_until)}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {formatDate(next.date_debut)}{next.ville ? ` · ${next.ville}` : ''}
              {standFor(next) && <span className="ml-2 text-foreground font-medium">Stand {standFor(next)}</span>}
            </p>
            <Button size="sm" className="w-full" onClick={() => onOpenMission(next)}>
              <Target className="h-3.5 w-3.5 mr-1.5" /> Préparer ma visite
            </Button>
          </div>
        )}

        {/* Reste des salons — une seule ligne repliable. */}
        {restSegments.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            <button
              type="button"
              onClick={() => setExpRest((o) => !o)}
              aria-expanded={expRest}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expRest ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {restSegments.join(' · ')}
            </button>
            {expRest && (
              <div className="space-y-2">
                {restFuture.map((g) => renderRow(g, 'future'))}
                {past.map((g) => renderRow(g, 'past'))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyAccountsList;
