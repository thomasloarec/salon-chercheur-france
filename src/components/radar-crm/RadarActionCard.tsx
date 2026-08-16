import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Carte d'action de la Vue d'ensemble Radar CRM.
 * Cliquable, sobre : la valeur en grand, le libellé dessous, la barre en bas.
 */
const RadarActionCard: React.FC<{
  value: number;
  target?: number | null;
  label: string;
  hint?: React.ReactNode;
  showBar?: boolean;
  onClick?: () => void;
}> = ({ value, target, label, hint, showBar = true, onClick }) => {
  const pct = target && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <Card
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); }
      }}
      className={cn(
        'shadow-none bg-card border-border/60',
        onClick && 'cursor-pointer transition-colors hover:bg-muted/40 hover:border-border',
      )}
    >
      <CardContent className="px-5 pt-6 pb-5">
        <p className="font-display text-3xl font-semibold leading-none tracking-tight text-foreground">
          {value}
          {typeof target === 'number' && (
            <span className="text-muted-foreground text-xl font-normal"> / {target}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-2 font-medium">{label}</p>
        {hint && <div className="text-[11px] mt-1">{hint}</div>}
        {showBar && (
          <div className="mt-3 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RadarActionCard;
