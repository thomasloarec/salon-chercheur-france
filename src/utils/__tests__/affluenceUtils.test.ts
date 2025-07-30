import { formatAffluence, formatAffluenceWithSuffix } from '../affluenceUtils';

describe('affluenceUtils', () => {
  describe('formatAffluence', () => {
    it('devrait formater un nombre valide', () => {
      expect(formatAffluence('15000')).toBe('15 000');
      expect(formatAffluence('1000')).toBe('1 000');
      expect(formatAffluence('500')).toBe('500');
    });

    it('devrait formater un nombre directement', () => {
      expect(formatAffluence(15000)).toBe('15 000');
      expect(formatAffluence(1000)).toBe('1 000');
    });

    it('devrait retourner la valeur originale si non numérique', () => {
      expect(formatAffluence('Inconnu')).toBe('Inconnu');
      expect(formatAffluence('Non défini')).toBe('Non défini');
      expect(formatAffluence('abc123')).toBe('abc123');
    });

    it('devrait retourner "Affluence inconnue" pour valeurs vides', () => {
      expect(formatAffluence('')).toBe('Affluence inconnue');
      expect(formatAffluence(undefined)).toBe('Affluence inconnue');
      expect(formatAffluence(null as any)).toBe('Affluence inconnue');
    });

    it('devrait gérer les cas limites', () => {
      expect(formatAffluence('0')).toBe('0');
      expect(formatAffluence(0)).toBe('0');
      expect(formatAffluence('NaN')).toBe('NaN');
      expect(formatAffluence('Infinity')).toBe('Infinity');
    });
  });

  describe('formatAffluenceWithSuffix', () => {
    it('devrait ajouter le suffixe pour les nombres valides', () => {
      expect(formatAffluenceWithSuffix('15000')).toBe('15 000 visiteurs attendus');
      expect(formatAffluenceWithSuffix(1000)).toBe('1 000 visiteurs attendus');
    });

    it('devrait retourner la valeur sans suffixe pour les textes', () => {
      expect(formatAffluenceWithSuffix('Inconnu')).toBe('Inconnu');
      expect(formatAffluenceWithSuffix('Non défini')).toBe('Non défini');
    });

    it('devrait retourner "Affluence inconnue" pour valeurs vides', () => {
      expect(formatAffluenceWithSuffix('')).toBe('Affluence inconnue');
      expect(formatAffluenceWithSuffix(undefined)).toBe('Affluence inconnue');
    });
  });
});