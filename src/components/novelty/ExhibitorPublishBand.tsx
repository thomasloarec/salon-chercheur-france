import { Link } from "react-router-dom";
import { ArrowRight, BellRing, CalendarCheck, FileText, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Refonte de la page Nouveautés, run F1.4 : module exposant en bas de page.
 * N'annonce que des services réellement disponibles (vérifiés le 28/09) :
 * - la nouveauté apparaît sur cette page et sur la page du salon (section #nouveautes) ;
 * - rédaction à partir d'une plaquette PDF (assistant de l'Atelier) ;
 * - page d'invitation à partager (espace exposant, /invitation/:slug) ;
 * - demandes de rendez-vous et de brochure des visiteurs (onglet Rendez-vous) ;
 * - alerte quand des visiteurs l'enregistrent (paliers novelty-milestone-check).
 * Le parcours de visite IA n'utilise pas les nouveautés : il n'est PAS annoncé.
 * Règle commerciale : 1 nouveauté gratuite par salon.
 */

interface ExhibitorPublishBandProps {
  noveltyCount: number;
  salonCount: number;
  onPublishClick?: (source: string) => void;
}

const SERVICES = [
  {
    icon: CalendarCheck,
    title: "Visible ici et sur la page du salon",
    text: "Les visiteurs la découvrent en préparant leur venue.",
  },
  {
    icon: FileText,
    title: "Prête en quelques minutes",
    text: "Même à partir de votre plaquette PDF.",
  },
  {
    icon: Mail,
    title: "Une page d'invitation à partager",
    text: "À envoyer à vos clients et prospects avant le salon.",
  },
  {
    icon: BellRing,
    title: "Des demandes et des alertes",
    text: "Rendez-vous et brochures demandés par les visiteurs, alerte quand ils l'enregistrent.",
  },
];

export default function ExhibitorPublishBand({ noveltyCount, salonCount, onPublishClick }: ExhibitorPublishBandProps) {
  return (
    <section aria-labelledby="exposants-titre" className="border-t border-primary/15 bg-primary/[0.05]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Exposants</p>
          <h2 id="exposants-titre" className="heading-display mt-2 text-3xl text-foreground md:text-4xl">
            Vous exposez sur un prochain salon ?
          </h2>
          <p className="mt-4 max-w-[52ch] text-base text-muted-foreground">
            Annoncez ce que vous présenterez. Les visiteurs le repèrent avant d’arriver et viennent vous voir sur
            votre stand.
          </p>
          {noveltyCount > 0 && salonCount > 0 && (
            <p className="mt-3 text-sm font-medium text-foreground">
              Déjà {noveltyCount} nouveauté{noveltyCount > 1 ? "s" : ""} annoncée{noveltyCount > 1 ? "s" : ""} pour{" "}
              {salonCount} salon{salonCount > 1 ? "s" : ""} à venir.
            </p>
          )}
          <div className="mt-6 flex flex-col items-start gap-2">
            <Button asChild size="lg" className="gap-2">
              <Link to="/publier-nouveaute" onClick={() => onPublishClick?.("module-exposant")}>
                Publier gratuitement ma nouveauté
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">1 nouveauté gratuite par salon.</p>
          </div>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <li key={s.title} className="rounded-xl border border-border/70 bg-background p-4">
              <s.icon className="h-5 w-5 text-primary" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-foreground">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
