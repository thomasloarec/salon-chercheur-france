
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrapingService } from '@/services/ScrapingService';
import { AIClassifier } from '@/services/aiClassifier';
import { Loader2, Play, CheckCircle, XCircle } from 'lucide-react';
import type { ScrapingResult } from '@/types/scraping';

const ScrapingTest = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ScrapingResult[]>([]);
  const [testClassification, setTestClassification] = useState<any>(null);

  const runScraping = async () => {
    setIsRunning(true);
    setResults([]);
    
    try {
      const scrapingService = new ScrapingService();
      const scrapingResults = await scrapingService.scrapeAllSources();
      setResults(scrapingResults);
    } catch (error) {
      console.error('Scraping failed:', error);
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
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats du Scraping</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{result.source}</h3>
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? 'Succès' : 'Échec'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Trouvés:</span>
                      <div className="font-medium">{result.eventsFound}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Traités:</span>
                      <div className="font-medium">{result.eventsProcessed}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Sauvés:</span>
                      <div className="font-medium text-green-600">{result.eventsSaved}</div>
                    </div>
                  </div>
                  
                  {result.errors.length > 0 && (
                    <div className="mt-3">
                      <span className="text-sm text-red-600 font-medium">Erreurs:</span>
                      <ul className="text-sm text-red-500 mt-1 space-y-1">
                        {result.errors.map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScrapingTest;
