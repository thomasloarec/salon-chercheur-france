import { useEffect, useState } from 'react';
import { Check, Flame } from 'lucide-react';
import { ConfettiView } from '../ui/Confetti';
import { useCalmMotion } from '../ui/motion';
import GoalRing from './GoalRing';
import { goalView, shouldCelebrate, type GoalInput } from './goal';

const safeStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** Carte navy de l'objectif du jour. Un manager l'ouvre pour régler l'objectif. */
export default function GoalCard({
  input,
  workspaceId,
  todayYmd,
  onEdit,
}: {
  input: GoalInput;
  workspaceId: string;
  todayYmd: string;
  onEdit: () => void;
}) {
  const v = goalView(input);
  const calm = useCalmMotion();
  const [party, setParty] = useState(false);
  useEffect(() => {
    if (v.reached && shouldCelebrate(safeStorage(), workspaceId, todayYmd)) setParty(true);
  }, [v.reached, workspaceId, todayYmd]);

  const body = (
    <>
      <GoalRing value={input.team} max={v.goal} reached={v.reached} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-base font-semibold leading-snug text-background">
          {v.reached && <Check className="h-5 w-5 shrink-0 text-mint-bright" aria-hidden="true" />}
          {v.title}
        </p>
        {v.subtitle && <p className="mt-0.5 text-sm leading-snug text-booth-on-navy">{v.subtitle}</p>}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-booth-on-navy">
          <span>{v.mine}</span>
          <span className="inline-flex items-center gap-1">
            <Flame className="h-4 w-4 text-flame" aria-hidden="true" />
            {v.hot}
          </span>
        </p>
        {v.showSetLink && (
          <span className="mt-1.5 inline-flex min-h-[44px] items-center text-sm font-medium text-booth-sky-text underline underline-offset-2">
            Fixer un objectif
          </span>
        )}
      </div>
    </>
  );

  const cls = 'relative flex w-full items-center gap-4 rounded-2xl bg-booth-navy p-4 text-left';
  return (
    <div className="relative" data-goal-card="">
      {v.canEdit ? (
        <button type="button" className={`${cls} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`} onClick={onEdit} aria-label={v.showSetLink ? undefined : `${v.title}, modifier l'objectif`}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
      {party && <ConfettiView count={14} calm={calm} />}
    </div>
  );
}
