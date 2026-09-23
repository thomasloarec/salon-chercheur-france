import { useState } from 'react';
import { Check, Copy, ExternalLink, Linkedin, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { track } from '@/lib/analytics';
import { dateRangeLabel } from '@/components/invitation/invitationDates';
import {
  buildEmailTemplate,
  buildLinkedInPost,
  INVITATION_BASE_URL,
  linkedInShareUrl,
  type InvitationOverviewRow,
} from '@/hooks/useInvitationPages';

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Bloc de partage : lien, LinkedIn (texte prêt à coller), modèle d'email. */
export default function SharePanel({ row, compact = false }: { row: InvitationOverviewRow; compact?: boolean }) {
  const url = `${INVITATION_BASE_URL}${row.invitation_slug}`;
  const dates = dateRangeLabel(row.date_debut, row.date_fin);
  const post = buildLinkedInPost({ eventName: row.event_name, dates, noveltyTitle: row.novelty_title, url });
  const email = buildEmailTemplate({ eventName: row.event_name, dates, noveltyTitle: row.novelty_title, url });
  const [open, setOpen] = useState<'linkedin' | 'email' | null>(compact ? null : 'linkedin');
  const [copied, setCopied] = useState<string | null>(null);

  const doCopy = async (key: string, text: string, event: string) => {
    if (await copy(text)) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
      track(event, { event_id: row.event_id });
    } else {
      toast.error('Copie impossible : sélectionnez le texte manuellement.');
    }
  };

  const shareLinkedIn = async () => {
    // Le texte est copié d'abord : LinkedIn ne permet pas de le pré-remplir.
    await copy(post);
    track('invitation_share_linkedin', { event_id: row.event_id });
    toast.success('Texte du post copié', { description: 'Collez-le dans la fenêtre LinkedIn qui s’ouvre.' });
    window.open(linkedInShareUrl(url), '_blank', 'noopener,noreferrer,width=620,height=720');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground truncate font-mono">
          {url.replace('https://', '')}
        </div>
        <Button variant="outline" size="sm" className="h-auto shrink-0" onClick={() => doCopy('link', url, 'invitation_copy_link')}>
          {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="ml-1.5 hidden sm:inline">{copied === 'link' ? 'Copié' : 'Copier le lien'}</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={shareLinkedIn} className="gap-1.5 bg-[#0a66c2] hover:bg-[#0a66c2]/90 text-white">
          <Linkedin className="h-4 w-4" />
          Partager sur LinkedIn
        </Button>
        <Button
          size="sm"
          variant={open === 'email' ? 'secondary' : 'outline'}
          onClick={() => setOpen(open === 'email' ? null : 'email')}
          className="gap-1.5"
        >
          <Mail className="h-4 w-4" />
          Modèle d'email
        </Button>
        <Button size="sm" variant="ghost" asChild className="gap-1.5">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Voir la page
          </a>
        </Button>
      </div>

      {open === 'linkedin' && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Texte de post suggéré (copié automatiquement au clic sur « Partager »)</p>
          <Textarea readOnly value={post} rows={6} className="text-sm resize-none" />
          <Button size="sm" variant="ghost" onClick={() => doCopy('post', post, 'invitation_copy_text')} className="gap-1.5">
            {copied === 'post' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === 'post' ? 'Copié' : 'Copier le texte'}
          </Button>
        </div>
      )}

      {open === 'email' && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Objet</p>
          <p className="text-sm font-medium">{email.subject}</p>
          <Textarea readOnly value={email.body} rows={8} className="text-sm resize-none" />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => doCopy('email', `${email.subject}\n\n${email.body}`, 'invitation_copy_email')}
              className="gap-1.5"
            >
              {copied === 'email' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === 'email' ? 'Copié' : "Copier l'email"}
            </Button>
            <Button size="sm" variant="ghost" asChild className="gap-1.5">
              <a href={`mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}>
                <Mail className="h-4 w-4" />
                Ouvrir dans ma messagerie
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
