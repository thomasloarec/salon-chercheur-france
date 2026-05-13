/**
 * @deprecated [LEGACY / NOT WIRED]
 * Composant de mapping de colonnes Radar CRM non utilisé dans le flux actuel.
 * Le flux CSV/Excel actif utilise des selects inline dans `src/pages/RadarCrm.tsx`.
 * Conservé en attendant un éventuel refactor mutualisant le mapping.
 * Ne pas supprimer sans vérifier qu'aucun futur flux OAuth ne le réutilise.
 */
import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RADAR_FIELD_LABELS, RADAR_FIELD_REQUIRED, RadarField } from '@/lib/radarCrm/columnDetection';
import { Badge } from '@/components/ui/badge';

interface Props {
  headers: string[];
  mapping: Partial<Record<RadarField, string>>;
  onChange: (m: Partial<Record<RadarField, string>>) => void;
}

const NONE = '__none__';

const RadarColumnMapper: React.FC<Props> = ({ headers, mapping, onChange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {(Object.keys(RADAR_FIELD_LABELS) as RadarField[]).map((field) => {
        const required = RADAR_FIELD_REQUIRED[field];
        const value = mapping[field] ?? NONE;
        return (
          <div key={field} className="space-y-1.5">
            <Label className="text-sm flex items-center gap-2">
              {RADAR_FIELD_LABELS[field]}
              {required && <Badge variant="secondary" className="text-[10px]">requis</Badge>}
            </Label>
            <Select
              value={value}
              onValueChange={(v) => {
                const next = { ...mapping };
                if (v === NONE) delete next[field];
                else next[field] = v;
                onChange(next);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Aucune colonne" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Aucune —</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
};

export default RadarColumnMapper;
