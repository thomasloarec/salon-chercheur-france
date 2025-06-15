
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const EventFooter = () => {
  return (
    <footer className="mt-8 pt-6 border-t">
      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link to="/events">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux événements
          </Link>
        </Button>
      </div>
    </footer>
  );
};
