import React from 'react';
import { Button } from '@/components/ui/button';
import { type EventGroup } from '@/types/radar';
import { formatDate, Th, Td } from './RadarShared';

const DetailTable: React.FC<{ groups: EventGroup[]; onView: (g: EventGroup) => void }> = ({ groups, onView }) => {
  const rows = groups.flatMap((g) =>
    g.companies.map((c) => ({ g, c })),
  ).sort((a, b) => (a.g.date_debut ?? '').localeCompare(b.g.date_debut ?? ''));
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50">
          <tr><Th>Entreprise</Th><Th>Événement</Th><Th>Date</Th><Th>Ville</Th><Th>Stand</Th><Th></Th></tr>
        </thead>
        <tbody>
          {rows.map(({ g, c }, i) => (
            <tr key={`${g.event_id}-${c.company.id}-${i}`} className="border-t">
              <Td className="font-medium text-foreground">{c.company.company_name}</Td>
              <Td className="text-foreground/80">{g.nom_event}</Td>
              <Td className="text-foreground/80">{formatDate(g.date_debut)}</Td>
              <Td className="text-foreground/80">{g.ville ?? '—'}</Td>
              <Td className="max-w-[180px] truncate text-foreground/80">{c.stand ?? '—'}</Td>
              <Td><Button size="sm" variant="ghost" onClick={() => onView(g)} disabled={!g.slug}>Voir</Button></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DetailTable;
