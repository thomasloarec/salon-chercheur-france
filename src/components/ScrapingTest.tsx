
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AIClassifier } from '@/services/aiClassifier';
import { Loader2, Play, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ScrapingResult {
  found: number;
  saved: number;
  scrapingErrors: number;
  saveErrors: string[];
  success: boolean;
}

const ScrapingTest = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ScrapingResult | null>(null);
  const [testClassification, setTestClassification] = useState<any>(null);

  const runScraping = async () => {
    setIsRunning(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/scrape', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Scraping failed:', error);
      setResult({
        found: 0,
        saved: 0,
        scrapingErrors: 1,
        saveErrors: [String(error)],
        success: false
      });
    } finally {
      setIsRunning(false);
    }
  };

  const testAIClassification = () => {
    const testEvent = {
      title: "Salon INDUSTRIE Paris 2025",
      description: "Le salon international de l'industrie et des technologies innovantes. Découvrez les dernières innovations B2B pour l'industrie 4.0, les équipements industriels et les solutions technologiques."
    };

    const classification = AIClassifier.classifyEvent(testEvent);
    setTestClassification({ event: testEvent, classification });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Système de Scraping - Tests</CardTitle>
          <CardDescription>
            Testez le système de scraping et la classification IA des événements professionnels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={runScraping} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunning ? 'Scraping en cours...' : 'Lancer le Scraping'}
            </Button>
            
            <Button 
              onClick={testAIClassification}
              variant="outline"
            >
              Tester Classification IA
            </Button>
          </div>

          {testClassification && (
            <Card className="bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg">Test de Classification IA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <strong>Événement test :</strong>
                    <p className="text-sm text-gray-600 mt-1">{testClassification.event.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{testClassification.event.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-sm font-medium">Professionnel</span>
                      <div className="flex items-center gap-2 mt-1">
                        {testClassification.classification.isProfessional ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">
                          {(testClassification.classification.professionalScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium">Secteur</span>
                      <Badge variant="secondary" className="mt-1">
                        {testClassification.classification.sector}
                      </Badge>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium">Confiance</span>
                      <div className="text-sm mt-1">
                        {(testClassification.classification.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium">Tags</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {testClassification.classification.tags.slice(0, 3).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Résultats du Scraping
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{result.found}</div>
                      <div className="text-sm text-blue-600">Événements trouvés</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{result.saved}</div>
                      <div className="text-sm text-green-600">Événements sauvés</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{result.scrapingErrors}</div>
                      <div className="text-sm text-orange-600">Erreurs de scraping</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{result.saveErrors.length}</div>
                      <div className="text-sm text-red-600">Erreurs de sauvegarde</div>
                    </div>
                  </div>

                  {result.saveErrors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-red-600 mb-2">Erreurs de sauvegarde :</h4>
                      <ul className="text-sm text-red-500 space-y-1">
                        {result.saveErrors.map((error, idx) => (
                          <li key={idx} className="bg-red-50 p-2 rounded">• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Résumé :</h4>
                    <p className="text-sm text-gray-600">
                      {result.success 
                        ? `✅ Scraping réussi ! ${result.saved} événements ont été traités.`
                        : `⚠️ Scraping partiellement réussi. ${result.saved}/${result.found} événements sauvés.`
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScrapingTest;
