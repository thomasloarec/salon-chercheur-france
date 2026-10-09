import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import {
  bootstrap,
  boothErrorMessage,
  findDuplicates,
  mergeContacts,
  type BoothDuplicateContact,
  type BoothDuplicateGroup,
} from '@/lib/booth/rpc';
import { applyContactMerge, mergeBootstrap, readCache, writeCache, type BoothCache } from '../sync/cache';
import { getSyncState, listOutbox, syncNow } from '../sync/engine';
import { primaryLabel, secondaryLabel } from './display';

const defaultKeep = (contacts: BoothDuplicateContact[]) =>
  [...contacts].sort(
    (a, b) => (b.interactions_count ?? 0) - (a.interactions_count ?? 0) || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  )[0]?.id ?? null;

function GroupCard({
  group,
  onMerge,
  busy,
}: {
  group: BoothDuplicateGroup;
  onMerge: (keepId: string, others: string[]) => void;
  busy: boolean;
}) {
  const [keep, setKeep] = useState<string | null>(defaultKeep(group.contacts));
  useEffect(() => setKeep(defaultKeep(group.contacts)), [group.contacts]);
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-semibold">
        {group.match === 'email' ? 'Même email' : 'Même téléphone'} : <span className="font-normal">{group.value}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {group.contacts.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setKeep(c.id)}
            className={`rounded-lg border p-3 text-left text-sm ${keep === c.id ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <p className="font-medium">{primaryLabel(c)}</p>
            {secondaryLabel(c) && <p className="text-muted-foreground">{secondaryLabel(c)}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {c.interactions_count} rencontre{c.interactions_count > 1 ? 's' : ''}
            </p>
            {keep === c.id && <p className="mt-1 text-xs font-semibold text-primary">Fiche gardée</p>}
          </button>
        ))}
      </div>
      <Button
        className="min-h-[48px] w-full md:w-auto md:min-w-[200px]"
        disabled={!keep || busy}
        onClick={() => keep && onMerge(keep, group.contacts.filter((c) => c.id !== keep).map((c) => c.id))}
      >
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Fusionner
      </Button>
    </div>
  );
}

export default function DuplicatesScreen({
  cache,
  me,
  online,
  onBack,
}: {
  cache: BoothCache;
  me: string;
  online: boolean;
  onBack: () => void;
}) {
  const [groups, setGroups] = useState<BoothDuplicateGroup[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState<{ keep: string; others: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await findDuplicates(cache.exhibitorId);
      setGroups(r.items ?? []);
    } catch (e) {
      setError(e);
    }
  }, [cache.exhibitorId]);

  useEffect(() => {
    if (online) void load();
  }, [online, load]);

  const doMerge = async () => {
    if (!pending) return;
    const { keep, others } = pending;
    setPending(null);
    setBusy(true);
    try {
      await syncNow(me, cache.exhibitorId);
      while (getSyncState(me, cache.exhibitorId).syncing) await new Promise((r) => setTimeout(r, 200));
      if ((await listOutbox(me, cache.exhibitorId)).length > 0) {
        toast({ description: "Des saisies sont encore en attente d'envoi. Réessayez dans un instant." });
        return;
      }
      for (const id of others) {
        await mergeContacts(keep, id);
        await applyContactMerge(me, cache.exhibitorId, id, keep);
      }
      const prev = await readCache(me, cache.workspaceId);
      try {
        const b = await bootstrap(cache.workspaceId, prev?.next_since ?? null);
        await writeCache(mergeBootstrap(me, cache.workspaceId, prev, b, new Set()));
      } catch {
        // le cache sera rafraîchi à la prochaine synchronisation
      }
      toast({ description: 'Fiches fusionnées' });
      await load();
    } catch (e) {
      toast({ description: boothErrorMessage(e), variant: 'destructive' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-2 py-2">
        <Button variant="ghost" className="min-h-[44px] px-2" onClick={onBack}>
          <ArrowLeft className="mr-1 h-5 w-5" /> Accueil
        </Button>
        <h2 className="text-lg font-semibold tracking-[-0.02em]">Doublons</h2>
      </div>
      <div className="space-y-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {!online ? (
          <p className="py-8 text-center text-muted-foreground">Les doublons se gèrent avec une connexion.</p>
        ) : error ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-destructive">{boothErrorMessage(error)}</p>
            <Button variant="outline" onClick={() => void load()}>
              Réessayer
            </Button>
          </div>
        ) : groups === null ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Aucun doublon détecté.</p>
        ) : (
          groups.map((g) => (
            <GroupCard
              key={`${g.match}|${g.value}`}
              group={g}
              busy={busy}
              onMerge={(keep, others) => setPending({ keep, others })}
            />
          ))
        )}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fusionner les fiches ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les rencontres et opportunités de l'autre fiche seront rattachées à celle-ci. Les informations manquantes
              seront complétées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doMerge()}>Fusionner</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
