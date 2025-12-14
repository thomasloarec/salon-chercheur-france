import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";
import type { Event } from "@/types/event";

interface BreadcrumbsProps {
  event: Pick<Event, "nom_event" | "slug" | "ville" | "secteur">;
}

export const Breadcrumbs = ({ event }: BreadcrumbsProps) => {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4">
      <ol
        itemScope
        itemType="https://schema.org/BreadcrumbList"
        className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
      >
        {/* Accueil */}
        <li
          itemProp="itemListElement"
          itemScope
          itemType="https://schema.org/ListItem"
          className="flex items-center"
        >
          <Link
            to="/"
            itemProp="item"
            className="flex items-center hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4 mr-1" />
            <span itemProp="name" className="hidden sm:inline">Accueil</span>
          </Link>
          <meta itemProp="position" content="1" />
        </li>

        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />

        {/* Événements */}
        <li
          itemProp="itemListElement"
          itemScope
          itemType="https://schema.org/ListItem"
          className="flex items-center"
        >
          <Link
            to="/events"
            itemProp="item"
            className="hover:text-foreground transition-colors"
          >
            <span itemProp="name">Événements</span>
          </Link>
          <meta itemProp="position" content="2" />
        </li>

        {/* Ville (si présente) */}
        {event.ville && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            <li
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
              className="flex items-center"
            >
              <Link
                to={`/events?location=${encodeURIComponent(event.ville)}`}
                itemProp="item"
                className="hover:text-foreground transition-colors"
              >
                <span itemProp="name">{event.ville}</span>
              </Link>
              <meta itemProp="position" content="3" />
            </li>
          </>
        )}

        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />

        {/* Événement actuel */}
        <li
          itemProp="itemListElement"
          itemScope
          itemType="https://schema.org/ListItem"
          className="flex items-center"
        >
          <span itemProp="name" className="font-medium text-foreground line-clamp-1 max-w-[200px] sm:max-w-none">
            {event.nom_event}
          </span>
          <meta itemProp="position" content={event.ville ? "4" : "3"} />
        </li>
      </ol>
    </nav>
  );
};
