import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface GoogleSheet {
  id: string;
  name: string;
}

const GoogleSheetsImporter = () => {
  const [sheets, setSheets] = useState<GoogleSheet[]>([]);
  const [spreadsheetId1, setSpreadsheetId1] = useState('');
  const [sheetName1, setSheetName1] = useState('');
  const [spreadsheetId2, setSpreadsheetId2] = useState('');
  const [sheetName2, setSheetName2] = useState('');
  const [worksheets1, setWorksheets1] = useState<string[]>([]);
  const [worksheets2, setWorksheets2] = useState<string[]>([]);
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

  useEffect(() => {
    const loadSheets = async () => {
      try {
        const { data, error } = await supabase.functions.invoke<{ files: GoogleSheet[] }>('list-google-sheets');
        
        if (error) {
          throw error;
        }

        setSheets(data?.files || []);
      } catch (e: any) {
        console.error('Erreur loading sheets:', e);
        setLogs(`Erreur lors du chargement des feuilles : ${e.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadSheets();
  }, []);

  useEffect(() => {
    if (spreadsheetId1) {
      loadWorksheets(spreadsheetId1).then(setWorksheets1);
    } else {
      setWorksheets1([]);
      setSheetName1('');
    }
  }, [spreadsheetId1]);

  useEffect(() => {
    if (spreadsheetId2) {
      loadWorksheets(spreadsheetId2).then(setWorksheets2);
    } else {
      setWorksheets2([]);
      setSheetName2('');
    }
  }, [spreadsheetId2]);

  const runImport = async () => {
    if (!spreadsheetId1 || !spreadsheetId2 || !sheetName1 || !sheetName2) {
      setLogs('Veuillez sélectionner les deux feuilles et leurs onglets');
      return;
    }

    setLogs('Import en cours…');
    try {
      const { data, error } = await supabase.functions.invoke('import-google-sheets', {
        body: { 
          spreadsheetId1, 
          sheetName1, 
          spreadsheetId2, 
          sheetName2 
        }
      });

      if (error) {
        // Afficher l'erreur complète de l'edge function
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
          <Select value={spreadsheetId1} onValueChange={setSpreadsheetId1}>
            <SelectTrigger aria-label="Choisir une feuille">
              <SelectValue placeholder="-- Sélectionnez une feuille --" />
            </SelectTrigger>
            <SelectContent>
              {sheets.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
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
              {worksheets1.map(title => (
                <SelectItem key={title} value={title}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Google Sheet exposants</Label>
          <Select value={spreadsheetId2} onValueChange={setSpreadsheetId2}>
            <SelectTrigger aria-label="Choisir une feuille exposants">
              <SelectValue placeholder="-- Sélectionnez une feuille --" />
            </SelectTrigger>
            <SelectContent>
              {sheets.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Nom de l'onglet exposants</Label>
          <Select value={sheetName2} onValueChange={setSheetName2}>
            <SelectTrigger>
              <SelectValue placeholder="-- Sélectionnez un onglet --" />
            </SelectTrigger>
            <SelectContent>
              {worksheets2.map(title => (
                <SelectItem key={title} value={title}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={runImport} className="w-full" disabled={!spreadsheetId1 || !spreadsheetId2 || !sheetName1 || !sheetName2}>Importer les données</Button>
        <pre className="text-sm bg-muted p-3 rounded">{logs}</pre>
      </CardContent>
    </Card>
  );
};

export default GoogleSheetsImporter;