
import React from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Copy, RefreshCw, Check } from 'lucide-react';
import { buildSecretCommand, copyToClipboard } from '@/utils/secretsCommandBuilder';
import { useToast } from '@/hooks/use-toast';

interface MissingSecretsAlertProps {
  missing: string[];
  onMarkAsDone?: () => void;
  isRefreshing?: boolean;
}

const MissingSecretsAlert: React.FC<MissingSecretsAlertProps> = ({
  missing,
  onMarkAsDone,
  isRefreshing = false
}) => {
  const { toast } = useToast();
  const command = buildSecretCommand(missing);

  const handleCopyCommand = async () => {
    const success = await copyToClipboard(command);
    
    if (success) {
      toast({
        title: 'Commande copiée',
        description: 'La commande a été copiée dans le presse-papiers',
      });
    } else {
      toast({
        title: 'Erreur de copie',
        description: 'Impossible de copier automatiquement. Copiez manuellement la commande.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Variables d'environnement manquantes
        <Badge variant="destructive">{missing.length}</Badge>
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-4">
          <p>
            Les variables suivantes doivent être configurées dans Supabase Functions :
          </p>
          
          <div className="flex flex-wrap gap-2">
            {missing.map(variable => (
              <Badge key={variable} variant="outline" className="font-mono text-xs">
                {variable}
              </Badge>
            ))}
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Commande à exécuter :</p>
            <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
              <code>{command}</code>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyCommand}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copier la commande
            </Button>
            
            {onMarkAsDone && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onMarkAsDone}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                {isRefreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {isRefreshing ? 'Vérification...' : 'J\'ai configuré les secrets'}
              </Button>
            )}
          </div>

          <div className="text-xs text-gray-600 border-t pt-3">
            <p><strong>Instructions :</strong></p>
            <ol className="list-decimal list-inside space-y-1 mt-1">
              <li>Copiez la commande ci-dessus</li>
              <li><strong>Complétez AIRTABLE_PAT=""</strong> avec votre Personal Access Token</li>
              <li>Exécutez la commande dans votre terminal</li>
              <li>Redéployez les functions : <code className="bg-gray-100 px-1 rounded">supabase functions deploy</code></li>
              <li>Cliquez sur "J'ai configuré les secrets" pour revérifier</li>
            </ol>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default MissingSecretsAlert;
