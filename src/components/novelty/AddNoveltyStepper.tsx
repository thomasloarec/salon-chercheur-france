import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Search, Plus, Upload, X, GripVertical } from 'lucide-react'
import type { Event } from '@/types/event'

interface AddNoveltyStepperProps {
  isOpen: boolean
  onClose: () => void
  event: Event
}

interface DbExhibitor {
  id: string
  name: string
  website?: string
  logo_url?: string
  approved: boolean
  stand_info?: string
}

const CONSUMER_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.fr', 'yahoo.co.uk', 'hotmail.com', 'hotmail.fr',
  'outlook.com', 'outlook.fr', 'live.com', 'live.fr', 'icloud.com', 'me.com',
  'gmx.com', 'gmx.fr', 'proton.me', 'protonmail.com', 'aol.com', 'free.fr',
  'orange.fr', 'laposte.net', 'msn.com', 'ymail.com'
]

type StepperStep = 'exhibitor' | 'auth' | 'novelty' | 'confirmation'

interface NoveltyFormData {
  title: string
  summary: string
  details: string
  images: File[]
  resource_file?: File
}

interface NewExhibitorData {
  name: string
  website: string
  stand_info: string
  logo?: File
}

export default function AddNoveltyStepper({ isOpen, onClose, event }: AddNoveltyStepperProps) {
  const { user, signIn } = useAuth()
  const { toast } = useToast()
  
  const [currentStep, setCurrentStep] = useState<StepperStep>('exhibitor')
  const [loading, setLoading] = useState(false)
  
  // Step 1: Exhibitor selection
  const [exhibitors, setExhibitors] = useState<DbExhibitor[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExhibitor, setSelectedExhibitor] = useState<DbExhibitor | null>(null)
  const [showNewExhibitorForm, setShowNewExhibitorForm] = useState(false)
  const [newExhibitorData, setNewExhibitorData] = useState<NewExhibitorData>({
    name: '', website: '', stand_info: ''
  })
  
  // Step 2: Auth
  const [authEmail, setAuthEmail] = useState('')
  const [authError, setAuthError] = useState('')
  
  // Step 3: Novelty form
  const [noveltyData, setNoveltyData] = useState<NoveltyFormData>({
    title: '', summary: '', details: '', images: []
  })
  
  // Step 4: Confirmation
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean
    message: string
    noveltyId?: string
  } | null>(null)

  // Load exhibitors when dialog opens
  useEffect(() => {
    if (isOpen && currentStep === 'exhibitor') {
      loadExhibitors()
    }
  }, [isOpen, currentStep])

  // Restore state from localStorage
  useEffect(() => {
    if (isOpen && user) {
      const savedState = localStorage.getItem('addNoveltyState')
      if (savedState) {
        try {
          const state = JSON.parse(savedState)
          if (state.selectedExhibitor) {
            setSelectedExhibitor(state.selectedExhibitor)
            setCurrentStep('novelty')
          }
        } catch (error) {
          console.error('Error restoring state:', error)
        }
      }
    }
  }, [isOpen, user])

  // Save state to localStorage
  const saveState = () => {
    const state = {
      selectedExhibitor,
      newExhibitorData: showNewExhibitorForm ? newExhibitorData : null
    }
    localStorage.setItem('addNoveltyState', JSON.stringify(state))
  }

  const loadExhibitors = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { event_id: event.id, search: searchQuery }
      })

      if (error) throw error
      setExhibitors(data || [])
    } catch (error) {
      console.error('Error loading exhibitors:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les exposants',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const validateProfessionalEmail = (email: string): boolean => {
    const domain = email.split('@')[1]?.toLowerCase()
    return domain && !CONSUMER_EMAIL_DOMAINS.includes(domain)
  }

  const handleExhibitorSelect = (exhibitor: DbExhibitor) => {
    setSelectedExhibitor(exhibitor)
    saveState()
    if (user) {
      setCurrentStep('novelty')
    } else {
      setCurrentStep('auth')
    }
  }

  const handleCreateNewExhibitor = async () => {
    if (!newExhibitorData.name.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le nom de l\'entreprise est requis',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: {
          name: newExhibitorData.name,
          website: newExhibitorData.website,
          stand_info: newExhibitorData.stand_info
        }
      })

      if (error) throw error

      const newExhibitor: DbExhibitor = {
        ...data,
        approved: false
      }
      
      setSelectedExhibitor(newExhibitor)
      setShowNewExhibitorForm(false)
      saveState()
      
      if (user) {
        setCurrentStep('novelty')
      } else {
        setCurrentStep('auth')
      }
      
      toast({
        title: 'Entreprise créée',
        description: 'Votre entreprise a été créée et est en attente d\'approbation'
      })
    } catch (error) {
      console.error('Error creating exhibitor:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de créer l\'entreprise',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async () => {
    if (!authEmail.trim()) {
      setAuthError('Email requis')
      return
    }

    if (!validateProfessionalEmail(authEmail)) {
      setAuthError('Veuillez utiliser votre email professionnel d\'entreprise')
      return
    }

    try {
      setLoading(true)
      const { error } = await signIn(authEmail, '')
      
      if (error) {
        setAuthError(error.message)
      } else {
        toast({
          title: 'Email envoyé',
          description: 'Consultez votre boîte mail pour vous connecter'
        })
        // The auth state change will automatically move to the next step
      }
    } catch (error) {
      setAuthError('Erreur lors de l\'envoi de l\'email')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (noveltyData.images.length + files.length > 3) {
      toast({
        title: 'Limite atteinte',
        description: 'Maximum 3 images autorisées',
        variant: 'destructive'
      })
      return
    }

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Type de fichier invalide',
          description: 'Seules les images sont autorisées',
          variant: 'destructive'
        })
        return false
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB
        toast({
          title: 'Fichier trop volumineux',
          description: 'Taille maximum: 5MB',
          variant: 'destructive'
        })
        return false
      }
      return true
    })

    setNoveltyData(prev => ({
      ...prev,
      images: [...prev.images, ...validFiles]
    }))
  }

  const handleResourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Type de fichier invalide',
        description: 'Seuls les fichiers PDF sont autorisés',
        variant: 'destructive'
      })
      return
    }

    if (file.size > 20 * 1024 * 1024) { // 20MB
      toast({
        title: 'Fichier trop volumineux',
        description: 'Taille maximum: 20MB',
        variant: 'destructive'
      })
      return
    }

    setNoveltyData(prev => ({ ...prev, resource_file: file }))
  }

  const removeImage = (index: number) => {
    setNoveltyData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const handleSubmitNovelty = async () => {
    if (!selectedExhibitor || !noveltyData.title.trim()) {
      toast({
        title: 'Erreur',
        description: 'Exposant et titre requis',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)

      // Check if user can add novelty (plan limits)
      const { data: canAdd, error: limitError } = await supabase.rpc('can_add_novelty', {
        p_exhibitor_id: selectedExhibitor.id,
        p_user_id: user!.id
      })

      if (limitError || !canAdd) {
        toast({
          title: 'Limite atteinte',
          description: 'Plan gratuit: 1 nouveauté maximum par exposant. Passez au plan payant pour plus.',
          variant: 'destructive'
        })
        return
      }

      // Create novelty
      const { data: novelty, error: noveltyError } = await supabase
        .from('novelties')
        .insert({
          event_id: event.id,
          exhibitor_id: selectedExhibitor.id,
          title: noveltyData.title.trim(),
          type: 'Launch', // Default type
          summary: noveltyData.summary.trim() || null,
          details: noveltyData.details.trim() || null,
          images_count: noveltyData.images.length,
          status: selectedExhibitor.approved ? 'Published' : 'pending',
          created_by: user!.id
        })
        .select()
        .single()

      if (noveltyError) throw noveltyError

      // Upload images
      for (let i = 0; i < noveltyData.images.length; i++) {
        const image = noveltyData.images[i]
        const filename = `${novelty.id}/image-${i}.${image.name.split('.').pop()}`
        
        const { error: uploadError } = await supabase.storage
          .from('novelty-images')
          .upload(filename, image)

        if (uploadError) {
          console.error('Error uploading image:', uploadError)
          continue
        }

        // Save image record
        await supabase
          .from('novelty_images')
          .insert({
            novelty_id: novelty.id,
            url: filename,
            position: i
          })
      }

      // Upload resource file
      if (noveltyData.resource_file) {
        const filename = `${novelty.id}/presentation.pdf`
        const { error: uploadError } = await supabase.storage
          .from('novelty-resources')
          .upload(filename, noveltyData.resource_file)

        if (!uploadError) {
          await supabase
            .from('novelties')
            .update({ resource_url: filename })
            .eq('id', novelty.id)
        }
      }

      // Initialize stats
      await supabase
        .from('novelty_stats')
        .insert({
          novelty_id: novelty.id,
          likes: 0,
          saves: 0,
          resource_downloads: 0,
          meeting_requests: 0
        })

      setSubmissionResult({
        success: true,
        message: selectedExhibitor.approved 
          ? 'Votre nouveauté est publiée 🎉'
          : 'Votre nouveauté a été soumise et sera publiée après validation.',
        noveltyId: novelty.id
      })

      setCurrentStep('confirmation')
      localStorage.removeItem('addNoveltyState')

    } catch (error) {
      console.error('Error submitting novelty:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de soumettre la nouveauté',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (currentStep !== 'confirmation') {
      localStorage.removeItem('addNoveltyState')
    }
    setCurrentStep('exhibitor')
    setSelectedExhibitor(null)
    setShowNewExhibitorForm(false)
    setNoveltyData({ title: '', summary: '', details: '', images: [] })
    setAuthEmail('')
    setAuthError('')
    setSubmissionResult(null)
    onClose()
  }

  const renderExhibitorStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Pour quelle société souhaitez-vous ajouter une nouveauté ?
        </h3>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une entreprise..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              loadExhibitors()
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
          <Button onClick={() => handleExhibitorSelect(exhibitor)}>
            Sélectionner
          </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setShowNewExhibitorForm(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Mon entreprise n'est pas dans la liste
          </Button>
        </div>

        {showNewExhibitorForm && (
          <Card className="mt-4">
            <CardContent className="p-4 space-y-4">
              <h4 className="font-medium">Créer une nouvelle entreprise</h4>
              
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
                  value={newExhibitorData.website}
                  onChange={(e) => setNewExhibitorData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://votresite.com"
                />
              </div>

              <div>
                <Label htmlFor="stand-info">Informations stand</Label>
                <Input
                  id="stand-info"
                  value={newExhibitorData.stand_info}
                  onChange={(e) => setNewExhibitorData(prev => ({ ...prev, stand_info: e.target.value }))}
                  placeholder="Numéro de stand, emplacement..."
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateNewExhibitor} disabled={loading}>
                  {loading ? 'Création...' : 'Créer l\'entreprise'}
                </Button>
                <Button variant="outline" onClick={() => setShowNewExhibitorForm(false)}>
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )

  const renderAuthStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Connexion requise</h3>
        <p className="text-muted-foreground mb-6">
          Veuillez vous connecter avec votre email professionnel pour continuer.
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="auth-email">Email professionnel</Label>
            <Input
              id="auth-email"
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="votre.email@entreprise.com"
            />
            {authError && (
              <p className="text-sm text-destructive mt-1">{authError}</p>
            )}
          </div>

          <Button onClick={handleAuth} disabled={loading} className="w-full">
            {loading ? 'Envoi...' : 'Envoyer le lien de connexion'}
          </Button>
        </div>
      </div>
    </div>
  )

  const renderNoveltyStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Ajouter une nouveauté</h3>
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-muted-foreground">Pour:</span>
          <Badge variant="outline">{selectedExhibitor?.name}</Badge>
          {!selectedExhibitor?.approved && (
            <Badge variant="secondary">En validation</Badge>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="novelty-title">Titre *</Label>
            <Input
              id="novelty-title"
              value={noveltyData.title}
              onChange={(e) => setNoveltyData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Nom de votre nouveauté"
            />
          </div>

          <div>
            <Label htmlFor="novelty-summary">Résumé</Label>
            <Textarea
              id="novelty-summary"
              value={noveltyData.summary}
              onChange={(e) => setNoveltyData(prev => ({ ...prev, summary: e.target.value }))}
              placeholder="Pitch court de votre nouveauté"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="novelty-details">Description détaillée</Label>
            <Textarea
              id="novelty-details"
              value={noveltyData.details}
              onChange={(e) => setNoveltyData(prev => ({ ...prev, details: e.target.value }))}
              placeholder="Description complète de votre nouveauté"
              rows={4}
            />
          </div>

          <div>
            <Label>Images (maximum 3)</Label>
            <div className="mt-2">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="flex items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-accent transition-colors"
              >
                <div className="text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Cliquez pour ajouter des images
                  </p>
                </div>
              </label>
            </div>

            {noveltyData.images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-4">
                {noveltyData.images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Dossier de présentation (PDF, max 20MB)</Label>
            <div className="mt-2">
              <input
                type="file"
                accept=".pdf"
                onChange={handleResourceUpload}
                className="hidden"
                id="resource-upload"
              />
              <label
                htmlFor="resource-upload"
                className="flex items-center justify-center w-full h-20 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-accent transition-colors"
              >
                <div className="text-center">
                  <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {noveltyData.resource_file ? noveltyData.resource_file.name : 'Ajouter un PDF'}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <Button onClick={handleSubmitNovelty} disabled={loading} className="w-full">
            {loading ? 'Soumission...' : 'Soumettre la nouveauté'}
          </Button>
        </div>
      </div>
    </div>
  )

  const renderConfirmationStep = () => (
    <div className="space-y-6 text-center">
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {submissionResult?.success ? '🎉 Nouveauté soumise !' : '❌ Erreur'}
        </h3>
        <p className="text-muted-foreground mb-6">
          {submissionResult?.message}
        </p>

        <Button onClick={handleClose} className="w-full">
          Terminer
        </Button>
      </div>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter une nouveauté</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {currentStep === 'exhibitor' && renderExhibitorStep()}
          {currentStep === 'auth' && renderAuthStep()}
          {currentStep === 'novelty' && renderNoveltyStep()}
          {currentStep === 'confirmation' && renderConfirmationStep()}
        </div>
      </DialogContent>
    </Dialog>
  )
}