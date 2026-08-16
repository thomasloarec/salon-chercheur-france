import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { LayoutDashboard, Building2, CalendarDays, Radar, History, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRadarLiveEvent } from '@/hooks/useRadarLiveEvent';

export function RadarCrmSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { data: live, isLoading: liveLoading } = useRadarLiveEvent();

  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');
  const panel = params.get('panel');
  const onResults = location.pathname === '/radar-crm/results';

  const overviewActive = onResults && !tab && !panel;
  const tabActive = (t: string) => onResults && tab === t;
  const terrainActive = location.pathname.startsWith('/radar-crm/terrain/');
  const settingsActive = onResults && panel === 'settings';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3">
        <Link to="/radar-crm/results" className="flex items-center gap-2">
          {!collapsed ? (
            <>
              <span className="font-bold text-lg">Lotexpo</span>
              <Badge variant="secondary" className="text-xs">Radar</Badge>
            </>
          ) : (
            <span className="font-bold text-lg">L</span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={overviewActive}>
                  <Link to="/radar-crm/results" className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    {!collapsed && <span className="flex-1">Vue d'ensemble</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>PRÉPARER</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={tabActive('companies')}>
                  <Link to="/radar-crm/results?tab=companies" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {!collapsed && <span className="flex-1">Mes comptes</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={tabActive('future')}>
                  <Link to="/radar-crm/results?tab=future" className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {!collapsed && <span className="flex-1">Salons à venir</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>PENDANT LE SALON</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {live ? (
                  <SidebarMenuButton asChild isActive={terrainActive}>
                    <Link to={'/radar-crm/terrain/' + live.eventId} className="flex items-center gap-2">
                      <Radar className="h-4 w-4" />
                      {!collapsed && (
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">Mode Salon</span>
                          {live.nomEvent && (
                            <span className="block text-[11px] text-muted-foreground truncate">{live.nomEvent}</span>
                          )}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    disabled
                    className="opacity-50 cursor-not-allowed"
                    title={liveLoading ? undefined : 'Aucun salon en cours aujourd\u2019hui'}
                  >
                    <Radar className="h-4 w-4" />
                    {!collapsed && <span className="flex-1">Mode Salon</span>}
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>APRÈS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={tabActive('past')}>
                  <Link to="/radar-crm/results?tab=past" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    {!collapsed && <span className="flex-1">Salons passés</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>MON ESPACE</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={settingsActive}>
                  <Link to="/radar-crm/results?panel=settings" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {!collapsed && <span className="flex-1">Espace et équipe</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
