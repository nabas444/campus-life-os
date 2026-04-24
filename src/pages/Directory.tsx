import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Search, MessageCircle, Home, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Member = {
  user_id: string;
  room_number: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  presence_state: string | null;
};

const presenceTone: Record<string, string> = {
  free: "bg-success",
  busy: "bg-destructive",
  studying: "bg-info",
  away: "bg-warning",
  offline: "bg-muted-foreground/40",
};

const Directory = () => {
  const { user, primaryDormId, dorms } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!primaryDormId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const { data: memberRows } = await supabase
        .from("dorm_members")
        .select("user_id, room_number")
        .eq("dorm_id", primaryDormId);

      const ids = (memberRows ?? []).map((m) => m.user_id);
      if (ids.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const [{ data: profiles }, { data: presence }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, bio")
          .in("user_id", ids),
        supabase
          .from("presence_status")
          .select("user_id, state")
          .in("user_id", ids),
      ]);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const presenceMap = new Map((presence ?? []).map((p: any) => [p.user_id, p.state]));

      const merged: Member[] = (memberRows ?? []).map((m) => {
        const p: any = profileMap.get(m.user_id) ?? {};
        return {
          user_id: m.user_id,
          room_number: m.room_number,
          full_name: p.full_name ?? null,
          avatar_url: p.avatar_url ?? null,
          bio: p.bio ?? null,
          presence_state: presenceMap.get(m.user_id) ?? null,
        };
      });

      // Sort: self first, then by name
      merged.sort((a, b) => {
        if (a.user_id === user?.id) return -1;
        if (b.user_id === user?.id) return 1;
        return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      });

      setMembers(merged);
      setLoading(false);
    };
    load();
  }, [primaryDormId, user?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.full_name ?? "").toLowerCase().includes(q) ||
        (m.room_number ?? "").toLowerCase().includes(q) ||
        (m.bio ?? "").toLowerCase().includes(q),
    );
  }, [members, query]);

  const startDM = async (otherId: string) => {
    if (!user || otherId === user.id) {
      navigate("/profile");
      return;
    }
    const [a, b] = [user.id, otherId].sort();
    const { data: existing } = await supabase
      .from("direct_threads")
      .select("id")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    if (existing) {
      navigate(`/chat/dm/${existing.id}`);
      return;
    }
    const { data: created, error } = await supabase
      .from("direct_threads")
      .insert({ user_a: a, user_b: b })
      .select("id")
      .single();
    if (error || !created) return;
    navigate(`/chat/dm/${created.id}`);
  };

  if (!primaryDormId) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-lg p-8 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="font-display text-2xl font-semibold text-primary">No directory yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">Join a dorm to see your co-residents.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary md:text-4xl">
            {dorms[0]?.dorm_name} directory<span className="text-accent">.</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "resident" : "residents"}
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, room, bio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm text-muted-foreground">No residents match that search.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const initials = (m.full_name || "??").slice(0, 2).toUpperCase();
            const isMe = m.user_id === user?.id;
            return (
              <Card key={m.user_id} className="p-5 transition-base hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="h-14 w-14 border border-border">
                      {m.avatar_url ? (
                        <AvatarImage src={m.avatar_url} alt={m.full_name ?? ""} />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {initials}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    {m.presence_state && (
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background ${
                          presenceTone[m.presence_state] ?? presenceTone.offline
                        }`}
                        title={m.presence_state}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-display font-semibold text-primary">
                        {m.full_name || "Unnamed"}
                      </div>
                      {isMe && (
                        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
                          You
                        </span>
                      )}
                    </div>
                    {m.room_number && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Home className="h-3 w-3" /> Room {m.room_number}
                      </div>
                    )}
                  </div>
                </div>

                {m.bio && (
                  <p className="mt-3 line-clamp-3 text-sm text-foreground/80">{m.bio}</p>
                )}

                <div className="mt-4 flex gap-2">
                  {isMe ? (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/profile")}>
                      Edit profile
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => startDM(m.user_id)}>
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
};

export default Directory;
