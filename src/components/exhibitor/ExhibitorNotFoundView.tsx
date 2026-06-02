import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import NotFoundSEO from '@/components/seo/NotFoundSEO';

/* -------------------------------- 404 view -------------------------------- */

export default function ExhibitorNotFoundView() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <NotFoundSEO title="Fiche exposant introuvable | Lotexpo" />
      <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold mb-2">Fiche exposant introuvable</h1>
      <p className="text-muted-foreground mb-6">
        Cette fiche exposant n'existe pas ou n'est pas accessible publiquement.
      </p>
      <Button asChild>
        <Link to="/exposants">Découvrir les exposants</Link>
      </Button>
    </div>
  );
}