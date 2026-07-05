import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, Users, Store, ShoppingCart, BarChart3, ArrowLeft, Megaphone, MessageSquare } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { adminGetAttentionCounts } from "@/lib/chat.functions";
import { UnreadBadge } from "@/components/unread-badge";

const items = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard, exact: true },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Stores", url: "/admin/stores", icon: Store },
  { title: "Orders", url: "/admin/orders", icon: ShoppingCart },
  { title: "Conversations", url: "/admin/conversations", icon: MessageSquare },
  { title: "Broadcasts", url: "/admin/broadcasts", icon: Megaphone },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
];

function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const getAttention = useServerFn(adminGetAttentionCounts);
  const [flagged, setFlagged] = useState(0);
  const refresh = useCallback(async () => {
    try { const d = await getAttention(); setFlagged(d.flagged ?? 0); } catch { /* ignore */ }
  }, [getAttention]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const ch = supabase
      .channel("admin-attention")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, () => { void refresh(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, () => { void refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-3 font-serif text-base">Admin</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url, it.exact)} tooltip={it.title}>
                    <Link to={it.url}>
                      <it.icon className="h-4 w-4" />
                      <span>{it.title}</span>
                      {it.url === "/admin/conversations" && <UnreadBadge count={flagged} className="ml-auto" />}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Back to site">
                  <Link to="/">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to site</span>
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

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-12 items-center gap-2 border-b bg-background px-2">
            <SidebarTrigger />
            <span className="text-sm font-medium">Admin panel</span>
          </header>
          <main className="flex-1 overflow-x-auto p-4 sm:p-6">{children ?? <Outlet />}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
