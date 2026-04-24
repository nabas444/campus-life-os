import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, Copy, KeyRound, Loader2, Package, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type Dorm = Database["public"]["Tables"]["dorms"]["Row"];
type Invite = Database["public"]["Tables"]["dorm_invites"]["Row"];
type RepToken = Database["public"]["Tables"]["rep_tokens"]["Row"];

const Admin = () => {
  const { user, isAdmin, isSystemAdmin, dorms: myDorms, refresh } = useAuth();
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: d } = await supabase.from("dorms").select("*").order("created_at", { ascending: false });
      const dormList = (d ?? []) as Dorm[];
      setDorms(dormList);

      if (dormList.length > 0) {
        const ids = dormList.map((x) => x.id);
        const [{ data: inv }, { data: mems }] = await Promise.all([
          supabase.from("dorm_invites").select("*").in("dorm_id", ids).order("created_at", { ascending: false }),
          supabase.from("dorm_members").select("dorm_id").in("dorm_id", ids),
        ]);
        setInvites((inv ?? []) as Invite[]);
        const counts: Record<string, number> = {};
        (mems ?? []).forEach((m: any) => {
          counts[m.dorm_id] = (counts[m.dorm_id] ?? 0) + 1;
        });
        setMemberCounts(counts);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const generateCode = (prefix: string) => {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, "")}-${rand}`;
  };

  const createDorm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string).trim();
    if (!name || !user) return;
    const { data, error } = await supabase
      .from("dorms")
      .insert({
        name,
        address: (fd.get("address") as string)?.trim() || null,
        description: (fd.get("description") as string)?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Could not create");
      return;
    }
    // Add creator as dorm_admin member
    await supabase.from("dorm_members").insert({ user_id: user.id, dorm_id: data.id });
    await supabase.from("user_roles").insert({ user_id: user.id, role: "dorm_admin" }).select();
    toast.success("Dorm created");
    setCreateOpen(false);
    setDorms((prev) => [data as Dorm, ...prev]);
    refresh();
  };

  const createInvite = async (dorm: Dorm, role: "student" | "dorm_admin", maxUses: number | null) => {
    if (!user) return;
    const code = generateCode(dorm.name);
    const { data, error } = await supabase
      .from("dorm_invites")
      .insert({
        dorm_id: dorm.id,
        code,
        role_granted: role,
        max_uses: maxUses,
        created_by: user.id,
      })
      .select()
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Could not create invite");
      return;
    }
    setInvites((prev) => [data as Invite, ...prev]);
    toast.success("Invite created");
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  const visibleDorms = isSystemAdmin
    ? dorms
    : dorms.filter((d) => myDorms.some((md) => md.dorm_id === d.id));

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage dorms and invite codes
            {isSystemAdmin && <Badge className="ml-2 bg-accent text-accent-foreground">System Admin</Badge>}
          </p>
        </div>
        {isSystemAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="h-4 w-4" /> New dorm
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Create a dorm</DialogTitle>
              </DialogHeader>
              <form onSubmit={createDorm} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" placeholder="e.g. Sterling Hall" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Address (optional)</Label>
                  <Input id="address" name="address" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea id="description" name="description" rows={2} />
                </div>
                <DialogFooter>
                  <Button type="submit" variant="hero">
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : visibleDorms.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isSystemAdmin ? "No dorms yet. Create one to begin." : "You don't manage any dorms."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleDorms.map((dorm) => {
            const dormInvites = invites.filter((i) => i.dorm_id === dorm.id);
            return (
              <Card key={dorm.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-primary">{dorm.name}</h2>
                    {dorm.address && <p className="text-sm text-muted-foreground">{dorm.address}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs">
                    <Users className="h-3.5 w-3.5" />
                    {memberCounts[dorm.id] ?? 0}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Invite codes
                    </div>
                    <Dialog
                      open={inviteOpen === dorm.id}
                      onOpenChange={(o) => setInviteOpen(o ? dorm.id : null)}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" variant="soft">
                          <KeyRound className="h-3.5 w-3.5" /> New code
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="font-display">New invite for {dorm.name}</DialogTitle>
                        </DialogHeader>
                        <NewInviteForm
                          onCreate={async (role, maxUses) => {
                            await createInvite(dorm, role, maxUses);
                            setInviteOpen(null);
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                  {dormInvites.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      No active invite codes.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dormInvites.slice(0, 4).map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 p-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-sm font-semibold text-primary">{inv.code}</code>
                              {inv.role_granted !== "student" && (
                                <Badge variant="outline" className="border-accent/30 text-accent">
                                  {inv.role_granted}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {inv.uses_count} {inv.max_uses ? `/ ${inv.max_uses}` : ""} uses
                            </div>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => copyCode(inv.code)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isSystemAdmin && (
        <Card className="mt-6 border-dashed bg-secondary/30 p-5 text-sm">
          <p className="font-medium">💡 Quick start</p>
          <p className="mt-1 text-muted-foreground">
            Create a dorm, generate an invite code, and share it with students. They'll join automatically when they
            sign up and enter the code.
          </p>
        </Card>
      )}

      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-primary">Inventory & Resources</h3>
              <p className="text-sm text-muted-foreground">Manage items and shared spaces</p>
            </div>
          </div>
          <Button variant="hero" onClick={() => window.location.href = '/admin/inventory'}>
            Manage
          </Button>
        </div>
      </Card>
    </AppShell>
  );
};

const NewInviteForm = ({
  onCreate,
}: {
  onCreate: (role: "student" | "dorm_admin", maxUses: number | null) => Promise<void>;
}) => {
  const [role, setRole] = useState<"student" | "dorm_admin">("student");
  const [maxUses, setMaxUses] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        await onCreate(role, maxUses ? parseInt(maxUses, 10) : null);
        setSubmitting(false);
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label>Role granted</Label>
        <Select value={role} onValueChange={(v) => setRole(v as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="dorm_admin">Dorm admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="maxUses">Max uses (blank = unlimited)</Label>
        <Input
          id="maxUses"
          type="number"
          min={1}
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          placeholder="e.g. 50"
        />
      </div>
      <DialogFooter>
        <Button type="submit" variant="hero" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Generate
        </Button>
      </DialogFooter>
    </form>
  );
};

export default Admin;
