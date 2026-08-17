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
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';

export function RadarCrmSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { ongoingEvents, loading, matchedCompanies, futureGroups, pastGroups } = useRadarWorkspace();
  const live = ongoingEvents[0] ?? null;

  const onResults = location.pathname === '/radar-crm/results';

  const overviewActive = onResults;
  const terrainActive = location.pathname.startsWith('/radar-crm/terrain/');
  const hubActive = location.pathname === '/radar-crm/mode-salon';
  const settingsActive = location.pathname === '/radar-crm/equipe';

  const Count: React.FC<{ n: number }> = ({ n }) => (
    <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{n}</span>
  );

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
                <SidebarMenuButton asChild isActive={location.pathname === '/radar-crm/comptes'}>
                  <Link to="/radar-crm/comptes" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {!collapsed && <><span className="flex-1">Mes comptes</span><Count n={matchedCompanies.length} /></>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/radar-crm/salons'}>
                  <Link to="/radar-crm/salons" className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {!collapsed && <><span className="flex-1">Salons à venir</span><Count n={futureGroups.length} /></>}
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
                <SidebarMenuButton asChild isActive={terrainActive || hubActive}>
                  <Link
                    to={live ? '/radar-crm/terrain/' + live.event_id : '/radar-crm/mode-salon'}
                    className="flex items-center gap-2"
                  >
                    <Radar className="h-4 w-4" />
                    {!collapsed && (
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">Mode Salon</span>
                        {live?.nom_event && (
                          <span className="block text-[11px] text-muted-foreground truncate">{live.nom_event}</span>
                        )}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>APRÈS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/radar-crm/passes'}>
                  <Link to="/radar-crm/passes" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    {!collapsed && <><span className="flex-1">Salons passés</span><Count n={pastGroups.length} /></>}
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
                  <Link to="/radar-crm/equipe" className="flex items-center gap-2">
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
