import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

interface ChecklistItem {
  id: string;
  item_key: string;
  label: string;
  checked: boolean;
  checked_at: string | null;
}

const helpTexts: Record<string, string> = {
  gsc_no_crawl_errors: 'Vérifier dans GSC > Pages > voir les erreurs de couverture',
  gsc_sitemap_submitted: 'GSC > Sitemaps > vérifier le statut du sitemap soumis',
  gsc_cwv_reviewed: 'GSC > Signaux Web Essentiels > vérifier les performances mobiles et desktop',
  gsc_no_manual_actions: 'GSC > Sécurité et actions manuelles > Actions manuelles',
  backlink_profile_reviewed: 'Utiliser Ahrefs Free Backlink Checker ou Ubersuggest gratuit',
  top5_ranking_pages: 'Chercher les mots-clés cibles dans Google en navigation privée',
  top10_salon_query: 'Tester "salon [secteur] 2026 France" dans Google',
  organizer_backlinks: 'Vérifier si les sites des organisateurs de salons lient vers Lotexpo',
  google_business_profile: 'https://business.google.com/ > créer ou vérifier la fiche',
  no_toxic_backlinks: 'GSC > Liens > vérifier les liens entrants suspects',
};

export default function ManualChecklistSection() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    const { data } = await db.from('seo_checklist').select('*').order('created_at');
    if (data) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const toggleItem = async (item: ChecklistItem) => {
    const newChecked = !item.checked;
    await db.from('seo_checklist').update({
      checked: newChecked,
      checked_at: newChecked ? new Date().toISOString() : null,
    }).eq('id', item.id);

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: newChecked, checked_at: newChecked ? new Date().toISOString() : null } : i));
  };

  const checkedCount = items.filter(i => i.checked).length;
  const pct = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  if (loading) return <p className="text-center py-8 text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">7. Checklist Manuelle</h2>
        <span className="text-sm font-medium text-muted-foreground">{checkedCount}/{items.length} vérifications</span>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Progress value={pct} className="flex-1" />
            <span className="font-bold text-sm">{pct}%</span>
          </div>
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="flex items-start gap-3 group">
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={() => toggleItem(item)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
                    {item.label}
                  </p>
                  {helpTexts[item.item_key] && (
                    <p className="text-xs text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      💡 {helpTexts[item.item_key]}
                    </p>
                  )}
                  {item.checked && item.checked_at && (
                    <p className="text-xs text-green-600 mt-0.5">
                      ✓ {new Date(item.checked_at).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
