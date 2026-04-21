import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookOpen, Coffee, Moon, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type State = "free" | "busy" | "studying" | "away" | "offline";

const STATES: { value: State; label: string; icon: any; tone: string }[] = [
  { value: "free", label: "Free", icon: Sparkles, tone: "bg-success/15 text-success border-success/30" },
  { value: "studying", label: "Studying", icon: BookOpen, tone: "bg-info/15 text-info border-info/30" },
  { value: "busy", label: "Busy", icon: Coffee, tone: "bg-warning/15 text-warning border-warning/30" },
  { value: "away", label: "Away", icon: Moon, tone: "bg-muted text-muted-foreground border-border" },
];

type Peer = {
  user_id: string;
  state: State;
  message: string | null;
  full_name: string | null;
  room_number: string | null;
};

export const PresenceWidget = ({ dormId }: { dormId: string }) => {
  const { user } = useAuth();
  const [myState, setMyState] = useState<State>("offline");
  const [myMessage, setMyMessage] = useState("");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPeers = async () => {
    // Get all members of this dorm
    const { data: members } = await supabase
      .from("dorm_members")
      .select("user_id, room_number")
      .eq("dorm_id", dormId);
    if (!members) return;

    const ids = members.map((m) => m.user_id);
    const [{ data: presences }, { data: profiles }] = await Promise.all([
      supabase.from("presence_status").select("user_id, state, message").in("user_id", ids),
      supabase.from("profiles").select("user_id, full_name").in("user_id", ids),
    ]);

    const presMap = new Map((presences ?? []).map((p: any) => [p.user_id, p]));
    const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
    const roomMap = new Map(members.map((m) => [m.user_id, m.room_number]));

    const list: Peer[] = ids
      .filter((id) => id !== user?.id)
      .map((id) => {
        const p = presMap.get(id) as any;
        return {
          user_id: id,
          state: (p?.state as State) ?? "offline",
          message: p?.message ?? null,
          full_name: profMap.get(id) ?? null,
          room_number: roomMap.get(id) ?? null,
        };
      })
      .sort((a, b) => stateOrder(a.state) - stateOrder(b.state));

    setPeers(list);

    if (user) {
      const mine = presMap.get(user.id) as any;
      if (mine) {
        setMyState(mine.state);
        setMyMessage(mine.message ?? "");
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user || !dormId) return;
    loadPeers();
    const channel = supabase
      .channel(`presence-${dormId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "presence_status" }, loadPeers)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dormId]);

  const updateStatus = async (state: State, message?: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("presence_status")
      .upsert({ user_id: user.id, state, message: message ?? myMessage ?? null }, { onConflict: "user_id" });
    if (error) {
      toast.error(error.message);
      return;
    }
    setMyState(state);
    toast.success(`You're now ${STATES.find((s) => s.value === state)?.label ?? state}`);
  };

  const clearStatus = async () => {
    if (!user) return;
    await supabase.from("presence_status").upsert({ user_id: user.id, state: "offline", message: null }, { onConflict: "user_id" });
    setMyState("offline");
    setMyMessage("");
  };

  const freeNow = peers.filter((p) => p.state === "free");

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-primary">Who's around</h2>
        {freeNow.length > 0 && (
          <Badge className="bg-success/15 text-success hover:bg-success/15">
            <Sparkles className="mr-1 h-3 w-3" />
            {freeNow.length} free now
          </Badge>
        )}
      </div>

      {/* Status setter */}
      <div className="mb-5 rounded-lg border border-border bg-secondary/30 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your status</div>
        <div className="flex flex-wrap gap-2">
          {STATES.map((s) => {
            const active = myState === s.value;
            return (
              <button
                key={s.value}
                onClick={() => updateStatus(s.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-base",
                  active ? s.tone : "border-border bg-background text-foreground/70 hover:bg-secondary",
                )}
              >
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
          {myState !== "offline" && (
            <button
              onClick={clearStatus}
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
            >
              <X className="h-3 w-3" /> clear
            </button>
          )}
        </div>
        {myState !== "offline" && (
          <Input
            placeholder="What's up? (optional)"
            value={myMessage}
            onChange={(e) => setMyMessage(e.target.value)}
            onBlur={() => updateStatus(myState, myMessage)}
            className="mt-3 h-9 text-sm"
            maxLength={80}
          />
        )}
      </div>

      {/* Peers list */}
      {loading ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
      ) : peers.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No co-members yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {peers.map((p) => {
            const meta = STATES.find((s) => s.value === p.state);
            const isOff = p.state === "offline";
            const initials = (p.full_name ?? "U").slice(0, 2).toUpperCase();
            return (
              <li
                key={p.user_id}
                className={cn(
                  "flex items-center gap-3 rounded-md p-2 transition-base",
                  !isOff && "bg-secondary/40",
                )}
              >
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                      p.state === "free" && "bg-success",
                      p.state === "studying" && "bg-info",
                      p.state === "busy" && "bg-warning",
                      p.state === "away" && "bg-muted-foreground",
                      p.state === "offline" && "bg-border",
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{p.full_name ?? "Unnamed"}</span>
                    {p.room_number && (
                      <span className="text-[11px] text-muted-foreground">· {p.room_number}</span>
                    )}
                  </div>
                  {p.message ? (
                    <p className="truncate text-xs text-muted-foreground">{p.message}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{meta?.label ?? "Offline"}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

const stateOrder = (s: State) =>
  s === "free" ? 0 : s === "studying" ? 1 : s === "busy" ? 2 : s === "away" ? 3 : 4;
