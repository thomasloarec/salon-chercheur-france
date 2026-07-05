import React from 'react';
import { RELATIONSHIP_META, type RelationshipStatus } from '@/lib/radarCrm/relationship';

/**
 * Miroir présentationnel de RelationshipBadge (RadarCrmResults) — garder synchronisé.
 * Point 8px + libellé neutre. La couleur du point vient de RELATIONSHIP_META
 * (source partagée). Le libellé est une donnée de démo passée en prop, car les
 * aperçus illustrent un contenu réaliste tout en gardant le style exact de l'app.
 */
const PreviewRelBadge: React.FC<{ status: RelationshipStatus; label: string }> = ({ status, label }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-foreground">
    <span className={`h-2 w-2 rounded-full shrink-0 ${RELATIONSHIP_META[status].dot}`} aria-hidden="true" />
    {label}
  </span>
);

export default PreviewRelBadge;
