import type { FlowStep, MeetingDraft } from './draft';

type StepDraft = Pick<MeetingDraft, 'step' | 'history' | 'relationship' | 'potential' | 'customer_topic'>;

/** Étapes restantes après l'étape donnée, selon les choix déjà faits. */
export function stepsAfter(step: FlowStep, d: Omit<StepDraft, 'step' | 'history'>): FlowStep[] {
  const tail: FlowStep[] = ['action', 'details'];
  const afterRel = (): FlowStep[] =>
    d.relationship === 'customer'
      ? ['topic', ...(d.customer_topic === 'new_project' || !d.customer_topic ? (['concrete'] as FlowStep[]) : []), ...tail]
      : ['pot', ...(d.potential === 'none' ? [] : (['concrete', ...tail] as FlowStep[]))];
  switch (step) {
    case 'who':
      return ['coord', 'rel', ...afterRel()];
    case 'verify':
    case 'coord':
      return ['rel', ...afterRel()];
    case 'rel':
      return afterRel();
    case 'pot':
      return d.potential === 'none' ? [] : ['concrete', ...tail];
    case 'topic':
      return d.customer_topic && d.customer_topic !== 'new_project' ? tail : ['concrete', ...tail];
    case 'concrete':
      return tail;
    case 'action':
      return ['details'];
    default:
      return [];
  }
}

/** Compteur « 5/7 » : étapes déjà parcourues + étape actuelle + étapes prévues. */
export function stepCounter(d: StepDraft): { index: number; total: number } {
  const index = d.history.length + 1;
  return { index, total: index + stepsAfter(d.step, d).length };
}
