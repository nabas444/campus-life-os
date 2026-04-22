import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplet,
  Loader2,
  Plus,
  ShieldAlert,
  Wifi,
  Zap,
  Activity,
  Wrench,
  Flame,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  KIND_LABEL,
  SEVERITY_TONE,
  STATUS_TONE,
  computeStats,
  durationLabel,
  formatHour,
  type Outage,
  type OutageReport,
  type UtilityCategory,
  type UtilityKind,
} from "@/lib/outageUtils";

const KIND_ICON: Record<UtilityKind, typeof Zap> = {
  electricity: Zap,
  water: Droplet,
  internet: Wifi,
  gas: Flame,
  heating: Flame,
  security: ShieldAlert,
  equipment: Wrench,
  other: Activity,
};

const Utilities = () => {
  const { user, primaryDormId, isAdmin } = useAuth();
  const [categories, setCategories] = useState<UtilityCategory[]>([]);
  const [outages, setOutages] = useState<Outage[]>([]);
  const [reports, setReports] = useState<OutageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportFor, setReportFor] = useState<UtilityCategory | null>(null);

  useEffect(() => {
    if (!primaryDormId) return;
    let cancelled = false;
    const load = async () => {
      const [{ data: cats }, { data: out }, { data: reps }] = await Promise.all([
        supabase
          .from("utility_categories")
          .select("*")
          .eq("dorm_id", primaryDormId)
          .eq("is_active", true)
          .order("name"),
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
          .order("reported_at", { ascending: false })
          .limit(50),
      ]);
      if (cancelled) return;
      setCategories((cats ?? []) as UtilityCategory[]);
      setOutages((out ?? []) as Outage[]);
      setReports((reps ?? []) as OutageReport[]);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel(`utilities-${primaryDormId}`)
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
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [primaryDormId]);

  const submitReport = async (note: string) => {
    if (!user || !primaryDormId || !reportFor) return;
    const { error } = await supabase.from("outage_reports").insert({
      dorm_id: primaryDormId,
      category_id: reportFor.id,
      reporter_id: user.id,
      note: note.trim() || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report submitted — admins notified");
    setReportFor(null);
  };

  if (!primaryDormId) {
    return (
      <AppShell>
        <Card className="p-12 text-center">
          <p className="text-sm text-muted-foreground">Join a dorm first to track utilities.</p>
        </Card>
      </AppShell>
    );
  }

  const activeOutages = outages.filter((o) => o.status === "confirmed");
  const recentReports24h = reports.filter(
    (r) => new Date(r.reported_at).getTime() > Date.now() - 24 * 3600_000,
  );

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Utilities</h1>
          <p className="text-sm text-muted-foreground">
            Live status of dorm services and equipment. Tap a card to report a problem.
          </p>
        </div>
        {isAdmin && (
          <Button variant="hero" asChild>
            <Link to="/admin/utilities">Manage</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Status grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => {
              const active = activeOutages.find((o) => o.category_id === cat.id);
              const reportsForCat = recentReports24h.filter((r) => r.category_id === cat.id);
              const Icon = KIND_ICON[cat.kind];
              return (
                <Card
                  key={cat.id}
                  className={`relative overflow-hidden p-5 transition-base ${
                    active ? "border-destructive/40" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-md ${
                          active ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-display font-semibold text-foreground">{cat.name}</div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {KIND_LABEL[cat.kind]}
                        </div>
                      </div>
                    </div>
                    {active ? (
                      <Badge className={SEVERITY_TONE[active.severity]}>{active.severity}</Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">
                        OK
                      </Badge>
                    )}
                  </div>

                  {active ? (
                    <div className="mt-3 rounded-md bg-destructive/5 p-3 text-sm">
                      <div className="flex items-center gap-1.5 font-medium text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Outage · {durationLabel(active.started_at)}
                      </div>
                      {active.summary && (
                        <p className="mt-1 text-xs text-muted-foreground">{active.summary}</p>
                      )}
                    </div>
                  ) : reportsForCat.length > 0 ? (
                    <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
                      {reportsForCat.length} report{reportsForCat.length > 1 ? "s" : ""} in the last 24h —
                      awaiting admin confirmation.
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">All systems normal.</p>
                  )}

                  <Button
                    size="sm"
                    variant={active ? "outline" : "soft"}
                    className="mt-4 w-full"
                    onClick={() => setReportFor(cat)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Report a problem
                  </Button>
                </Card>
              );
            })}

            {categories.length === 0 && (
              <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
                No utility categories yet.
                {isAdmin && (
                  <>
                    {" "}
                    <Link to="/admin/utilities" className="text-primary underline">
                      Add some
                    </Link>
                    .
                  </>
                )}
              </Card>
            )}
          </div>

          {/* Pattern stats */}
          <PatternsSection categories={categories} outages={outages} />

          {/* Recent timeline */}
          <Card className="mt-6 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold text-primary">Outage timeline</h2>
            </div>
            {outages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outages recorded yet — that's a good thing.</p>
            ) : (
              <div className="space-y-2">
                {outages.slice(0, 20).map((o) => {
                  const cat = categories.find((c) => c.id === o.category_id);
                  return (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cat?.name ?? "Unknown"}</span>
                          <Badge variant="outline" className={STATUS_TONE[o.status]}>
                            {o.status}
                          </Badge>
                          {o.status !== "resolved" && o.status !== "dismissed" && (
                            <Badge className={SEVERITY_TONE[o.severity]}>{o.severity}</Badge>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(o.started_at).toLocaleString()} ·{" "}
                          {durationLabel(o.started_at, o.ended_at)}
                          {o.ended_at && (
                            <span className="ml-1 inline-flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> restored
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      <Dialog open={!!reportFor} onOpenChange={(o) => !o && setReportFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Report: {reportFor?.name}</DialogTitle>
          </DialogHeader>
          <ReportForm onSubmit={submitReport} />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

const ReportForm = ({ onSubmit }: { onSubmit: (note: string) => Promise<void> }) => {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        await onSubmit(note);
        setSubmitting(false);
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="note">What's happening? (optional)</Label>
        <Textarea
          id="note"
          rows={3}
          placeholder="e.g. No power on the 3rd floor since 9pm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="submit" variant="hero" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit report
        </Button>
      </DialogFooter>
    </form>
  );
};

const PatternsSection = ({
  categories,
  outages,
}: {
  categories: UtilityCategory[];
  outages: Outage[];
}) => {
  const insights = useMemo(() => {
    return categories
      .map((c) => {
        const list = outages.filter((o) => o.category_id === c.id);
        return { cat: c, stats: computeStats(list) };
      })
      .filter((x) => x.stats.total > 0)
      .sort((a, b) => b.stats.total - a.stats.total);
  }, [categories, outages]);

  if (insights.length === 0) return null;

  return (
    <Card className="mt-6 p-6">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-accent" />
        <h2 className="font-display text-lg font-semibold text-primary">Patterns</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {insights.slice(0, 4).map(({ cat, stats }) => (
          <div key={cat.id} className="rounded-md border border-border bg-secondary/30 p-4">
            <div className="font-medium">{cat.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {stats.total} outage{stats.total > 1 ? "s" : ""} on record · {stats.last7} in last 7 days
            </div>
            {stats.peakCount >= 2 && (
              <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                💡 Often goes down around <strong>{formatHour(stats.peakHour)}</strong>
              </div>
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              Avg duration: <span className="font-medium text-foreground">{stats.avgDuration}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default Utilities;
