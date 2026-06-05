// Read-only labels & badge styles for the reconciliation preview.
// No action is ever derived from these — display only.

export const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  auto_reconcilable: {
    label: 'Auto-réconciliable',
    variant: 'outline',
    className: 'border-emerald-500 text-emerald-700 bg-emerald-50',
  },
  manual_review: {
    label: 'À valider manuellement',
    variant: 'outline',
    className: 'border-amber-500 text-amber-700 bg-amber-50',
  },
  dangerous: {
    label: 'Dangereux',
    variant: 'destructive',
  },
  likely_false_positive: {
    label: 'Faux positif probable',
    variant: 'outline',
    className: 'border-slate-400 text-slate-600 bg-slate-50',
  },
};

export const CATEGORY_META: Record<string, { label: string; hint: string }> = {
  B: { label: 'B', hint: 'Legacy + moderne complémentaires, sûr' },
  A_SAFE: { label: 'A_SAFE', hint: 'Même domaine + nom proche, sûr' },
  A2: { label: 'A2', hint: 'Même domaine seul, à vérifier' },
  D: { label: 'D', hint: 'Domaines différents mais même nom' },
  E: { label: 'E', hint: 'Domaines différents, noms différents' },
  F: { label: 'F', hint: 'Dépendances actives présentes' },
  shared_domain: { label: 'Domaine partagé', hint: 'Domaine générique/partagé' },
  other: { label: 'Autre', hint: 'Cas non classé automatiquement' },
};

export function statusConclusion(status: string): string {
  switch (status) {
    case 'auto_reconcilable':
      return 'Correction potentiellement automatisable plus tard.';
    case 'manual_review':
      return 'Validation manuelle obligatoire.';
    case 'dangerous':
      return 'Dangereux : données actives présentes des deux côtés.';
    case 'likely_false_positive':
      return 'Faux positif probable : domaine partagé ou générique.';
    default:
      return 'Statut inconnu.';
  }
}

export function confidenceLabel(c: string | null | undefined): string {
  switch ((c || '').toLowerCase()) {
    case 'high':
      return 'Élevée';
    case 'medium':
      return 'Moyenne';
    case 'low':
      return 'Faible';
    default:
      return c || '—';
  }
}

const REASON_LABELS: Record<string, string> = {
  same_domain: 'Même domaine web',
  name_close: 'Nom très proche',
  same_name: 'Nom identique',
  website_conflict: 'Domaines différents',
};

export function readableReasons(reasons: Record<string, unknown> | null): string[] {
  if (!reasons) return [];
  return Object.entries(reasons)
    .filter(([, v]) => v === true || (typeof v === 'number' && v > 0) || (typeof v === 'string' && v))
    .map(([k]) => REASON_LABELS[k] || k);
}
