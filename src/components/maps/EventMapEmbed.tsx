import React from "react";

type Props = {
  lat?: number | null;
  lon?: number | null;
  address?: string | null;
  zoom?: number;    // défaut 14
  height?: number;  // défaut 320-360px pour sidebar
  className?: string;
};

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export default function EventMapEmbed({
  lat,
  lon,
  address,
  zoom = 14,
  height = 360,
  className = ""
}: Props) {
  // Fallback si pas de clé
  if (!apiKey) {
    return (
      <div className={`rounded-lg border p-4 bg-gray-50 ${className}`}>
        <p className="text-sm text-gray-600">Carte indisponible (clé Google Maps absente).</p>
        {address ? (
          <a
            className="underline text-sm text-primary hover:text-primary/80 transition-colors"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir dans Google Maps
          </a>
        ) : null}
      </div>
    );
  }

  // Priorité aux coordonnées si disponibles
  let src = "";
  if (typeof lat === "number" && typeof lon === "number") {
    // Affichage par coordonnées
    src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lon}&zoom=${zoom}`;
  } else if (address) {
    // Affichage par adresse
    const q = encodeURIComponent(address);
    src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${q}&zoom=${zoom}`;
  } else {
    // Aucun data de localisation
    return (
      <div className={`rounded-lg border p-4 bg-gray-50 ${className}`}>
        <p className="text-sm text-gray-600">Localisation non renseignée.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden border ${className}`} style={{ height }}>
      <iframe
        title="Carte Google Maps - Localisation de l'événement"
        src={src}
        width="100%"
        height="100%"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ border: 0 }}
        allowFullScreen
      />
      {/* Lien itinéraire rapide */}
      <div className="p-2 text-right bg-white border-t">
        <a
          className="underline text-xs text-primary hover:text-primary/80 transition-colors"
          href={
            typeof lat === "number" && typeof lon === "number"
              ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
              : address
              ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
              : "#"
          }
          target="_blank"
          rel="noreferrer"
        >
          Itinéraire →
        </a>
      </div>
    </div>
  );
}