import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download, CheckCircle, AlertCircle, Info } from 'lucide-react';

const GoogleSheetsImporter = () => {
  const [spreadsheetId1, setSpreadsheetId1] = useState('');
  const [spreadsheetId2, setSpreadsheetId2] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('E46');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleImport = async () => {
    if (!spreadsheetId1 && !spreadsheetId2) {
      setError('Veuillez renseigner au moins un ID de Google Sheet');
      return;
    }

    setIsImporting(true);
    setError('');
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-google-sheets', {
        body: {
          spreadsheetId1: spreadsheetId1 || null,
          spreadsheetId2: spreadsheetId2 || null,
          sheetName1: 'All_Evenements',
          sheetName2: selectedSheet
        }
      });

      if (error) {
        throw error;
      }

      setResult(data);
    } catch (err: any) {
      console.error('Import error:', err);
      setError(`Erreur lors de l'importation: ${err.message || err.error || 'Erreur inconnue'}${err.details ? ` - ${err.details}` : ''}`);
    } finally {
      setIsImporting(false);
    }
  };

  const extractSpreadsheetId = (url: string) => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Importation Google Sheets vers Supabase
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Google Sheet "All_Evenements" (ID ou URL complète)
          </label>
          <Input
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
            value={spreadsheetId1}
            onChange={(e) => setSpreadsheetId1(extractSpreadsheetId(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Google Sheet "All_Exposants" (ID ou URL complète)
          </label>
          <Input
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
            value={spreadsheetId2}
            onChange={(e) => setSpreadsheetId2(extractSpreadsheetId(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Nom de la feuille des exposants
          </label>
          <Select value={selectedSheet} onValueChange={setSelectedSheet}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une feuille" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="E46">E46</SelectItem>
              <SelectItem value="E47">E47</SelectItem>
              <SelectItem value="E48">E48</SelectItem>
              <SelectItem value="All_Exposants">All_Exposants</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Instructions :</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Assurez-vous que les Google Sheets sont publics ou partagés</li>
            <li>• Vous pouvez importer les événements et/ou les exposants indépendamment</li>
            <li>• Les colonnes doivent correspondre aux noms attendus</li>
          </ul>
        </div>

        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Import flexible :</strong> Vous pouvez importer les événements <strong>ou</strong> les exposants indépendamment en remplissant seulement les champs nécessaires.
          </AlertDescription>
        </Alert>

        <Button
          onClick={handleImport}
          disabled={isImporting || (!spreadsheetId1 && !spreadsheetId2)}
          className="w-full"
        >
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importation en cours...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Importer les données
            </>
          )}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="space-y-1">
                <div>✅ Importation réussie !</div>
                {result.eventsImported > 0 && (
                  <div>📊 Événements importés : {result.eventsImported}</div>
                )}
                {result.exposantsImported > 0 && (
                  <div>🏢 Exposants importés : {result.exposantsImported}</div>
                )}
                {result.eventsImported === 0 && result.exposantsImported === 0 && (
                  <div>ℹ️ Aucune donnée importée (peut-être que les feuilles sont vides)</div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleSheetsImporter;