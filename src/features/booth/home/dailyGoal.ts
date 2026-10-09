import { setDailyGoal } from '@/lib/booth/rpc';
import { readCache, writeCache } from '../sync/cache';

/** Enregistre l'objectif côté serveur puis met à jour le cache local. Réseau obligatoire. */
export async function saveDailyGoal(userId: string, workspaceId: string, goal: number | null) {
  await setDailyGoal(workspaceId, goal);
  const c = await readCache(userId, workspaceId);
  if (c) await writeCache({ ...c, workspace: { ...c.workspace, daily_goal: goal } });
}
