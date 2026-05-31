import {
  canEditExhibitorProfile,
  resolveDescriptionPrefill,
} from '@/lib/exhibitorOwnerEdit';
import { normalizeExternalUrl, normalizeLinkedInUrl } from '@/lib/urlUtils';
import {
  validateLogoFile,
  LOGO_MAX_BYTES,
} from '@/lib/exhibitorLogoUpload';

// Petit helper : un objet ressemblant à un File pour validateLogoFile
// (on n'a besoin que de type + size).
const fakeFile = (type: string, size: number) =>
  ({ type, size }) as unknown as File;

describe('canEditExhibitorProfile — visibilité du bouton', () => {
  const manager = {
    isAuthenticated: true,
    exhibitorId: 'uuid-1',
    isTest: false,
    isManager: true,
  };

  it('gestionnaire validé connecté sur fiche moderne → bouton visible', () => {
    expect(canEditExhibitorProfile(manager)).toBe(true);
  });

  it('utilisateur non connecté → pas de bouton', () => {
    expect(canEditExhibitorProfile({ ...manager, isAuthenticated: false })).toBe(false);
  });

  it('non-gestionnaire → pas de bouton', () => {
    expect(canEditExhibitorProfile({ ...manager, isManager: false })).toBe(false);
  });

  it('profil legacy pur (exhibitor_id NULL) → pas de bouton', () => {
    expect(canEditExhibitorProfile({ ...manager, exhibitorId: null })).toBe(false);
  });

  it('profil test → pas de bouton', () => {
    expect(canEditExhibitorProfile({ ...manager, isTest: true })).toBe(false);
  });
});

describe('resolveDescriptionPrefill — source du préremplissage', () => {
  it('utilise exhibitors.description quand présent', () => {
    expect(resolveDescriptionPrefill({ description: 'Texte humain' })).toBe('Texte humain');
  });

  it('description NULL → chaîne vide (jamais de fallback IA/legacy)', () => {
    expect(resolveDescriptionPrefill({ description: null })).toBe('');
    expect(resolveDescriptionPrefill(null)).toBe('');
    expect(resolveDescriptionPrefill(undefined)).toBe('');
  });
});

describe('validation website (miroir frontend)', () => {
  it('domaine nu "horn.fr" accepté et normalisé en https', () => {
    expect(normalizeExternalUrl('horn.fr')).toBe('https://horn.fr/');
  });
  it('texte libre invalide → null', () => {
    expect(normalizeExternalUrl('pas une url')).toBeNull();
  });
});

describe('validation LinkedIn (miroir frontend)', () => {
  it('page company acceptée', () => {
    expect(normalizeLinkedInUrl('linkedin.com/company/acme')).toBe(
      'https://linkedin.com/company/acme',
    );
  });
  it('page showcase acceptée', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/showcase/acme')).toContain(
      '/showcase/acme',
    );
  });
  it('profil personnel /in/ refusé', () => {
    expect(normalizeLinkedInUrl('https://linkedin.com/in/jean')).toBeNull();
  });
});

describe('validateLogoFile — formats et taille', () => {
  it('accepte JPEG/PNG/WebP', () => {
    expect(validateLogoFile(fakeFile('image/jpeg', 1000)).ok).toBe(true);
    expect(validateLogoFile(fakeFile('image/png', 1000)).ok).toBe(true);
    expect(validateLogoFile(fakeFile('image/webp', 1000)).ok).toBe(true);
  });
  it('refuse le SVG', () => {
    expect(validateLogoFile(fakeFile('image/svg+xml', 1000)).ok).toBe(false);
  });
  it('refuse un fichier > 5 Mo', () => {
    expect(validateLogoFile(fakeFile('image/png', LOGO_MAX_BYTES + 1)).ok).toBe(false);
  });
});