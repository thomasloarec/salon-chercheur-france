import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Building2, FileText, Users, BarChart3, Download, Upload, X } from 'lucide-react'

interface DbExhibitor {
  id: string
  name: string
  website?: string
  logo_url?: string
  approved: boolean
  stand_info?: string
  description?: string
}

interface DbNovelty {
  id: string
  title: string
  summary?: string
  details?: string
  status: string
  resource_url?: string
  images_count: number
  created_at: string
}

interface DbLead {
  id: string
  lead_type: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  company?: string
  role?: string
  created_at: string
}

interface NoveltyStats {
  likes: number
  saves: number
  resource_downloads: number
  meeting_requests: number
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [exhibitor, setExhibitor] = useState<DbExhibitor | null>(null)
  const [novelty, setNovelty] = useState<DbNovelty | null>(null)
  const [leads, setLeads] = useState<DbLead[]>([])
  const [stats, setStats] = useState<NoveltyStats>({
    likes: 0, saves: 0, resource_downloads: 0, meeting_requests: 0
  })
  const [userPlan, setUserPlan] = useState<'free' | 'paid'>('free')

  // Form states
  const [exhibitorForm, setExhibitorForm] = useState({
    name: '', website: '', stand_info: '', description: ''
  })
  const [noveltyForm, setNoveltyForm] = useState({
    title: '', summary: '', details: ''
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Load user's exhibitor
      const { data: exhibitorData, error: exhibitorError } = await supabase
        .from('exhibitors')
        .select('*')
        .eq('owner_user_id', user.id)
        .single()

      if (exhibitorError && exhibitorError.code !== 'PGRST116') {
        throw exhibitorError
      }

      if (exhibitorData) {
        setExhibitor(exhibitorData)
        setExhibitorForm({
          name: exhibitorData.name || '',
          website: exhibitorData.website || '',
          stand_info: exhibitorData.stand_info || '',
          description: exhibitorData.description || ''
        })

        // Load novelty for this exhibitor
        const { data: noveltyData, error: noveltyError } = await supabase
          .from('novelties')
          .select('*')
          .eq('exhibitor_id', exhibitorData.id)
          .eq('created_by', user.id)
          .single()

        if (noveltyError && noveltyError.code !== 'PGRST116') {
          throw noveltyError
        }

        if (noveltyData) {
          setNovelty(noveltyData)
          setNoveltyForm({
            title: noveltyData.title || '',
            summary: noveltyData.summary || '',
            details: noveltyData.details || ''
          })

          // Load leads for this novelty
          const { data: leadsData, error: leadsError } = await supabase
            .from('leads')
            .select('*')
            .eq('novelty_id', noveltyData.id)
            .order('created_at', { ascending: false })

          if (leadsError) throw leadsError
          setLeads(leadsData || [])

          // Load stats
          const { data: statsData, error: statsError } = await supabase
            .from('novelty_stats')
            .select('*')
            .eq('novelty_id', noveltyData.id)
            .single()

          if (statsError && statsError.code !== 'PGRST116') {
            throw statsError
          }

          if (statsData) {
            setStats({
              likes: 0, // Field doesn't exist in current schema, using default
              saves: statsData.saves_count || 0,
              resource_downloads: 0, // Field doesn't exist in current schema, using default  
              meeting_requests: 0 // Field doesn't exist in current schema, using default
            })
          }
        }
      }

      // Load user plan
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('plan')
        .eq('user_id', user.id)
        .single()

      if (planError && planError.code !== 'PGRST116') {
        throw planError
      }

      setUserPlan((planData?.plan as 'free' | 'paid') || 'free')

    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateExhibitor = async () => {
    if (!exhibitor) return

    try {
      setLoading(true)

      // Upload logo if provided
      let logoUrl = exhibitor.logo_url
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${exhibitor.id}/logo.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('novelty-images')
          .upload(fileName, logoFile, { upsert: true })

        if (uploadError) throw uploadError
        
        const { data: { publicUrl } } = supabase.storage
          .from('novelty-images')
          .getPublicUrl(fileName)
        
        logoUrl = publicUrl
      }

      const { error } = await supabase.functions.invoke('exhibitors-manage', {
        body: {
          ...exhibitorForm,
          logo_url: logoUrl
        }
      })

      if (error) throw error

      toast({
        title: 'Entreprise mise à jour',
        description: 'Les informations ont été sauvegardées'
      })

      loadDashboardData()

    } catch (error) {
      console.error('Error updating exhibitor:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour l\'entreprise',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateNovelty = async () => {
    if (!novelty) return

    try {
      setLoading(true)

      const { error } = await supabase
        .from('novelties')
        .update({
          title: noveltyForm.title,
          summary: noveltyForm.summary || null,
          details: noveltyForm.details || null
        })
        .eq('id', novelty.id)

      if (error) throw error

      toast({
        title: 'Nouveauté mise à jour',
        description: 'Les informations ont été sauvegardées'
      })

      loadDashboardData()

    } catch (error) {
      console.error('Error updating novelty:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la nouveauté',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportLeads = () => {
    if (leads.length === 0) {
      toast({
        title: 'Aucun lead',
        description: 'Aucun lead à exporter',
        variant: 'destructive'
      })
      return
    }

    const visibleLeads = userPlan === 'free' ? leads.slice(0, 3) : leads
    
    const csvContent = [
      ['Date', 'Type', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Société', 'Rôle'].join(','),
      ...visibleLeads.map(lead => [
        new Date(lead.created_at).toLocaleDateString('fr-FR'),
        lead.lead_type === 'resource_download' ? 'Téléchargement' : 'Demande RDV',
        lead.first_name,
        lead.last_name,
        lead.email,
        lead.phone || '',
        lead.company || '',
        lead.role || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'leads.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  }

  if (!exhibitor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">Aucune entreprise trouvée</h2>
            <p className="text-muted-foreground mb-4">
              Vous devez d'abord créer une entreprise pour accéder au tableau de bord.
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Ajouter une nouveauté
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Tableau de bord</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{exhibitor.name}</Badge>
          <Badge variant={exhibitor.approved ? 'default' : 'secondary'}>
            {exhibitor.approved ? 'Approuvé' : 'En validation'}
          </Badge>
          <Badge variant={userPlan === 'paid' ? 'default' : 'secondary'}>
            Plan {userPlan === 'paid' ? 'Pro' : 'Gratuit'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Entreprise
          </TabsTrigger>
          <TabsTrigger value="novelty" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Nouveauté
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Informations de l'entreprise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="company-name">Nom de l'entreprise</Label>
                <Input
                  id="company-name"
                  value={exhibitorForm.name}
                  onChange={(e) => setExhibitorForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="company-website">Site web</Label>
                <Input
                  id="company-website"
                  value={exhibitorForm.website}
                  onChange={(e) => setExhibitorForm(prev => ({ ...prev, website: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="stand-info">Informations stand</Label>
                <Input
                  id="stand-info"
                  value={exhibitorForm.stand_info}
                  onChange={(e) => setExhibitorForm(prev => ({ ...prev, stand_info: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="company-description">Description</Label>
                <Textarea
                  id="company-description"
                  value={exhibitorForm.description}
                  onChange={(e) => setExhibitorForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                />
              </div>

              <div>
                <Label>Logo</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="flex items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-accent transition-colors"
                  >
                    {exhibitor.logo_url || logoFile ? (
                      <img
                        src={logoFile ? URL.createObjectURL(logoFile) : exhibitor.logo_url!}
                        alt="Logo"
                        className="h-24 w-24 object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Cliquez pour ajouter un logo</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <Button onClick={handleUpdateExhibitor} disabled={loading}>
                {loading ? 'Mise à jour...' : 'Mettre à jour'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="novelty">
          <Card>
            <CardHeader>
              <CardTitle>Nouveauté</CardTitle>
            </CardHeader>
            <CardContent>
              {novelty ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant={novelty.status === 'Published' ? 'default' : 'secondary'}>
                      {novelty.status === 'Published' ? 'Publiée' : 'En attente'}
                    </Badge>
                  </div>

                  <div>
                    <Label htmlFor="novelty-title">Titre</Label>
                    <Input
                      id="novelty-title"
                      value={noveltyForm.title}
                      onChange={(e) => setNoveltyForm(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="novelty-summary">Résumé</Label>
                    <Textarea
                      id="novelty-summary"
                      value={noveltyForm.summary}
                      onChange={(e) => setNoveltyForm(prev => ({ ...prev, summary: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="novelty-details">Description détaillée</Label>
                    <Textarea
                      id="novelty-details"
                      value={noveltyForm.details}
                      onChange={(e) => setNoveltyForm(prev => ({ ...prev, details: e.target.value }))}
                      rows={4}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Images: {novelty.images_count}/3</p>
                      <p className="text-sm text-muted-foreground">
                        Dossier de présentation: {novelty.resource_url ? 'Disponible' : 'Non disponible'}
                      </p>
                    </div>
                  </div>

                  <Button onClick={handleUpdateNovelty} disabled={loading}>
                    {loading ? 'Mise à jour...' : 'Mettre à jour'}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucune nouveauté créée</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Leads</CardTitle>
                <div className="flex items-center gap-2">
                  {userPlan === 'free' && leads.length > 3 && (
                    <Badge variant="secondary">
                      {leads.length - 3} leads masqués (Plan gratuit)
                    </Badge>
                  )}
                  <Button onClick={handleExportLeads} size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {leads.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-muted">
                    <thead>
                      <tr className="bg-muted">
                        <th className="border border-muted p-2 text-left">Date</th>
                        <th className="border border-muted p-2 text-left">Type</th>
                        <th className="border border-muted p-2 text-left">Nom</th>
                        <th className="border border-muted p-2 text-left">Email</th>
                        <th className="border border-muted p-2 text-left">Société</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(userPlan === 'free' ? leads.slice(0, 3) : leads).map((lead) => (
                        <tr key={lead.id}>
                          <td className="border border-muted p-2">
                            {new Date(lead.created_at).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="border border-muted p-2">
                            <Badge variant="outline">
                              {lead.lead_type === 'resource_download' ? 'Téléchargement' : 'Demande RDV'}
                            </Badge>
                          </td>
                          <td className="border border-muted p-2">
                            {lead.first_name} {lead.last_name}
                          </td>
                          <td className="border border-muted p-2">{lead.email}</td>
                          <td className="border border-muted p-2">{lead.company || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucun lead enregistré</p>
                </div>
              )}

              {userPlan === 'free' && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-900 mb-2">
                    Plan gratuit: Visibilité limitée à 3 leads
                  </p>
                  <Button size="sm" variant="outline">
                    Passer au plan Pro
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Likes</p>
                    <p className="text-2xl font-bold">{stats.likes}</p>
                  </div>
                  <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                    ❤️
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ajouts au parcours</p>
                    <p className="text-2xl font-bold">{stats.saves}</p>
                  </div>
                  <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                    📋
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Téléchargements</p>
                    <p className="text-2xl font-bold">{stats.resource_downloads}</p>
                  </div>
                  <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                    📥
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Demandes RDV</p>
                    <p className="text-2xl font-bold">{stats.meeting_requests}</p>
                  </div>
                  <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    📅
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}