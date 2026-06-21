import React, { useState } from 'react';
import { Play } from 'lucide-react';

interface RadarCrmDemoVideoProps {
  posterSrc?: string;
}

const LOOM_SRC =
  'https://www.loom.com/embed/6a46d28187ce43d1b2f0d51267abb08e?hideEmbedTopBar=true&hide_share=true&hide_owner=true&hide_title=true&autoplay=1';

const RadarCrmDemoVideo: React.FC<RadarCrmDemoVideoProps> = ({
  posterSrc = '/placeholder.svg',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div
      id="demo-video"
      className="relative aspect-video w-full max-w-3xl mx-auto my-8 overflow-hidden rounded-xl shadow-lg scroll-mt-24"
    >
      {isPlaying ? (
        <iframe
          src={LOOM_SRC}
          title="Démonstration Radar CRM — Lotexpo"
          allow="fullscreen; encrypted-media"
          frameBorder={0}
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Lire la démonstration Radar CRM"
          onClick={() => setIsPlaying(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsPlaying(true);
            }
          }}
          className="group absolute inset-0 w-full h-full cursor-pointer"
        >
          <img
            src={posterSrc}
            alt="Aperçu de la démonstration Radar CRM"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110">
              <Play className="h-7 w-7 translate-x-0.5 fill-current" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RadarCrmDemoVideo;