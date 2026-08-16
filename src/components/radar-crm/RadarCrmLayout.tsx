import React from 'react';
import { Outlet } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RadarCrmSidebar } from './RadarCrmSidebar';

const RadarCrmLayout: React.FC = () => (
  <MainLayout title="Mon Radar CRM | Lotexpo">
    <SidebarProvider>
      <div className="flex w-full min-h-[60vh]">
        <RadarCrmSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b bg-background px-4 shrink-0 gap-3">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">Radar CRM</span>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  </MainLayout>
);

export default RadarCrmLayout;
