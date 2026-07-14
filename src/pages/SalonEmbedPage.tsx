import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { noveltyTypeLabel } from '@/lib/noveltyTypeMeta';

interface EventLite {
  id: string;
  slug: string;
  nom_event: string;
}

interface NoveltyRow {
  id: string;
  title: string;
  type: string | null;
  media_urls: string[] | null;
  created_at: string;
  exhibitor_id: string;
  exhibitors?: { name: string | null } | null;
}

const SITE = 'https://lotexpo.com';

const SalonEmbedPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventLite | null>(null);
  const [novelties, setNovelties] = useState<NoveltyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) return;
      setLoading(true);
      const { data: ev } = await supabase
        .from('events')
        .select('id, slug, nom_event, visible, is_test')
        .eq('slug', slug)
        .eq('visible', true)
        .eq('is_test', false)
        .maybeSingle();
      if (cancelled) return;
      if (!ev) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setEvent({ id: (ev as any).id, slug: (ev as any).slug, nom_event: (ev as any).nom_event });
      const { data: nv } = await supabase
        .from('novelties')
        .select('id, title, type, media_urls, created_at, exhibitor_id, exhibitors!novelties_exhibitor_id_fkey(name)')
        .eq('event_id', (ev as any).id)
        .eq('status', 'published')
        .eq('is_test', false)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setNovelties((nv as any[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const eventUrl = event ? `${SITE}/events/${event.slug}` : SITE;

  return (
    <div
      style={{
        background: '#ffffff',
        color: '#0f172a',
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        minHeight: '100vh',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {loading ? (
        <p style={{ fontSize: 14, color: '#64748b' }}>Chargement…</p>
      ) : notFound || !event ? (
        <p style={{ fontSize: 14, color: '#64748b' }}>Salon introuvable.</p>
      ) : (
        <>
          <header style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', margin: 0 }}>
              {event.nom_event}
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 0' }}>Nouveautés</h1>
          </header>

          {novelties.length === 0 ? (
            <p style={{ fontSize: 14, color: '#64748b' }}>Aucune nouveauté publiée pour l'instant.</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              }}
            >
              {novelties.map((n) => {
                const img = n.media_urls?.[0];
                const exhibitorName = n.exhibitors?.name ?? '';
                return (
                  <a
                    key={n.id}
                    href={eventUrl}
                    target="_blank"
                    rel="noopener"
                    style={{
                      display: 'block',
                      textDecoration: 'none',
                      color: 'inherit',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: '#fff',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '16 / 10',
                        background: '#f1f5f9',
                        overflow: 'hidden',
                      }}
                    >
                      {img ? (
                        <img
                          src={img}
                          alt={n.title}
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : null}
                    </div>
                    <div style={{ padding: 10 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          marginBottom: 6,
                        }}
                      >
                        {noveltyTypeLabel(n.type)}
                      </span>
                      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{n.title}</div>
                      {exhibitorName ? (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{exhibitorName}</div>
                      ) : null}
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          <footer style={{ marginTop: 20, textAlign: 'center' }}>
            <a
              href="https://lotexpo.com"
              target="_blank"
              rel="noopener"
              style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none' }}
            >
              Propulsé par Lotexpo
            </a>
          </footer>
        </>
      )}
    </div>
  );
};

export default SalonEmbedPage;