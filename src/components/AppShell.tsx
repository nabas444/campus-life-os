import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GraduationCap, LayoutDashboard, AlertCircle, Building2, LogOut, Bell, Plus, Package, CalendarRange, Activity, MessagesSquare, Megaphone, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { user, signOut, isAdmin, dorms } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setUnread(count ?? 0);
    };
    load();
    const channel = supabase
      .channel("notif-shell")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/feed", label: "Activity", icon: Activity },
    { to: "/chat", label: "Chat", icon: MessagesSquare },
    { to: "/issues", label: "Issues", icon: AlertCircle },
    { to: "/announcements", label: "News", icon: Megaphone },
    { to: "/utilities", label: "Utilities", icon: Zap },
    { to: "/borrow", label: "Borrow", icon: Package },
    { to: "/resources", label: "Resources", icon: CalendarRange },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Building2 }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-parchment">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-2.5 transition-base hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-hero shadow-md">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold text-primary">Campus Life</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">OS</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-base",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/70 hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="accent" onClick={() => navigate("/issues/new")} className="hidden sm:inline-flex">
              <Plus className="h-4 w-4" />
              Report
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/notifications")}
              className="relative"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <Badge className="absolute -right-0.5 -top-0.5 h-5 min-w-5 justify-center rounded-full bg-accent px-1.5 text-[10px] text-accent-foreground">
                  {unread > 9 ? "9+" : unread}
                </Badge>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-9 w-9 border-2 border-primary/10">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{user?.email}</div>
                  {dorms[0] && (
                    <div className="text-xs text-muted-foreground">
                      {dorms[0].dorm_name}
                      {dorms[0].room_number ? ` · Room ${dorms[0].room_number}` : ""}
                    </div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {nav.map((item) => (
                  <DropdownMenuItem key={item.to} onClick={() => navigate(item.to)} className="md:hidden">
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="md:hidden" />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container py-8 animate-fade-in">{children}</main>
    </div>
  );
};
