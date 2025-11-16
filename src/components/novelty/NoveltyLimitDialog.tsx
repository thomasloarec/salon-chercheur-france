import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Crown, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NoveltyLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCount: number;
  limit: number;
  eventName: string;
}

export function NoveltyLimitDialog({
  open,
  onOpenChange,
  currentCount,
  limit,
  eventName,
}: NoveltyLimitDialogProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    window.open('/exposants', '_blank');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <Crown className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <AlertDialogTitle>Limite de nouveautés atteinte</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Vous avez déjà publié <strong>{currentCount} nouveauté{currentCount > 1 ? 's' : ''}</strong> sur <strong>{eventName}</strong>.
            </p>
            <p>
              Le <strong>plan gratuit</strong> limite à <strong>{limit} nouveauté par événement</strong>.
            </p>
            
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-lg border border-primary/20 mt-4">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground mb-1">Passez au plan Pro</p>
                  <p className="text-sm text-muted-foreground">
                    Publiez jusqu'à <strong>5 nouveautés par événement</strong> et bénéficiez de statistiques avancées
                  </p>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Fermer</AlertDialogCancel>
          <AlertDialogAction className="bg-primary" onClick={handleUpgrade}>
            Découvrir le plan Pro
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
