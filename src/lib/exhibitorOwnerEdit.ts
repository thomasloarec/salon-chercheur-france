/**
 * Phase 4A-C — Logique pure (sans DOM) pour l'édition owner de la fiche
 * exposant. Extraite ici pour être unit-testable et partagée par l'UI.
 */

export interface OwnerEditVisibilityInput {
  /** L'utilisateur est connecté. */
  isAuthenticated: boolean;
  /** UUID exhibitor moderne (NULL/undefined = profil legacy pur). */
  exhibitorId: string | null | undefined;
  /** Profil de test. */
  isTest: boolean | null | undefined;
  /**
   * Gestionnaire validé (owner direct OU team member owner/admin actif),
   * dérivé de useExhibitorGovernance.isManager.
   */
  isManager: boolean;
}

/**
 * Décide si le bouton "Modifier cette fiche" doit être affiché.
 * Règles : connecté + fiche moderne (exhibitor_id) + non-test + gestionnaire.
 * Les profils legacy purs (exhibitor_id NULL) et les profils test ne sont
 * jamais éditables.
 */
export function canEditExhibitorProfile(input: OwnerEditVisibilityInput): boolean {
  return (
    input.isAuthenticated === true &&
    !!input.exhibitorId &&
    input.isTest !== true &&
    input.isManager === true
  );
}

/**
 * Préremplissage de la description du drawer d'édition owner.
 *
 * Priorité (Bloc C) :
 *   1. exhibitors.description brut (champ éditorial humain, via get_editable) ;
 *   2. à défaut, la description ACTUELLEMENT AFFICHÉE et résolue sur la fiche
 *      publique (owner > IA > legacy, déjà nettoyée des refus IA) passée en
 *      `displayedFallback` — pour qu'une fiche à description IA s'ouvre
 *      préremplie, prête à être adoptée/ajustée.
 *
 * La SAUVEGARDE écrit toujours exhibitors.description (champ cible inchangé).
 * Sans aucune description disponible (raw vide ET pas de fallback) → '' →
 * textarea vide + placeholder.
 */
export function resolveDescriptionPrefill(
  editable: { description: string | null } | null | undefined,
  displayedFallback?: string | null,
): string {
  const raw = editable?.description;
  if (raw && raw.trim().length > 0) return raw;
  const fallback = displayedFallback?.trim();
  return fallback ? (displayedFallback as string) : '';
}