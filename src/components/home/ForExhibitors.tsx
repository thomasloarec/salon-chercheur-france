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
    <section className="bg-[#0F1424] py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Benefits */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#E6EAF3] mb-6">
              Pour les exposants : <br />
              <span className="text-[#FF7A00]">captez des RDV avant l'ouverture</span>
            </h2>

            <div className="space-y-6 mb-8">
              {benefits.map((benefit, index) => (
                <div 
                  key={index}
                  className="flex gap-4 items-start bg-[#0B0F19]/60 backdrop-blur-xl rounded-xl p-5 border border-white/10"
                >
                  <div className="bg-[#FF7A00]/10 rounded-lg p-3 flex-shrink-0">
                    <benefit.icon className="h-6 w-6 text-[#FF7A00]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#E6EAF3] mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-[#E6EAF3]/70 text-sm">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-[#0B0F19]/60 backdrop-blur-xl rounded-xl p-5 border border-white/10 text-center">
                <div className="text-3xl font-bold text-[#FF7A00] mb-2">+320</div>
                <div className="text-sm text-[#E6EAF3]/70">Nouveautés publiées ce trimestre</div>
              </div>
              <div className="bg-[#0B0F19]/60 backdrop-blur-xl rounded-xl p-5 border border-white/10 text-center">
                <div className="text-3xl font-bold text-[#FF7A00] mb-2">14%</div>
                <div className="text-sm text-[#E6EAF3]/70">Taux de RDV moyen</div>
              </div>
            </div>
          </div>

          {/* Right: Pricing Card */}
          <div className="bg-gradient-to-br from-[#FF7A00]/20 to-[#5B9DFF]/20 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <Crown className="h-8 w-8 text-[#FF7A00]" />
              <h3 className="text-2xl font-bold text-[#E6EAF3]">Premium</h3>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold text-[#E6EAF3]">99€</span>
                <span className="text-[#E6EAF3]/70">HT / salon</span>
              </div>
              <p className="text-[#E6EAF3]/70 text-sm">Facturé par événement</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="bg-[#10B981] rounded-full p-1 flex-shrink-0 mt-0.5">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[#E6EAF3]">Publication illimitée de Nouveautés</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-[#10B981] rounded-full p-1 flex-shrink-0 mt-0.5">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[#E6EAF3]">Leads illimités (téléchargements + RDV)</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-[#10B981] rounded-full p-1 flex-shrink-0 mt-0.5">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[#E6EAF3]">Statistiques détaillées en temps réel</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-[#10B981] rounded-full p-1 flex-shrink-0 mt-0.5">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[#E6EAF3]">Badge "Exposant Premium"</span>
              </div>
            </div>

            <Button 
              onClick={() => navigate('/premium')}
              className="w-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-white text-lg py-6"
            >
              Passer en Premium
            </Button>

            <p className="text-center text-xs text-[#E6EAF3]/60 mt-4">
              Offre gratuite : 3 leads par salon • Sans engagement
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ForExhibitors;
