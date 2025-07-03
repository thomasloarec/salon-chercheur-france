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
  const [sheetName1, setSheetName1] = useState('All_Evenements');
  const [spreadsheetId2, setSpreadsheetId2] = useState('');
  const [sheetName2, setSheetName2] = useState('All_Exposants');
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);

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

  const runImport = async () => {
    if (!spreadsheetId1 || !spreadsheetId2) {
      setLogs('Veuillez sélectionner les deux feuilles à importer');
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
        throw error;
      }

      setLogs(data?.message || JSON.stringify(data));
    } catch (e: any) {
      setLogs(`Erreur front : ${e.message}`);
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
          <Input value={sheetName1} onChange={e => setSheetName1(e.target.value)} />
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
          <Input value={sheetName2} onChange={e => setSheetName2(e.target.value)} />
        </div>
        <Button onClick={runImport} className="w-full" disabled={!spreadsheetId1 || !spreadsheetId2}>Importer les données</Button>
        <pre className="text-sm bg-muted p-3 rounded">{logs}</pre>
      </CardContent>
    </Card>
  );
};

export default GoogleSheetsImporter;