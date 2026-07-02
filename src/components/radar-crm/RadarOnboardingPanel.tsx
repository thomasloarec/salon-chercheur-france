import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Target, Star, CalendarCheck, ClipboardList, CheckCircle2, ChevronDown,
  ChevronUp, Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';

/**
 * Shape returned by the server-side RPC `get_radar_onboarding_progress`.
 * Defined locally because the RPC is typed as `Json` in the generated types.
 */
export interface RadarOnboardingProgress {
  qualify: { done: number; total: number; pct: number };
  prioritize: { starred: number; ignored: number; done: boolean };
  prepare_next: {
    event_id: string;
    nom_event: string;
    prepared: number;
    total: number;
    pct: number;
  } | null;
  capture: { count: number; notes: number; tasks: number; done: boolean };
}

interface MissionDef {
  key: 'qualify' | 'prioritize' | 'prepare' | 'capture';
  icon: React.ReactNode;
  title: string;
  sub: string;
  help?: string;
  done: boolean;
  /** Mission neutre / non comptée (ex. aucun salon à venir). */
  na?: boolean;
  /** 0..100 pour la barre de progression (absent si sans barre). */
  progress?: number;
  ctaLabel?: string;
  onCta?: () => void;
}

const COLLAPSED_KEY = 'radarOnboardingCollapsed';

/**
 * Panneau d'onboarding gamifié — 4 missions, doctrine premium :
 * une seule couleur d'accent (orange = action attendue), fait = calme/atténué.
 * Repliable (bouton « masquer »). État compact « Radar CRM est prêt ✓ »
 * quand toutes les missions comptées sont faites.
 */
