import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Building, Upload, X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { useNoveltyQuota } from '@/hooks/useNoveltyQuota';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Step1Data } from '@/lib/validation/noveltySchemas';
import { step1Schema, CONSUMER_EMAIL_DOMAINS } from '@/lib/validation/noveltySchemas';
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
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [loading, setLoading] = useState(false);
  const [showNewExhibitorForm, setShowNewExhibitorForm] = useState(false);
  const [selectedExhibitor, setSelectedExhibitor] = useState<DbExhibitor | null>(null);
  
  // Vérifier le quota pour l'exposant sélectionné
  const { data: quota } = useNoveltyQuota(
    selectedExhibitor?.id,
    event?.id
  );
  
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

  // Load exhibitors on mount and when search changes
  useEffect(() => {
    loadExhibitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, event?.id_event]);

  // Validate form data
  useEffect(() => {
    const hasExhibitor = selectedExhibitor || (newExhibitorData.name && newExhibitorData.website);
    const hasUserData = !!user || (!!(userData.first_name && userData.last_name && userData.email && userData.phone && userData.role));
    
    // Validate professional email if provided
    const emailValid = !userData.email || isProfessionalEmail(userData.email);
    
    // Bloquer la validation si quota dépassé pour l'exposant sélectionné
    const quotaOk = !selectedExhibitor || !quota || quota.allowed;
    
    const isValid = hasExhibitor && hasUserData && emailValid && quotaOk;
    onValidationChange(isValid);

    // Update parent data - Always send valid structure
    if (hasExhibitor && hasUserData && emailValid && quotaOk) {
      const exhibitorData = selectedExhibitor 
        ? { 
            id: selectedExhibitor.id, 
            name: selectedExhibitor.name, 
            website: selectedExhibitor.website || '',
            approved: selectedExhibitor.approved 
          }
        : { 
            name: newExhibitorData.name, 
            website: newExhibitorData.website || '',
            stand_info: newExhibitorData.stand_info || '',
            logo: newExhibitorData.logo 
          };

      onChange({
        exhibitor: exhibitorData,
        user: user ? undefined : {
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          role: userData.role || ''
        }
      });
    }
  }, [selectedExhibitor, newExhibitorData, userData, user, quota, onChange, onValidationChange]);

  // Check if email is professional
  const isProfessionalEmail = (email: string) => {
    const domain = email.split('@')[1]?.toLowerCase();
    return domain && !CONSUMER_EMAIL_DOMAINS.includes(domain);
  };

  const loadExhibitors = async () => {
    try {
      setLoading(true);

      const eventId = event?.id_event ?? null;
      if (!eventId) {
        console.warn('[Step1ExhibitorAndUser] Aucun id_event défini');
        setExhibitors([]);
        return;
      }

      // Charger directement depuis la vue participations_with_exhibitors
      // (sans jointure avec exhibitors pour éviter les erreurs de type)
      let q = supabase
        .from('participations_with_exhibitors')
        .select('id_exposant, exhibitor_uuid, exhibitor_name, exhibitor_website, stand_exposant')
        .eq('id_event_text', eventId)
        .order('exhibitor_name', { ascending: true });

      const s = debouncedSearch?.trim();
      if (s) q = q.ilike('exhibitor_name', `%${s}%`);

      const { data: participations, error: partErr } = await q;
      if (partErr) {
        console.error('[Step1ExhibitorAndUser] participations error', partErr);
        throw partErr;
      }

      const rows = participations ?? [];
      if (rows.length === 0) {
        setExhibitors([]);
        return;
      }

      // Pour chaque participation, vérifier s'il existe dans la table exhibitors (avec UUID)
      // Si oui, utiliser l'UUID; sinon, utiliser id_exposant comme identifiant temporaire
      const exhibitorMap = new Map<string, string>();
      
      // Essayer de matcher avec la table exhibitors par website (si disponible)
      const websitesWithData = rows
        .filter(p => p.exhibitor_website)
        .map(p => ({ website: p.exhibitor_website!.toLowerCase().trim(), original: p }));
      
      if (websitesWithData.length > 0) {
        const websites = websitesWithData.map(w => w.website);
        const { data: matchingExhibitors } = await supabase
          .from('exhibitors')
          .select('id, website')
          .in('website', websites);
        
        if (matchingExhibitors) {
          matchingExhibitors.forEach(ex => {
            if (ex.website) {
              exhibitorMap.set(ex.website.toLowerCase().trim(), ex.id);
            }
          });
        }
      }

      // Mapper les résultats
      const formatted: DbExhibitor[] = rows.map(p => {
        const website = p.exhibitor_website?.toLowerCase().trim();
        const matchedUuid = website ? exhibitorMap.get(website) : undefined;
        
        return {
          id: matchedUuid || p.id_exposant || String(p.exhibitor_uuid || ''),
          name: p.exhibitor_name || p.id_exposant || '',
          website: p.exhibitor_website || '',
          logo_url: undefined,
          approved: !!matchedUuid, // Approuvé si trouvé dans exhibitors
          stand_info: p.stand_exposant || undefined,
        };
      }).filter(e => e.name); // Filtrer ceux sans nom

      setExhibitors(formatted);
    } catch (error) {
      console.error('[Step1ExhibitorAndUser] Exception', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les exposants',
        variant: 'destructive'
      });
      setExhibitors([]);
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
          <div className="space-y-3">
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
                  <div>
                    <Badge variant={selectedExhibitor.approved ? "default" : "secondary"}>
                      {selectedExhibitor.approved ? 'Approuvé' : 'En validation'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Afficher un avertissement si le quota est atteint */}
            {quota && !quota.allowed && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  <p className="font-semibold mb-1">Limite atteinte pour cet exposant</p>
                  <p className="text-sm">
                    {selectedExhibitor.name} a déjà publié {quota.current} nouveauté{quota.current > 1 ? 's' : ''} sur cet événement.
                    Le plan gratuit limite à {quota.limit} nouveauté par exposant et par événement.
                  </p>
                  <p className="text-sm mt-2">
                    Veuillez sélectionner un autre exposant ou{' '}
                    <a 
                      href="/premium" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline font-semibold hover:text-destructive-foreground/80 transition-colors"
                    >
                      passer au plan Pro
                    </a>
                    {' '}pour publier davantage de nouveautés.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>
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
                onChange={(e) => setSearchQuery(e.target.value)}
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
                className={userData.email && !isProfessionalEmail(userData.email) ? 'border-destructive' : ''}
              />
              {userData.email && !isProfessionalEmail(userData.email) && (
                <p className="text-xs text-destructive mt-1">
                  Utilisez votre email professionnel d'entreprise
                </p>
              )}
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