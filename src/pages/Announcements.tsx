import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Megaphone, Pin, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Announcement = {
  id: string;
  dorm_id: string;
  author_id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  created_at: string;
  author_name?: string | null;
};

const Announcements = () => {
  const { user, isAdmin, primaryDormId, dorms } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!primaryDormId) return;
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .eq("dorm_id", primaryDormId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Announcement[];

    // Author names
    const authorIds = [...new Set(list.map((a) => a.author_id))];
    if (authorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", authorIds);
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
      list.forEach((a) => (a.author_name = map.get(a.author_id) ?? null));
    }

    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!primaryDormId) return;
    const channel = supabase
      .channel(`announcements-${primaryDormId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements", filter: `dorm_id=eq.${primaryDormId}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryDormId]);

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string).trim();
    const body = (fd.get("body") as string).trim();
    const pinned = fd.get("pinned") === "on";
    if (!title || !user || !primaryDormId) return;
    const { error } = await supabase.from("announcements").insert({
      dorm_id: primaryDormId,
      author_id: user.id,
      title,
      body: body || null,
      pinned,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Announcement posted");
    setOpen(false);
    load();
  };

  const togglePin = async (a: Announcement) => {
    await supabase.from("announcements").update({ pinned: !a.pinned }).eq("id", a.id);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    await supabase.from("announcements").delete().eq("id", id);
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Announcements</h1>
          <p className="text-sm text-muted-foreground">{dorms[0]?.dorm_name ?? "Your dorm"}</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="h-4 w-4" /> New post
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">New announcement</DialogTitle>
              </DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" required maxLength={120} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="body">Message</Label>
                  <Textarea id="body" name="body" rows={4} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="pinned" name="pinned" />
                  <Label htmlFor="pinned" className="cursor-pointer">
                    Pin to top
                  </Label>
                </div>
                <DialogFooter>
                  <Button type="submit" variant="hero">
                    Post
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card
              key={a.id}
              className={cn(
                "p-5 transition-base",
                a.pinned && "border-accent/40 bg-accent/5",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Pin className="h-3.5 w-3.5 text-accent" />}
                    <h3 className="font-display text-lg font-semibold text-primary">{a.title}</h3>
                  </div>
                  {a.body && <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground/80">{a.body}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {a.author_name ?? "Admin"} ·{" "}
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" onClick={() => togglePin(a)}>
                      <Pin className={cn("h-4 w-4", a.pinned && "fill-accent text-accent")} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
};

export default Announcements;
