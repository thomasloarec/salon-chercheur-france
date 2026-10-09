import type { Interaction } from '@/lib/booth/types';
import { ownerOf, ymd } from './labels';

export interface DayStats {
  mine: number;
  hot: number;
  team: number;
}

/** Chiffres du jour pour un salon, sans la rencontre exclue (celle qu'on vient d'enregistrer). */
export function dayStats(
  interactions: Interaction[],
  workspaceId: string,
  me: string,
  excludeId: string | null,
  now: Date = new Date(),
): DayStats {
  const today = ymd(now);
  const s: DayStats = { mine: 0, hot: 0, team: 0 };
  for (const i of interactions) {
    if (i.id === excludeId || i.status === 'cancelled') continue;
    if (i.workspace_id && i.workspace_id !== workspaceId) continue;
    if (!i.occurred_at || ymd(new Date(i.occurred_at)) !== today) continue;
    s.team++;
    if (ownerOf(i, me) === me) {
      s.mine++;
      if (i.potential === 'hot') s.hot++;
    }
  }
  return s;
}

export function addSaved(before: DayStats, potential: Interaction['potential'] | null): DayStats {
  return { mine: before.mine + 1, hot: before.hot + (potential === 'hot' ? 1 : 0), team: before.team + 1 };
}

/** Vrai seulement si l'objectif d'équipe est franchi par cette rencontre. */
export function goalJustReached(before: number, after: number, goal: number | null | undefined): boolean {
  return !!goal && goal > 0 && before < goal && after >= goal;
}
