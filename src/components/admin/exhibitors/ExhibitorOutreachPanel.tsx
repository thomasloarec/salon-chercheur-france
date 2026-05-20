import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Mail, Calendar, Clock, AlertTriangle, Ban, CheckCircle2, Circle, ShieldOff, Send, Sparkles,
} from 'lucide-react';
import StopCampaignDialog from '@/components/admin/campaigns/StopCampaignDialog';
import {
  CAMPAIGN_STATUS_VARIANTS, campaignStatusLabel, stopReasonLabel,
  TERMINAL_CAMPAIGN_STATUSES,
} from '@/lib/outreach/labels';

interface Props {
  exhibitorId?: string;
  campaignId?: string;
  /** Optional title shown in the card header. Defaults to "Prospection email". */
  title?: string;
}

interface CampaignRow {
  id: string;
  event_id: string;
  contact_email: string | null;
  email_source: string | null;
  campaign_status: string | null;
  current_step: number | null;
  last_sent_at: string | null;
  next_send_at: string | null;
  stop_reason: string | null;
  stop_note: string | null;
  stopped_at: string | null;
  hunter_status: string | null;
  hunter_prenom: string | null;
  hunter_poste: string | null;
  created_at: string;
  updated_at: string;
  novelty_id?: string | null;
  exhibitor_id?: string | null;
}

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const ExhibitorOutreachPanel = ({ exhibitorId, campaignId, title }: Props) => {
  const [stopDialog, setStopDialog] = useState<{ id: string; email?: string | null } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['exhibitor-outreach', { exhibitorId, campaignId }],
    queryFn: async () => {
      const selectCols = `
        id, event_id, exhibitor_id, novelty_id, contact_email, email_source,
        campaign_status, current_step, last_sent_at, next_send_at,
        stop_reason, stop_note, stopped_at, hunter_status, hunter_prenom,
        hunter_poste, created_at, updated_at
      `;

      let campaigns: any[] = [];

      if (campaignId) {
        const { data: rows, error } = await supabase
          .from('outreach_campaigns')
          .select(selectCols)
          .eq('id', campaignId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        campaigns = rows ?? [];
      } else if (exhibitorId) {
        // Also pull campaigns linked via a novelty published by this exhibitor
        // (campaigns converted before exhibitor_id was backfilled keep only novelty_id).
        const { data: novRows } = await supabase
          .from('novelties')
          .select('id')
          .eq('exhibitor_id', exhibitorId);
        const noveltyIds = (novRows ?? []).map((n: any) => n.id);

        const orParts = [`exhibitor_id.eq.${exhibitorId}`];
        if (noveltyIds.length) {
          orParts.push(`novelty_id.in.(${noveltyIds.join(',')})`);
        }

        const { data: rows, error } = await supabase
          .from('outreach_campaigns')
          .select(selectCols)
          .or(orParts.join(','))
          .order('created_at', { ascending: false });
        if (error) throw error;

        // Dedupe by id (a campaign may match both clauses).
        const seen = new Set<string>();
        campaigns = (rows ?? []).filter((r: any) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
      } else {
        return { campaigns: [], eventsById: new Map(), blacklistByEmail: new Map() };
      }

      const eventIds = Array.from(new Set((campaigns ?? []).map(c => c.event_id).filter(Boolean)));
      const emails = Array.from(new Set((campaigns ?? []).map(c => c.contact_email?.toLowerCase().trim()).filter(Boolean) as string[]));

      const [eventsRes, blacklistRes] = await Promise.all([
        eventIds.length
          ? supabase.from('events').select('id, nom_event, slug, date_debut, date_fin').in('id', eventIds)
          : Promise.resolve({ data: [], error: null } as any),
        emails.length
          ? supabase.from('email_blacklist').select('email_normalized, reason').in('email_normalized', emails)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const eventsById = new Map((eventsRes.data ?? []).map((e: any) => [e.id, e]));
      const blacklistByEmail = new Map((blacklistRes.data ?? []).map((b: any) => [b.email_normalized, b.reason]));

      return { campaigns: campaigns ?? [], eventsById, blacklistByEmail };
    },
    enabled: !!(exhibitorId || campaignId),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Chargement des campagnes...
        </CardContent>
      </Card>
    );
  }

  const campaigns: CampaignRow[] = (data?.campaigns as any) ?? [];

  if (!campaigns.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Mail className="h-6 w-6 mx-auto mb-2 opacity-40" />
          Aucune campagne email pour cette entreprise.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          {title ?? 'Prospection email'} ({campaigns.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {campaigns.map(c => {
          const event = data?.eventsById.get(c.event_id) as
            | { nom_event?: string; slug?: string; date_debut?: string; date_fin?: string }
            | undefined;
          const isTerminal = TERMINAL_CAMPAIGN_STATUSES.has(c.campaign_status ?? '');
          const emailKey = c.contact_email?.toLowerCase().trim();
          const blacklistReason = emailKey ? data?.blacklistByEmail.get(emailKey) : undefined;
          const variant = CAMPAIGN_STATUS_VARIANTS[c.campaign_status ?? ''] ?? 'outline';

          return (
            <div key={c.id} className="rounded-lg border p-4 space-y-3">
              {/* Header: event + status */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {event?.nom_event ?? 'Événement inconnu'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(event?.date_debut)} → {fmtDate(event?.date_fin)}
                  </div>
                </div>
                <Badge variant={variant}>{campaignStatusLabel(c.campaign_status)}</Badge>
              </div>

              {/* Converted banner */}
              {c.campaign_status === 'converted' && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs space-y-1">
                  <div className="flex items-center gap-1 font-medium text-emerald-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Campagne convertie : nouveauté publiée
                  </div>
                  <div className="text-emerald-800/80">
                    Cette entreprise a publié une nouveauté après la prospection email. Aucun nouvel email ne sera envoyé.
                  </div>
                  {c.novelty_id && (
                    <div className="text-emerald-800/80">
                      Nouveauté : <span className="font-mono">{c.novelty_id}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Contact */}
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono">{c.contact_email ?? <span className="italic text-muted-foreground">aucun email</span>}</span>
                  {blacklistReason && (
                    <Badge variant="destructive" className="gap-1">
                      <Ban className="h-3 w-3" />
                      {blacklistReason === 'invalid_address' ? 'Email invalide' :
                       blacklistReason === 'opt_out_global' ? 'Opt-out global' : 'Blacklisté'}
                    </Badge>
                  )}
                  {!blacklistReason && c.contact_email && (
                    <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-200 bg-emerald-50">
                      <CheckCircle2 className="h-3 w-3" /> Actif
                    </Badge>
                  )}
                </div>
                {(c.hunter_prenom || c.hunter_poste) && (
                  <div className="text-xs text-muted-foreground">
                    {c.hunter_prenom} {c.hunter_poste && `— ${c.hunter_poste}`}
                  </div>
                )}
                {c.email_source && (
                  <div className="text-xs text-muted-foreground">Source : {c.email_source}</div>
                )}
              </div>

              {/* Stepper */}
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">Séquence email</div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map(step => {
                    const done = (c.current_step ?? 0) >= step;
                    return (
                      <div key={step} className="flex items-center gap-1">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={`text-xs ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
                          Email {step}
                        </span>
                        {step < 3 && <span className="text-muted-foreground">·</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Send className="h-3 w-3" /> Dernier envoi : {fmtDateTime(c.last_sent_at)}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Prochain envoi : {fmtDateTime(c.next_send_at)}
                </div>
              </div>

              {/* Stop reason */}
              {c.stop_reason && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs space-y-1">
                  <div className="flex items-center gap-1 font-medium text-destructive">
                    <ShieldOff className="h-3.5 w-3.5" /> Motif d'arrêt : {stopReasonLabel(c.stop_reason)}
                  </div>
                  {c.stop_note && <div className="text-muted-foreground">{c.stop_note}</div>}
                  {c.stopped_at && <div className="text-muted-foreground">Le {fmtDateTime(c.stopped_at)}</div>}
                </div>
              )}

              {/* Actions */}
              {!isTerminal && (
                <>
                  <Separator />
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setStopDialog({ id: c.id, email: c.contact_email })}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Arrêter la campagne
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </CardContent>

      {stopDialog && (
        <StopCampaignDialog
          open={!!stopDialog}
          onOpenChange={o => !o && setStopDialog(null)}
          campaignId={stopDialog.id}
          contactEmail={stopDialog.email}
        />
      )}
    </Card>
  );
};

export default ExhibitorOutreachPanel;