import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Save, Trash2 } from 'lucide-react';

const db = supabase as any;

interface Keyword {
  id: string;
  keyword: string;
  target_url: string | null;
  current_position: number | null;
  previous_position: number | null;
  serp_features: string | null;
  notes: string | null;
}

function PositionBadge({ pos }: { pos: number | null }) {
  if (!pos) return <span className="text-gray-400">⚪ N/A</span>;
  if (pos <= 3) return <span className="text-green-600 font-bold">🟢 {pos}</span>;
  if (pos <= 10) return <span className="text-yellow-600 font-bold">🟡 {pos}</span>;
  if (pos <= 30) return <span className="text-orange-600 font-bold">🟠 {pos}</span>;
  return <span className="text-red-600 font-bold">🔴 {pos}</span>;
}

function TrendArrow({ current, previous }: { current: number | null; previous: number | null }) {
  if (!current || !previous) return <span className="text-gray-400">—</span>;
  if (current < previous) return <span className="text-green-600">↑ +{previous - current}</span>;
  if (current > previous) return <span className="text-red-600">↓ -{current - previous}</span>;
  return <span className="text-gray-500">→</span>;
}

export default function KeywordTrackingSection() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, Partial<Keyword>>>({});
  const [newKeyword, setNewKeyword] = useState('');

  const loadKeywords = useCallback(async () => {
    const { data } = await db.from('seo_keywords').select('*').order('created_at');
    if (data) setKeywords(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadKeywords(); }, [loadKeywords]);

  const addKeyword = async () => {
    if (!newKeyword.trim()) return;
    await db.from('seo_keywords').insert({ keyword: newKeyword.trim(), target_url: '/' });
    setNewKeyword('');
    loadKeywords();
  };

  const updateField = (id: string, field: string, value: any) => {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveKeyword = async (id: string) => {
    const changes = editing[id];
    if (!changes) return;
    await db.from('seo_keywords').update({
      ...changes,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setEditing(prev => { const next = { ...prev }; delete next[id]; return next; });
    loadKeywords();
  };

  const deleteKeyword = async (id: string) => {
    await db.from('seo_keywords').delete().eq('id', id);
    loadKeywords();
  };

  if (loading) return <p className="text-center py-8 text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">8. Suivi de Mots-Clés</h2>
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <Input
          placeholder="Nouveau mot-clé..."
          value={newKeyword}
          onChange={e => setNewKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addKeyword()}
          className="max-w-sm"
        />
        <Button onClick={addKeyword} size="sm"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mot-clé</TableHead>
                <TableHead>Page cible</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Tendance</TableHead>
                <TableHead>SERP Features</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords.map(kw => {
                const edit = editing[kw.id] || {};
                const isEditing = !!editing[kw.id];
                return (
                  <TableRow key={kw.id}>
                    <TableCell className="font-medium text-sm">{kw.keyword}</TableCell>
                    <TableCell>
                      <Input
                        className="h-7 text-xs w-32"
                        defaultValue={kw.target_url || ''}
                        onChange={e => updateField(kw.id, 'target_url', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          className="h-7 text-xs w-16"
                          defaultValue={kw.current_position || ''}
                          onChange={e => updateField(kw.id, 'current_position', e.target.value ? parseInt(e.target.value) : null)}
                        />
                        <PositionBadge pos={edit.current_position !== undefined ? edit.current_position : kw.current_position} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <TrendArrow
                        current={edit.current_position !== undefined ? edit.current_position : kw.current_position}
                        previous={kw.previous_position}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-7 text-xs w-28"
                        defaultValue={kw.serp_features || ''}
                        placeholder="PAA, snippet..."
                        onChange={e => updateField(kw.id, 'serp_features', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-7 text-xs w-32"
                        defaultValue={kw.notes || ''}
                        onChange={e => updateField(kw.id, 'notes', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isEditing && (
                          <Button size="sm" variant="ghost" onClick={() => saveKeyword(kw.id)}>
                            <Save className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteKeyword(kw.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
