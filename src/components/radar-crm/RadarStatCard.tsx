import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Carte statistique Radar CRM (présentationnelle, props only — aucun hook).
 * Source de vérité partagée entre le cockpit (RadarCrmResults) et les aperçus
 * de la landing. Discipline « un seul accent » : seul le chiffre clé (accent)
 * porte l'orange ; les autres restent neutres (navy / foreground).
 */
const RadarStatCard: React.FC<{
  label: string; value: number | string; sub?: string;
  accent?: 'primary' | 'success' | 'accent'; icon?: React.ReactNode;
}> = ({ label, value, sub, accent, icon }) => {
  const tone =
    accent === 'accent' ? 'border-accent/30 bg-secondary/40' :
    'bg-card border-border/60';
  const valueTone =
    accent === 'accent'  ? 'text-accent' :
    accent === 'primary' ? 'text-primary' :
    'text-foreground';
  return (
    <Card className={cn('shadow-none', tone)}>
      <CardContent className="px-5 pt-6 pb-6">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 font-medium">
          {icon}<span>{label}</span>
        </div>
        <p className={`font-display text-3xl font-semibold leading-none tracking-tight ${valueTone}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1.5 truncate" title={sub}>{sub}</p>}
      </CardContent>
    </Card>
  );
};

export default RadarStatCard;
