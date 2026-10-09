/** Logique pure de l'accueil du salon : carte d'objectif, sous-titre, tuiles, feuille de reprise. */

export type StartMode = 'dictate' | 'badge' | 'card';

export interface GoalInput {
  team: number;
  mine: number;
  hot: number;
  goal: number | null | undefined;
  isManager: boolean;
  archived: boolean;
}

export interface GoalView {
  goal: number | null;
  reached: boolean;
  center: string;
  title: string;
  subtitle: string | null;
  mine: string;
  hot: string;
  canEdit: boolean;
  showSetLink: boolean;
}

export const GOAL_MIN = 1;
export const GOAL_MAX = 500;
export const GOAL_STEP = 5;
export const clampGoal = (n: number) => Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(Number.isFinite(n) ? n : GOAL_MIN)));

export function goalView(i: GoalInput): GoalView {
  const goal = typeof i.goal === 'number' && i.goal > 0 ? i.goal : null;
  const reached = goal !== null && i.team >= goal;
  const canEdit = i.isManager && !i.archived;
  const left = goal !== null ? goal - i.team : 0;
  return {
    goal,
    reached,
    center: goal !== null ? `${i.team}/${goal}` : String(i.team),
    title: goal === null ? "Rencontres de l'équipe aujourd'hui" : reached ? 'Objectif atteint' : 'Objectif du jour',
    subtitle: goal !== null && !reached ? `Encore ${left} rencontre${left > 1 ? 's' : ''} pour l'équipe.` : null,
    mine: `Vous : ${i.mine}`,
    hot: `${i.hot} chaud${i.hot > 1 ? 's' : ''}`,
    canEdit,
    showSetLink: goal === null && canEdit,
  };
}

/** Vrai la première fois seulement, pour ce salon, ce jour et cet appareil. */
export function shouldCelebrate(storage: Pick<Storage, 'getItem' | 'setItem'> | null, workspaceId: string, ymd: string): boolean {
  if (!storage) return false;
  const k = `lx-goal-confetti|${workspaceId}|${ymd}`;
  try {
    if (storage.getItem(k)) return false;
    storage.setItem(k, '1');
    return true;
  } catch {
    return false;
  }
}

const toUtc = (ymd: string) => {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** « J-15 · Stand A12 », « Jour 2 sur 3 · Stand A12 » ou « Après le salon ». */
export function homeSubtitle(ws: { date_debut: string | null; date_fin: string | null; stand_label: string | null }, todayYmd: string): string {
  const parts: string[] = [];
  if (ws.date_debut) {
    const DAY = 86_400_000;
    const today = toUtc(todayYmd);
    const start = toUtc(ws.date_debut);
    const end = toUtc(ws.date_fin || ws.date_debut);
    const total = Math.round((end - start) / DAY) + 1;
    if (today < start) parts.push(`J-${Math.round((start - today) / DAY)}`);
    else if (today > end) parts.push('Après le salon');
    else parts.push(`Jour ${Math.round((today - start) / DAY) + 1} sur ${total}`);
  }
  if (ws.stand_label) parts.push(`Stand ${ws.stand_label}`);
  return parts.join(' · ');
}

/** Tuiles d'accès rapide visibles selon les fonctions disponibles. Aucune sur un salon archivé. */
export function quickTiles(f: { voice: boolean; card: boolean; archived: boolean }): StartMode[] {
  if (f.archived) return [];
  const out: StartMode[] = [];
  if (f.voice) out.push('dictate');
  out.push('badge');
  if (f.card) out.push('card');
  return out;
}

/** Appui sur « Nouvelle rencontre » ou une tuile : feuille si un brouillon existe, sinon ouverture directe. */
export function startDecision(hasDraft: boolean): 'sheet' | 'open' {
  return hasDraft ? 'sheet' : 'open';
}

export type ResumeChoice = 'resume' | 'new' | 'cancel';
export interface ResumeAction {
  clearDraft: boolean;
  open: 'draft' | 'new' | null;
  mode: StartMode | null;
}

/** Effet de chaque bouton de la feuille « Une rencontre est en cours ». */
export function resolveResume(choice: ResumeChoice, mode: StartMode | null): ResumeAction {
  if (choice === 'resume') return { clearDraft: false, open: 'draft', mode: null };
  if (choice === 'new') return { clearDraft: true, open: 'new', mode };
  return { clearDraft: false, open: null, mode: null };
}
