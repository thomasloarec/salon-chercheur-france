
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useBlogArticle, useSaveBlogArticle, generateSlug, BlogArticle, BlogEventLink, BlogFaqItem } from '@/hooks/useBlogArticles';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Sparkles, X, ChevronUp, ChevronDown, Loader2, Search, ExternalLink, Upload, ImageIcon, Plus, Trash2, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSectors } from '@/hooks/useSectors';
import { REGIONS } from '@/lib/regions';

interface EventRow {
  id: string;
  id_event: string;
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
  .filter(r => !['01', '02', '03', '04', '06'].includes(r.code))
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
  const [whyVisitText, setWhyVisitText] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [status, setStatus] = useState<'draft' | 'ready' | 'scheduled' | 'published'>('draft');
  const [publishedAt, setPublishedAt] = useState('');
  const [selectedEventLinks, setSelectedEventLinks] = useState<BlogEventLink[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<EventRow[]>([]);
  const [faqItems, setFaqItems] = useState<BlogFaqItem[]>([]);

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

  const selectedEventIds = selectedEventLinks.map(l => l.event_id);

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
      setWhyVisitText(existingArticle.why_visit_text || '');
      setHeaderImageUrl(existingArticle.header_image_url || '');
      setStatus(existingArticle.status);
      setPublishedAt(existingArticle.published_at ? existingArticle.published_at.slice(0, 16) : '');
      setSelectedEventLinks(existingArticle.event_ids || []);
      setFaqItems(existingArticle.faq || []);
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
        .select('id, id_event, nom_event, date_debut, date_fin, ville, url_image, slug, secteur, code_postal')
        .in('id', selectedEventIds);
      if (data) {
        const ordered = selectedEventIds
          .map(eid => data.find(e => e.id === eid))
          .filter(Boolean) as EventRow[];
        setSelectedEvents(ordered);
      }
    };
    loadSelectedEvents();
  }, [selectedEventIds.join(',')]);

  // Load available events
  const loadEvents = useCallback(async () => {
    setEventsLoading(true);

    let regionDeptCodes: Set<string> | null = null;
    if (eventRegionFilter !== 'all') {
      const { data: depts } = await supabase
        .from('departements')
        .select('code')
        .eq('region_code', eventRegionFilter);
      regionDeptCodes = new Set((depts || []).map(d => d.code));
    }

    // Récupérer le nom du secteur sélectionné pour filtrer via JSONB
    let sectorName: string | null = null;
    if (eventSectorFilter !== 'all' && sectors) {
      const found = sectors.find(s => s.id === eventSectorFilter);
      sectorName = found?.name || null;
    }

    const needsClientFilter = regionDeptCodes !== null || sectorName !== null;
    const fetchLimit = needsClientFilter ? 1000 : PAGE_SIZE;
    const fetchOffset = needsClientFilter ? 0 : eventPage * PAGE_SIZE;

    let query = supabase
      .from('events')
      .select('id, id_event, nom_event, date_debut, date_fin, ville, url_image, slug, secteur, code_postal', { count: 'exact' })
      .eq('visible', true)
      .order('date_debut', { ascending: true })
      .range(fetchOffset, fetchOffset + fetchLimit - 1);

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
    let filtered = data || [];

    if (regionDeptCodes) {
      filtered = filtered.filter(e => {
        if (!e.code_postal) return false;
        const dept = e.code_postal.substring(0, 2);
        return regionDeptCodes!.has(dept);
      });
    }

    if (sectorEventIds) {
      filtered = filtered.filter(e => sectorEventIds!.has(e.id_event));
    }

    if (needsClientFilter) {
      const totalFiltered = filtered.length;
      const start = eventPage * PAGE_SIZE;
      const paged = filtered.slice(start, start + PAGE_SIZE);
      setAvailableEvents(paged);
      setTotalEvents(totalFiltered);
    } else {
      setAvailableEvents(filtered);
      setTotalEvents(count || 0);
    }

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
      const { data: urlData } = supabase.storage.from('blog-images').getPublicUrl(fileName);
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
    setSelectedEventLinks(prev => {
      const exists = prev.find(l => l.event_id === eventId);
      if (exists) return prev.filter(l => l.event_id !== eventId);
      return [...prev, { event_id: eventId, description: '' }];
    });
  };

  const updateEventDescription = (eventId: string, description: string) => {
    setSelectedEventLinks(prev =>
      prev.map(l => l.event_id === eventId ? { ...l, description } : l)
    );
  };

  const moveEvent = (index: number, direction: 'up' | 'down') => {
    const newLinks = [...selectedEventLinks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newLinks.length) return;
    [newLinks[index], newLinks[targetIndex]] = [newLinks[targetIndex], newLinks[index]];
    setSelectedEventLinks(newLinks);
  };

  // FAQ handlers
  const addFaqItem = () => {
    setFaqItems(prev => [...prev, { question: '', answer: '' }]);
  };
  const updateFaqItem = (index: number, field: 'question' | 'answer', value: string) => {
    setFaqItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };
  const removeFaqItem = (index: number) => {
    setFaqItems(prev => prev.filter((_, i) => i !== index));
  };
  const moveFaqItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...faqItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setFaqItems(newItems);
  };

  const handleSave = async (publishNow = false) => {
    if (!title || !slug) {
      toast({ title: 'Le titre et le slug sont requis', variant: 'destructive' });
      return;
    }
    const articleData: any = {
      title,
      h1_title: h1Title || title,
      slug,
      meta_title: metaTitle || title,
      meta_description: metaDescription,
      intro_text: introText,
      body_text: null, // no longer used
      why_visit_text: whyVisitText || null,
      header_image_url: headerImageUrl || null,
      status: publishNow ? 'published' : status,
      event_ids: selectedEventLinks,
      faq: faqItems.filter(f => f.question.trim() || f.answer.trim()),
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
        id: e.id,
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
          article_id: id || null,
          events: eventsPayload,
          fields_to_generate: ['meta_title', 'meta_description', 'h1_title', 'intro_text', 'why_visit_text', 'event_descriptions', 'faq'],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.meta_title) setMetaTitle(data.meta_title);
      if (data.meta_description) setMetaDescription(data.meta_description);
      if (data.h1_title) setH1Title(data.h1_title);
      if (data.intro_text) setIntroText(data.intro_text);
      if (data.why_visit_text) setWhyVisitText(data.why_visit_text);
      if (Array.isArray(data.event_descriptions)) {
        setSelectedEventLinks(prev =>
          prev.map(link => {
            const match = data.event_descriptions.find((ed: any) => ed.event_id === link.event_id);
            return match ? { ...link, description: match.description } : link;
          })
        );
      }
      if (Array.isArray(data.faq)) {
        setFaqItems(data.faq);
      }
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
              <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value.slice(0, 60))} placeholder="Titre de la page (max 60 caractères)" maxLength={60} />
            </div>
            <div>
              <Label>Meta Description <span className="text-muted-foreground text-xs">({metaDescription.length}/160)</span></Label>
              <Textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value.slice(0, 160))} placeholder="Description pour les moteurs de recherche (max 160 caractères)" maxLength={160} className="min-h-[60px]" />
            </div>
            <div>
              <Label>Slug URL</Label>
              <Input value={slug} onChange={e => { setSlug(e.target.value); setSlugManual(true); }} placeholder="url-de-l-article" />
              <p className="text-xs text-muted-foreground mt-1">lotexpo.com/blog/<strong>{slug || '...'}</strong></p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Contenu éditorial */}
        <Card>
          <CardHeader><CardTitle>Contenu éditorial</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Titre H1 affiché sur la page</Label>
              <Input value={h1Title} onChange={e => setH1Title(e.target.value)} placeholder="Titre affiché sur la page (peut différer du meta title)" />
            </div>
            <div>
              <Label>Titre interne (pour l'admin)</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de l'article" />
            </div>
            <div>
              <Label>Image d'en-tête</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Taille recommandée : <strong>1200 × 630 px</strong> (ratio 1.91:1) — format JPEG, PNG ou WebP, max 5 Mo
              </p>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} disabled={imageUploading} />
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-md bg-background hover:bg-muted transition-colors text-sm">
                    {imageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
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
                <img src={headerImageUrl} alt="Aperçu" className="mt-3 rounded-lg max-h-48 object-cover w-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              {!headerImageUrl && (
                <div className="mt-3 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mb-2" />
                  <p className="text-sm">Aucune image sélectionnée</p>
                </div>
              )}
            </div>
            <div>
              <Label>Accroche d'introduction <span className="text-muted-foreground text-xs">({introText.length}/600)</span></Label>
              <Textarea
                value={introText}
                onChange={e => setIntroText(e.target.value.slice(0, 600))}
                placeholder="Présentez en 3-4 lignes le sujet de cet article et ce que le lecteur va trouver ici."
                className="min-h-[100px]"
                maxLength={600}
              />
            </div>
            <div>
              <Label>Pourquoi visiter ces salons ?</Label>
              <Textarea
                value={whyVisitText}
                onChange={e => setWhyVisitText(e.target.value)}
                placeholder="Décrivez l'intérêt concret de ces salons : types d'exposants, public cible, opportunités business, tendances du secteur..."
                className="min-h-[200px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Événements liés */}
        <Card>
          <CardHeader><CardTitle>Événements liés</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Selected events with contextual text */}
            {selectedEvents.length > 0 && (
              <div className="space-y-3">
                <Label>Événements sélectionnés ({selectedEvents.length})</Label>
                <div className="space-y-3">
                  {selectedEvents.map((event, idx) => {
                    const link = selectedEventLinks.find(l => l.event_id === event.id);
                    return (
                      <div key={event.id} className="p-3 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center gap-3">
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
                        <Textarea
                          value={link?.description || ''}
                          onChange={e => updateEventDescription(event.id, e.target.value)}
                          placeholder="2-3 phrases décrivant ce salon spécifiquement dans le contexte de cet article (exposants typiques, intérêt pour le secteur, particularité de l'édition...)"
                          className="min-h-[60px] text-sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={eventSearch} onChange={e => { setEventSearch(e.target.value); setEventPage(0); }} placeholder="Rechercher un événement..." className="pl-9" />
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
                  <div key={event.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                    <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                      <Checkbox checked={selectedEventIds.includes(event.id)} onCheckedChange={() => toggleEvent(event.id)} />
                      {event.url_image && <img src={event.url_image} alt="" className="h-8 w-12 object-cover rounded" />}
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
                <Button variant="outline" size="sm" disabled={eventPage === 0} onClick={() => setEventPage(p => p - 1)}>Précédent</Button>
                <span className="text-sm self-center">Page {eventPage + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={eventPage >= totalPages - 1} onClick={() => setEventPage(p => p + 1)}>Suivant</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>FAQ — Questions fréquentes</CardTitle>
            <p className="text-sm text-muted-foreground">
              La FAQ améliore significativement le référencement Google. Ajoutez 3 à 5 questions que se posent vos visiteurs sur ce sujet.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqItems.map((item, idx) => (
              <div key={idx} className="p-4 border rounded-lg space-y-3 relative">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1 pt-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveFaqItem(idx, 'up')} disabled={idx === 0}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveFaqItem(idx, 'down')} disabled={idx === faqItems.length - 1}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={item.question}
                      onChange={e => updateFaqItem(idx, 'question', e.target.value)}
                      placeholder="Question"
                      className="font-medium"
                    />
                    <Textarea
                      value={item.answer}
                      onChange={e => updateFaqItem(idx, 'answer', e.target.value)}
                      placeholder="Réponse"
                      className="min-h-[80px]"
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeFaqItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addFaqItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Ajouter une question
            </Button>
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
                    <SelectItem value="scheduled">Planifié</SelectItem>
                    <SelectItem value="published">Publié</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {status === 'published' && (
                <div>
                  <Label>Date de publication</Label>
                  <Input type="datetime-local" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} />
                </div>
              )}
            </div>
            {(status === 'published' || status === 'ready') && slug && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <a href={`/blog/${slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  Voir l'article : /blog/{slug}
                </a>
              </div>
            )}
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
              <Textarea value={aiContext} onChange={e => setAiContext(e.target.value)} placeholder="Ex : Article sur les salons professionnels dans le secteur industrie à Lyon en 2025" className="min-h-[100px]" />
            </div>
            {selectedEvents.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedEvents.length} événement(s) seront envoyés comme contexte.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Champs générés : meta title, meta description, H1, accroche, texte "pourquoi visiter", descriptions d'événements, FAQ
            </p>
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
