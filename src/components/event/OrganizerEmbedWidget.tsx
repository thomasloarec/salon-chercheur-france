import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  slug: string;
  nomEvent: string;
}

const OrganizerEmbedWidget: React.FC<Props> = ({ slug, nomEvent }) => {
  const embedUrl = `https://lotexpo.com/embed/salon/${slug}`;
  const iframeCode = useMemo(
    () =>
      `<iframe src="${embedUrl}" width="100%" height="600" style="border:0;" title="Nouveautés - ${nomEvent}"></iframe>`,
    [embedUrl, nomEvent]
  );
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopied(true);
      toast.success('Code copié');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Code à intégrer</label>
        <Textarea
          readOnly
          value={iframeCode}
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs h-24"
        />
        <div>
          <Button variant="outline" onClick={onCopy}>
            {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
            Copier le code
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Aperçu live</label>
        <div className="rounded-md border overflow-hidden bg-background">
          <iframe
            src={`/embed/salon/${slug}`}
            width="100%"
            height={600}
            style={{ border: 0, display: 'block' }}
            title={`Aperçu widget - ${nomEvent}`}
          />
        </div>
      </div>
    </Card>
  );
};

export default OrganizerEmbedWidget;