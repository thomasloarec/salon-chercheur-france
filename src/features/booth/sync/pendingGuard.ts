import { getAllByPrefix } from '../storage/db';
import type { OutboxItem } from './engine';

/** Nombre d'éléments Lotexpo Leads non envoyés (en attente ou à reprendre) pour un utilisateur. */
export async function getPendingCountForUser(userId: string): Promise<number> {
  try {
    const items = await getAllByPrefix<OutboxItem>('outbox', `${userId}|`);
    return items.length;
  } catch {
    return 0;
  }
}
