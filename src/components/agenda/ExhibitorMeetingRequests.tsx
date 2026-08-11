import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CalendarCheck, Loader2, Mail, Phone, MapPin, Check } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useExhibitorMeetingRequests,
  useUpdateMeetingRequestStatus,
  useUserExhibitors,
} from '@/hooks/useExhibitorAdmin';

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau',
  contacted: 'Traité',
  qualified: 'Qualifié',
  converted: 'Converti',
  lost: 'Perdu',
};

export function ExhibitorMeetingRequests() {
  const { data: requests = [], isLoading, error } = useExhibitorMeetingRequests();
  const { data: myExhibitors = [] } = useUserExhibitors();
  const updateStatus = useUpdateMeetingRequestStatus();

  const newCount = requests.filter((r) => (r.status ?? 'new') === 'new').length;
  const multipleExhibitors = myExhibitors.length > 1;
  const exhibitorName = (id: string) =>
    myExhibitors.find((e: any) => e.id === id)?.name ?? null;

  return (
    <Card id="rendezvous" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarCheck className="h-5 w-5" />
          Demandes de rendez-vous
          {newCount > 0 && <Badge variant="default" className="ml-1">{newCount}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des demandes…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-6">
            Impossible de charger les demandes de rendez-vous, réessayez.
          </p>
        ) : requests.length === 0 ? (
          <div className="py-8 text-center">
            <CalendarCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Aucune demande pour le moment. Les visiteurs peuvent demander un rendez-vous
              depuis les suggestions du Parcours Visiteur IA : leurs demandes arriveront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((r, index) => {
              const isNew = (r.status ?? 'new') === 'new';
              return (
                <div key={r.id}>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">
                          {r.first_name} {r.last_name}
                        </p>
                        {r.status !== 'new' && (
                          <Badge variant="secondary" className="text-xs">
                            {STATUS_LABELS[r.status ?? ''] ?? r.status}
                          </Badge>
                        )}
                      </div>
                      {(r.company || r.role) && (
                        <p className="text-sm text-muted-foreground">
                          {[r.company, r.role].filter(Boolean).join(' — ')}
                        </p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap text-sm">
                        <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <Mail className="h-3.5 w-3.5" />
                          {r.email}
                        </a>
                        {r.phone && (
                          <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Phone className="h-3.5 w-3.5" />
                            {r.phone}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground pt-1">
                        {r.events?.nom_event && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {r.events.nom_event}
                          </span>
                        )}
                        <span>
                          Demande du {format(new Date(r.created_at), 'dd MMM yyyy', { locale: fr })}
                        </span>
                        {multipleExhibitors && exhibitorName(r.exhibitor_id) && (
                          <span>Fiche : {exhibitorName(r.exhibitor_id)}</span>
                        )}
                      </div>
                    </div>

                    {isNew && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: r.id, status: 'contacted' })}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Marquer comme traité
                      </Button>
                    )}
                  </div>

                  {r.notes && (
                    <div className="mt-3 rounded-md bg-muted/50 border border-border p-3 text-sm text-foreground whitespace-pre-wrap">
                      {r.notes}
                    </div>
                  )}

                  {index < requests.length - 1 && <Separator className="mt-4" />}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ExhibitorMeetingRequests;