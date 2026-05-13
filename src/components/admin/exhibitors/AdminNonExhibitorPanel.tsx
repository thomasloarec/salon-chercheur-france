import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Building2, Mail, Archive, Globe, ExternalLink, Calendar, Info,
} from 'lucide-react';
import ExhibitorOutreachPanel from './ExhibitorOutreachPanel';
import AdminExhibitorParticipationsCard from './AdminExhibitorParticipationsCard';
import { CAMPAIGN_STATUS_VARIANTS, campaignStatusLabel } from '@/lib/outreach/labels';
import type { AdminSelection } from './types';

interface Props {
  selection: Extract<AdminSelection, { kind: 'outreach' | 'legacy' }>;
  onBack: () => void;
}

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

const AdminNonExhibitorPanel = ({ selection, onBack }: Props) => {
  const isOutreach = selection.kind === 'outreach';
  const eventId = isOutreach ? selection.event_id : null;

  // Fetch event details to show real event name (not UUID)
  const { data: event } = useQuery({
    queryKey: ['admin-non-exhibitor-event', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, nom_event, slug, date_debut, date_fin, ville')
        .eq('id', eventId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const sourceBadge = isOutreach ? (
    <Badge variant="outline" className="gap-1 bg-sky-50 text-sky-700 border-sky-200">
      <Mail className="h-3.5 w-3.5" /> Campagne email uniquement
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 bg-zinc-100 text-zinc-700 border-zinc-300">
      <Archive className="h-3.5 w-3.5" /> Exposant legacy
    </Badge>
  );

  const campaignStatus = isOutreach ? selection.campaign_status : null;

  return (
    <div className="space-y-6">
      {/* Header — same shape as AdminExhibitorDetailPanel */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">{selection.name || '—'}</h2>
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
              {sourceBadge}
              {campaignStatus && (
                <Badge variant={CAMPAIGN_STATUS_VARIANTS[campaignStatus] ?? 'outline'}>
                  {campaignStatusLabel(campaignStatus)}
                </Badge>
              )}
              {event?.nom_event && (
                <span className="inline-flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" /> {event.nom_event}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              {isOutreach && (
                <TabsTrigger value="outreach" className="gap-1">
                  <Mail className="h-3.5 w-3.5" /> Prospection email
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fiche entreprise</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nom</span>
                      <div className="font-medium">{selection.name || '—'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Site web</span>
                      <div>
                        {selection.website ? (
                          <a
                            href={selection.website.startsWith('http') ? selection.website : `https://${selection.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            <span className="truncate">{selection.website}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : '—'}
                      </div>
                    </div>
                    {isOutreach && (
                      <div>
                        <span className="text-muted-foreground">Email principal</span>
                        <div>
                          {selection.contact_email ? (
                            <a
                              href={`mailto:${selection.contact_email}`}
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              {selection.contact_email}
                            </a>
                          ) : '—'}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Source des données</span>
                      <div className="mt-0.5">{sourceBadge}</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm flex gap-2">
                    <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-amber-900">
                      {isOutreach
                        ? "Cette entreprise n'a pas encore de fiche exposant moderne. Elle existe uniquement via une campagne de prospection email."
                        : "Cette entreprise provient des données legacy et n'a pas encore été migrée vers une fiche exposant moderne."}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <AdminExhibitorParticipationsCard
                exhibitorName={selection.name}
                legacyId={selection.kind === 'legacy' ? selection.legacy_id : null}
              />
            </TabsContent>

            {isOutreach && (
              <TabsContent value="outreach" className="mt-4">
                <ExhibitorOutreachPanel campaignId={selection.outreach_id} />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Right rail — technical metadata, discrete */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Identifiants techniques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {isOutreach ? (
                <>
                  <div>
                    <div className="font-medium text-foreground/80">outreach_id</div>
                    <code className="break-all">{selection.outreach_id}</code>
                  </div>
                  {selection.event_id && (
                    <div>
                      <div className="font-medium text-foreground/80">event_id</div>
                      <code className="break-all">{selection.event_id}</code>
                    </div>
                  )}
                  {selection.current_step != null && (
                    <div>
                      <div className="font-medium text-foreground/80">Étape actuelle</div>
                      <span>Email {selection.current_step}</span>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div className="font-medium text-foreground/80">legacy_id</div>
                  <code className="break-all">{selection.legacy_id}</code>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminNonExhibitorPanel;