import { Link } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ASSISTANT_ONBOARDING_PATH, ASSISTANT_ONBOARDING_READY } from './config';

interface Props {
  pistes: { id: string; short_label: string }[];
  status?: { refreshing: boolean; refreshed_at: string | null };
}

const MAX_CHIPS = 6;

function updatedLabel(iso: string): string | null {
  try {
    return `Mis à jour ${formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: fr })}`;
  } catch {
    return null;
  }
}

export default function AssistantSearchBar({ pistes, status }: Props) {
  const shown = pistes.slice(0, MAX_CHIPS);
  const rest = pistes.length - shown.length;
  const updated = !status?.refreshing && status?.refreshed_at ? updatedLabel(status.refreshed_at) : null;

  return (
    <div
      role="region"
      aria-label="Ce que votre assistant cherche"
      className="flex flex-wrap items-center gap-3 rounded-xl bg-primary px-5 py-4 text-primary-foreground"
    >
      <div className="flex items-center gap-2">
        <Search className="h-[22px] w-[22px]" aria-hidden="true" />
        <span className="text-base font-bold">Je cherche pour vous</span>
      </div>
      {shown.map((p) => (
        <span
          key={p.id}
          className="inline-flex h-8 items-center rounded-full bg-background px-3 text-sm font-semibold text-primary"
        >
          {p.short_label}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex h-8 items-center rounded-full bg-background px-3 text-sm font-semibold text-primary">
          +{rest}
        </span>
      )}
      {ASSISTANT_ONBOARDING_READY && (
        <Link
          to={`${ASSISTANT_ONBOARDING_PATH}?modifier=1`}
          className="text-sm text-primary-foreground underline underline-offset-2"
        >
          Modifier
        </Link>
      )}
      {(status?.refreshing || updated) && (
        <div className="flex w-full items-center gap-1.5 text-[13px] text-primary-foreground/85 sm:ml-auto sm:w-auto">
          {status?.refreshing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Je relis les programmes…
            </>
          ) : (
            updated
          )}
        </div>
      )}
    </div>
  );
}
