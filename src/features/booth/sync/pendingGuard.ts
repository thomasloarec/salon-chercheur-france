import { getAllByPrefix } from '../storage/db';
import type { OutboxItem } from './engine';

/** Nombre d'éléments Lotexpo Leads non envoyés (en attente ou à reprendre) pour un utilisateur, cartes à lire comprises. */
export async function getPendingCountForUser(userId: string): Promise<number> {
  let n = 0;
  try {
    const items = await getAllByPrefix<OutboxItem>('outbox', `${userId}|`);
    n += items.length;
  } catch {
    // ignorer
  }
  try {
    const cards = await getAllByPrefix<{ key: string; state?: string }>('meta', `cardq|${userId}|`);
    n += cards.filter((c) => c.state === 'pending').length;
  } catch {
    // ignorer
  }
  return n;
}
