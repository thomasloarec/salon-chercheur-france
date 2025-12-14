import { Users, Sparkles, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Event } from "@/types/event";

interface EventWhyVisitProps {
  event: Pick<Event, "nom_event" | "ville" | "affluence" | "secteur" | "date_debut">;
}

export const EventWhyVisit = ({ event }: EventWhyVisitProps) => {
  const year = new Date(event.date_debut).getFullYear();

  // Parse sectors from JSON if needed
  const getSectors = (): string[] => {
    if (!event.secteur) return [];
    if (Array.isArray(event.secteur)) return event.secteur;
    if (typeof event.secteur === 'string') {
      try {
        const parsed = JSON.parse(event.secteur);
        return Array.isArray(parsed) ? parsed : [event.secteur];
      } catch {
        return [event.secteur];
      }
    }
    return [];
  };

  const sectors = getSectors();

  // Ne pas afficher si pas assez de données
  if (!event.affluence && sectors.length === 0) {
    return null;
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        Pourquoi visiter {event.nom_event} ?
      </h2>

      <ul className="space-y-3 text-sm text-muted-foreground">
        {event.affluence && (
          <li className="flex items-start gap-3">
            <Users className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <span>
              Rencontrez les{" "}
              <strong className="text-foreground">
                {parseInt(event.affluence).toLocaleString("fr-FR")} visiteurs professionnels
              </strong>{" "}
              attendus sur cet événement incontournable
              {event.ville && ` à ${event.ville}`}
            </span>
          </li>
        )}

        {sectors.length > 0 && (
          <li className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <span>
              Découvrez les dernières innovations dans{" "}
              {sectors.length === 1 ? "le secteur" : "les secteurs"} :{" "}
              <strong className="text-foreground">
                {sectors.slice(0, 2).join(" et ")}
              </strong>
            </span>
          </li>
        )}

        <li className="flex items-start gap-3">
          <Calendar className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <span>
            Préparez votre visite du salon{" "}
            <strong className="text-foreground">
              {event.nom_event} {year}
            </strong>{" "}
            et prenez rendez-vous avec les exposants directement sur Lotexpo
          </span>
        </li>
      </ul>
    </Card>
  );
};
