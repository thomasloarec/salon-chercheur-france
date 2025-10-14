import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Lock } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import AddNoveltyStepper from './AddNoveltyStepper';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Event } from '@/types/event';

interface AddNoveltyButtonProps {
  event: Event;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export default function AddNoveltyButton({ 
  event, 
  variant = 'default', 
  size = 'default',
  className 
}: AddNoveltyButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Vérifier si on est en période de pré-lancement (plus de 60 jours avant l'événement)
  const daysUntilEvent = differenceInDays(new Date(event.date_debut), new Date());
  const isPreLaunch = daysUntilEvent > 60;
  const noveltiesOpenDate = new Date(event.date_debut);
  noveltiesOpenDate.setDate(noveltiesOpenDate.getDate() - 60);

  const handleClick = async () => {
    // Not logged in - redirect to auth
    if (!user) {
      navigate('/auth');
      return;
    }

    setIsChecking(true);

    try {
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const isAdmin = profile?.role === 'admin';

      if (isAdmin) {
        // Admin can do everything
        setIsModalOpen(true);
        return;
      }

      // Check if user owns any exhibitor participating in this event
      const { data: userExhibitors } = await supabase
        .from('exhibitors')
        .select(`
          id,
          name,
          participation!inner(id)
        `)
        .eq('owner_user_id', user.id)
        .eq('participation.id_event', event.id);

      if (!userExhibitors || userExhibitors.length === 0) {
        // User doesn't own any participating exhibitor
        toast({
          title: 'Co-administration requise',
          description: 'Vous devez être co-administrateur d\'un exposant participant à cet événement.',
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO: Open claim modal or redirect to exhibitor claim flow
                toast({
                  title: 'Fonctionnalité à venir',
                  description: 'La demande de co-administration sera bientôt disponible.',
                });
              }}
            >
              Demander la co-administration
            </Button>
          ),
        });
        return;
      }

      // User has exhibitor(s) - open modal
      setIsModalOpen(true);

    } catch (error) {
      console.error('Error checking user permissions:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de vérifier vos permissions.',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Si période de pré-lancement, afficher bouton désactivé avec tooltip explicatif
  if (isPreLaunch) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button 
                disabled 
                variant={variant}
                size={size}
                className={className}
              >
                <Lock className="h-4 w-4 mr-2" />
                Ajouter ma nouveauté
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">
              La publication de nouveautés ouvrira le{' '}
              <strong>{format(noveltiesOpenDate, 'dd MMMM yyyy', { locale: fr })}</strong>
              {' '}(60 jours avant l'événement)
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Bouton normal si période ouverte
  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isChecking}
        variant={variant}
        size={size}
        className={className}
      >
        <Plus className="h-4 w-4 mr-2" />
        {isChecking ? 'Vérification...' : 'Ajouter ma nouveauté'}
      </Button>

      <AddNoveltyStepper
        event={event}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}