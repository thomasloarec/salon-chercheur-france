import { Button } from '@/components/ui/button';
import { TrendingUp, Users, BarChart3, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ForExhibitors = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: TrendingUp,
      title: 'Captez des RDV avant l\'ouverture',
      description: 'Les visiteurs réservent des créneaux sur votre stand avant même le jour J.'
    },
    {
      icon: Users,
      title: 'Sortez de la "loterie de l\'emplacement"',
      description: 'Votre visibilité ne dépend plus uniquement de votre position sur le salon.'
    },
    {
      icon: BarChart3,
      title: 'Centralisez vos leads et mesurez l\'impact',
      description: 'Toutes vos interactions (vues, téléchargements, RDV) en un seul tableau de bord.'
    }
  ];

  return (
    <section className="bg-secondary py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Benefits */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Pour les exposants : <br />
              <span className="text-accent">captez des RDV avant l'ouverture</span>
            </h2>

            <div className="space-y-6 mb-8">
              {benefits.map((benefit, index) => (
                <div 
                  key={index}
                  className="flex gap-4 items-start bg-card backdrop-blur-xl rounded-xl p-5 border border-border"
                >
                  <div className="bg-accent/10 rounded-lg p-3 flex-shrink-0">
                    <benefit.icon className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-card backdrop-blur-xl rounded-xl p-5 border border-border text-center">
                <div className="text-3xl font-bold text-accent mb-2">+320</div>
                <div className="text-sm text-muted-foreground">Nouveautés publiées ce trimestre</div>
              </div>
              <div className="bg-card backdrop-blur-xl rounded-xl p-5 border border-border text-center">
                <div className="text-3xl font-bold text-accent mb-2">14%</div>
                <div className="text-sm text-muted-foreground">Taux de RDV moyen</div>
              </div>
            </div>
          </div>

          {/* Right: Pricing Card */}
          <div className="bg-gradient-to-br from-accent/10 to-primary/10 backdrop-blur-xl rounded-2xl p-8 border border-border">
            <div className="flex items-center gap-3 mb-6">
              <Crown className="h-8 w-8 text-accent" />
              <h3 className="text-2xl font-bold text-foreground">Premium</h3>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold text-foreground">99€</span>
                <span className="text-muted-foreground">HT / salon</span>
              </div>
              <p className="text-muted-foreground text-sm">Facturé par événement</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="bg-success-green rounded-full p-1 flex-shrink-0 mt-0.5">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-foreground">Publiez jusqu'à 5 Nouveautés par événement</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-success-green rounded-full p-1 flex-shrink-0 mt-0.5">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-foreground">Leads illimités (téléchargements + RDV)</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-success-green rounded-full p-1 flex-shrink-0 mt-0.5">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-foreground">Statistiques détaillées en temps réel</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-success-green rounded-full p-1 flex-shrink-0 mt-0.5">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-foreground">Export CSV (Salesforce, HubSpot, Pipedrive)</span>
              </div>
            </div>

            <Button 
              onClick={() => navigate('/premium')}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-6"
            >
              Passer en Premium
            </Button>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Offre gratuite : 3 leads par salon • Sans engagement
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ForExhibitors;
