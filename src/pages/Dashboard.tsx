import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock, Loader2, Plus, Bell, ArrowRight, Building2 } from "lucide-react";
import { StatusBadge, CategoryBadge } from "@/components/issues/issueMeta";
import { formatDistanceToNow } from "date-fns";

type IssueRow = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "resolved";
  category: "utilities" | "maintenance" | "noise" | "security" | "other";
  created_at: string;
  reporter_id: string;
};

const Dashboard = () => {
  const { user, dorms, primaryDormId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myIssues, setMyIssues] = useState<IssueRow[]>([]);
  const [dormIssues, setDormIssues] = useState<IssueRow[]>([]);
  const [counts, setCounts] = useState({ pending: 0, inProgress: 0, resolved: 0, unread: 0 });

  useEffect(() => {
    if (!user || !primaryDormId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const [mine, dorm, notif] = await Promise.all([
        supabase
          .from("issues")
          .select("id, title, status, category, created_at, reporter_id")
          .eq("reporter_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("issues")
          .select("id, title, status, category, created_at, reporter_id")
          .eq("dorm_id", primaryDormId)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false),
      ]);

      setMyIssues((mine.data ?? []) as IssueRow[]);
      setDormIssues((dorm.data ?? []) as IssueRow[]);

      const all = (dorm.data ?? []) as IssueRow[];
      setCounts({
        pending: all.filter((i) => i.status === "pending").length,
        inProgress: all.filter((i) => i.status === "in_progress").length,
        resolved: all.filter((i) => i.status === "resolved").length,
        unread: notif.count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, [user, primaryDormId]);

  if (!primaryDormId) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-lg p-8 text-center">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="font-display text-2xl font-semibold text-primary">Join a dorm to begin</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You need to be a member of a dorm to use Campus Life OS.
          </p>
          <Button asChild className="mt-6" variant="hero">
            <Link to="/onboarding/dorm">Enter invite code</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Welcome */}
      <div className="mb-8 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary md:text-4xl">
            Welcome back<span className="text-accent">.</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {dorms[0]?.dorm_name}
            {dorms[0]?.room_number ? ` · Room ${dorms[0].room_number}` : ""}
          </p>
        </div>
        <Button asChild variant="hero" className="self-start sm:hidden md:inline-flex">
          <Link to="/issues/new">
            <Plus className="h-4 w-4" /> Report an issue
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} label="Pending" value={counts.pending} tone="info" />
        <StatCard icon={Loader2} label="In progress" value={counts.inProgress} tone="warning" spin />
        <StatCard icon={CheckCircle2} label="Resolved" value={counts.resolved} tone="success" />
        <StatCard icon={Bell} label="Unread alerts" value={counts.unread} tone="accent" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* My issues */}
          <Card className="lg:col-span-2 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-primary">My issues</h2>
              <Link to="/issues?mine=1" className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            </div>
            {myIssues.length === 0 ? (
              <EmptyState message="You haven't reported anything yet." cta />
            ) : (
              <ul className="space-y-2">
                {myIssues.map((i) => (
                  <IssueItem key={i.id} issue={i} />
                ))}
              </ul>
            )}
          </Card>

          {/* Dorm feed */}
          <Card className="lg:col-span-3 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-primary">
                {dorms[0]?.dorm_name} · activity
              </h2>
              <Link to="/issues" className="text-xs font-medium text-accent hover:underline">
                Open issue board
              </Link>
            </div>
            {dormIssues.length === 0 ? (
              <EmptyState message="Your dorm is all clear. 🌿" />
            ) : (
              <ul className="space-y-2">
                {dormIssues.map((i) => (
                  <IssueItem key={i.id} issue={i} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  tone,
  spin,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  tone: "info" | "warning" | "success" | "accent";
  spin?: boolean;
}) => {
  const toneMap = {
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    accent: "bg-accent/10 text-accent",
  };
  return (
    <Card className="p-5 transition-base hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneMap[tone]}`}>
          <Icon className={`h-5 w-5 ${spin && value > 0 ? "animate-spin" : ""}`} />
        </div>
        <div className="text-right">
          <div className="font-display text-3xl font-semibold text-primary">{value}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
};

const IssueItem = ({ issue }: { issue: IssueRow }) => (
  <li>
    <Link
      to={`/issues/${issue.id}`}
      className="group flex items-center gap-3 rounded-lg border border-transparent p-3 transition-base hover:border-border hover:bg-secondary/40"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
        <AlertCircle className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{issue.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <CategoryBadge category={issue.category} />
          <span>{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
        </div>
      </div>
      <StatusBadge status={issue.status} />
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-base group-hover:opacity-100" />
    </Link>
  </li>
);

const EmptyState = ({ message, cta }: { message: string; cta?: boolean }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 py-10 text-center">
    <p className="text-sm text-muted-foreground">{message}</p>
    {cta && (
      <Button asChild size="sm" variant="accent" className="mt-4">
        <Link to="/issues/new">
          <Plus className="h-4 w-4" /> Report one
        </Link>
      </Button>
    )}
  </div>
);

export default Dashboard;
