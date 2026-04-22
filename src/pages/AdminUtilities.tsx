import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, Loader2, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  KIND_LABEL,
  SEVERITY_TONE,
  STATUS_TONE,
  durationLabel,
  type Outage,
  type OutageReport,
  type OutageSeverity,
  type UtilityCategory,
  type UtilityKind,
} from "@/lib/outageUtils";

const KINDS: UtilityKind[] = [
  "electricity",
  "water",
  "internet",
  "gas",
  "heating",
  "security",
  "equipment",
  "other",
];

const AdminUtilities = () => {
  const { user, primaryDormId, isAdmin } = useAuth();
  const [categories, setCategories] = useState<UtilityCategory[]>([]);
  const [outages, setOutages] = useState<Outage[]>([]);
  const [reports, setReports] = useState<OutageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    if (!primaryDormId) return;
    const [{ data: cats }, { data: out }, { data: reps }] = await Promise.all([
      supabase.from("utility_categories").select("*").eq("dorm_id", primaryDormId).order("name"),
      supabase
        .from("outages")
        .select("*")
        .eq("dorm_id", primaryDormId)
        .order("started_at", { ascending: false })
        .limit(100),
      supabase
        .from("outage_reports")
        .select("*")
        .eq("dorm_id", primaryDormId)
        .is("outage_id", null)
        .order("reported_at", { ascending: false })
        .limit(50),
    ]);
    setCategories((cats ?? []) as UtilityCategory[]);
    setOutages((out ?? []) as Outage[]);
    setReports((reps ?? []) as OutageReport[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!primaryDormId) return;
    const ch = supabase
      .channel(`admin-utilities-${primaryDormId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outages", filter: `dorm_id=eq.${primaryDormId}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outage_reports", filter: `dorm_id=eq.${primaryDormId}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "utility_categories", filter: `dorm_id=eq.${primaryDormId}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryDormId]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  if (!primaryDormId) {
    return (
      <AppShell>
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Join a dorm to manage utilities.
        </Card>
      </AppShell>
    );
  }

  const addCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("utility_categories").insert({
      dorm_id: primaryDormId,
      name: (fd.get("name") as string).trim(),
      kind: fd.get("kind") as UtilityKind,
      description: ((fd.get("description") as string) || "").trim() || null,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Category added");
    setAddOpen(false);
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category and all its outage history?")) return;
    const { error } = await supabase.from("utility_categories").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const confirmReport = async (rep: OutageReport, severity: OutageSeverity) => {
    if (!user) return;
    // Check for existing active outage in this category
    const existing = outages.find(
      (o) => o.category_id === rep.category_id && (o.status === "reported" || o.status === "confirmed"),
    );
    let outageId = existing?.id;
    if (!existing) {
      const { data, error } = await supabase
        .from("outages")
        .insert({
          dorm_id: rep.dorm_id,
          category_id: rep.category_id,
          status: "confirmed",
          severity,
          summary: rep.note,
          created_by: user.id,
        })
        .select()
        .single();
      if (error || !data) {
        toast.error(error?.message ?? "Could not confirm");
        return;
      }
      outageId = data.id;
    } else if (existing.status !== "confirmed") {
      await supabase.from("outages").update({ status: "confirmed", severity }).eq("id", existing.id);
    }
    await supabase.from("outage_reports").update({ outage_id: outageId }).eq("id", rep.id);
    toast.success("Outage confirmed — dorm notified");
  };

  const dismissReport = async (rep: OutageReport) => {
    const { error } = await supabase.from("outage_reports").delete().eq("id", rep.id);
    if (error) toast.error(error.message);
  };

  const resolveOutage = async (o: Outage) => {
    const { error } = await supabase.from("outages").update({ status: "resolved" }).eq("id", o.id);
    if (error) toast.error(error.message);
    else toast.success("Marked as restored");
  };

  const activeOutages = outages.filter((o) => o.status === "confirmed" || o.status === "reported");

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/utilities">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Manage utilities</h1>
          <p className="text-sm text-muted-foreground">
            Confirm outages, track restorations, and curate trackable categories.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pending reports */}
          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <h2 className="font-display text-lg font-semibold text-primary">Pending reports</h2>
              {reports.length > 0 && <Badge>{reports.length}</Badge>}
            </div>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unhandled reports.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => {
                  const cat = categories.find((c) => c.id === r.category_id);
                  return (
                    <div key={r.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{cat?.name ?? "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(r.reported_at).toLocaleString()}
                          </div>
                          {r.note && <p className="mt-1 text-sm text-foreground/80">{r.note}</p>}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Select onValueChange={(v) => confirmReport(r, v as OutageSeverity)}>
                          <SelectTrigger className="h-8 w-[160px]">
                            <SelectValue placeholder="Confirm as..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minor">Minor</SelectItem>
                            <SelectItem value="partial">Partial outage</SelectItem>
                            <SelectItem value="major">Major outage</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => dismissReport(r)}>
                          <X className="h-3.5 w-3.5" /> Dismiss
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Active outages */}
          <Card className="p-6">
            <h2 className="mb-3 font-display text-lg font-semibold text-primary">Active outages</h2>
            {activeOutages.length === 0 ? (
              <p className="text-sm text-muted-foreground">All clear.</p>
            ) : (
              <div className="space-y-2">
                {activeOutages.map((o) => {
                  const cat = categories.find((c) => c.id === o.category_id);
                  return (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cat?.name ?? "Unknown"}</span>
                          <Badge variant="outline" className={STATUS_TONE[o.status]}>
                            {o.status}
                          </Badge>
                          <Badge className={SEVERITY_TONE[o.severity]}>{o.severity}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Started {new Date(o.started_at).toLocaleString()} · {durationLabel(o.started_at)}
                        </div>
                      </div>
                      <Button size="sm" variant="soft" onClick={() => resolveOutage(o)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Restored
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Categories */}
          <Card className="p-6 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-primary">Trackable items</h2>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="hero">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">New trackable item</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={addCategory} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="e.g. Front door lock, 4F windows, Laundry locker"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="kind">Type</Label>
                      <Select name="kind" defaultValue="equipment">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {KINDS.map((k) => (
                            <SelectItem key={k} value={k}>
                              {KIND_LABEL[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="description">Description (optional)</Label>
                      <Textarea id="description" name="description" rows={2} />
                    </div>
                    <DialogFooter>
                      <Button type="submit" variant="hero">
                        Add
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{KIND_LABEL[c.kind]}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteCategory(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
};

export default AdminUtilities;
