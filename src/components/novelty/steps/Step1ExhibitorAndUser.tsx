import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Building, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Step1Data } from '@/lib/validation/noveltySchemas';
import type { Event } from '@/types/event';

interface DbExhibitor {
  id: string;
  name: string;
  website?: string;
  logo_url?: string;
  approved: boolean;
  stand_info?: string;
}

interface Step1ExhibitorAndUserProps {
  event: Event;
  data: Partial<Step1Data>;
  onChange: (data: Partial<Step1Data>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export default function Step1ExhibitorAndUser({
  event,
  data,
  onChange,
  onValidationChange
}: Step1ExhibitorAndUserProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [exhibitors, setExhibitors] = useState<DbExhibitor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewExhibitorForm, setShowNewExhibitorForm] = useState(false);
  const [selectedExhibitor, setSelectedExhibitor] = useState<DbExhibitor | null>(null);
  
  // New exhibitor form data
  const [newExhibitorData, setNewExhibitorData] = useState({
    name: '',
    website: '',
    stand_info: '',
    logo: null as File | null
  });

  // User form data (if not logged in)
  const [userData, setUserData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: ''
  });

  // Load exhibitors on mount
  useEffect(() => {
    loadExhibitors();
  }, []);

  // Validate form data
  useEffect(() => {
    const hasExhibitor = selectedExhibitor || (newExhibitorData.name && newExhibitorData.website);
    const hasUserData = !!user || (!!(userData.first_name && userData.last_name && userData.email && userData.phone && userData.role));
    
    const isValid = hasExhibitor && hasUserData;
    onValidationChange(isValid);

    // Update parent data
    if (hasExhibitor && hasUserData) {
      const exhibitorData = selectedExhibitor 
        ? { id: selectedExhibitor.id, name: selectedExhibitor.name, website: selectedExhibitor.website, approved: selectedExhibitor.approved }
        : { name: newExhibitorData.name, website: newExhibitorData.website, stand_info: newExhibitorData.stand_info, logo: newExhibitorData.logo };

      onChange({
        exhibitor: exhibitorData,
        user: user ? undefined : userData
      });
    }
  }, [selectedExhibitor, newExhibitorData, userData, user, onChange, onValidationChange]);

  const loadExhibitors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { event_id: event.id, search: searchQuery }
      });

      if (error) throw error;
      setExhibitors(data || []);
    } catch (error) {
      console.error('Error loading exhibitors:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les exposants',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExhibitorSelect = (exhibitor: DbExhibitor) => {
    setSelectedExhibitor(exhibitor);
    setShowNewExhibitorForm(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Type de fichier invalide',
        description: 'Seules les images sont autorisées',
        variant: 'destructive'
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB
      toast({
        title: 'Fichier trop volumineux',
        description: 'Taille maximum: 2MB',
        variant: 'destructive'
      });
      return;
    }

    setNewExhibitorData(prev => ({ ...prev, logo: file }));
  };

  const resetSelection = () => {
    setSelectedExhibitor(null);
    setShowNewExhibitorForm(false);
    setNewExhibitorData({ name: '', website: '', stand_info: '', logo: null });
  };

  return (
    <div className="space-y-8">
      {/* Step header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Société et utilisateur</h2>
        <p className="text-muted-foreground">
          Sélectionnez l'exposant et renseignez vos informations
        </p>
      </div>

      {/* Exhibitor Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Sélectionner l'exposant</h3>
          {(selectedExhibitor || showNewExhibitorForm) && (
            <Button variant="outline" size="sm" onClick={resetSelection}>
              <X className="h-4 w-4 mr-1" />
              Changer
            </Button>
          )}
        </div>

        {selectedExhibitor ? (
          /* Selected exhibitor display */
          <Card className="border-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{selectedExhibitor.name}</h4>
                    {selectedExhibitor.website && (
                      <p className="text-sm text-muted-foreground">{selectedExhibitor.website}</p>
                    )}
                    {selectedExhibitor.stand_info && (
                      <p className="text-sm text-muted-foreground">Stand: {selectedExhibitor.stand_info}</p>
                    )}
                  </div>
                </div>
                <Badge variant={selectedExhibitor.approved ? "default" : "secondary"}>
                  {selectedExhibitor.approved ? 'Approuvé' : 'En validation'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ) : showNewExhibitorForm ? (
          /* New exhibitor form */
          <Card>
            <CardContent className="p-6 space-y-4">
              <h4 className="font-medium">Créer une nouvelle entreprise</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company-name">Nom de l'entreprise *</Label>
                  <Input
                    id="company-name"
                    value={newExhibitorData.name}
                    onChange={(e) => setNewExhibitorData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nom de votre entreprise"
                  />
                </div>

                <div>
                  <Label htmlFor="company-website">Site web</Label>
                  <Input
                    id="company-website"
                    type="url"
                    value={newExhibitorData.website}
                    onChange={(e) => setNewExhibitorData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://votresite.com"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="stand-info">Informations du stand</Label>
                <Input
                  id="stand-info"
                  value={newExhibitorData.stand_info}
                  onChange={(e) => setNewExhibitorData(prev => ({ ...prev, stand_info: e.target.value }))}
                  placeholder="Numéro de stand, emplacement..."
                />
              </div>

              <div>
                <Label htmlFor="company-logo">Logo (optionnel)</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="company-logo"
                  />
                  <label
                    htmlFor="company-logo"
                    className="flex items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-accent transition-colors"
                  >
                    {newExhibitorData.logo ? (
                      <div className="text-center">
                        <p className="text-sm font-medium">{newExhibitorData.logo.name}</p>
                        <p className="text-xs text-muted-foreground">Cliquez pour changer</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Ajouter un logo</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Exhibitor search and list */
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une entreprise..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  loadExhibitors();
                }}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {exhibitors.map((exhibitor) => (
                  <Card 
                    key={exhibitor.id} 
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleExhibitorSelect(exhibitor)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{exhibitor.name}</h4>
                          {exhibitor.website && (
                            <p className="text-sm text-muted-foreground">{exhibitor.website}</p>
                          )}
                          {exhibitor.stand_info && (
                            <p className="text-sm text-muted-foreground">Stand: {exhibitor.stand_info}</p>
                          )}
                        </div>
                        <Button size="sm">Sélectionner</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => setShowNewExhibitorForm(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Mon entreprise n'est pas dans la liste
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* User Information (if not logged in) */}
      {!user && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Vos informations</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first-name">Prénom *</Label>
              <Input
                id="first-name"
                value={userData.first_name}
                onChange={(e) => setUserData(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder="Votre prénom"
              />
            </div>

            <div>
              <Label htmlFor="last-name">Nom *</Label>
              <Input
                id="last-name"
                value={userData.last_name}
                onChange={(e) => setUserData(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder="Votre nom"
              />
            </div>

            <div>
              <Label htmlFor="email">Email professionnel *</Label>
              <Input
                id="email"
                type="email"
                value={userData.email}
                onChange={(e) => setUserData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="votre.email@entreprise.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                value={userData.phone}
                onChange={(e) => setUserData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="01 23 45 67 89"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="role">Rôle/Fonction *</Label>
              <Input
                id="role"
                value={userData.role}
                onChange={(e) => setUserData(prev => ({ ...prev, role: e.target.value }))}
                placeholder="Directeur commercial, Chef de produit..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}