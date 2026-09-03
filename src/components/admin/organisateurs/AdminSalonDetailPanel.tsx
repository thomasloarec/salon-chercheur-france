import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ArrowLeft, CalendarDays, ExternalLink, Check, X, User, ArrowRight, PencilLine, Download, FileText, Mail, MailX, Phone, Briefcase, Building2, Megaphone, ShieldBan, ShieldCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Link } from 'react-router-dom';
import VerifiedBadge from '@/components/exhibitor/VerifiedBadge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  salonId: string;
  onBack: () => void;
}

interface ClaimRow {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  requester_user_id: string;
  requester_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company: string | null;
}

interface ChangeRequestRow {
  id: string;
  status: string;
  created_at: string;
  requester_user_id: string;
  requester_name: string | null;
  changed_fields: string[];
  proposed_changes: Record<string, any>;
  previous_values: Record<string, any>;
  review_note: string | null;
  reviewed_at: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  nom_event: 'Nom',
  date_debut: 'Date de début',
  date_fin: 'Date de fin',
  secteur: 'Secteur',
  affluence: 'Nombre de visiteurs',
  tarif: 'Tarif',
  url_image: 'Photo',
  description_event: 'Description',
};

const formatValue = (field: string, value: any): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'secteur') {
    return Array.isArray(value) ? value.join(', ') || '—' : String(value);
  }
  if ((field === 'date_debut' || field === 'date_fin') && typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR');
  }
  return String(value);
};

const statusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  approved: { label: 'Approuvée', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  rejected: { label: 'Rejetée', className: 'bg-muted text-muted-foreground' },
};

