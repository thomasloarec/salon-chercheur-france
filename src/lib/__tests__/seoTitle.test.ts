import { describe, expect, it } from 'bun:test';
import { buildSeoTitle, cutWords } from '../seoTitle';

describe('cutWords', () => {
  it('ne coupe pas un texte plus court que la limite', () => {
    expect(cutWords('Court texte', 20)).toBe('Court texte');
  });

  it('coupe sur un mot entier', () => {
    expect(cutWords('Cfia Toulouse 2026 Salon', 16)).toBe('Cfia Toulouse');
  });

  it('ne laisse pas de ponctuation en fin de coupe', () => {
    expect(cutWords('Alpha Beta, Gamma Delta', 12)).toBe('Alpha Beta');
  });
});

describe('buildSeoTitle', () => {
  it('laisse le title intact quand tout tient', () => {
    expect(buildSeoTitle('Salons à Paris', '| Lotexpo', 70)).toBe(
      'Salons à Paris | Lotexpo',
    );
  });

  it('tronque le socle AVANT de coller le suffixe de marque (jamais « | Lot »)', () => {
    const title = buildSeoTitle(
      'Cinq voiliers RM à flot au Grand Pavois : RM890, RM1080 et RM1380 à bord',
      '| Lotexpo',
      70,
    );
    expect(title.length).toBeLessThanOrEqual(70);
    expect(title.endsWith('| Lotexpo')).toBe(true);
    expect(title.endsWith('| Lot')).toBe(false);
  });

  it('garde le suffixe long complet sur les pages salon (jamais « – Lotexp »)', () => {
    const title = buildSeoTitle(
      'Cfia Toulouse 2026',
      '| Salon professionnel à Aussonne – Lotexpo',
      60,
    );
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('– Lotexpo')).toBe(true);
  });

  it('applique le préfixe [Terminé] dans le budget de 60 caractères', () => {
    const title = buildSeoTitle(
      'Foire internationale de Bordeaux pendant la saison des vendanges',
      '| Salon professionnel à Bordeaux – Lotexpo',
      60,
      '[Terminé]',
    );
    expect(title.startsWith('[Terminé] ')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('– Lotexpo')).toBe(true);
  });

  it('déduplique les espaces du socle', () => {
    expect(buildSeoTitle('Nom   double   espaces', '| Lotexpo', 70)).toBe(
      'Nom double espaces | Lotexpo',
    );
  });
});
