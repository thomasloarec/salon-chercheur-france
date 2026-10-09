import { renderToStaticMarkup } from 'react-dom/server';
import { goalView, homeSubtitle, quickTiles, resolveResume, shouldCelebrate, startDecision } from '../goal';
import { DraftCard, QuickTiles, ResumeChoices } from '../HomeParts';

const base = { team: 2, mine: 1, hot: 1, isManager: false, archived: false };

describe('carte d’objectif', () => {
  it('avec objectif', () => {
    const v = goalView({ ...base, goal: 12 });
    expect(v.center).toBe('2/12');
    expect(v.title).toBe('Objectif du jour');
    expect(v.subtitle).toBe("Encore 10 rencontres pour l'équipe.");
    expect(v.mine).toBe('Vous : 1');
    expect(v.hot).toBe('1 chaud');
    expect(v.reached).toBe(false);
  });
  it('objectif atteint', () => {
    const v = goalView({ ...base, team: 12, hot: 3, goal: 12 });
    expect(v.title).toBe('Objectif atteint');
    expect(v.subtitle).toBeNull();
    expect(v.hot).toBe('3 chauds');
    expect(v.reached).toBe(true);
  });
  it('sans objectif, manager : lien pour fixer', () => {
    const v = goalView({ ...base, goal: null, isManager: true });
    expect(v.center).toBe('2');
    expect(v.title).toBe("Rencontres de l'équipe aujourd'hui");
    expect(v.showSetLink).toBe(true);
    expect(v.canEdit).toBe(true);
  });
  it('sans objectif, terrain : pas de réglage', () => {
    const v = goalView({ ...base, goal: null });
    expect(v.showSetLink).toBe(false);
    expect(v.canEdit).toBe(false);
  });
  it('salon archivé : pas de réglage même pour un manager', () => {
    expect(goalView({ ...base, goal: 5, isManager: true, archived: true }).canEdit).toBe(false);
  });
  it('sous-titre du salon', () => {
    const ws = { date_debut: '2026-10-06', date_fin: '2026-10-08', stand_label: 'Test A12' };
    expect(homeSubtitle(ws, '2026-09-21')).toBe('J-15 · Stand Test A12');
    expect(homeSubtitle(ws, '2026-10-07')).toBe('Jour 2 sur 3 · Stand Test A12');
  });
});

describe('confettis', () => {
  it('une seule fois par jour et par salon', () => {
    const m = new Map<string, string>();
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(shouldCelebrate(st, 'w1', '2026-10-07')).toBe(true);
    expect(shouldCelebrate(st, 'w1', '2026-10-07')).toBe(false);
    expect(shouldCelebrate(st, 'w1', '2026-10-08')).toBe(true);
    expect(shouldCelebrate(null, 'w1', '2026-10-09')).toBe(false);
  });
});

describe('rencontre en cours', () => {
  it('nom sur une ligne tronquée, effacer accessible', () => {
    const html = renderToStaticMarkup(<DraftCard label={'Jean Dupont · ' + 'Très longue entreprise '.repeat(8)} onResume={() => {}} onClear={() => {}} />);
    expect(html).toMatch(/class="block truncate [^"]*"/);
    expect(html).toContain('aria-label="Effacer le brouillon"');
    expect(html).toContain('Reprendre');
  });
});

describe('tuiles d’accès rapide', () => {
  it('masquées si la fonction n’est pas disponible', () => {
    expect(quickTiles({ voice: false, card: false, archived: false })).toEqual(['badge']);
    expect(quickTiles({ voice: true, card: true, archived: false })).toEqual(['dictate', 'badge', 'card']);
    expect(quickTiles({ voice: true, card: true, archived: true })).toEqual([]);
    const html = renderToStaticMarkup(<QuickTiles modes={['badge']} online onPick={() => {}} />);
    expect(html).toContain('data-tile="badge"');
    expect(html).not.toContain('data-tile="dictate"');
    expect(html).not.toContain('data-tile="card"');
  });
  it('dicter sans réseau : désactivée avec le message', () => {
    const html = renderToStaticMarkup(<QuickTiles modes={['dictate', 'badge']} online={false} onPick={() => {}} />);
    expect(html).toMatch(/data-tile="dictate" disabled=""/);
    expect(html).toContain('Dictée disponible avec du réseau');
  });
});

describe('feuille « Une rencontre est en cours »', () => {
  it('apparaît seulement s’il existe un brouillon', () => {
    expect(startDecision(true)).toBe('sheet');
    expect(startDecision(false)).toBe('open');
  });
  it('chaque choix fait la bonne action', () => {
    expect(resolveResume('resume', 'badge')).toEqual({ clearDraft: false, open: 'draft', mode: null });
    expect(resolveResume('new', 'badge')).toEqual({ clearDraft: true, open: 'new', mode: 'badge' });
    expect(resolveResume('new', null)).toEqual({ clearDraft: true, open: 'new', mode: null });
    expect(resolveResume('cancel', 'dictate')).toEqual({ clearDraft: false, open: null, mode: null });
  });
  it('affiche le nom et les trois choix', () => {
    const html = renderToStaticMarkup(<ResumeChoices name="Jean Dupont · Acme" onChoice={() => {}} />);
    expect(html).toContain('Jean Dupont · Acme');
    expect(html).toContain('Reprendre la rencontre');
    expect(html).toContain('Commencer une nouvelle rencontre');
    expect(html).toContain('Annuler');
  });
});
