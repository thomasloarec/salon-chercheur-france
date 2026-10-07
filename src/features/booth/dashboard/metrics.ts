import type { BoothCache } from '../sync/cache';
import type { Interaction, Opportunity } from '@/lib/booth/types';
import { ymdInTz } from '../salon/display';

export type Scope = 'team' | 'mine' | { userId: string };
export interface MetricsOptions {
  day: string | 'all';
  scope: Scope;
  me: string;
  /** Date du jour (aaaa-mm-jj, fuseau du salon). Calculée si absente. */
  today?: string;
}

type MetricsCache = Pick<BoothCache, 'workspaceId' | 'workspace' | 'interactions' | 'opportunities'>;

export interface MemberRow {
  userId: string;
  meetings: number;
  hot: number;
  projects: number;
  overdue: number;
}

export interface Metrics {
  meetings: number;
  people: number;
  newProspects: number;
  customers: number;
  partners: number;
  others: number;
  hot: number;
  potential: { hot: number; good: number; explore: number; none: number };
  projects: number;
  projectsAmount: number;
  projectsWithoutAmount: number;
  actionsTodo: number;
  actionsOverdue: number;
  actionsDone: number;
  totalCost: number | null;
  costPerMeeting: number | null;
  costPerProject: number | null;
  byMember: MemberRow[];
  series: { key: string; label: string; count: number }[];
  seriesMode: 'day' | 'hour';
  ids: {
    all: string[];
    hot: string[];
    customers: string[];
    todo: string[];
    overdue: string[];
    withProject: string[];
  };
}

const tzOf = (c: MetricsCache) => c.workspace.timezone || 'Europe/Paris';
export const isMeeting = (i: Interaction, wsId: string) =>
  (i.workspace_id === wsId || !i.workspace_id) && (i.status ?? 'completed') === 'completed';
export const ownerId = (i: { owner_user_id?: string | null; created_by?: string | null }, me: string) =>
  i.owner_user_id ?? i.created_by ?? me;

export function todayInTz(tz: string) {
  return ymdInTz(new Date().toISOString(), tz);
}

export function dueYmd(due: string, tz: string) {
  return due.length <= 10 ? due : ymdInTz(due, tz);
}

const inScope = (owner: string, scope: Scope, me: string) =>
  scope === 'team' ? true : scope === 'mine' ? owner === me : owner === scope.userId;

function hourInTz(iso: string, tz: string) {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)));
  } catch {
    return new Date(iso).getHours();
  }
}

export const isOpenAction = (i: Interaction) => i.next_action !== 'none' && !i.next_action_done_at;
export const isOverdue = (i: Interaction, today: string, tz: string) =>
  isOpenAction(i) && !!i.next_action_due && dueYmd(i.next_action_due, tz) < today;

/** Projets concrets du salon (hors abandonnés) rattachés aux rencontres filtrées. */
function projectsFor(
  c: MetricsCache,
  meetingIds: Set<string>,
  allMeetingIds: Set<string>,
  day: string,
  match: (owner: string) => boolean,
  me: string,
) {
  const tz = tzOf(c);
  return c.opportunities.filter((o: Opportunity) => {
    if (o.workspace_id && o.workspace_id !== c.workspaceId) return false;
    if (o.status === 'abandoned') return false;
    if (o.origin_interaction_id && allMeetingIds.has(o.origin_interaction_id)) return meetingIds.has(o.origin_interaction_id);
    if (!match(ownerId(o, me))) return false;
    if (day === 'all') return true;
    const created = (o as Opportunity & { created_at?: string | null }).created_at;
    return !!created && ymdInTz(created, tz) === day;
  });
}

