import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Archive, Globe, Building2, ExternalLink } from 'lucide-react';
import type { AdminSelection } from './types';

interface Props {
  selection: Extract<AdminSelection, { kind: 'outreach' | 'legacy' }>;
  onBack: () => void;
}

const AdminNonExhibitorPanel = ({ selection, onBack }: Props) => {
  const isOutreach = selection.kind === 'outreach';
  console.log('[AdminDetail] non-exhibitor panel', { kind: selection.kind, selection });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate">{selection.name || '—'}</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {isOutreach ? (
                    <Badge variant="outline" className="gap-1 bg-sky-50 text-sky-700 border-sky-200">
                      <Mail className="h-3.5 w-3.5" /> Campagne email uniquement
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 bg-zinc-100 text-zinc-700 border-zinc-300">
                      <Archive className="h-3.5 w-3.5" /> Exposant legacy
                    </Badge>
                  )}
                  {isOutreach && selection.campaign_status && (
                    <Badge variant="outline" className="text-xs">
                      {selection.campaign_status}
                      {selection.current_step ? ` · ${selection.current_step}` : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {selection.website && (
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={selection.website.startsWith('http') ? selection.website : `https://${selection.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-primary hover:underline inline-flex items-center gap-1"
                >
                  {selection.website}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {isOutreach && selection.contact_email && (
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`mailto:${selection.contact_email}`}
                  className="truncate text-primary hover:underline"
                >
                  {selection.contact_email}
                </a>
              </div>
            )}
            {isOutreach && selection.event_id && (
              <div className="text-muted-foreground">
                <span className="font-medium">Événement :</span>{' '}
                <code className="text-xs">{selection.event_id}</code>
              </div>
            )}
            <div className="text-muted-foreground">
              <span className="font-medium">Source :</span>{' '}
              {isOutreach ? 'outreach_campaigns' : 'exposants (legacy)'}
            </div>
            {isOutreach && (
              <div className="text-muted-foreground">
                <span className="font-medium">outreach_id :</span>{' '}
                <code className="text-xs">{selection.outreach_id}</code>
              </div>
            )}
            {!isOutreach && (
              <div className="text-muted-foreground">
                <span className="font-medium">legacy_id :</span>{' '}
                <code className="text-xs">{selection.legacy_id}</code>
              </div>
            )}
          </div>

          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {isOutreach
              ? "Cette entreprise n'a pas encore de fiche exposant moderne. Elle existe uniquement dans une campagne outreach."
              : "Cette entreprise provient des données legacy et n'a pas encore été migrée vers une fiche exposant moderne."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNonExhibitorPanel;