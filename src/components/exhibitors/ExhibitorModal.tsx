import React from 'react';
import { X, ExternalLink, MapPin } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ExhibitorModalProps {
  exhibitor: {
    id: string;
    name: string;
    logo_url?: string;
    website?: string;
    description?: string;
    stand_info?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export default function ExhibitorModal({ exhibitor, isOpen, onClose }: ExhibitorModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {exhibitor.logo_url && (
              <img
                src={exhibitor.logo_url}
                alt={`Logo ${exhibitor.name}`}
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
            <div>
              <h2 className="text-2xl font-bold">{exhibitor.name}</h2>
              {exhibitor.stand_info && (
                <Badge variant="secondary" className="mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {exhibitor.stand_info}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {exhibitor.description && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">À propos</h3>
            <p className="text-muted-foreground">{exhibitor.description}</p>
          </div>
        )}

        {exhibitor.website && (
          <div className="mt-6 flex justify-start">
            <Button asChild variant="outline">
              <a 
                href={exhibitor.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Visiter le site web
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}