import type { BoothWorkspace, BoothWorkspaceSummaryItem } from '@/lib/booth/rpc';

export type CockpitKind = 'prepare' | 'before' | 'during' | 'after';

export interface CockpitEvent {
  id: string;
  nom_event: string;
  slug: string | null;
  ville: string | null;
  date_debut: string | null;
  date_fin: string | null;
}

export interface CockpitUpcoming {
  event: {
    id: string;
    nom_event: string;
    slug: string | null;
    ville: string | null;
    date_debut: string | null;
    date_fin: string | null;
  };
}

export interface CockpitCard {
  kind: CockpitKind;
  event: CockpitEvent;
  workspace: BoothWorkspace | null;
  summary: BoothWorkspaceSummaryItem | null;
  daysUntil?: number;
  daysSince?: number;
  dayIndex?: number;
  dayCount?: number;
  done?: boolean;
}

export const MAX_PREPARE = 5;

const ymd = (s: string | null | undefined) => (s ? s.slice(0, 10) : null);

/** Nombre de jours entre deux dates YYYY-MM-DD (b - a). */
export function dayDiff(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((tb - ta) / 86_400_000);
}

export function buildCockpit(input: {
  workspaces: BoothWorkspace[];
  upcoming: CockpitUpcoming[];
  summary: BoothWorkspaceSummaryItem[] | null | undefined;
  today: string;
}): CockpitCard[] {
  const today = input.today.slice(0, 10);
  const byWs = new Map((input.summary ?? []).map((s) => [s.workspace_id, s]));
  const during: CockpitCard[] = [];
  const afterOpen: CockpitCard[] = [];
  const afterDone: CockpitCard[] = [];
  const before: CockpitCard[] = [];

  for (const w of input.workspaces) {
    if (w.archived) continue;
    const event: CockpitEvent = {
      id: w.event_id,
      nom_event: w.nom_event,
      slug: w.event_slug,
      ville: w.ville,
      date_debut: w.date_debut,
      date_fin: w.date_fin,
    };
    const summary = byWs.get(w.workspace_id) ?? null;
    const d1 = ymd(w.date_debut);
    const d2 = ymd(w.date_fin) ?? d1;
    const base = { event, workspace: w, summary };
    if (w.phase === 'during') {
      const card: CockpitCard = { ...base, kind: 'during' };
      if (d1 && d2) {
        card.dayCount = Math.max(1, dayDiff(d1, d2) + 1);
        card.dayIndex = Math.min(card.dayCount, Math.max(1, dayDiff(d1, today) + 1));
      }
      during.push(card);
    } else if (w.phase === 'after') {
      const done = summary ? summary.actions_open === 0 : false;
      const card: CockpitCard = { ...base, kind: 'after', done };
      if (d2) card.daysSince = Math.max(0, dayDiff(d2, today));
      (done ? afterDone : afterOpen).push(card);
    } else {
      const card: CockpitCard = { ...base, kind: 'before' };
      if (d1) card.daysUntil = Math.max(0, dayDiff(today, d1));
      before.push(card);
    }
  }

  const withWs = new Set(input.workspaces.map((w) => w.event_id));
  const seen = new Set<string>();
  const prepare: CockpitCard[] = input.upcoming
    .filter((u) => u.event && !withWs.has(u.event.id))
    .filter((u) => (seen.has(u.event.id) ? false : (seen.add(u.event.id), true)))
    .sort((a, b) => (a.event.date_debut ?? '9999').localeCompare(b.event.date_debut ?? '9999'))
    .slice(0, MAX_PREPARE)
    .map((u) => {
      const d1 = ymd(u.event.date_debut);
      return {
        kind: 'prepare' as const,
        event: { ...u.event },
        workspace: null,
        summary: null,
        daysUntil: d1 ? Math.max(0, dayDiff(today, d1)) : undefined,
      };
    });

  const recent = (a: CockpitCard, b: CockpitCard) => (a.daysSince ?? 1e9) - (b.daysSince ?? 1e9);
  const soon = (a: CockpitCard, b: CockpitCard) => (a.daysUntil ?? 1e9) - (b.daysUntil ?? 1e9);

  return [
    ...during,
    ...afterOpen.sort(recent),
    ...before.sort(soon),
    ...prepare,
    ...afterDone.sort(recent),
  ];
}
