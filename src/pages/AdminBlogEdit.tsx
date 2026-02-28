
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useBlogArticle, useSaveBlogArticle, generateSlug, BlogArticle } from '@/hooks/useBlogArticles';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Sparkles, X, ChevronUp, ChevronDown, Loader2, Search, ExternalLink, Upload, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSectors } from '@/hooks/useSectors';
import { REGIONS } from '@/lib/regions';

interface EventRow {
  id: string;
  nom_event: string;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  url_image: string | null;
  slug: string | null;
  secteur: any;
  code_postal: string | null;
}

const MONTHS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' }, { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
];

const REGION_OPTIONS = Object.values(REGIONS)
  .filter(r => !['01', '02', '03', '04', '06'].includes(r.code)) // exclude DROM for cleaner list
  .sort((a, b) => a.name.localeCompare(b.name));

const AdminBlogEdit = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { data: existingArticle, isLoading: articleLoading } = useBlogArticle(id);
  const saveMutation = useSaveBlogArticle();
  const { toast } = useToast();

  // Form state
  const [title, setTitle] = useState('');
  const [h1Title, setH1Title] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [introText, setIntroText] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [status, setStatus] = useState<'draft' | 'ready' | 'published'>('draft');
  const [publishedAt, setPublishedAt] = useState('');
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<EventRow[]>([]);

  // Image upload
  const [imageUploading, setImageUploading] = useState(false);

  // AI modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiContext, setAiContext] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Event selector state
  const [eventSearch, setEventSearch] = useState('');
  const [eventSectorFilter, setEventSectorFilter] = useState('all');
  const [eventMonthFilter, setEventMonthFilter] = useState('all');
  const [eventRegionFilter, setEventRegionFilter] = useState('all');
  const [eventPage, setEventPage] = useState(0);
  const [availableEvents, setAvailableEvents] = useState<EventRow[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(false);

  const { data: sectors } = useSectors();
  const PAGE_SIZE = 10;

  // Load existing article
  useEffect(() => {
    if (existingArticle) {
      setTitle(existingArticle.title);
      setH1Title(existingArticle.h1_title || '');
      setSlug(existingArticle.slug);
      setSlugManual(true);
      setMetaTitle(existingArticle.meta_title || '');
      setMetaDescription(existingArticle.meta_description || '');
      setIntroText(existingArticle.intro_text || '');
      setBodyText(existingArticle.body_text || '');
      setHeaderImageUrl(existingArticle.header_image_url || '');
      setStatus(existingArticle.status);
      setPublishedAt(existingArticle.published_at ? existingArticle.published_at.slice(0, 16) : '');
      setSelectedEventIds(existingArticle.event_ids || []);
    }
  }, [existingArticle]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManual && title) {
      setSlug(generateSlug(title));
    }
  }, [title, slugManual]);

  // Load selected events details
  useEffect(() => {
    if (selectedEventIds.length === 0) {
      setSelectedEvents([]);
      return;
    }
    const loadSelectedEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('id, nom_event, date_debut, date_fin, ville, url_image, slug, secteur, code_postal')
        .in('id', selectedEventIds);
      if (data) {
        const ordered = selectedEventIds
          .map(eid => data.find(e => e.id === eid))
          .filter(Boolean) as EventRow[];
        setSelectedEvents(ordered);
      }
    };
    loadSelectedEvents();
  }, [selectedEventIds]);

  // Load available events
  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    let query = supabase
      .from('events')
      .select('id, nom_event, date_debut, date_fin, ville, url_image, slug, secteur, code_postal', { count: 'exact' })
      .eq('visible', true)
      .order('date_debut', { ascending: true })
      .range(eventPage * PAGE_SIZE, (eventPage + 1) * PAGE_SIZE - 1);

    if (eventSearch) {
      query = query.ilike('nom_event', `%${eventSearch}%`);
    }
    if (eventMonthFilter !== 'all') {
      const month = parseInt(eventMonthFilter);
      const currentYear = new Date().getFullYear();
      const startDate = `${currentYear}-${String(month).padStart(2, '0')}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? currentYear + 1 : currentYear;
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
      query = query.gte('date_debut', startDate).lt('date_debut', endDate);
    }

    const { data, count } = await query;
    
    // Client-side region filter (uses code_postal → departement → region)
    let filtered = data || [];
    if (eventRegionFilter !== 'all') {
      // We need to check which department codes belong to the selected region
      const { data: depts } = await supabase
        .from('departements')
        .select('code')
        .eq('region_code', eventRegionFilter);
      const deptCodes = new Set((depts || []).map(d => d.code));
      filtered = filtered.filter(e => {
        if (!e.code_postal) return false;
        const dept = e.code_postal.substring(0, 2);
        return deptCodes.has(dept);
      });
    }
    
    setAvailableEvents(filtered);
    setTotalEvents(eventRegionFilter !== 'all' ? filtered.length : (count || 0));
    setEventsLoading(false);
  }, [eventSearch, eventSectorFilter, eventMonthFilter, eventRegionFilter, eventPage]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImageUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `blog-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('blog-images')
        .getPublicUrl(fileName);
      
      setHeaderImageUrl(urlData.publicUrl);
      toast({ title: 'Image téléchargée avec succès' });
    } catch (err: any) {
      toast({ title: 'Erreur upload: ' + err.message, variant: 'destructive' });
    } finally {
      setImageUploading(false);
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" replace />;
  if (!isNew && articleLoading) {
    return (
      <MainLayout title="Chargement...">
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  const toggleEvent = (eventId: string) => {
    setSelectedEventIds(prev =>
      prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]
    );
  };

  const moveEvent = (index: number, direction: 'up' | 'down') => {
    const newIds = [...selectedEventIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newIds.length) return;
    [newIds[index], newIds[targetIndex]] = [newIds[targetIndex], newIds[index]];
    setSelectedEventIds(newIds);
  };

  const handleSave = async (publishNow = false) => {
    if (!title || !slug) {
      toast({ title: 'Le titre et le slug sont requis', variant: 'destructive' });
      return;
    }
    const articleData: Partial<BlogArticle> = {
      title,
      h1_title: h1Title || title,
      slug,
      meta_title: metaTitle || title,
      meta_description: metaDescription,
      intro_text: introText,
      body_text: bodyText,
      header_image_url: headerImageUrl || null,
      status: publishNow ? 'published' : status,
      event_ids: selectedEventIds,
      created_by: user?.id,
    };
    if (publishNow && !publishedAt) {
      articleData.published_at = new Date().toISOString();
    } else if (publishedAt) {
      articleData.published_at = new Date(publishedAt).toISOString();
    }
    if (id) articleData.id = id;

    try {
      const saved = await saveMutation.mutateAsync(articleData);
      toast({ title: publishNow ? 'Article publié !' : 'Article sauvegardé' });
      if (isNew) navigate(`/admin/blog/edit/${saved.id}`, { replace: true });
    } catch (e: any) {
      toast({ title: 'Erreur: ' + (e.message || 'Échec de la sauvegarde'), variant: 'destructive' });
    }
  };

  const handleAIGenerate = async () => {
    if (!aiContext.trim()) return;
    setAiLoading(true);
    try {
      const webhookUrl = import.meta.env.VITE_N8N_BLOG_WEBHOOK;
      if (!webhookUrl) {
        toast({ title: 'Webhook N8N non configuré (VITE_N8N_BLOG_WEBHOOK)', variant: 'destructive' });
        setAiLoading(false);
        return;
      }
      const eventsPayload = selectedEvents.map(e => ({
        name: e.nom_event,
        date: e.date_debut,
        city: e.ville,
        sectors: e.secteur,
      }));
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: aiContext,
          events: eventsPayload,
          article_id: id || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.meta_title) setMetaTitle(data.meta_title);
      if (data.meta_description) setMetaDescription(data.meta_description);
      if (data.h1_title) setH1Title(data.h1_title);
      if (data.intro_text) setIntroText(data.intro_text);
      if (data.body_text) setBodyText(data.body_text);
      toast({ title: 'Contenu généré avec succès !' });
      setAiModalOpen(false);
    } catch (e: any) {
      toast({ title: 'Erreur de génération: ' + e.message, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const totalPages = Math.ceil(totalEvents / PAGE_SIZE);

  const getEventUrl = (event: EventRow) => {
    if (event.slug) return `/events/${event.slug}`;
    return `/events/${event.id}`;
  };

  return (
    <MainLayout title={isNew ? 'Nouvel article' : 'Éditer l\'article'}>
      <div className="container mx-auto py-8 space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/blog')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold flex-1">
            {isNew ? 'Nouvel article' : 'Éditer l\'article'}
          </h1>
          <Button variant="outline" onClick={() => setAiModalOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" /> Générer avec l'IA
          </Button>
        </div>

        {/* Section 1: SEO */}
        <Card>
          <CardHeader><CardTitle>Informations SEO</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Meta Title <span className="text-muted-foreground text-xs">({metaTitle.length}/60)</span></Label>
              <Input
                value={metaTitle}
                onChange={e => setMetaTitle(e.target.value.slice(0, 60))}
                placeholder="Titre de la page (max 60 caractères)"
                maxLength={60}
              />
            </div>
            <div>
              <Label>Meta Description <span className="text-muted-foreground text-xs">({metaDescription.length}/160)</span></Label>
              <Textarea
                value={metaDescription}
                onChange={e => setMetaDescription(e.target.value.slice(0, 160))}
                placeholder="Description pour les moteurs de recherche (max 160 caractères)"
                maxLength={160}
                className="min-h-[60px]"
              />
            </div>
            <div>
              <Label>Slug URL</Label>
              <Input
                value={slug}
                onChange={e => { setSlug(e.target.value); setSlugManual(true); }}
                placeholder="url-de-l-article"
              />
              <p className="text-xs text-muted-foreground mt-1">
                lotexpo.com/blog/<strong>{slug || '...'}</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Contenu */}
        <Card>
          <CardHeader><CardTitle>Contenu éditorial</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Titre H1 affiché sur la page</Label>
              <Input
                value={h1Title}
                onChange={e => setH1Title(e.target.value)}
                placeholder="Titre affiché sur la page (peut différer du meta title)"
              />
            </div>
            <div>
              <Label>Titre interne (pour l'admin)</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Titre de l'article"
              />
            </div>
            <div>
              <Label>Image d'en-tête</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Taille recommandée : <strong>1200 × 630 px</strong> (ratio 1.91:1) — format JPEG, PNG ou WebP, max 5 Mo
              </p>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={imageUploading}
                  />
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-md bg-background hover:bg-muted transition-colors text-sm">
                    {imageUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {imageUploading ? 'Téléchargement...' : 'Charger une image'}
                  </div>
                </label>
                {headerImageUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setHeaderImageUrl('')}>
                    <X className="h-4 w-4 mr-1" /> Supprimer
                  </Button>
                )}
              </div>
              {headerImageUrl && (
                <img
                  src={headerImageUrl}
                  alt="Aperçu"
                  className="mt-3 rounded-lg max-h-48 object-cover w-full"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              {!headerImageUrl && (
                <div className="mt-3 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mb-2" />
                  <p className="text-sm">Aucune image sélectionnée</p>
                </div>
              )}
            </div>
            <div>
              <Label>Introduction (200-300 mots)</Label>
              <Textarea
                value={introText}
                onChange={e => setIntroText(e.target.value)}
                placeholder="Introduction de l'article..."
                className="min-h-[150px]"
              />
            </div>
            <div>
              <Label>Corps de l'article (500-800 mots)</Label>
              <Textarea
                value={bodyText}
                onChange={e => setBodyText(e.target.value)}
                placeholder="Contenu principal de l'article..."
                className="min-h-[300px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Event Selector */}
        <Card>
          <CardHeader><CardTitle>Événements liés</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Selected events */}
            {selectedEvents.length > 0 && (
              <div className="space-y-2">
                <Label>Événements sélectionnés ({selectedEvents.length})</Label>
                <div className="space-y-2">
                  {selectedEvents.map((event, idx) => (
                    <div key={event.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      {event.url_image && (
                        <img src={event.url_image} alt="" className="h-10 w-14 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{event.nom_event}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.date_debut ? new Date(event.date_debut).toLocaleDateString('fr-FR') : ''} — {event.ville}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={getEventUrl(event)} target="_blank" rel="noopener noreferrer" title="Voir l'événement">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveEvent(idx, 'up')} disabled={idx === 0}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveEvent(idx, 'down')} disabled={idx === selectedEvents.length - 1}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleEvent(event.id)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={eventSearch}
                  onChange={e => { setEventSearch(e.target.value); setEventPage(0); }}
                  placeholder="Rechercher un événement..."
                  className="pl-9"
                />
              </div>
              <Select value={eventSectorFilter} onValueChange={v => { setEventSectorFilter(v); setEventPage(0); }}>
                <SelectTrigger><SelectValue placeholder="Secteur" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les secteurs</SelectItem>
                  {sectors?.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={eventRegionFilter} onValueChange={v => { setEventRegionFilter(v); setEventPage(0); }}>
                <SelectTrigger><SelectValue placeholder="Région" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les régions</SelectItem>
                  {REGION_OPTIONS.map(r => (
                    <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={eventMonthFilter} onValueChange={v => { setEventMonthFilter(v); setEventPage(0); }}>
                <SelectTrigger><SelectValue placeholder="Mois" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les mois</SelectItem>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Event list */}
            <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
              {eventsLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : availableEvents.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Aucun événement trouvé</p>
              ) : (
                availableEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50"
                  >
                    <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                      <Checkbox
                        checked={selectedEventIds.includes(event.id)}
                        onCheckedChange={() => toggleEvent(event.id)}
                      />
                      {event.url_image && (
                        <img src={event.url_image} alt="" className="h-8 w-12 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.nom_event}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.date_debut ? new Date(event.date_debut).toLocaleDateString('fr-FR') : ''} — {event.ville}
                        </p>
                      </div>
                    </label>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
                      <a href={getEventUrl(event)} target="_blank" rel="noopener noreferrer" title="Voir l'événement">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ))
              )}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" disabled={eventPage === 0} onClick={() => setEventPage(p => p - 1)}>
                  Précédent
                </Button>
                <span className="text-sm self-center">
                  Page {eventPage + 1} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={eventPage >= totalPages - 1} onClick={() => setEventPage(p => p + 1)}>
                  Suivant
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Publication */}
        <Card>
          <CardHeader><CardTitle>Publication</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Statut</Label>
                <Select value={status} onValueChange={v => setStatus(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="ready">Prêt</SelectItem>
                    <SelectItem value="published">Publié</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {status === 'published' && (
                <div>
                  <Label>Date de publication</Label>
                  <Input
                    type="datetime-local"
                    value={publishedAt}
                    onChange={e => setPublishedAt(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sauvegarder
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publier
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Generation Modal */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Générer le contenu avec l'IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Contexte de génération</Label>
              <Textarea
                value={aiContext}
                onChange={e => setAiContext(e.target.value)}
                placeholder="Ex : Article sur les salons professionnels dans le secteur industrie à Lyon en 2025"
                className="min-h-[100px]"
              />
            </div>
            {selectedEvents.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedEvents.length} événement(s) seront envoyés comme contexte.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiModalOpen(false)}>Annuler</Button>
            <Button onClick={handleAIGenerate} disabled={aiLoading || !aiContext.trim()}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default AdminBlogEdit;
