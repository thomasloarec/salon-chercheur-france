import { Briefcase, ShoppingCart, LineChart, Store } from 'lucide-react';

const USE_CASES = [
  {
    icon: Briefcase,
    title: 'Commercial B2B',
    text: "Identifiez les salons o\u00f9 vos prospects, clients ou partenaires seront pr\u00e9sents. Pr\u00e9parez vos visites en amont et concentrez votre temps sur les \u00e9v\u00e9nements qui peuvent cr\u00e9er de vraies opportunit\u00e9s commerciales.",
  },
  {
    icon: ShoppingCart,
    title: 'Acheteur ou responsable sourcing',
    text: "Rep\u00e9rez les fournisseurs, innovations et solutions \u00e0 comparer avant votre d\u00e9placement. Lotexpo vous aide \u00e0 construire une visite plus efficace, avec moins de temps perdu sur place.",
  },
  {
    icon: LineChart,
    title: 'Responsable marketing ou veille',
    text: "Suivez les nouveaut\u00e9s de votre secteur, d\u00e9tectez les salons \u00e0 surveiller et gardez une vision claire des \u00e9v\u00e9nements qui peuvent influencer votre march\u00e9.",
  },
  {
    icon: Store,
    title: 'Entreprise exposante',
    text: "Publiez vos nouveaut\u00e9s pour attirer des visiteurs qualifi\u00e9s avant l\u2019ouverture du salon et donner une raison concr\u00e8te de passer sur votre stand.",
  },
];

const TestimonialsNew = () => {
  return (
    <section className="bg-background py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="section-rule [&::before]:mx-auto heading-display text-4xl md:text-5xl text-foreground mb-4">
            Lotexpo s&rsquo;adapte &agrave; plusieurs usages professionnels
          </h2>
          <p className="text-xl text-muted-foreground">
            Que vous soyez commercial, acheteur, responsable marketing ou exposant, Lotexpo vous aide &agrave; mieux exploiter les salons professionnels avant le jour J.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {USE_CASES.map((useCase) => (
            <div
              key={useCase.title}
              className="bg-card border border-border rounded-2xl p-8"
            >
              <div className="bg-accent/10 rounded-xl w-14 h-14 flex items-center justify-center mb-5">
                <useCase.icon className="h-7 w-7 text-accent" />
              </div>
              <h3 className="heading-display text-xl text-foreground mb-3">{useCase.title}</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">{useCase.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsNew;