const RadarOnboardingPanel: React.FC<{
  progress: RadarOnboardingProgress | null;
  loading: boolean;
  /** id du prochain salon à venir, pour le CTA « Capturer ». */
  captureEventId: string | null;
  onGoCompanies: () => void;
  onPrepareEvent: (eventId: string) => void;
  onEnterTerrain: (eventId: string) => void;
}> = ({ progress, loading, captureEventId, onGoCompanies, onPrepareEvent, onEnterTerrain }) => {
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return sessionStorage.getItem(COLLAPSED_KEY) !== '1'; } catch { return true; }
  });

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      try { sessionStorage.setItem(COLLAPSED_KEY, next ? '0' : '1'); } catch { /* ignore */ }
      return next;
    });
  };

  // Track once when the panel is first rendered with data.
  useEffect(() => {
    if (progress) void trackRadarEvent('radar_onboarding_viewed');
  }, [progress]);

  const missions = useMemo<MissionDef[]>(() => {
    if (!progress) return [];
    const q = progress.qualify ?? { done: 0, total: 0, pct: 0 };
    const p = progress.prioritize ?? { starred: 0, ignored: 0, done: false };
    const pn = progress.prepare_next ?? null;
    const cap = progress.capture ?? { count: 0, notes: 0, tasks: 0, done: false };

    const m1Done = q.pct >= 100;
    const m2Done = !!p.done;
    const m3Done = !!pn && pn.pct >= 100;
    const m3NA = !pn;
    const m4Done = !!cap.done;

    const fire = (mission: MissionDef['key'], fn: () => void) => () => {
      void trackRadarEvent('radar_onboarding_cta_clicked', { mission });
      fn();
    };

    return [
      {
        key: 'qualify',
        icon: <Target className="h-5 w-5" />,
        title: 'Qualifier vos comptes',
        sub: `${q.done}/${q.total} comptes à venir qualifiés`,
        done: m1Done,
        progress: q.pct,
        ctaLabel: m1Done ? undefined : 'Qualifier',
        onCta: m1Done ? undefined : fire('qualify', onGoCompanies),
      },
      {
        key: 'prioritize',
        icon: <Star className="h-5 w-5" />,
        title: 'Prioriser',
        sub: `${p.starred} favoris · ${p.ignored} ignorés`,
        done: m2Done,
        ctaLabel: m2Done ? undefined : 'Trier mes comptes',
        onCta: m2Done ? undefined : fire('prioritize', onGoCompanies),
      },
      {
        key: 'prepare',
        icon: <CalendarCheck className="h-5 w-5" />,
        title: 'Préparer votre prochain salon',
        sub: m3NA ? 'Aucun salon à venir' : `${pn!.nom_event} — ${pn!.prepared}/${pn!.total} préparés`,
        done: m3Done,
        na: m3NA,
        progress: m3NA ? undefined : pn!.pct,
        ctaLabel: m3NA || m3Done ? undefined : 'Préparer',
        onCta: m3NA || m3Done ? undefined : fire('prepare', () => onPrepareEvent(pn!.event_id)),
      },
      {
        key: 'capture',
        icon: <ClipboardList className="h-5 w-5" />,
        title: 'Capturer sur le terrain',
        sub: `${cap.count} notes/tâches créées`,
        help: 'Ajoutez une note ou une tâche depuis un salon (Mode salon / Préparer ma visite).',
        done: m4Done,
        ctaLabel: m4Done || !captureEventId ? undefined : 'Capturer',
        onCta: m4Done || !captureEventId ? undefined : fire('capture', () => onEnterTerrain(captureEventId)),
      },
    ];
  }, [progress, onGoCompanies, onPrepareEvent, onEnterTerrain, captureEventId]);

  // Dénominateur dynamique : la mission « préparer » n'est pas comptée
  // s'il n'y a aucun salon à venir (neutre, non bloquante).
  const denom = progress && !progress.prepare_next ? 3 : 4;
  const k = missions.filter((m) => m.done).length;
  const allDone = missions.length > 0 && k >= denom;

  if (loading) {
    return (
      <Card className="shadow-none bg-card border-border/60">
        <CardContent className="py-5 px-5 space-y-4">
          <div className="h-6 w-56 rounded bg-muted animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!progress) return null;

  // ── État compact : toutes les missions comptées sont faites ──────────
  if (allDone) {
    return (
      <Card className="shadow-none bg-card border-border/60">
        <CardContent className="py-4 px-5">
          {expanded ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="font-display text-sm font-semibold text-foreground/70 truncate">
                  Radar CRM est prêt <span className="text-muted-foreground" aria-hidden>✓</span>
                </span>
              </div>
              <button
                type="button"
                onClick={toggle}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-[44px] px-2 shrink-0"
              >
                Masquer <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={toggle}
              className="flex w-full items-center justify-between gap-3 min-h-[44px]"
            >
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" /> Radar CRM est prêt ✓
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                Afficher <ChevronDown className="h-4 w-4" />
              </span>
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Panneau complet ─────────────────────────────────────────────────
  return (
    <Card className="shadow-none bg-card border-border/60">
      <CardContent className="py-5 px-5 space-y-4">
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Rocket className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold tracking-tight text-foreground truncate">
                Bien démarrer avec Radar CRM
              </h2>
              <p className="text-xs text-muted-foreground">
                {k}/{denom} mission{denom > 1 ? 's' : ''}
                {denom < 4 && ' · salon à venir non requis'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-[44px] px-2 shrink-0"
          >
            {expanded ? <>Masquer <ChevronUp className="h-4 w-4" /></> : <>Afficher <ChevronDown className="h-4 w-4" /></>}
          </button>
        </div>

        {expanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {missions.map((m) => (
              <MissionRow key={m.key} mission={m} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/** Une mission : icône, titre, sous-texte, progression, CTA — faite = calme. */
const MissionRow: React.FC<{ mission: MissionDef }> = ({ mission }) => {
  const { icon, title, sub, help, done, na, progress, ctaLabel, onCta } = mission;
  const calm = done || na;
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-3.5 transition-colors',
        done ? 'border-border/40 bg-muted/20 opacity-70' :
        na ? 'border-border/40 bg-muted/10' :
        'border-border/60 bg-background',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
            calm ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
          )}
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3
            className={cn(
              'font-display text-sm font-semibold leading-tight',
              calm ? 'text-foreground/60' : 'text-foreground',
            )}
          >
            {title}
          </h3>
          <p className={cn('text-xs', calm ? 'text-muted-foreground' : 'text-foreground/70')}>{sub}</p>
          {progress != null && (
            <Progress value={progress} className={cn('h-1.5', done && 'opacity-60')} />
          )}
          {help && (
            <p className="text-[11px] leading-snug text-muted-foreground/80">{help}</p>
          )}
        </div>
      </div>
      {ctaLabel && onCta && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCta}
          className="self-start min-h-[44px] border-accent/40 text-accent hover:bg-accent/10 hover:text-accent"
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
};

export default RadarOnboardingPanel;
