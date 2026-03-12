
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useBlogArticles, useDeleteBlogArticle } from '@/hooks/useBlogArticles';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, ArrowLeft, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  ready: 'Prêt',
  scheduled: 'Planifié',
  published: 'Publié',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  ready: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  published: 'bg-green-100 text-green-800',
};

const AdminBlog = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: articles, isLoading } = useBlogArticles(statusFilter);
  const deleteMutation = useDeleteBlogArticle();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Article supprimé' });
    } catch {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  return (
    <MainLayout title="Blog - Administration">
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Gestion du Blog</h1>
            <p className="text-muted-foreground">Créez et gérez vos articles SEO</p>
          </div>
          <Button onClick={() => navigate('/admin/blog/new')}>
            <Plus className="h-4 w-4 mr-2" /> Nouvel article
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Articles</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="ready">Prêt</SelectItem>
                <SelectItem value="published">Publié</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : !articles?.length ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun article trouvé. Créez votre premier article !
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Publication</TableHead>
                    <TableHead>Événements</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {article.title}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[article.status]}>
                          {statusLabels[article.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {article.published_at
                          ? new Date(article.published_at).toLocaleDateString('fr-FR')
                          : '—'}
                      </TableCell>
                      <TableCell>{article.event_ids?.length || 0}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {(article.status === 'published' || article.status === 'ready') && article.slug && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/blog/${article.slug}`} target="_blank" rel="noopener noreferrer" title="Voir l'article">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/blog/edit/${article.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cet article ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. L'article « {article.title} » sera définitivement supprimé.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(article.id)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default AdminBlog;
