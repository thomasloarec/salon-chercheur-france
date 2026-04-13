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
import {
  LayoutDashboard,
  Calendar,
  FileSearch,
  Sparkles,
  Star,
  BookOpen,
  Building2,
  ClipboardList,
  Search,
  BarChart3,
  Bot,
  TestTube,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const navSections = [
  {
    label: null,
    items: [
      { title: 'Vue d\'ensemble', url: '/admin', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'CONTENU',
    items: [
      { title: 'Liste & import', url: '/admin/events', icon: Calendar },
      { title: 'Enrichissement SEO', url: '/admin/events/seo', icon: FileSearch },
      { title: 'Diagnostics', url: '/admin/events/diagnostics', icon: Search },
      { title: 'Modération', url: '/admin/novelties', icon: Star },
      { title: 'Blog & Articles', url: '/admin/blog', icon: BookOpen },
    ],
  },
  {
    label: 'ENTREPRISES',
    items: [
      { title: 'Entreprises exposantes', url: '/admin/exhibitors', icon: Building2 },
      { title: 'Demandes de gestion', url: '/admin/exhibitors/claims', icon: ClipboardList },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { title: 'Audit SEO', url: '/admin/seo-audit', icon: BarChart3 },
      { title: 'IA Visite', url: '/admin/ia-visite', icon: Sparkles },
    ],
  },
  {
    label: 'SYSTÈME',
    items: [
      { title: 'Enrichissement IA', url: '/admin/system/ai', icon: Bot },
      { title: 'Données de test', url: '/admin/system/test', icon: TestTube },
      { title: 'Outils & Export', url: '/admin/system/tools', icon: Wrench },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  const isActive = (url: string, end?: boolean) => {
    if (end) return location.pathname === url;
    return location.pathname === url || location.pathname.startsWith(url + '/');
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3">
        <Link to="/admin" className="flex items-center gap-2">
          {!collapsed && (
            <>
              <span className="font-bold text-lg">Lotexpo</span>
              <Badge variant="secondary" className="text-xs">Admin</Badge>
            </>
          )}
          {collapsed && <span className="font-bold text-lg">L</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {navSections.map((section, i) => (
          <SidebarGroup key={i}>
            {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url, (item as any).end)}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
