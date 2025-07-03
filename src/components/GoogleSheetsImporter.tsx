import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

const GoogleSheetsImporter = () => {
  const [spreadsheetId1, setSpreadsheetId1] = useState('');
  const [sheetName1, setSheetName1] = useState('All_Evenements');
  const [spreadsheetId2, setSpreadsheetId2] = useState('');
  const [sheetName2, setSheetName2] = useState('E46');
  const [logs, setLogs] = useState<string>('');

  const runImport = async () => {
    setLogs('Import en cours…');
    try {
      const { data, error } = await supabase.functions.invoke('import-google-sheets', {
        body: { spreadsheetId1, sheetName1, spreadsheetId2, sheetName2 }
      });

      if (error) {
        throw error;
      }

      setLogs(data?.message || JSON.stringify(data));
    } catch (e: any) {
      setLogs(`Erreur front : ${e.message}`);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Import Google Sheets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Spreadsheet ID événements</Label>
          <Input value={spreadsheetId1} onChange={e => setSpreadsheetId1(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Nom de l'onglet événements</Label>
          <Input value={sheetName1} onChange={e => setSheetName1(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Spreadsheet ID exposants</Label>
          <Input value={spreadsheetId2} onChange={e => setSpreadsheetId2(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Nom de l'onglet exposants</Label>
          <Input value={sheetName2} onChange={e => setSheetName2(e.target.value)} />
        </div>
        <Button onClick={runImport} className="w-full">Importer les données</Button>
        <pre className="text-sm bg-muted p-3 rounded">{logs}</pre>
      </CardContent>
    </Card>
  );
};

export default GoogleSheetsImporter;