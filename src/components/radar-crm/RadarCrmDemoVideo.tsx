import React from 'react';

const LOOM_SRC =
  'https://www.loom.com/embed/6a46d28187ce43d1b2f0d51267abb08e?hideEmbedTopBar=true&hide_share=true&hide_owner=true&hide_title=true';

const RadarCrmDemoVideo: React.FC = () => {
  return (
    <div
      id="demo-video"
      className="relative aspect-video w-full max-w-3xl mx-auto my-8 overflow-hidden rounded-xl shadow-lg scroll-mt-24"
    >
      <iframe
        src={LOOM_SRC}
        title="Démonstration Radar CRM — Lotexpo"
        loading="lazy"
        allow="fullscreen; encrypted-media"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
        style={{ border: 0 }}
      />
    </div>
  );
};

export default RadarCrmDemoVideo;