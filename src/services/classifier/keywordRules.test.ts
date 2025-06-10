
import { ruleBasedType, classifyEvent } from './keywordRules';

describe('Event Type Classification', () => {
  describe('Salon classification', () => {
    test('should classify salon events correctly', () => {
      expect(ruleBasedType('Salon de l\'automobile')).toBe('salon');
      expect(ruleBasedType('Expo Tech 2024')).toBe('salon');
      expect(ruleBasedType('Foire aux vins')).toBe('salon');
      expect(ruleBasedType('Grande exposition artistique')).toBe('salon');
    });
  });

  describe('Convention classification', () => {
    test('should classify convention events correctly', () => {
      expect(ruleBasedType('Convention annuelle')).toBe('convention');
      expect(ruleBasedType('Rencontre professionnelle')).toBe('convention');
      expect(ruleBasedType('Meeting des entreprises')).toBe('convention');
    });
  });

  describe('Congrès classification', () => {
    test('should classify congrès events correctly', () => {
      expect(ruleBasedType('Congrès médical international')).toBe('congres');
      expect(ruleBasedType('Symposium scientifique')).toBe('congres');
      expect(ruleBasedType('Colloque universitaire')).toBe('congres');
      expect(ruleBasedType('Assises nationales')).toBe('congres');
    });
  });

  describe('Conférence classification', () => {
    test('should classify conférence events correctly', () => {
      expect(ruleBasedType('Conférence TED')).toBe('conference');
      expect(ruleBasedType('Forum économique')).toBe('conference');
      expect(ruleBasedType('Summit technologique')).toBe('conference');
      expect(ruleBasedType('Webinar formation')).toBe('conference');
      expect(ruleBasedType('Séminaire management')).toBe('conference');
    });
  });

  describe('Cérémonie classification', () => {
    test('should classify cérémonie events correctly', () => {
      expect(ruleBasedType('Cérémonie de remise des diplômes')).toBe('ceremonie');
      expect(ruleBasedType('Gala de charité')).toBe('ceremonie');
      expect(ruleBasedType('Remise de prix excellence')).toBe('ceremonie');
      expect(ruleBasedType('Awards 2024')).toBe('ceremonie');
    });
  });

  describe('Loisir classification', () => {
    test('should classify loisir events correctly', () => {
      expect(ruleBasedType('Concert de jazz')).toBe('loisir');
      expect(ruleBasedType('Spectacle de danse')).toBe('loisir');
      expect(ruleBasedType('Festival de musique')).toBe('loisir');
      expect(ruleBasedType('Match de football')).toBe('loisir');
      expect(ruleBasedType('Show humoristique')).toBe('loisir');
    });
  });

  describe('Inconnu classification', () => {
    test('should return inconnu for unclassifiable events', () => {
      expect(ruleBasedType('Événement mystérieux')).toBe('inconnu');
      expect(ruleBasedType('Activité non définie')).toBe('inconnu');
      expect(ruleBasedType('Rassemblement général')).toBe('inconnu');
    });
  });

  describe('classifyEvent function', () => {
    test('should classify using both title and description', () => {
      expect(classifyEvent('Événement tech', 'Une grande exposition de nouvelles technologies')).toBe('salon');
      expect(classifyEvent('Réunion annuelle', 'Convention des professionnels du secteur')).toBe('convention');
      expect(classifyEvent('Journée scientifique', 'Congrès international de recherche')).toBe('congres');
    });

    test('should handle missing description', () => {
      expect(classifyEvent('Salon automobile')).toBe('salon');
      expect(classifyEvent('Concert rock', undefined)).toBe('loisir');
    });
  });
});
