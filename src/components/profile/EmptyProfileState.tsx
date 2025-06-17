
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, AlertCircle } from 'lucide-react';

interface EmptyProfileStateProps {
  onCreateProfile: () => void;
}

const EmptyProfileState = ({ onCreateProfile }: EmptyProfileStateProps) => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <User className="h-8 w-8" />
            Mon profil
          </h1>
          <p className="text-gray-600 mt-2">
            Créez votre profil pour une meilleure expérience
          </p>
        </div>

        <Card className="p-8 rounded-2xl shadow-sm text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-amber-100 p-4 rounded-full">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          
          <h2 className="text-xl font-semibold mb-2">Profil non configuré</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Votre profil n'a pas encore été créé. Complétez vos informations 
            pour personnaliser votre expérience et recevoir des recommandations adaptées.
          </p>
          
          <Button onClick={onCreateProfile} size="lg">
            Compléter mon profil
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default EmptyProfileState;
