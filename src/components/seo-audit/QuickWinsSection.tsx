import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Plus, CheckCircle } from 'lucide-react';

const db = supabase as any;

interface QuickWin {
  id: string;
  title: string;
  category: string;
  impact: string;
  effort: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

const CATEGORIES = ['Technical', 'On-page', 'Content', 'Backlinks', 'Schema'];
const IMPACTS = ['high', 'medium', 'low'];
const EFFORTS = ['low', 'medium', 'high'];
const STATUSES = ['todo', 'in_progress', 'done'];

const statusLabels: Record<string, string> = { todo: 'À faire', in_progress: 'En cours', done: 'Fait' };
const statusColors: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
};
const impactColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-600',
};

export default function QuickWinsSection() {
  const [items, setItems] = useState<QuickWin[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Technical');
  const [newImpact, setNewImpact] = useState('medium');

  const loadItems = useCallback(async () => {
    const { data } = await db.from('seo_quick_wins').select('*').order('created_at');
    if (data) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const addItem = async () => {
    if (!newTitle.trim()) return;
    await db.from('seo_quick_wins').insert({
      title: newTitle.trim(),
      category: newCategory,
      impact: newImpact,
    });
    setNewTitle('');
    loadItems();
  };

  const updateStatus = async (id: string, status: string) => {
    await db.from('seo_quick_wins').update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    }).eq('id', id);
    loadItems();
  };

  const deleteItem = async (id: string) => {
    await db.from('seo_quick_wins').delete().eq('id', id);
    loadItems();
  };

  const doneCount = items.filter(i => i.status === 'done').length;
  const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  if (loading) return <p className="text-center py-8 text-muted-foreground">Chargement...</p>;

  const grouped = {
    todo: items.filter(i => i.status === 'todo'),
    in_progress: items.filter(i => i.status === 'in_progress'),
    done: items.filter(i => i.status === 'done'),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">9. Quick Wins</h2>
        <span className="text-sm text-muted-foreground">{pct}% résolu</span>
      </div>

      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <Progress value={pct} className="flex-1 max-w-xs" />
          <span className="text-sm font-medium">{doneCount}/{items.length}</span>
        </div>
      )}

      {/* Add new */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Nouvelle tâche SEO..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          className="max-w-sm"
        />
        <select className="border rounded px-2 py-1 text-sm" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="border rounded px-2 py-1 text-sm" value={newImpact} onChange={e => setNewImpact(e.target.value)}>
          {IMPACTS.map(i => <option key={i} value={i}>Impact: {i}</option>)}
        </select>
        <Button onClick={addItem} size="sm"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </div>

      {/* Kanban-style columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['todo', 'in_progress', 'done'] as const).map(status => (
          <div key={status}>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
              <span className="text-muted-foreground">({grouped[status].length})</span>
            </h3>
            <div className="space-y-2">
              {grouped[status].map(item => (
                <Card key={item.id} className="p-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      <Badge variant="outline" className={`text-xs ${impactColors[item.impact]}`}>
                        {item.impact}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {STATUSES.filter(s => s !== item.status).map(s => (
                        <Button key={s} size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => updateStatus(item.id, s)}>
                          {s === 'done' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {statusLabels[s]}
                        </Button>
                      ))}
                      <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-red-500" onClick={() => deleteItem(item.id)}>
                        ×
                      </Button>
                    </div>
                    {item.completed_at && (
                      <p className="text-xs text-green-600">
                        ✓ {new Date(item.completed_at).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
              {grouped[status].length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun élément</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
