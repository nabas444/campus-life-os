import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Hash, Loader2, MessagesSquare, Plus, Send, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Channel = {
  id: string;
  name: string;
  description: string | null;
  kind: "dorm_default" | "topic";
};

type Thread = {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string;
  other_id: string;
  other_name: string | null;
};

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_name?: string | null;
};

const Chat = () => {
  const { user, primaryDormId } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const targetType = params.type as "channel" | "dm" | undefined;
  const targetId = params.id;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [newChanOpen, setNewChanOpen] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load sidebar (channels + threads + members)
  useEffect(() => {
    if (!primaryDormId || !user) return;

    const loadSidebar = async () => {
      const [{ data: chans }, { data: thrs }, { data: mems }] = await Promise.all([
        supabase
          .from("chat_channels")
          .select("id, name, description, kind")
          .eq("dorm_id", primaryDormId)
          .order("kind", { ascending: true })
          .order("name"),
        supabase
          .from("direct_threads")
          .select("id, user_a, user_b, last_message_at")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .order("last_message_at", { ascending: false }),
        supabase.from("dorm_members").select("user_id").eq("dorm_id", primaryDormId),
      ]);

      setChannels((chans ?? []) as Channel[]);

      const memberIds = (mems ?? []).map((m: any) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", memberIds);
      const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
      setMembers(memberIds.filter((id) => id !== user.id).map((id) => ({ user_id: id, full_name: profMap.get(id) ?? null })));

      setThreads(
        (thrs ?? []).map((t: any) => {
          const other_id = t.user_a === user.id ? t.user_b : t.user_a;
          return { ...t, other_id, other_name: profMap.get(other_id) ?? null };
        }),
      );

      // Auto-open first channel
      if (!targetType && chans && chans.length > 0) {
        navigate(`/chat/channel/${chans[0].id}`, { replace: true });
      }
    };
    loadSidebar();

    // Realtime sidebar updates
    const ch = supabase
      .channel(`chat-sidebar-${primaryDormId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_channels", filter: `dorm_id=eq.${primaryDormId}` }, loadSidebar)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_threads" }, loadSidebar)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryDormId, user]);

  // Load messages for current target
  useEffect(() => {
    if (!targetId || !targetType) {
      setMessages([]);
      return;
    }
    const loadMsgs = async () => {
      const filter = targetType === "channel" ? "channel_id" : "thread_id";
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_id, body, created_at")
        .eq(filter, targetId)
        .order("created_at", { ascending: true })
        .limit(200);
      const list = (data ?? []) as Message[];
      const senderIds = [...new Set(list.map((m) => m.sender_id))];
      if (senderIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", senderIds);
        const map = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
        list.forEach((m) => (m.sender_name = map.get(m.sender_id) ?? null));
      }
      setMessages(list);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    };
    loadMsgs();

    const ch = supabase
      .channel(`chat-msgs-${targetId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `${targetType === "channel" ? "channel_id" : "thread_id"}=eq.${targetId}`,
        },
        loadMsgs,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [targetId, targetType]);

  const send = async () => {
    if (!body.trim() || !user || !targetId || !targetType) return;
    setSending(true);
    const payload: any = { sender_id: user.id, body: body.trim() };
    if (targetType === "channel") payload.channel_id = targetId;
    else payload.thread_id = targetId;
    const { error } = await supabase.from("chat_messages").insert(payload);
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
  };

  const createChannel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = ((fd.get("name") as string) ?? "").trim().toLowerCase().replace(/\s+/g, "-");
    const description = (fd.get("description") as string)?.trim() || null;
    if (!name || !user || !primaryDormId) return;
    const { data, error } = await supabase
      .from("chat_channels")
      .insert({ dorm_id: primaryDormId, name, description, kind: "topic", created_by: user.id })
      .select()
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Could not create");
      return;
    }
    setNewChanOpen(false);
    navigate(`/chat/channel/${data.id}`);
  };

  const startDm = async (otherId: string) => {
    if (!user) return;
    const a = user.id < otherId ? user.id : otherId;
    const b = user.id < otherId ? otherId : user.id;
    // Try find existing
    const { data: existing } = await supabase
      .from("direct_threads")
      .select("id")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    let threadId = existing?.id;
    if (!threadId) {
      const { data, error } = await supabase
        .from("direct_threads")
        .insert({ user_a: a, user_b: b })
        .select()
        .single();
      if (error || !data) {
        toast.error(error?.message ?? "Could not start chat");
        return;
      }
      threadId = data.id;
    }
    setNewDmOpen(false);
    navigate(`/chat/dm/${threadId}`);
  };

  const currentChannel = channels.find((c) => c.id === targetId);
  const currentThread = threads.find((t) => t.id === targetId);
  const currentTitle = currentChannel
    ? `# ${currentChannel.name}`
    : currentThread
    ? currentThread.other_name ?? "Direct message"
    : "Chat";

  return (
    <AppShell>
      <div className="grid h-[calc(100vh-12rem)] gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <Card className="flex flex-col overflow-hidden">
          <div className="border-b border-border p-4">
            <h1 className="font-display text-xl font-semibold text-primary">Chat</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="mb-1 flex items-center justify-between px-2 pt-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Channels
              </span>
              <Dialog open={newChanOpen} onOpenChange={setNewChanOpen}>
                <DialogTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">New topic channel</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={createChannel} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" name="name" placeholder="study-group" required maxLength={32} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="description">Description (optional)</Label>
                      <Input id="description" name="description" maxLength={120} />
                    </div>
                    <DialogFooter>
                      <Button type="submit" variant="hero">
                        Create
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {channels.map((c) => (
              <SidebarItem
                key={c.id}
                active={targetType === "channel" && targetId === c.id}
                onClick={() => navigate(`/chat/channel/${c.id}`)}
                icon={<Hash className="h-3.5 w-3.5" />}
                label={c.name}
                meta={c.kind === "dorm_default" ? "default" : undefined}
              />
            ))}

            <div className="mb-1 mt-4 flex items-center justify-between px-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Direct messages
              </span>
              <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
                <DialogTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">Start a direct message</DialogTitle>
                  </DialogHeader>
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {members.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">No co-members yet.</p>
                    ) : (
                      members.map((m) => (
                        <button
                          key={m.user_id}
                          onClick={() => startDm(m.user_id)}
                          className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-base hover:bg-secondary"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                              {(m.full_name ?? "U").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{m.full_name ?? "Unnamed"}</span>
                        </button>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {threads.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">No DMs yet.</p>
            ) : (
              threads.map((t) => (
                <SidebarItem
                  key={t.id}
                  active={targetType === "dm" && targetId === t.id}
                  onClick={() => navigate(`/chat/dm/${t.id}`)}
                  icon={
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-primary text-[9px] text-primary-foreground">
                        {(t.other_name ?? "U").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  }
                  label={t.other_name ?? "Unnamed"}
                />
              ))
            )}
          </div>
        </Card>

        {/* Conversation */}
        <Card className="flex flex-col overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              {currentChannel ? (
                <Hash className="h-4 w-4 text-muted-foreground" />
              ) : currentThread ? (
                <MessagesSquare className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Users className="h-4 w-4 text-muted-foreground" />
              )}
              <h2 className="font-display font-semibold text-primary">{currentTitle}</h2>
              {currentChannel?.kind === "dorm_default" && (
                <Badge className="bg-accent/15 text-accent hover:bg-accent/15">default</Badge>
              )}
            </div>
            {currentChannel?.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{currentChannel.description}</p>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5">
            {!targetId ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Pick a channel or DM to start
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No messages yet. Say hi 👋
              </div>
            ) : (
              <ul className="space-y-3">
                {messages.map((m) => (
                  <MessageRow key={m.id} m={m} mine={m.sender_id === user?.id} />
                ))}
              </ul>
            )}
          </div>

          {targetId && (
            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <Textarea
                  rows={1}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Write a message…"
                  className="min-h-10 resize-none"
                />
                <Button onClick={send} disabled={sending || !body.trim()} variant="hero" size="icon">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

const SidebarItem = ({
  active,
  onClick,
  icon,
  label,
  meta,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  meta?: string;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-base",
      active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-secondary",
    )}
  >
    {icon}
    <span className="flex-1 truncate">{label}</span>
    {meta && (
      <span className={cn("text-[9px] uppercase tracking-wider", active ? "opacity-70" : "text-muted-foreground")}>
        {meta}
      </span>
    )}
  </button>
);

const MessageRow = ({ m, mine }: { m: Message; mine: boolean }) => (
  <li className={cn("flex gap-3", mine && "flex-row-reverse")}>
    <Avatar className="h-8 w-8 shrink-0">
      <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
        {(m.sender_name ?? "U").slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
    <div className={cn("max-w-[75%]", mine && "items-end text-right")}>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium">{mine ? "You" : m.sender_name ?? "Unnamed"}</span>
        <span>· {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
      </div>
      <div
        className={cn(
          "mt-1 inline-block rounded-2xl px-3.5 py-2 text-sm",
          mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap">{m.body}</p>
      </div>
    </div>
  </li>
);

export default Chat;
