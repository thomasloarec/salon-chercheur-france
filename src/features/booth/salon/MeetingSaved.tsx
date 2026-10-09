import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { AppButton } from '../ui/ChunkyButton';
import Confetti from '../ui/Confetti';
import CountUp from '../ui/CountUp';
import { haptic, useCalmMotion } from '../ui/motion';
import { goalJustReached, type DayStats } from './savedStats';

export default function MeetingSaved({
  line1,
  line2,
  before,
  after,
  goal,
  onNext,
  onHome,
}: {
  line1: string;
  line2: string;
  before: DayStats;
  after: DayStats;
  goal: number | null;
  onNext: () => void;
  onHome: () => void;
}) {
  const calm = useCalmMotion();
  const reached = goalJustReached(before.team, after.team, goal);
  useEffect(() => haptic([12, 40, 12]), []);
  const goalPct = goal ? Math.min(1, after.team / goal) : 0;

  return (
    <div className="flex flex-1 flex-col md:px-4 md:py-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center md:mx-auto md:w-full md:max-w-xl md:flex-none md:rounded-xl md:border md:border-border md:bg-background md:py-12 md:shadow-[0_1px_2px_hsl(var(--lx-shadow)/0.05)]">
        <div className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full bg-success-surface">
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-success"
            initial={calm ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="hsl(var(--primary-foreground))"
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={calm ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: calm ? 0 : 0.2 }}
              />
            </svg>
          </motion.div>
          <Confetti count={reached ? 28 : 14} />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-[-0.01em]">{reached ? 'Objectif du jour atteint' : 'Rencontre enregistrée'}</h2>
          {line1 && <p className="text-muted-foreground">{line1}</p>}
          {line2 && <p className="text-muted-foreground">{line2}</p>}
        </div>

        <div className="grid w-full max-w-sm grid-cols-3 divide-x divide-border rounded-xl border border-border bg-background shadow-[0_1px_2px_hsl(var(--lx-shadow)/0.05)]">
          <div className="px-2 py-3">
            <p className="text-xl font-semibold"><CountUp from={before.mine} to={after.mine} /></p>
            <p className="text-[13px] text-muted-foreground">vos rencontres</p>
          </div>
          <div className="px-2 py-3">
            <p className="flex items-center justify-center gap-1 text-xl font-semibold">
              <Flame className="h-4 w-4 text-flame-deep" aria-hidden="true" />
              <CountUp from={before.hot} to={after.hot} />
            </p>
            <p className="text-[13px] text-muted-foreground">chauds</p>
          </div>
          <div className="px-2 py-3">
            {goal ? (
              <>
                <p className="text-xl font-semibold"><CountUp from={before.team} to={after.team} />/{goal}</p>
                <div className="mx-auto mt-1 h-1 w-12 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-success" style={{ width: `${goalPct * 100}%` }} />
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">objectif équipe</p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold"><CountUp from={before.team} to={after.team} /></p>
                <p className="text-[13px] text-muted-foreground">rencontres équipe</p>
              </>
            )}
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3 md:max-w-none md:flex-row md:justify-center">
          <AppButton data-primary="" className="md:w-auto md:min-w-[200px]" onClick={onNext}>Rencontre suivante</AppButton>
          <AppButton variant="secondary" className="md:w-auto md:min-w-[200px]" onClick={onHome}>Retour à l'accueil</AppButton>
        </div>
      </div>
    </div>
  );
}
