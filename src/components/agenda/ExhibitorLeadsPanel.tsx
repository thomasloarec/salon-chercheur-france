import React, { useState } from 'react';
import { useExhibitorAdmin } from '@/hooks/useExhibitorAdmin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Calendar, Heart, Users, FileText, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ExhibitorLeadsPanelProps {
  exhibitors: Array<{
    id: string;
    name: string;
    logo_url?: string;
  }>;
}

export default function ExhibitorLeadsPanel({ exhibitors }: ExhibitorLeadsPanelProps) {
  const [selectedExhibitorId, setSelectedExhibitorId] = useState<string>(exhibitors[0]?.id || '');
  const { data: exhibitorData, isLoading } = useExhibitorAdmin(selectedExhibitorId);

  const exportToCsv = (leads: any[], type: 'brochure' | 'meeting') => {
    const filteredLeads = leads.filter(lead => 
      type === 'brochure' ? lead.lead_type === 'brochure_download' : lead.lead_type === 'meeting_request'
    );

    const headers = ['Nom', 'Prénom', 'Email', 'Société', 'Rôle', 'Téléphone', 'Nouveauté', 'Date'];
    const csvContent = [
      headers.join(','),
      ...filteredLeads.map(lead => [
        lead.last_name || '',
        lead.first_name || '',
        lead.email || '',
        lead.company || '',
        lead.role || '',
        lead.phone || '',
        lead.novelties.title || '',
        format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${type === 'brochure' ? 'telechargements' : 'rendezvous'}_${exhibitorData?.exhibitor.name || 'exposant'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (exhibitors.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg">
        <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">
          Aucun exposant associé
        </h3>
        <p className="text-gray-500">
          Vous devez être administrateur d'un exposant pour accéder à cette section.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Exhibitor Selector */}
      <div className="flex items-center gap-4">
        <label className="font-medium">Exposant :</label>
        <Select value={selectedExhibitorId} onValueChange={setSelectedExhibitorId}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {exhibitors.map((exhibitor) => (
              <SelectItem key={exhibitor.id} value={exhibitor.id}>
                <div className="flex items-center gap-2">
                  {exhibitor.logo_url && (
                    <img 
                      src={exhibitor.logo_url} 
                      alt="" 
                      className="w-4 h-4 rounded object-cover"
                    />
                  )}
                  {exhibitor.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : exhibitorData ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Likes totaux</span>
                </div>
                <p className="text-2xl font-bold mt-1">{exhibitorData.stats.total_likes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Téléchargements</span>
                </div>
                <p className="text-2xl font-bold mt-1">{exhibitorData.stats.total_downloads}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Demandes RDV</span>
                </div>
                <p className="text-2xl font-bold mt-1">{exhibitorData.stats.total_meetings}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Nouveautés</span>
                </div>
                <p className="text-2xl font-bold mt-1">{exhibitorData.stats.novelties_count}</p>
              </CardContent>
            </Card>
          </div>

          {/* Brochure Downloads */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-blue-500" />
                  Téléchargements de brochures
                </CardTitle>
                <Button 
                  onClick={() => exportToCsv(exhibitorData.leads, 'brochure')}
                  variant="outline" 
                  size="sm"
                  disabled={exhibitorData.leads.filter(l => l.lead_type === 'brochure_download').length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {exhibitorData.leads.filter(lead => lead.lead_type === 'brochure_download').length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Société</TableHead>
                      <TableHead>Nouveauté</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exhibitorData.leads
                      .filter(lead => lead.lead_type === 'brochure_download')
                      .map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                              <p className="text-sm text-muted-foreground">{lead.email}</p>
                              {lead.phone && (
                                <p className="text-sm text-muted-foreground">{lead.phone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              {lead.company && <p className="font-medium">{lead.company}</p>}
                              {lead.role && <p className="text-sm text-muted-foreground">{lead.role}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{lead.novelties.title}</p>
                          </TableCell>
                          <TableCell>
                            {format(new Date(lead.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun téléchargement de brochure pour le moment
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meeting Requests */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-green-500" />
                  Demandes de rendez-vous
                </CardTitle>
                <Button 
                  onClick={() => exportToCsv(exhibitorData.leads, 'meeting')}
                  variant="outline" 
                  size="sm"
                  disabled={exhibitorData.leads.filter(l => l.lead_type === 'meeting_request').length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {exhibitorData.leads.filter(lead => lead.lead_type === 'meeting_request').length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Société</TableHead>
                      <TableHead>Nouveauté</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exhibitorData.leads
                      .filter(lead => lead.lead_type === 'meeting_request')
                      .map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                              <p className="text-sm text-muted-foreground">{lead.email}</p>
                              {lead.phone && (
                                <p className="text-sm text-muted-foreground">{lead.phone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              {lead.company && <p className="font-medium">{lead.company}</p>}
                              {lead.role && <p className="text-sm text-muted-foreground">{lead.role}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{lead.novelties.title}</p>
                          </TableCell>
                          <TableCell>
                            {lead.notes ? (
                              <p className="text-sm">{lead.notes}</p>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(lead.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune demande de rendez-vous pour le moment
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg">
          <Mail className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            Impossible de charger les données
          </h3>
          <p className="text-gray-500">
            Vérifiez que vous avez accès à cet exposant.
          </p>
        </div>
      )}
    </div>
  );
}