import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getEventCapabilities } from '@/lib/eventCapabilities';
import type { Event } from '@/types/event';

interface AddNoveltyButtonProps {
  event: Event;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  label?: string;
  /** Libellé replié sous 640 px (jamais un verbe seul). */
  shortLabel?: string;
}

export default function AddNoveltyButton({ 
  event, 
  variant = 'default', 
  size = 'default',
  className,
  label,
  shortLabel
}: AddNoveltyButtonProps) {
  const defaultLabel = 'Exposant ? Ajouter votre nouveauté';
  const resolvedLabel = label || defaultLabel;
  const renderLabel = () =>
    shortLabel ? (
      <>
        <span className="hidden sm:inline">{resolvedLabel}</span>
        <span className="sm:hidden">{shortLabel}</span>
      </>
    ) : (
      resolvedLabel
    );

  const navigate = useNavigate();

  // Règle unique (lot 2) : le CTA disparaît dès que la publication est
  // impossible — événement sans exposants (has_exhibitors = false),
  // événement terminé, ou publication pas encore ouverte (J-90).
  const capabilities = getEventCapabilities(event, 0);
  if (!capabilities.canPublishNovelty) {
    return null;
  }

  const handleClick = () => {
    // Nouveau parcours pleine page (connecté ou non).
    navigate(`/publier-nouveaute/exposant?event=${event.id}`);
  };

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={className}
    >
      <Plus className="h-4 w-4 mr-2" />
      {renderLabel()}
    </Button>
  );
}
