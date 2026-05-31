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
 * Source EXACTE du préremplissage de la description : uniquement le champ
 * éditorial humain brut exhibitors.description (renvoyé par get_editable).
 *
 * Garantie critique : on n'utilise JAMAIS ai_summary, jamais la description
 * legacy (exposant_description), jamais la valeur calculée
 * public_exhibitor_profiles.description (COALESCE). Si la valeur brute est
 * NULL/vide, on renvoie '' → textarea vide.
 */
export function resolveDescriptionPrefill(
  editable: { description: string | null } | null | undefined,
): string {
  return editable?.description ?? '';
}