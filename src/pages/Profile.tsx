
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Mail, 
  Lock, 
  Trash2, 
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { 
  useProfile, 
  useUpdateProfile, 
  useNewsletterPrefsControlled
} from '@/hooks/useProfile';
import { useSectors } from '@/hooks/useSectors';
import ChangePasswordModal from '@/components/profile/ChangePasswordModal';
import ChangeEmailModal from '@/components/profile/ChangeEmailModal';
import DeleteAccountModal from '@/components/profile/DeleteAccountModal';
import ProfileSkeleton from '@/components/profile/ProfileSkeleton';
import EmptyProfileState from '@/components/profile/EmptyProfileState';

const Profile = () => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile();
  const { data: sectors = [], isLoading: sectorsLoading } = useSectors();
  const updateProfile = useUpdateProfile();
  const {
    selectedIds: selectedSectors,
    toggle: toggleSector,
    save: saveNewsletterPrefs,
    isSaving: isNewsletterSaving,
    isFetching: isNewsletterFetching,
    countLabel,
    dirty: hasNewsletterChanges
  } = useNewsletterPrefsControlled();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    job_title: '',
    company: '',
    primary_sector: '',
  });

  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        job_title: profile.job_title || '',
        company: profile.company || '',
        primary_sector: profile.primary_sector || '',
      });
    }
  }, [profile]);


  if (loading || profileLoading) {
    return (
      <MainLayout title="Mon profil">
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
                <User className="h-8 w-8" />
                Mon profil
              </h1>
              <p className="text-gray-600 mt-2">
                Gérez vos informations personnelles et vos préférences
              </p>
            </div>
            <ProfileSkeleton />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Show empty state if profile doesn't exist and user hasn't chosen to create one
  if (profile === null && !showCreateForm) {
    return (
      <MainLayout title="Mon profil">
        <EmptyProfileState onCreateProfile={() => setShowCreateForm(true)} />
      </MainLayout>
    );
  }

  const calculateProfileProgress = () => {
    const fields = [
      formData.first_name,
      formData.last_name,
      formData.job_title,
      formData.company,
      formData.primary_sector,
    ];
    const filledFields = fields.filter(field => field && field.trim() !== '').length;
    return Math.round((filledFields / fields.length) * 100);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateProfile.mutate(formData);
  };

  const handleSectorToggle = (sectorId: string) => {
    toggleSector(sectorId);
  };

  const profileProgress = calculateProfileProgress();
  const isLoading = sectorsLoading;

  return (
    <MainLayout title="Mon profil">
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
              <User className="h-8 w-8" />
              Mon profil
            </h1>
            <p className="text-gray-600 mt-2">
              Gérez vos informations personnelles et vos préférences
            </p>
          </div>

          <div className="space-y-8">
            {/* Bloc Identité */}
            <Card className="p-6 rounded-2xl shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Informations personnelles</h2>
                <div className="flex items-center gap-2 mb-4">
                  <Progress value={profileProgress} className="flex-1" />
                  <span className="text-sm text-gray-600 font-medium">
                    {profileProgress}% complété
                  </span>
                </div>
                {profileProgress < 100 && (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">
                      Complétez votre profil pour une meilleure expérience
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom *</Label>
                  {isLoading ? (
                    <div className="h-10 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      placeholder="Votre prénom"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom *</Label>
                  {isLoading ? (
                    <div className="h-10 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      placeholder="Votre nom"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job_title">Fonction / Poste</Label>
                  {isLoading ? (
                    <div className="h-10 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <Input
                      id="job_title"
                      value={formData.job_title}
                      onChange={(e) => handleInputChange('job_title', e.target.value)}
                      placeholder="Votre fonction"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Entreprise</Label>
                  {isLoading ? (
                    <div className="h-10 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      placeholder="Votre entreprise"
                    />
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="primary_sector">Secteur d'activité principal</Label>
                  {isLoading ? (
                    <div className="h-10 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <Select
                      value={formData.primary_sector}
                      onValueChange={(value) => handleInputChange('primary_sector', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez votre secteur principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map((sector) => (
                          <SelectItem key={sector.id} value={sector.id}>
                            {sector.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button 
                  onClick={handleSave}
                  disabled={updateProfile.isPending || isLoading}
                >
                  {updateProfile.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </div>
            </Card>

            {/* Bloc Accès au compte */}
            <Card className="p-6 rounded-2xl shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Accès au compte</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium">Adresse email</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEmailModal(true)}
                  >
                    Modifier
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium">Mot de passe</p>
                      <p className="text-sm text-gray-600">••••••••</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPasswordModal(true)}
                  >
                    Modifier
                  </Button>
                </div>
              </div>
            </Card>

            {/* Bloc Newsletters */}
            <Card className="p-6 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Newsletters sectorielles</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Recevez {countLabel} sur les événements de vos secteurs
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-1 animate-pulse" />
                        <div className="h-3 bg-gray-200 rounded w-48 animate-pulse" />
                      </div>
                      <div className="h-6 w-11 bg-gray-200 rounded-full animate-pulse" />
                    </div>
                  ))
                ) : (
                  sectors.map((sector) => (
                    <div
                      key={sector.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{sector.name}</p>
                        {sector.description && (
                          <p className="text-sm text-gray-600">{sector.description}</p>
                        )}
                      </div>
                      <Switch
                        checked={selectedSectors.includes(sector.id)}
                        onCheckedChange={() => handleSectorToggle(sector.id)}
                        disabled={isNewsletterSaving || isNewsletterFetching}
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end mt-4">
                <Button 
                  onClick={saveNewsletterPrefs} 
                  disabled={isNewsletterSaving || isNewsletterFetching || !hasNewsletterChanges}
                  className="w-full"
                >
                  {isNewsletterSaving ? 'Sauvegarde...' : 'Enregistrer mes préférences'}
                </Button>
              </div>
            </Card>

            {/* Bloc RGPD */}
            <Card className="p-6 rounded-2xl shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Gestion des données</h2>
              <div className="w-full">
                <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                  <div className="flex items-center gap-3">
                    <Trash2 className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="font-medium text-red-800">Supprimer mon compte</p>
                      <p className="text-sm text-red-600">
                        Cette action est irréversible
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full md:w-auto"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
      <ChangeEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
      />
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </MainLayout>
  );
};

export default Profile;
