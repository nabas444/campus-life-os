import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Notif = Database["public"]["Tables"]["notifications"]["Row"];

const Notifications = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setItems((data ?? []) as Notif[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("notif-page")
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

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-primary">Notifications</h1>
            <p className="text-sm text-muted-foreground">{items.length} total</p>
          </div>
          {items.some((i) => !i.read) && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <Check className="h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center">
            <BellOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((n) => {
              const Wrapper = n.link ? Link : "div";
              return (
                <Wrapper
                  key={n.id}
                  to={n.link ?? "#"}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`block rounded-lg border p-4 transition-base ${
                    n.read
                      ? "border-border bg-card"
                      : "border-accent/30 bg-accent-soft/40 hover:bg-accent-soft/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                        n.read ? "bg-secondary text-muted-foreground" : "bg-accent text-accent-foreground"
                      }`}
                    >
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{n.title}</div>
                      {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    {!n.read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                  </div>
                </Wrapper>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Notifications;
