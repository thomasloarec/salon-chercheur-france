import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Rendu markdown compact pour les réponses de l'agent.
 * Le projet n'utilise pas @tailwindcss/typography : on stylise chaque élément
 * manuellement pour rester cohérent avec la marque (sobre, lisible, B2B).
 */
const AnswerMarkdown = ({ children }: { children: string }) => {
  return (
    <div className="text-[15px] leading-relaxed text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => <p className="my-2" {...props} />,
          ul: ({ node, ...props }) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
          ol: ({ node, ...props }) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
          li: ({ node, ...props }) => <li className="pl-1" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-semibold text-primary" {...props} />,
          h1: ({ node, ...props }) => <h3 className="heading-display mb-2 mt-3 text-lg" {...props} />,
          h2: ({ node, ...props }) => <h3 className="heading-display mb-2 mt-3 text-base" {...props} />,
          h3: ({ node, ...props }) => <h4 className="heading-display mb-1 mt-3 text-base" {...props} />,
          a: ({ node, ...props }) => (
            <a className="font-medium text-accent underline underline-offset-2" {...props} />
          ),
          code: ({ node, ...props }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-[13px]" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export default AnswerMarkdown;