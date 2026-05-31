import { Helmet } from 'react-helmet-async';

interface NotFoundSEOProps {
  /** Optional override for the page title. */
  title?: string;
  /** Optional override for the meta description. */
  description?: string;
}

/**
 * SEO head for "page not found" views.
 *
 * Because Lotexpo is a client-side SPA, unknown routes (and hidden / test /
 * non-existent exhibitor profiles) still respond HTTP 200 while rendering a
 * "not found" view. To avoid soft-404 issues in Google, every such view must
 * emit an explicit `noindex, follow` robots directive.
 *
 * This component intentionally emits NO canonical, NO Organization JSON-LD and
 * NO BreadcrumbList — a not-found page must not carry any positive SEO signal.
 */
export const NotFoundSEO = ({
  title = 'Page introuvable | Lotexpo',
  description = "Cette page Lotexpo est introuvable ou n'est plus disponible.",
}: NotFoundSEOProps) => {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="noindex, follow" />
    </Helmet>
  );
};

export default NotFoundSEO;