const AdminSalonDetailPanel = ({ salonId, onBack }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: imports, isLoading: importsLoading } = useQuery({
    queryKey: ['admin-salon-imports', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizer_exhibitor_imports')
        .select('id, created_at, original_name, file_path')
        .eq('event_id', salonId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleDownloadImport = async (filePath: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('organizer-exhibitor-import', {
        body: { action: 'signed_url', file_path: filePath },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error('URL indisponible');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err?.message || 'Téléchargement impossible.',
        variant: 'destructive',
      });
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-salon-detail', salonId],
    queryFn: async () => {
      const { data: event, error } = await supabase
        .from('events')
        .select('id, nom_event, ville, date_debut, slug, owner_user_id, verified_at, url_image')
        .eq('id', salonId)
        .maybeSingle();
      if (error) throw error;
      if (!event) return null;

      let ownerName: string | null = null;
      if (event.owner_user_id) {
        const { data: owner } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', event.owner_user_id)
          .maybeSingle();
        ownerName =
          [owner?.first_name, owner?.last_name].filter(Boolean).join(' ').trim() || null;
      }

      const { data: claimsData } = await (supabase as any).rpc('admin_list_event_claim_identities', {
        p_event_id: salonId,
      });

      const profilesById: Record<string, string> = {};
      const claims: ClaimRow[] = ((claimsData as any[]) || []).map((c) => {
        const fullName =
          [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || null;
        profilesById[c.requester_user_id] = fullName ?? '—';
        return {
          id: c.id,
          status: c.status,
          message: c.message,
          created_at: c.created_at,
          requester_user_id: c.requester_user_id,
          requester_name: fullName,
          email: c.email ?? null,
          phone: c.phone ?? null,
          job_title: c.job_title ?? null,
          company: c.company ?? null,
        };
      });

      // Demandes de modification en attente
      const { data: changesData } = await supabase
        .from('event_change_requests')
        .select('id, status, created_at, requester_user_id, changed_fields, proposed_changes, previous_values, review_note, reviewed_at')
        .eq('event_id', salonId)
        .order('created_at', { ascending: false });

      const changeUserIds = [...new Set((changesData || []).map((c) => c.requester_user_id))];
      let changeProfilesById: Record<string, string> = { ...profilesById };
      const missingIds = changeUserIds.filter((id) => !(id in changeProfilesById));
      if (missingIds.length) {
        const { data: cp } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', missingIds);
        (cp || []).forEach((p) => {
          changeProfilesById[p.user_id] =
            [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—';
        });
      }

      const changeRequests: ChangeRequestRow[] = (changesData || []).map((c) => ({
        id: c.id,
        status: c.status,
        created_at: c.created_at,
        requester_user_id: c.requester_user_id,
        requester_name: changeProfilesById[c.requester_user_id] ?? null,
        changed_fields: (c.changed_fields as string[]) || [],
        proposed_changes: (c.proposed_changes as Record<string, any>) || {},
        previous_values: (c.previous_values as Record<string, any>) || {},
        review_note: (c as any).review_note ?? null,
        reviewed_at: (c as any).reviewed_at ?? null,
      }));

      return { event, ownerName, claims, changeRequests };
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approve' | 'reject' }) => {
      const { error } = await supabase.functions.invoke('event-claim-manage', {
        body: { action, request_id: requestId },
      });
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      toast({
        title: action === 'approve' ? 'Demande approuvée' : 'Demande rejetée',
        description:
          action === 'approve'
            ? 'Le demandeur gère désormais ce salon.'
            : 'La demande a été rejetée.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-salon-detail', salonId] });
      queryClient.invalidateQueries({ queryKey: ['admin-salons'] });
      queryClient.invalidateQueries({ queryKey: ['admin-event-claims'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Erreur',
        description: err?.message || 'Impossible de traiter la demande.',
        variant: 'destructive',
      });
    },
  });

  const changeMutation = useMutation({
    mutationFn: async ({
      requestId,
      action,
      note,
    }: {
      requestId: string;
      action: 'approve' | 'reject';
      note?: string;
    }) => {
      const { error } = await supabase.functions.invoke('event-change-manage', {
        body: { action, request_id: requestId, ...(note ? { note } : {}) },
      });
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      toast({
        title: action === 'approve' ? 'Modifications appliquées' : 'Modifications refusées',
        description:
          action === 'approve'
            ? 'La fiche du salon a été mise à jour.'
            : 'La demande de modification a été refusée.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-salon-detail', salonId] });
      queryClient.invalidateQueries({ queryKey: ['admin-salons'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Erreur',
        description: err?.message || 'Impossible de traiter la demande.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Button>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-40" />
          </CardContent>
        </Card>
      ) : !data?.event ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">Salon introuvable</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                {data.event.url_image ? (
                  <img src={data.event.url_image} alt="" className="w-12 h-12 rounded object-contain bg-white border" />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                    <CalendarDays className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 flex-wrap">
                    {data.event.nom_event}
                    {data.event.verified_at && <VerifiedBadge />}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {[
                      data.event.ville,
                      data.event.date_debut
                        ? new Date(data.event.date_debut).toLocaleDateString('fr-FR')
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                {data.event.owner_user_id ? (
                  <span>
                    Géré par <span className="font-medium">{data.ownerName || '—'}</span>
                  </span>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">Libre</Badge>
                )}
              </div>
              {data.event.slug && (
                <Button asChild variant="outline" size="sm">
                  <Link to={`/events/${data.event.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Voir la page du salon
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <OrganizerOutreachCard salonId={salonId} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Demandes de revendication</CardTitle>
            </CardHeader>
            <CardContent>
              {data.claims.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucune demande pour ce salon.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.claims.map((c) => {
                    const meta = statusMeta[c.status] ?? {
                      label: c.status,
                      className: 'bg-muted text-muted-foreground',
                    };
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 border rounded-lg gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{c.requester_name || '—'}</p>
                          <div className="mt-1 grid gap-1 text-xs text-muted-foreground">
                            {c.email && (
                              <span className="flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                <a href={`mailto:${c.email}`} className="hover:text-primary underline-offset-2 hover:underline break-all">
                                  {c.email}
                                </a>
                              </span>
                            )}
                            {c.phone && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <a href={`tel:${c.phone}`} className="hover:text-primary">{c.phone}</a>
                              </span>
                            )}
                            {c.job_title && (
                              <span className="flex items-center gap-1.5">
                                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                                {c.job_title}
                              </span>
                            )}
                            {c.company && (
                              <span className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                {c.company}
                              </span>
                            )}
                          </div>
                          {c.message && (
                            <p className="text-sm text-foreground/70 mt-1 italic">« {c.message} »</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${meta.className}`}>
                              {meta.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                        {c.status === 'pending' && (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              onClick={() => mutation.mutate({ requestId: c.id, action: 'approve' })}
                              disabled={mutation.isPending}
                              className="flex items-center gap-1"
                            >
                              <Check className="h-4 w-4" />
                              Valider
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => mutation.mutate({ requestId: c.id, action: 'reject' })}
                              disabled={mutation.isPending}
                              className="flex items-center gap-1"
                            >
                              <X className="h-4 w-4" />
                              Refuser
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PencilLine className="h-4 w-4" />
                Modifications proposées (historique)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.changeRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucune demande de modification pour ce salon.
                </p>
              ) : (
                <div className="space-y-4">
                  {data.changeRequests.map((cr) => {
                    const meta = statusMeta[cr.status] ?? {
                      label: cr.status,
                      className: 'bg-muted text-muted-foreground',
                    };
                    const isPending = cr.status === 'pending';
                    return (
                    <div key={cr.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-medium text-sm">{cr.requester_name || '—'}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${meta.className}`}>
                            {meta.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(cr.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {cr.changed_fields.map((field) => {
                          const before = cr.previous_values?.[field];
                          const after = cr.proposed_changes?.[field];
                          const label = FIELD_LABELS[field] ?? field;

                          if (field === 'url_image') {
                            return (
                              <div key={field} className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                                <div className="flex items-center gap-3">
                                  <div className="text-center">
                                    {before ? (
                                      <img src={before} alt="Avant" className="h-24 w-20 rounded object-cover border bg-white" />
                                    ) : (
                                      <div className="h-24 w-20 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">Avant</span>
                                  </div>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <div className="text-center">
                                    {after ? (
                                      <img src={after} alt="Après" className="h-24 w-20 rounded object-cover border bg-white" />
                                    ) : (
                                      <div className="h-24 w-20 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
                                    )}
                                    <span className="text-[10px] font-medium text-foreground">Après</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          if (field === 'description_event') {
                            return (
                              <div key={field} className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                                <div className="grid gap-2">
                                  <div className="rounded border bg-muted/40 p-2 text-xs text-muted-foreground">
                                    <span className="block text-[10px] uppercase tracking-wide mb-1">Avant</span>
                                    {formatValue(field, before)}
                                  </div>
                                  <div className="rounded border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">
                                    <span className="block text-[10px] uppercase tracking-wide mb-1 text-primary">Après</span>
                                    {formatValue(field, after)}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={field} className="text-sm">
                              <span className="text-xs font-medium text-muted-foreground">{label} : </span>
                              <span className="text-muted-foreground line-through">{formatValue(field, before)}</span>
                              <ArrowRight className="inline h-3.5 w-3.5 mx-1 text-muted-foreground" />
                              <span className="font-medium text-foreground">{formatValue(field, after)}</span>
                            </div>
                          );
                        })}
                      </div>

                      {isPending ? (
                        <>
                          <Textarea
                            placeholder="Note (optionnelle, transmise à l'organisateur en cas de refus)"
                            value={notes[cr.id] ?? ''}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [cr.id]: e.target.value }))}
                            rows={2}
                            className="text-sm"
                          />

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => changeMutation.mutate({ requestId: cr.id, action: 'approve' })}
                              disabled={changeMutation.isPending}
                              className="flex items-center gap-1"
                            >
                              <Check className="h-4 w-4" />
                              Valider
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                changeMutation.mutate({ requestId: cr.id, action: 'reject', note: notes[cr.id]?.trim() || undefined })
                              }
                              disabled={changeMutation.isPending}
                              className="flex items-center gap-1"
                            >
                              <X className="h-4 w-4" />
                              Refuser
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {cr.reviewed_at && (
                            <p>Traitée le {new Date(cr.reviewed_at).toLocaleDateString('fr-FR')}</p>
                          )}
                          {cr.review_note && (
                            <p className="italic text-foreground/70">Note envoyée : « {cr.review_note} »</p>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Imports exposants
              </CardTitle>
            </CardHeader>
            <CardContent>
              {importsLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : !imports || imports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucune liste transmise pour ce salon.
                </p>
              ) : (
                <div className="space-y-2">
                  {imports.map((imp) => (
                    <div
                      key={imp.id}
                      className="flex items-center justify-between p-3 border rounded-lg gap-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{imp.original_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(imp.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadImport(imp.file_path)}
                        className="flex items-center gap-1 shrink-0"
                      >
                        <Download className="h-4 w-4" />
                        Télécharger
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Bloc « Campagne organisateur » : état de la campagne d'emailing de
// l'organisateur du salon + interrupteur de blocage (portée = tous ses salons).
// ---------------------------------------------------------------------------
interface OrganizerOutreachState {
  organizer_id: string | null;
  organizer_name?: string;
  primary_domain?: string;
  outreach_blocked?: boolean;
  blocked_reason?: string | null;
  blocked_at?: string | null;
  nb_salons_total?: number;
  nb_salons_a_venir?: number;
  campaign_id?: string | null;
  claim_status?: string | null;
  claim_step?: number | null;
  last_sent_at?: string | null;
  next_send_at?: string | null;
  stop_reason?: string | null;
  has_contact?: boolean;
}

const claimStatusLabel: Record<string, { label: string; className: string }> = {
  pending:                { label: 'À contacter',    className: 'bg-blue-50 text-blue-700 border-blue-200' },
  active:                 { label: 'Séquence en cours', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  claimed:                { label: 'Revendiqué',     className: 'bg-green-50 text-green-700 border-green-200' },
  completed:              { label: 'Séquence terminée', className: 'bg-muted text-muted-foreground' },
  stopped:                { label: 'Bloqué',         className: 'bg-red-50 text-red-700 border-red-200' },
  opted_out:              { label: 'Désinscrit',     className: 'bg-red-50 text-red-700 border-red-200' },
  blocked_invalid_email:  { label: 'Email invalide', className: 'bg-muted text-muted-foreground' },
};

function OrganizerOutreachCard({ salonId }: { salonId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data: state, isLoading } = useQuery({
    queryKey: ['organizer-outreach-state', salonId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        'get_event_organizer_outreach_state',
        { p_event_id: salonId },
      );
      if (error) throw error;
      return data as OrganizerOutreachState;
    },
  });

  const mutation = useMutation({
    mutationFn: async (blocked: boolean) => {
      const { data, error } = await (supabase as any).rpc(
        'admin_set_organizer_outreach_block',
        { p_event_id: salonId, p_blocked: blocked, p_reason: reason || null },
      );
      if (error) throw error;
      return data as { ok: boolean; salons_impactes?: number; reason?: string };
    },
    onSuccess: (res, blocked) => {
      if (!res?.ok) {
        toast({
          title: 'Action impossible',
          description: res?.reason === 'organizer_not_found'
            ? "Aucun organisateur rattaché à ce salon."
            : "L'action n'a pas abouti.",
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: blocked ? 'Campagne bloquée' : 'Campagne débloquée',
        description: blocked
          ? `${res.salons_impactes ?? 0} salon(s) de cet organisateur ne recevront plus d'emails.`
          : `L'organisateur redevient contactable.`,
      });
      setReason('');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['organizer-outreach-state', salonId] });
    },
    onError: () => {
      toast({ title: 'Erreur', description: "La requête a échoué.", variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Campagne organisateur
          </CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    );
  }

  // Salon sans organisateur rattaché (cas théorique : domaine absent)
  if (!state || !state.organizer_id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Campagne organisateur
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun organisateur rattaché à ce salon.
          </p>
        </CardContent>
      </Card>
    );
  }

  const blocked = !!state.outreach_blocked;
  const nbTotal = state.nb_salons_total ?? 0;
  const nbAVenir = state.nb_salons_a_venir ?? 0;
  const statusMetaOutreach = state.claim_status ? claimStatusLabel[state.claim_status] : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="h-4 w-4" />
          Campagne organisateur
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Organisateur :</span>
            <span className="font-medium">{state.organizer_name || state.primary_domain}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {nbTotal} salon(s) référencé(s){nbAVenir > 0 ? `, dont ${nbAVenir} à venir` : ''}.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {statusMetaOutreach && (
            <Badge variant="outline" className={statusMetaOutreach.className}>{statusMetaOutreach.label}</Badge>
          )}
          {typeof state.claim_step === 'number' && state.claim_step > 0 && (
            <Badge variant="outline" className="bg-muted text-muted-foreground">
              {state.claim_step} email(s) envoyé(s)
            </Badge>
          )}
          {state.last_sent_at && (
            <span className="text-xs text-muted-foreground">
              Dernier envoi : {new Date(state.last_sent_at).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              {blocked
                ? <ShieldBan className="h-4 w-4 text-red-600" />
                : <ShieldCheck className="h-4 w-4 text-green-600" />}
              {blocked ? 'Emails bloqués' : 'Emails autorisés'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {blocked
                ? (state.blocked_reason || 'Cet organisateur ne reçoit aucun email.')
                : 'Bloquer coupe les emails pour TOUS les salons de cet organisateur.'}
            </p>
          </div>

          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <div>
                <Switch checked={blocked} disabled={mutation.isPending} />
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {blocked ? 'Débloquer cet organisateur ?' : 'Bloquer cet organisateur ?'}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    {blocked ? (
                      <span>
                        L'organisateur <strong>{state.organizer_name || state.primary_domain}</strong> redeviendra
                        contactable. Les campagnes que tu avais arrêtées manuellement reprendront ;
                        une désinscription d'un destinataire n'est jamais réactivée.
                      </span>
                    ) : (
                      <span>
                        Cette action coupe les emails pour <strong>l'ensemble des {nbTotal} salon(s)</strong> de
                        <strong> {state.organizer_name || state.primary_domain}</strong>, pas seulement ce salon.
                        Utilise-la si l'organisateur a demandé à ne plus être contacté.
                      </span>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>

              {!blocked && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Motif (optionnel)</label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex. : l'organisateur a demandé par email de ne plus être contacté"
                    rows={2}
                  />
                </div>
              )}

              <AlertDialogFooter>
                <AlertDialogCancel disabled={mutation.isPending}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); mutation.mutate(!blocked); }}
                  disabled={mutation.isPending}
                  className={blocked ? '' : 'bg-red-600 hover:bg-red-700'}
                >
                  {mutation.isPending
                    ? '...'
                    : blocked ? 'Débloquer' : `Bloquer les ${nbTotal} salon(s)`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminSalonDetailPanel;
