import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { AlertCircle, CalendarRange, Megaphone, Package, Sparkles, Pin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PresenceWidget } from "@/components/phase3/PresenceWidget";
import { cn } from "@/lib/utils";

type FeedItem = {
  id: string;
  kind: "issue" | "announcement" | "borrow" | "booking";
  title: string;
  subtitle?: string;
  href: string;
  at: string;
  pinned?: boolean;
};

const Feed = () => {
  const { primaryDormId, dorms } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [freeCount, setFreeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!primaryDormId) {
      setLoading(false);
      return;
    }

    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString();

    const [issuesRes, annRes, borrowsRes, bookingsRes, presRes, membersRes] = await Promise.all([
      supabase
        .from("issues")
        .select("id, title, status, created_at, updated_at")
        .eq("dorm_id", primaryDormId)
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("announcements")
        .select("id, title, body, created_at, pinned")
        .eq("dorm_id", primaryDormId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("borrow_requests")
        .select("id, status, created_at, item_id, items(name)")
        .eq("dorm_id", primaryDormId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("resource_bookings")
        .select("id, starts_at, created_at, resource_id, resources(name)")
        .eq("dorm_id", primaryDormId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase.from("presence_status").select("user_id, state").eq("state", "free"),
      supabase.from("dorm_members").select("user_id").eq("dorm_id", primaryDormId),
    ]);

    const memberIds = new Set((membersRes.data ?? []).map((m: any) => m.user_id));
    const free = (presRes.data ?? []).filter((p: any) => memberIds.has(p.user_id));
    setFreeCount(free.length);

    const merged: FeedItem[] = [];

    (issuesRes.data ?? []).forEach((i: any) =>
      merged.push({
        id: `issue-${i.id}`,
        kind: "issue",
        title: i.title,
        subtitle: `Status: ${i.status}`,
        href: `/issues/${i.id}`,
        at: i.updated_at ?? i.created_at,
      }),
    );
    (annRes.data ?? []).forEach((a: any) =>
      merged.push({
        id: `ann-${a.id}`,
        kind: "announcement",
        title: a.title,
        subtitle: a.body?.slice(0, 100),
        href: `/announcements`,
        at: a.created_at,
        pinned: a.pinned,
      }),
    );
    (borrowsRes.data ?? []).forEach((b: any) =>
      merged.push({
        id: `borrow-${b.id}`,
        kind: "borrow",
        title: `${b.items?.name ?? "Item"} — ${b.status}`,
        href: `/borrow/requests`,
        at: b.created_at,
      }),
    );
    (bookingsRes.data ?? []).forEach((b: any) =>
      merged.push({
        id: `booking-${b.id}`,
        kind: "booking",
        title: `${b.resources?.name ?? "Resource"} booked`,
        subtitle: new Date(b.starts_at).toLocaleString(),
        href: `/resources/${b.resource_id}`,
        at: b.created_at,
      }),
    );

    // Pinned announcements first, then by date
    merged.sort((a, b) => {
      if ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) !== 0) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

    setItems(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!primaryDormId) return;
    const channel = supabase
      .channel(`feed-${primaryDormId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements", filter: `dorm_id=eq.${primaryDormId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "issues", filter: `dorm_id=eq.${primaryDormId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "presence_status" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryDormId]);

  const grouped = useMemo(() => items, [items]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-primary">Activity</h1>
        <p className="text-sm text-muted-foreground">{dorms[0]?.dorm_name ?? "Your dorm"} · what's happening</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3">
          {freeCount > 0 && (
            <Card className="border-success/30 bg-success/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-success/15 text-success">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{freeCount} co-member{freeCount > 1 ? "s are" : " is"} free now</div>
                  <p className="text-xs text-muted-foreground">Tap their card on the right to see what they're up to.</p>
                </div>
              </div>
            </Card>
          )}

          {loading ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">Loading…</Card>
          ) : grouped.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">Nothing's happening yet. 🌿</Card>
          ) : (
            grouped.map((item) => <FeedRow key={item.id} item={item} />)
          )}
        </div>

        <div className="lg:col-span-2">
          {primaryDormId && <PresenceWidget dormId={primaryDormId} />}
        </div>
      </div>
    </AppShell>
  );
};

const KIND_META = {
  issue: { icon: AlertCircle, tone: "bg-warning/15 text-warning", label: "Issue" },
  announcement: { icon: Megaphone, tone: "bg-accent/15 text-accent", label: "Announcement" },
  borrow: { icon: Package, tone: "bg-info/15 text-info", label: "Borrow" },
  booking: { icon: CalendarRange, tone: "bg-primary/10 text-primary", label: "Booking" },
} as const;

const FeedRow = ({ item }: { item: FeedItem }) => {
  const meta = KIND_META[item.kind];
  return (
    <Link
      to={item.href}
      className={cn(
        "block rounded-lg border border-border bg-card p-4 transition-base hover:border-primary/30 hover:shadow-sm",
        item.pinned && "border-accent/40 bg-accent/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", meta.tone)}>
          <meta.icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {meta.label}
            </Badge>
            {item.pinned && (
              <Badge className="bg-accent/15 text-accent text-[10px] hover:bg-accent/15">
                <Pin className="mr-1 h-2.5 w-2.5" /> pinned
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
            </span>
          </div>
          <div className="mt-1 truncate font-medium">{item.title}</div>
          {item.subtitle && <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</div>}
        </div>
      </div>
    </Link>
  );
};

export default Feed;
