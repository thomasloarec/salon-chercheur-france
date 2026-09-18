import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  ADMIN_SUPPORT_INBOX_KEY,
  useAdminSupportInbox,
  type AdminInboxThread,
} from './useAdminSupportInbox';
import { CANNED_REPLIES } from './cannedReplies';

// ---------------------------------------------------------------- contexte

interface AdminSupportContextValue {
  openThread: (threadId: string) => void;
  open: () => void;
}

const AdminSupportContext = createContext<AdminSupportContextValue | null>(null);

export function useAdminSupport() {
  const ctx = useContext(AdminSupportContext);
  if (!ctx) {
    return { openThread: () => {}, open: () => {} } as AdminSupportContextValue;
  }
  return ctx;
}

// ---------------------------------------------------------------- types

interface SupportMessageRow {
  id: string;
  thread_id: string;
  sender_role: string;
  sender_name: string | null;
  body: string;
  created_at: string;
  is_internal_note: boolean;
}

type ListFilter = 'todo' | 'pending_user' | 'resolved';

const relative = (iso: string | null) => {
  if (!iso) return '';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
};

const waitingLabel = (minutes: number) => {
  if (minutes < 60) return `${Math.max(0, Math.round(minutes))} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
};

export const filterThreads = (threads: AdminInboxThread[], filter: ListFilter) => {
  if (filter === 'todo') {
    return threads.filter((t) => (t.admin_unread_count ?? 0) > 0 || t.status === 'open');
  }
  if (filter === 'pending_user') return threads.filter((t) => t.status === 'pending_user');
  return threads.filter((t) => t.status === 'resolved' || t.status === 'closed');
};

// ---------------------------------------------------------------- conversation

function ThreadConversation({
  thread,
  onBack,
}: {
  thread: AdminInboxThread;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [links, setLinks] = useState<{ publicUrl: string | null; manageUrl: string | null }>({
    publicUrl: null,
    manageUrl: null,
  });
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, thread_id, sender_role, sender_name, body, created_at, is_internal_note')
      .eq('thread_id', thread.thread_id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('AdminSupportWidget messages:', error);
      toast.error("La conversation n'a pas pu être chargée.");
      return;
    }
    setMessages((data ?? []) as SupportMessageRow[]);
  }, [thread.thread_id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      await load();
      const { error } = await supabase.rpc('support_mark_read', {
        p_thread_id: thread.thread_id,
      });
      if (error) console.error('support_mark_read:', error);
      void queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_INBOX_KEY });
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [load, queryClient, thread.thread_id]);

  // Liens entité (page publique + espace de gestion).
  useEffect(() => {
    let active = true;
    void (async () => {
      if (thread.context_type === 'exhibitor') {
        const { data } = await supabase
          .from('public_exhibitor_profiles')
          .select('public_slug')
          .eq('exhibitor_id', thread.entity_id)
          .maybeSingle();
        const slug = (data as { public_slug?: string } | null)?.public_slug;
        if (active && slug) {
          setLinks({ publicUrl: `/exposants/${slug}`, manageUrl: `/exposants/${slug}/gerer` });
        }
      } else {
        const { data } = await supabase
          .from('events')
          .select('slug')
          .eq('id', thread.entity_id)
          .maybeSingle();
        const slug = (data as { slug?: string } | null)?.slug;
        if (active && slug) {
          setLinks({ publicUrl: `/events/${slug}`, manageUrl: `/events/${slug}/gerer` });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [thread.context_type, thread.entity_id]);

  useEffect(() => {
    const channel = supabase
      .channel(`admin-support-thread-${thread.thread_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `thread_id=eq.${thread.thread_id}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, thread.thread_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const handleSend = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc('support_post_message', {
        p_thread_id: thread.thread_id,
        p_body: text,
        p_is_internal: internal,
        p_as_role: 'admin',
      });
      if (error) throw error;
      setBody('');
      await load();
      const { error: readError } = await supabase.rpc('support_mark_read', {
        p_thread_id: thread.thread_id,
      });
      if (readError) console.error('support_mark_read:', readError);
      void queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_INBOX_KEY });
    } catch (err) {
      console.error('support_post_message:', err);
      toast.error("Le message n'a pas pu être envoyé. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    const { error } = await supabase.rpc('support_set_status', {
      p_thread_id: thread.thread_id,
      p_status: 'resolved',
    });
    if (error) {
      console.error('support_set_status:', error);
      toast.error("Le statut n'a pas pu être modifié.");
      return;
    }
    toast.success('Fil marqué comme résolu.');
    void queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_INBOX_KEY });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3 space-y-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Retour à la liste">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-sm truncate flex-1">{thread.entity_label}</span>
          <Badge variant="secondary" className="text-[10px]">
            {thread.context_type === 'exhibitor' ? 'Exposant' : 'Organisateur'}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 pl-2 text-xs">
          {links.publicUrl && (
            <a
              href={links.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Page publique <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {links.manageUrl && (
            <a
              href={links.manageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Espace de gestion <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {thread.topic && <span className="text-muted-foreground">{thread.topic}</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3" aria-live="polite">
        {loading ? (
          <>
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="h-16 w-2/3 ml-auto" />
          </>
        ) : (
          messages.map((message) => {
            if (message.sender_role === 'system') {
              return (
                <p key={message.id} className="text-center text-xs italic text-muted-foreground">
                  {message.body}
                </p>
              );
            }
            if (message.is_internal_note) {
              return (
                <div
                  key={message.id}
                  className="rounded-lg border border-dashed border-border bg-muted/60 p-2.5"
                >
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Note interne, invisible du demandeur
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                    {message.body}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {message.sender_name || 'Équipe Lotexpo'} · {relative(message.created_at)}
                  </p>
                </div>
              );
            }
            const isAdmin = message.sender_role === 'admin';
            return (
              <div
                key={message.id}
                className={cn('flex gap-2', isAdmin ? 'justify-end' : 'justify-start')}
              >
                <div className="max-w-[85%] space-y-1">
                  <div
                    className={cn(
                      'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                      isAdmin
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm',
                    )}
                  >
                    {message.body}
                  </div>
                  <p
                    className={cn(
                      'text-[11px] text-muted-foreground',
                      isAdmin ? 'text-right' : 'text-left',
                    )}
                  >
                    {isAdmin ? message.sender_name || 'Équipe Lotexpo' : message.sender_name || 'Demandeur'}{' '}
                    · {relative(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          rows={2}
          placeholder="Votre réponse"
          className="min-h-[60px] resize-y"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={internal}
              onCheckedChange={(v) => setInternal(v === true)}
              aria-label="Note interne"
            />
            Note interne
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Réponses types
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-w-xs">
              {CANNED_REPLIES.map((reply) => (
                <DropdownMenuItem key={reply.label} onSelect={() => setBody(reply.body)}>
                  {reply.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => void handleResolve()}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Résolu
          </Button>
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => void handleSend()}
            disabled={!body.trim() || sending}
            aria-label="Envoyer la réponse"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- liste

function ThreadList({
  threads,
  loading,
  onSelect,
}: {
  threads: AdminInboxThread[];
  loading: boolean;
  onSelect: (thread: AdminInboxThread) => void;
}) {
  const [filter, setFilter] = useState<ListFilter>('todo');
  const visible = useMemo(() => filterThreads(threads, filter), [threads, filter]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b p-2">
        {(
          [
            ['todo', 'À traiter'],
            ['pending_user', 'En attente'],
            ['resolved', 'Résolus'],
          ] as [ListFilter, string][]
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? 'default' : 'ghost'}
            className="text-xs"
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Aucun fil dans cette vue.
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map((thread) => (
              <li key={thread.thread_id}>
                <button
                  type="button"
                  onClick={() => onSelect(thread)}
                  className="w-full px-3 py-2.5 text-left hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{thread.entity_label}</span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {thread.context_type === 'exhibitor' ? 'Exposant' : 'Organisateur'}
                    </Badge>
                    {thread.admin_unread_count > 0 && (
                      <Badge variant="destructive" className="ml-auto shrink-0 text-[10px]">
                        {thread.admin_unread_count}
                      </Badge>
                    )}
                  </div>
                  {thread.topic && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{thread.topic}</p>
                  )}
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {thread.last_message_preview}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-[11px]',
                      thread.minutes_waiting > 5 ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    Attente {waitingLabel(thread.minutes_waiting ?? 0)}
                    {thread.escalated_at ? ' · escaladé' : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- widget

export function AdminSupportProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: threads, isLoading, error } = useAdminSupportInbox();

  useEffect(() => {
    if (error) {
      console.error('support_admin_inbox:', error);
      toast.error("Les demandes d'aide n'ont pas pu être chargées.");
    }
  }, [error]);

  const deepLink = searchParams.get('support');
  useEffect(() => {
    if (!deepLink) return;
    setActiveThreadId(deepLink);
    setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('support');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  const list = threads ?? [];
  const totalUnread = list.reduce((sum, t) => sum + (t.admin_unread_count ?? 0), 0);
  const active = list.find((t) => t.thread_id === activeThreadId) ?? null;

  const value = useMemo<AdminSupportContextValue>(
    () => ({
      open: () => setOpen(true),
      openThread: (threadId: string) => {
        setActiveThreadId(threadId);
        setOpen(true);
      },
    }),
    [],
  );

  return (
    <AdminSupportContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {open && (
          <div className="fixed inset-0 z-50 flex flex-col border bg-background shadow-lg sm:static sm:inset-auto sm:h-[70vh] sm:w-[380px] sm:rounded-xl">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <LifeBuoy className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Demandes d'aide</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setOpen(false)}
                aria-label="Fermer le support"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              {active ? (
                <ThreadConversation thread={active} onBack={() => setActiveThreadId(null)} />
              ) : activeThreadId && isLoading ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : (
                <ThreadList
                  threads={list}
                  loading={isLoading}
                  onSelect={(t) => setActiveThreadId(t.thread_id)}
                />
              )}
            </div>
          </div>
        )}
        <Button
          type="button"
          size="icon"
          className="relative h-12 w-12 rounded-full shadow-lg"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fermer les demandes d'aide" : "Ouvrir les demandes d'aide"}
        >
          {open ? <MessageSquare className="h-5 w-5" /> : <LifeBuoy className="h-5 w-5" />}
          {totalUnread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-[1.25rem] justify-center rounded-full px-1 text-[10px]"
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
        </Button>
      </div>
    </AdminSupportContext.Provider>
  );
}

export default AdminSupportProvider;
