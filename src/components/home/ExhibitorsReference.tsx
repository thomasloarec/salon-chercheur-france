import { Button } from '@/components/ui/button';
import { Building2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ExhibitorsReference = () => {
  const navigate = useNavigate();

  return (
    <section className="bg-secondary py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card border border-border rounded-2xl p-8 md:p-12 text-center">
          <div className="bg-accent/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Building2 className="h-10 w-10 text-accent" />
          </div>
          
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Entreprises exposantes ?
          </h3>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Publiez vos Nouveautés pour attirer des visiteurs qualifiés avant l'ouverture du salon
          </p>

          <Button
            onClick={() => navigate('/exposants')}
            size="lg"
            className="bg-accent hover:bg-accent/90 text-lg font-semibold px-8 h-14"
          >
            Découvrir Lotexpo pour les exposants
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ExhibitorsReference;
