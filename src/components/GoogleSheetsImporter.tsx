import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download, CheckCircle, AlertCircle, Info, LogIn, LogOut } from 'lucide-react';
import { gapi } from 'gapi-script';

interface GoogleSheet {
  id: string;
  name: string;
}

const GoogleSheetsImporter = () => {
  const [isGoogleAuthReady, setIsGoogleAuthReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const [googleSheets, setGoogleSheets] = useState<GoogleSheet[]>([]);
  const [selectedEventSheet, setSelectedEventSheet] = useState<string>('');
  const [selectedExposantSheet, setSelectedExposantSheet] = useState<string>('');
  const [eventSheetName, setEventSheetName] = useState('All_Evenements');
  const [exposantSheetName, setExposantSheetName] = useState('E46');
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Configuration Google OAuth
  // ⚠️ IMPORTANT: Ces valeurs doivent être configurées dans Google Cloud Console
  // 1. Créer un projet dans Google Cloud Console
  // 2. Activer les APIs Google Sheets et Google Drive
  // 3. Créer des identifiants OAuth 2.0 pour application web
  // 4. Ajouter votre domaine dans les origines JavaScript autorisées
  const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; // À remplacer
  const API_KEY = 'YOUR_GOOGLE_API_KEY'; // À remplacer
  const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
  const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly';

  useEffect(() => {
    initializeGapi();
  }, []);

  const initializeGapi = async () => {
    try {
      await gapi.load('auth2', () => {
        gapi.auth2.init({
          client_id: CLIENT_ID,
        });
      });

      await gapi.load('client', async () => {
        await gapi.client.init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          discoveryDocs: [DISCOVERY_DOC],
          scope: SCOPES
        });

        setIsGoogleAuthReady(true);
        
        // Vérifier si l'utilisateur est déjà connecté
        const authInstance = gapi.auth2.getAuthInstance();
        if (authInstance.isSignedIn.get()) {
          handleSignInSuccess();
        }
      });
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de Google API:', error);
      setError('Erreur lors de l\'initialisation de Google API');
    }
  };

  const handleSignIn = async () => {
    try {
      const authInstance = gapi.auth2.getAuthInstance();
      await authInstance.signIn();
      handleSignInSuccess();
    } catch (error) {
      console.error('Erreur lors de la connexion Google:', error);
      setError('Erreur lors de la connexion à Google');
    }
  };

  const handleSignInSuccess = () => {
    const authInstance = gapi.auth2.getAuthInstance();
    const user = authInstance.currentUser.get();
    const token = user.getAuthResponse().access_token;
    
    setIsSignedIn(true);
    setAccessToken(token);
    loadGoogleSheets();
  };

  const handleSignOut = () => {
    const authInstance = gapi.auth2.getAuthInstance();
    authInstance.signOut();
    setIsSignedIn(false);
    setAccessToken('');
    setGoogleSheets([]);
    setSelectedEventSheet('');
    setSelectedExposantSheet('');
  };

  const loadGoogleSheets = async () => {
    setIsLoadingSheets(true);
    try {
      const response = await gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: 'files(id, name)',
        orderBy: 'modifiedTime desc'
      });

      const sheets: GoogleSheet[] = response.result.files.map((file: any) => ({
        id: file.id,
        name: file.name
      }));

      setGoogleSheets(sheets);
    } catch (error) {
      console.error('Erreur lors du chargement des Google Sheets:', error);
      setError('Erreur lors du chargement de vos Google Sheets');
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleImport = async () => {
    if (!selectedEventSheet && !selectedExposantSheet) {
      setError('Veuillez sélectionner au moins un Google Sheet à importer');
      return;
    }

    if (!accessToken) {
      setError('Token d\'accès manquant. Veuillez vous reconnecter.');
      return;
    }

    setIsImporting(true);
    setError('');
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-google-sheets', {
        body: {
          spreadsheetId1: selectedEventSheet || null,
          spreadsheetId2: selectedExposantSheet || null,
          sheetName1: eventSheetName,
          sheetName2: exposantSheetName,
          accessToken: accessToken
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

  if (!isGoogleAuthReady) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importation Google Sheets vers Supabase
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Initialisation de Google API...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Importation Google Sheets vers Supabase
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSignedIn ? (
          <div className="text-center space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Connectez-vous avec Google pour accéder à vos Google Sheets privés.
              </AlertDescription>
            </Alert>
            <Button onClick={handleSignIn} className="w-full">
              <LogIn className="mr-2 h-4 w-4" />
              Se connecter avec Google
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600">✅ Connecté à Google Drive</span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </Button>
            </div>

            {isLoadingSheets ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Chargement de vos Google Sheets...</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Google Sheet pour les événements
                  </label>
                  <Select value={selectedEventSheet} onValueChange={setSelectedEventSheet}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un fichier pour les événements" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucun (ne pas importer d'événements)</SelectItem>
                      {googleSheets.map((sheet) => (
                        <SelectItem key={sheet.id} value={sheet.id}>
                          {sheet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEventSheet && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Nom de l'onglet événements
                    </label>
                    <Input
                      value={eventSheetName}
                      onChange={(e) => setEventSheetName(e.target.value)}
                      placeholder="All_Evenements"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Google Sheet pour les exposants
                  </label>
                  <Select value={selectedExposantSheet} onValueChange={setSelectedExposantSheet}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un fichier pour les exposants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucun (ne pas importer d'exposants)</SelectItem>
                      {googleSheets.map((sheet) => (
                        <SelectItem key={sheet.id} value={sheet.id}>
                          {sheet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedExposantSheet && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Nom de l'onglet exposants
                    </label>
                    <Input
                      value={exposantSheetName}
                      onChange={(e) => setExposantSheetName(e.target.value)}
                      placeholder="E46"
                    />
                  </div>
                )}

                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Import flexible :</strong> Vous pouvez importer les événements <strong>ou</strong> les exposants indépendamment.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleImport}
                  disabled={isImporting || (!selectedEventSheet && !selectedExposantSheet)}
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
              </>
            )}
          </>
        )}

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