export function computeMetrics(cache: MetricsCache, opts: MetricsOptions): Metrics {
  const tz = tzOf(cache);
  const today = opts.today ?? todayInTz(tz);
  const all = cache.interactions.filter((i) => isMeeting(i, cache.workspaceId));
  const allIds = new Set(all.map((i) => i.id));
  const ofDay = all.filter((i) => opts.day === 'all' || ymdInTz(i.occurred_at, tz) === opts.day);
  const list = ofDay.filter((i) => inScope(ownerId(i, opts.me), opts.scope, opts.me));
  const ids = new Set(list.map((i) => i.id));

  const projects = projectsFor(cache, ids, allIds, opts.day, (o) => inScope(o, opts.scope, opts.me), opts.me);
  const nonCustomers = list.filter((i) => i.relationship !== 'customer');
  const potential = { hot: 0, good: 0, explore: 0, none: 0 };
  for (const i of nonCustomers) if (i.potential) potential[i.potential] += 1;

  const todo = list.filter(isOpenAction);
  const overdue = todo.filter((i) => isOverdue(i, today, tz));
  const done = list.filter((i) => i.next_action !== 'none' && !!i.next_action_done_at);

  const amounts = projects.filter((p) => typeof p.amount === 'number');
  const totalCost = typeof cache.workspace.total_cost === 'number' ? cache.workspace.total_cost : null;

  // Par membre : filtre jour seulement
  const members = new Map<string, MemberRow>();
  const row = (u: string) => {
    if (!members.has(u)) members.set(u, { userId: u, meetings: 0, hot: 0, projects: 0, overdue: 0 });
    return members.get(u)!;
  };
  for (const i of ofDay) {
    const r = row(ownerId(i, opts.me));
    r.meetings += 1;
    if (i.potential === 'hot') r.hot += 1;
    if (isOverdue(i, today, tz)) r.overdue += 1;
  }
  const dayIds = new Set(ofDay.map((i) => i.id));
  const byId = new Map(all.map((i) => [i.id, i]));
  for (const p of projectsFor(cache, dayIds, allIds, opts.day, () => true, opts.me)) {
    const origin = p.origin_interaction_id ? byId.get(p.origin_interaction_id) : undefined;
    row(origin ? ownerId(origin, opts.me) : ownerId(p, opts.me)).projects += 1;
  }

  let series: Metrics['series'];
  let seriesMode: Metrics['seriesMode'];
  if (opts.day === 'all') {
    seriesMode = 'day';
    const m = new Map<string, number>();
    for (const i of list) {
      const k = ymdInTz(i.occurred_at, tz);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    series = [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({ key, label: key, count }));
  } else {
    seriesMode = 'hour';
    const counts = new Array(24).fill(0) as number[];
    for (const i of list) counts[hourInTz(i.occurred_at, tz)] += 1;
    const used = counts.map((n, h) => ({ n, h })).filter((x) => x.n > 0).map((x) => x.h);
    const from = used.length ? Math.min(...used) : 9;
    const to = used.length ? Math.max(...used) : 18;
    series = [];
    for (let h = from; h <= to; h++) series.push({ key: String(h), label: `${h} h`, count: counts[h] });
  }

  const projectOrigins = new Set(projects.map((p) => p.origin_interaction_id).filter(Boolean) as string[]);

  return {
    meetings: list.length,
    people: new Set(list.map((i) => i.contact_id)).size,
    newProspects: list.filter((i) => i.relationship === 'new_prospect').length,
    customers: list.filter((i) => i.relationship === 'customer').length,
    partners: list.filter((i) => i.relationship === 'partner').length,
    others: list.filter((i) => i.relationship === 'other').length,
    hot: list.filter((i) => i.potential === 'hot').length,
    potential,
    projects: projects.length,
    projectsAmount: amounts.reduce((s, p) => s + (p.amount as number), 0),
    projectsWithoutAmount: projects.length - amounts.length,
    actionsTodo: todo.length,
    actionsOverdue: overdue.length,
    actionsDone: done.length,
    totalCost,
    costPerMeeting: totalCost !== null && list.length > 0 ? totalCost / list.length : null,
    costPerProject: totalCost !== null && projects.length > 0 ? totalCost / projects.length : null,
    byMember: [...members.values()].sort((a, b) => b.meetings - a.meetings),
    series,
    seriesMode,
    ids: {
      all: list.map((i) => i.id),
      hot: list.filter((i) => i.potential === 'hot').map((i) => i.id),
      customers: list.filter((i) => i.relationship === 'customer').map((i) => i.id),
      todo: todo.map((i) => i.id),
      overdue: overdue.map((i) => i.id),
      withProject: list.filter((i) => projectOrigins.has(i.id)).map((i) => i.id),
    },
  };
}

export const formatEuros = (n: number, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(n);
