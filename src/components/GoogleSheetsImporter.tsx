
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

type SheetFile = { id: string; name: string };
type SheetTitles = { titles: string[] };

const GoogleSheetsImporter = () => {
  const [files, setFiles] = useState<SheetFile[]>([]);
  const [eventSheetId, setEventSheetId] = useState<string>('');
  const [exposantSheetId, setExposantSheetId] = useState<string>('');
  const [tabsEvent, setTabsEvent] = useState<string[]>([]);
  const [tabsExpo, setTabsExpo] = useState<string[]>([]);
  const [sheetName1, setSheetName1] = useState<string>('');
  const [sheetName2, setSheetName2] = useState<string>('');
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadWorksheets = async (spreadsheetId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke<{ titles: string[] }>('list-worksheets', {
        body: { spreadsheetId }
      });
      
      if (error) {
        throw error;
      }

      return data?.titles || [];
    } catch (e: any) {
      console.error('Erreur loading worksheets:', e);
      setLogs(`Erreur lors du chargement des onglets : ${e.message}`);
      return [];
    }
  };

  // Charger la liste des fichiers au montage
  useEffect(() => {
    supabase.functions
      .invoke<{ files: SheetFile[] }>('list-google-sheets')
      .then(({ data, error }) => {
        if (error) throw error;
        setFiles(data?.files || []);
      })
      .catch(e => setLogs(`Erreur fichiers : ${e.message}`))
      .finally(() => setLoading(false));
  }, []);

  // Charger les onglets pour chaque sélection
  useEffect(() => {
    if (!eventSheetId) return;
    supabase.functions
      .invoke<SheetTitles>('list-worksheets', { body: { spreadsheetId: eventSheetId } })
      .then(({ data, error }) => {
        if (error) throw error;
        setTabsEvent(data?.titles || []);
        setSheetName1(data?.titles?.[0] || '');
      })
      .catch(e => setLogs(`Erreur onglets événements : ${e.message}`));
  }, [eventSheetId]);

  useEffect(() => {
    if (!exposantSheetId) return;
    supabase.functions
      .invoke<SheetTitles>('list-worksheets', { body: { spreadsheetId: exposantSheetId } })
      .then(({ data, error }) => {
        if (error) throw error;
        setTabsExpo(data?.titles || []);
        setSheetName2(data?.titles?.[0] || 'All_Exposants');
      })
      .catch(e => setLogs(`Erreur onglets exposants : ${e.message}`));
  }, [exposantSheetId]);

  const runImport = async () => {
    if (!eventSheetId && !exposantSheetId) {
      setLogs('Veuillez sélectionner au moins un fichier');
      return;
    }

    setLogs('Import en cours…');
    try {
      const { data, error } = await supabase.functions.invoke('import-google-sheets', {
        body: { 
          spreadsheetId1: eventSheetId, 
          sheetName1, 
          spreadsheetId2: exposantSheetId, 
          sheetName2 
        }
      });

      if (error) {
        const errorMessage = error.message || 'Erreur inconnue';
        const errorDetails = error.details || error.hint || '';
        setLogs(`❌ Erreur d'import: ${errorMessage}${errorDetails ? '\nDétails: ' + errorDetails : ''}`);
        return;
      }

      setLogs(data?.message || '✅ Import terminé avec succès');
    } catch (e: any) {
      setLogs(`❌ Erreur de communication: ${e.message}`);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Import Google Sheets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Chargement des Google Sheets...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Import Google Sheets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Google Sheet événements</Label>
          <Select value={eventSheetId} onValueChange={setEventSheetId}>
            <SelectTrigger aria-label="Choisir une feuille">
              <SelectValue placeholder="-- Sélectionnez une feuille --" />
            </SelectTrigger>
            <SelectContent>
              {files.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Nom de l'onglet événements</Label>
          <Select value={sheetName1} onValueChange={setSheetName1}>
            <SelectTrigger>
              <SelectValue placeholder="-- Sélectionnez un onglet --" />
            </SelectTrigger>
            <SelectContent>
              {tabsEvent.map(title => (
                <SelectItem key={title} value={title}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Google Sheet exposants</Label>
          <Select value={exposantSheetId} onValueChange={setExposantSheetId}>
            <SelectTrigger aria-label="Choisir une feuille exposants">
              <SelectValue placeholder="-- Sélectionnez une feuille --" />
            </SelectTrigger>
            <SelectContent>
              {files.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Nom de l'onglet exposants</Label>
          <Select value={sheetName2} onValueChange={setSheetName2}>
            <SelectTrigger>
              <SelectValue placeholder="All_Exposants" />
            </SelectTrigger>
            <SelectContent>
              {tabsExpo.map(title => (
                <SelectItem key={title} value={title}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={runImport} className="w-full" disabled={!eventSheetId && !exposantSheetId}>
          Importer événements et/ou exposants
        </Button>
        <pre className="text-sm bg-muted p-3 rounded">{logs}</pre>
      </CardContent>
    </Card>
  );
};

export default GoogleSheetsImporter;
