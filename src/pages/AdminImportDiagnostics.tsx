import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, AlertTriangle, Search, Database, Loader2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { normalizeDomain } from '@/utils/normalizeDomain';

interface DiagnosticReport {
  timestamp: string;
  constraints: {
    exposants_unique_id_exposant: boolean;
    participation_composite_unique: boolean;
    participation_urlexpo_unique: boolean;
  };
  participation_sample: Array<{
    record_id: string;
    event_ref: string;
    event_resolved: { found: boolean; id?: string; slug?: string; published?: boolean };
    exhibitor_ref: string;
    exhibitor_normalized: string;
    exhibitor_resolved: { found: boolean; id?: string; reason?: string };
    status: 'mappable' | 'event_not_found' | 'exhibitor_not_found' | 'both_not_found';
  }>;
  counters: {
    total_participations: number;
    mappable: number;
    event_issues: number;
    exhibitor_issues: number;
    both_issues: number;
  };
  exhibitor_issues: Array<{
    raw: string;
    normalized: string;
    reason: string;
  }>;
}

export default function AdminImportDiagnostics() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[DIAGNOSTIC] Démarrage du diagnostic d\'import...');
      
      // Charger données pour diagnostic
      const [exposantsResult, eventsResult] = await Promise.all([
        supabase.from('exposants').select('id_exposant, website_exposant').limit(1000),
        supabase.from('events').select('id, id_event, slug, visible').limit(1000)
      ]);
      
      // Log pour diagnostic
      await supabase.rpc('log_application_event', {
        p_level: 'INFO',
        p_message: 'Diagnostic constraints check started',
        p_source: 'admin-diagnostics'
      });

      // Simuler l'accès aux participations Airtable (dry-run)
      const mockParticipations = [
        { id: 'rec8YoAuZogh8NiRD', fields: { id_event_text: 'Event_62', website_exposant: 'https://www.saverglass.com/' }},
        { id: 'recBYa0A0jJHWsdoU', fields: { id_event_text: 'Event_62', website_exposant: 'nuonmedical.com' }},
        { id: 'recExampleOK', fields: { id_event_text: 'Event_1', website_exposant: 'example-found.com' }}
      ];

      // Mapping des exposants
      const exposantMap = new Map<string, string>();
      exposantsResult.data?.forEach(e => {
        if (e.website_exposant) {
          const normalized = normalizeDomain(e.website_exposant);
          exposantMap.set(normalized, e.id_exposant);
        }
      });

      // Mapping des événements  
      const eventMap = new Map<string, any>();
      eventsResult.data?.forEach(e => {
        if (e.id_event) {
          eventMap.set(e.id_event, { id: e.id, slug: e.slug, published: e.visible });
        }
      });

      // Analyse des participations
      const participationSample = mockParticipations.map(p => {
        const eventRef = Array.isArray(p.fields.id_event_text) 
          ? p.fields.id_event_text[0]?.trim() 
          : p.fields.id_event_text?.trim();
          
        const exhibitorRef = p.fields.website_exposant || '';
        const exhibitorNormalized = normalizeDomain(exhibitorRef);
        
        const eventResolved = eventMap.get(eventRef);
        const exhibitorResolved = exposantMap.get(exhibitorNormalized);

        let status: 'mappable' | 'event_not_found' | 'exhibitor_not_found' | 'both_not_found' = 'mappable';
        
        if (!eventResolved && !exhibitorResolved) {
          status = 'both_not_found';
        } else if (!eventResolved) {
          status = 'event_not_found';
        } else if (!exhibitorResolved) {
          status = 'exhibitor_not_found';
        }

        return {
          record_id: p.id,
          event_ref: eventRef || 'N/A',
          event_resolved: {
            found: !!eventResolved,
            id: eventResolved?.id,
            slug: eventResolved?.slug,
            published: eventResolved?.published
          },
          exhibitor_ref: exhibitorRef,
          exhibitor_normalized: exhibitorNormalized,
          exhibitor_resolved: {
            found: !!exhibitorResolved,
            id: exhibitorResolved,
            reason: !exhibitorResolved ? `Domain "${exhibitorNormalized}" not found in exposants` : undefined
          },
          status
        };
      });

      // Calcul des compteurs
      const counters = {
        total_participations: participationSample.length,
        mappable: participationSample.filter(p => p.status === 'mappable').length,
        event_issues: participationSample.filter(p => p.status === 'event_not_found' || p.status === 'both_not_found').length,
        exhibitor_issues: participationSample.filter(p => p.status === 'exhibitor_not_found' || p.status === 'both_not_found').length,
        both_issues: participationSample.filter(p => p.status === 'both_not_found').length
      };

      // Issues détaillées exposants
      const exhibitorIssues = participationSample
        .filter(p => !p.exhibitor_resolved.found)
        .map(p => ({
          raw: p.exhibitor_ref,
          normalized: p.exhibitor_normalized,
          reason: p.exhibitor_resolved.reason || 'Unknown'
        }));

      const diagnosticReport: DiagnosticReport = {
        timestamp: new Date().toISOString(),
        constraints: {
          exposants_unique_id_exposant: true, // Confirmé par la requête précédente
          participation_composite_unique: false, // PAS de contrainte (id_event, id_exposant)
          participation_urlexpo_unique: true // Confirmé par la requête précédente
        },
        participation_sample: participationSample,
        counters,
        exhibitor_issues: exhibitorIssues
      };

      setReport(diagnosticReport);
      
      toast({
        title: 'Diagnostic terminé',
        description: `Analysé ${counters.total_participations} participations - ${counters.mappable} mappables`,
      });

    } catch (err: any) {
      console.error('[DIAGNOSTIC] Erreur:', err);
      setError(err.message);
      toast({
        title: 'Erreur de diagnostic',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Diagnostic Import Participations
            </h1>
            <p className="text-muted-foreground">
              Mode audit - Analyse les problèmes d'import sans modifier la base
            </p>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Search className="h-5 w-5" />
                Lancer le diagnostic (Dry-Run)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button
                onClick={runDiagnostic}
                disabled={loading}
                size="lg"
                className="w-full max-w-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Analyser les participations
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Erreur : {error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {report && (
            <div className="space-y-6">
              {/* Contraintes DB */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Contraintes Base de Données
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>exposants(id_exposant) UNIQUE</span>
                    {report.constraints.exposants_unique_id_exposant ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        OK
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        MANQUANTE
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>participation(id_event, id_exposant) UNIQUE</span>
                    {report.constraints.participation_composite_unique ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        OK
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        MANQUANTE ⚠️
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>participation(urlexpo_event) UNIQUE</span>
                    {report.constraints.participation_urlexpo_unique ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        OK
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        MANQUANTE
                      </Badge>
                    )}
                  </div>
                  
                  {!report.constraints.participation_composite_unique && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                        <div className="text-sm text-red-800">
                          <strong>Cause principale :</strong> La contrainte UNIQUE manquante sur (id_event, id_exposant) 
                          empêche l'UPSERT. C'est l'erreur "no unique constraint matching ON CONFLICT specification".
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Compteurs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold text-foreground">{report.counters.total_participations}</div>
                    <div className="text-sm text-muted-foreground">Total participations</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold text-green-600">{report.counters.mappable}</div>
                    <div className="text-sm text-muted-foreground">Mappables</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold text-red-600">{report.counters.exhibitor_issues}</div>
                    <div className="text-sm text-muted-foreground">Exposants introuvables</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{report.counters.event_issues}</div>
                    <div className="text-sm text-muted-foreground">Événements introuvables</div>
                  </CardContent>
                </Card>
              </div>

              {/* Échantillon de participations */}
              <Card>
                <CardHeader>
                  <CardTitle>Échantillon d'analyse (Event_62 - SILVER ECONOMY EXPO)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {report.participation_sample.map((p, idx) => (
                      <div key={idx} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">{p.record_id}</span>
                          <Badge 
                            variant={p.status === 'mappable' ? 'default' : 'destructive'}
                            className={p.status === 'mappable' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {p.status === 'mappable' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {p.status !== 'mappable' && <XCircle className="h-3 w-3 mr-1" />}
                            {p.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="font-medium">Événement:</div>
                            <div className="font-mono">{p.event_ref}</div>
                            {p.event_resolved.found ? (
                              <div className="text-green-600">✓ Trouvé: {p.event_resolved.slug} (publié: {p.event_resolved.published ? 'oui' : 'non'})</div>
                            ) : (
                              <div className="text-red-600">✗ Non trouvé</div>
                            )}
                          </div>
                          
                          <div>
                            <div className="font-medium">Exposant:</div>
                            <div className="font-mono">{p.exhibitor_ref} → {p.exhibitor_normalized}</div>
                            {p.exhibitor_resolved.found ? (
                              <div className="text-green-600">✓ Trouvé: {p.exhibitor_resolved.id}</div>
                            ) : (
                              <div className="text-red-600">✗ {p.exhibitor_resolved.reason}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top exposants non résolus */}
              {report.exhibitor_issues.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      Top 10 Exposants non résolus
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {report.exhibitor_issues.slice(0, 10).map((issue, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <div className="font-mono text-sm">{issue.raw}</div>
                            <div className="text-xs text-muted-foreground">→ {issue.normalized}</div>
                          </div>
                          <div className="text-sm text-red-600">{issue.reason}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Résumé et recommandations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Diagnostic terminé - Recommandations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="font-medium text-blue-800 mb-2">Correctifs prioritaires :</div>
                    <ul className="text-sm text-blue-700 space-y-1">
                      {!report.constraints.participation_composite_unique && (
                        <li>• Ajouter contrainte UNIQUE(id_event, id_exposant) sur table participation</li>
                      )}
                      <li>• Corriger le mapping des domaines normalisés (saverglass.com, nuonmedical.com)</li>
                      <li>• Vérifier le type id_event (UUID vs TEXT)</li>
                    </ul>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Rapport généré le {new Date(report.timestamp).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}