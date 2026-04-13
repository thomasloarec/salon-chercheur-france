import React from 'react';

const AdminSystemToolsPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Outils & Export</h1>

      {/* Contrôle qualité */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Contrôle qualité</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
            <span className="text-red-800">Événements sans image</span>
            <span className="font-semibold text-red-600">0</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
            <span className="text-orange-800">Événements sans URL officielle</span>
            <span className="font-semibold text-orange-600">0</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
            <span className="text-yellow-800">Événements sans exposants</span>
            <span className="font-semibold text-yellow-600">0</span>
          </div>
        </div>
      </div>

      {/* Outils admin */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Outils d'administration</h3>
        <div className="flex flex-wrap gap-3">
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
            Exporter CSV (tous les événements)
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors">
            Générer rapport mensuel
          </button>
          <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors">
            Nettoyer les données obsolètes
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSystemToolsPage;
