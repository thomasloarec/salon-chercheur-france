import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { boothErrorMessage } from '@/lib/booth/rpc';
import AppButton from '../ui/ChunkyButton';
import { clampGoal, GOAL_MAX, GOAL_MIN, GOAL_STEP } from './goal';
import { saveDailyGoal } from './dailyGoal';

export default function GoalSheet({
  open,
  onOpenChange,
  userId,
  workspaceId,
  current,
  online,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  workspaceId: string;
  current: number | null;
  online: boolean;
}) {
  const [value, setValue] = useState<string>(String(current ?? 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setValue(String(current ?? 10));
      setErr(null);
    }
  }, [open, current]);

  const n = Number(value);
  const valid = Number.isInteger(n) && n >= GOAL_MIN && n <= GOAL_MAX;
  const step = (d: number) => setValue(String(clampGoal((Number.isFinite(n) ? n : 0) + d)));

  const run = async (goal: number | null) => {
    setBusy(true);
    setErr(null);
    try {
      await saveDailyGoal(userId, workspaceId, goal);
      onOpenChange(false);
    } catch (e) {
      setErr(boothErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle className="font-semibold">Objectif de rencontres par jour</SheetTitle>
          <SheetDescription>Pour toute l'équipe, de {GOAL_MIN} à {GOAL_MAX}.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button type="button" aria-label="Moins 5" disabled={busy} onClick={() => step(-GOAL_STEP)} className="flex h-12 w-12 items-center justify-center rounded-xl border border-booth-line bg-background disabled:opacity-50">
            <Minus className="h-5 w-5" />
          </button>
          <Input
            type="number"
            inputMode="numeric"
            min={GOAL_MIN}
            max={GOAL_MAX}
            aria-label="Objectif"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-12 w-24 text-center text-xl font-semibold"
          />
          <button type="button" aria-label="Plus 5" disabled={busy} onClick={() => step(GOAL_STEP)} className="flex h-12 w-12 items-center justify-center rounded-xl border border-booth-line bg-background disabled:opacity-50">
            <Plus className="h-5 w-5" />
          </button>
        </div>
        {!valid && <p className="mt-2 text-center text-sm text-muted-foreground">Choisissez un nombre entre {GOAL_MIN} et {GOAL_MAX}.</p>}
        {err && <p className="mt-2 text-center text-sm text-destructive">{err}</p>}
        <div className="mt-5 space-y-2">
          <AppButton disabled={!online || !valid} loading={busy} onClick={() => void run(n)}>
            Enregistrer
          </AppButton>
          {!online && <p className="text-center text-xs text-muted-foreground">Réglable avec du réseau</p>}
          {current !== null && (
            <button type="button" disabled={!online || busy} onClick={() => void run(null)} className="mx-auto block min-h-[44px] text-sm font-medium text-primary underline underline-offset-2 disabled:opacity-50">
              Retirer l'objectif
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
