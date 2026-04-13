import React from 'react';
import NoveltyModeration from '@/components/admin/NoveltyModeration';

const AdminNoveltiesPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Modération des nouveautés</h1>
      <NoveltyModeration />
    </div>
  );
};

export default AdminNoveltiesPage;
