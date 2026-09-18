import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Info, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface SupportChatPanelProps {
  contextType: 'exhibitor' | 'organizer';
  entityId: string;
  entityLabel: string;
}

type SenderRole = 'user' | 'admin' | 'system';

interface SupportMessage {
  id: string;
  thread_id: string;
  sender_role: SenderRole;
  sender_name: string | null;
  body: string;
  created_at: string;
}

const TOPICS = [
  'Problème technique',
  'Données erronées sur ma fiche',
  'Question sur mon offre',
  "Suggestion d'amélioration",
  'Autre',
];

const RELATIVE = (iso: string) => {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
};

export default function SupportChatPanel({
  contextType,
  entityId,
  entityLabel,
}: SupportChatPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [topic, setTopic] = useState<string>('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async (id: string) => {
    const { data, error: msgError } = await supabase
      .from('support_messages')
      .select('id, thread_id, sender_role, sender_name, body, created_at')
      .eq('thread_id', id)
      .order('created_at', { ascending: true });
    if (msgError) throw msgError;
    setMessages((data ?? []) as SupportMessage[]);
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: settings } = await supabase
        .from('support_settings')
        .select('enabled')
        .maybeSingle();
      setEnabled(settings?.enabled !== false);

      const { data: threads, error: threadError } = await supabase.rpc('support_my_thread', {
        p_context_type: contextType,
        p_entity_id: entityId,
      });
      if (threadError) throw threadError;

      const list = threads ?? [];
      const current =
        list.find((t) => t.status === 'open' || t.status === 'pending_user') ?? list[0];

      if (current?.thread_id) {
        setThreadId(current.thread_id);
        await loadMessages(current.thread_id);
        await supabase.rpc('support_mark_read', { p_thread_id: current.thread_id });
      } else {
        setThreadId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('SupportChatPanel:', err);
      setError("Impossible de charger votre conversation pour le moment. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }, [contextType, entityId, loadMessages]);

  useEffect(() => {
    void init();
  }, [init]);

  // Temps réel : nouveaux messages du fil en cours.
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`support-thread-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as unknown as SupportMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
          void supabase.rpc('support_mark_read', { p_thread_id: threadId });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const canSend = useMemo(
    () => body.trim().length > 0 && (threadId ? true : topic.length > 0),
    [body, topic, threadId],
  );

  const handleSend = async () => {
    if (!canSend || sending) return;
    const text = body.trim();
    setSending(true);
    const optimistic: SupportMessage = {
      id: `optimistic-${Date.now()}`,
      thread_id: threadId ?? 'pending',
      sender_role: 'user',
      sender_name: null,
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody('');
    try {
      if (threadId) {
        const { error: postError } = await supabase.rpc('support_post_message', {
          p_thread_id: threadId,
          p_body: text,
        });
        if (postError) throw postError;
        await loadMessages(threadId);
      } else {
        const { error: openError } = await supabase.rpc('support_open_thread', {
          p_context_type: contextType,
          p_entity_id: entityId,
          p_message: text,
          p_topic: topic,
          p_subject: `${topic} · ${entityLabel}`,
        });
        if (openError) throw openError;
        await init();
      }
    } catch (err) {
      console.error('SupportChatPanel envoi:', err);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBody(text);
      toast.error("Votre message n'a pas pu être envoyé. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  if (loading) {
    return (
      <Card className="p-6 space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void init()}>
          Réessayer
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      {!enabled && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Le support est momentanément indisponible. Vous pourrez nous écrire à nouveau très
            bientôt. Pour une urgence, écrivez à admin@lotexpo.com.
          </p>
        </div>
      )}

      {threadId ? (
        <div
          aria-live="polite"
          aria-label="Conversation avec l'équipe Lotexpo"
          className="max-h-[60vh] overflow-y-auto space-y-3 pr-1"
        >
          {messages.map((message) => {
            if (message.sender_role === 'system') {
              return (
                <p
                  key={message.id}
                  className="text-center text-xs text-muted-foreground italic px-4"
                >
                  {message.body}
                </p>
              );
            }
            const isUser = message.sender_role === 'user';
            return (
              <div
                key={message.id}
                className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}
              >
                {!isUser && (
                  <span className="mt-1 h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center">
                    L
                  </span>
                )}
                <div className={cn('max-w-[85%] sm:max-w-[75%] space-y-1')}>
                  <div
                    className={cn(
                      'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm',
                    )}
                  >
                    {message.body}
                  </div>
                  <p
                    className={cn(
                      'text-[11px] text-muted-foreground',
                      isUser ? 'text-right' : 'text-left',
                    )}
                  >
                    {isUser ? 'Vous' : message.sender_name || 'Équipe Lotexpo'} ·{' '}
                    {RELATIVE(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      ) : (
        <div className="space-y-4" aria-live="polite">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Une question sur {entityLabel} ?
            </p>
            <p className="text-sm text-muted-foreground">
              Écrivez-nous ici. Nous vous répondons dans cet espace et par email.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support-topic">Votre besoin porte sur</Label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger id="support-topic" className="sm:max-w-sm">
                <SelectValue placeholder="Choisissez un motif" />
              </SelectTrigger>
              <SelectContent>
                {TOPICS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {enabled && (
        <div className="space-y-2">
          <Label htmlFor="support-message">Votre message</Label>
          <div className="flex items-end gap-2">
            <Textarea
              id="support-message"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="Décrivez votre demande en quelques lignes"
              className="min-h-[72px] resize-y"
            />
            <Button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend || sending}
              aria-label="Envoyer le message"
              className="shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            L'équipe répond généralement en quelques minutes. Sans réponse immédiate, vous
            recevrez un email dès que nous aurons répondu.
          </p>
        </div>
      )}
    </Card>
  );
}
