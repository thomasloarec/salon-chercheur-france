import { CalendarClock, FileStack, Clock3 } from 'lucide-react';

const CARDS = [
  {
    icon: CalendarClock,
    title: 'Trop d\u2019\u00e9v\u00e9nements, pas assez de temps',
    text: "Il existe des centaines de salons B2B en France. Sans vue centralis\u00e9e, les bons \u00e9v\u00e9nements restent souvent invisibles.",
  },
  {
    icon: FileStack,
    title: 'Trop d\u2019informations dispers\u00e9es',
    text: "Les exposants, les nouveaut\u00e9s et les informations pratiques sont souvent r\u00e9partis entre sites officiels, PDF, applications ferm\u00e9es et communications isol\u00e9es.",
  },
  {
    icon: Clock3,
    title: 'Trop tard le jour du salon',
    text: "D\u00e9couvrir les bons stands une fois sur place, c\u2019est souvent trop tard pour organiser une visite efficace ou prendre contact avec les bonnes personnes.",
  },
];

const AttentionProblem = () => {
  return (
    <section className="bg-background py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Le vrai probl&egrave;me n&rsquo;est pas de trouver un salon. C&rsquo;est de savoir lequel m&eacute;rite votre attention.
          </h2>
          <p className="text-lg text-muted-foreground">
            Les salons professionnels sont des lieux puissants pour cr&eacute;er des relations business. Mais sans pr&eacute;paration, on passe facilement &agrave; c&ocirc;t&eacute; des bons &eacute;v&eacute;nements, des bons exposants et des bonnes opportunit&eacute;s.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CARDS.map((card) => (
            <div
              key={card.title}
              className="bg-card border border-border rounded-2xl p-8 shadow-sm"
            >
              <div className="bg-accent/10 rounded-xl w-14 h-14 flex items-center justify-center mb-5">
                <card.icon className="h-7 w-7 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{card.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AttentionProblem;
