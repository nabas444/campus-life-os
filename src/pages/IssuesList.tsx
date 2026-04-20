import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2, Plus, Search, Filter } from "lucide-react";
import { StatusBadge, CategoryBadge, PriorityBadge, CATEGORY_OPTIONS } from "@/components/issues/issueMeta";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Issue = Database["public"]["Tables"]["issues"]["Row"];

const IssuesList = () => {
  const { user, primaryDormId } = useAuth();
  const [params] = useSearchParams();
  const onlyMine = params.get("mine") === "1";
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    if (!user || !primaryDormId) return;
    const load = async () => {
      let q = supabase
        .from("issues")
        .select("*")
        .eq("dorm_id", primaryDormId)
        .order("created_at", { ascending: false });
      if (onlyMine) q = q.eq("reporter_id", user.id);
      const { data } = await q;
      setIssues((data ?? []) as Issue[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("issues-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "issues", filter: `dorm_id=eq.${primaryDormId}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, primaryDormId, onlyMine]);

  const filtered = issues.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!primaryDormId) {
    return (
      <AppShell>
        <Card className="p-8 text-center">
          <p>Join a dorm to view issues.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {onlyMine ? "My reports" : "Issue board"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "issue" : "issues"}
          </p>
        </div>
        <Button asChild variant="hero">
          <Link to="/issues/new">
            <Plus className="h-4 w-4" /> Report
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-4 flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search issues…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No issues match your filters.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => (
            <Link
              key={i.id}
              to={`/issues/${i.id}`}
              className="group block rounded-lg border border-border bg-card p-4 transition-base hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <AlertCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-display text-lg font-semibold text-primary">{i.title}</div>
                    <StatusBadge status={i.status} />
                  </div>
                  {i.description && (
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{i.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <CategoryBadge category={i.category} />
                    <PriorityBadge priority={i.priority} />
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}</span>
                    {i.location && (
                      <>
                        <span>·</span>
                        <span>{i.location}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
};

export default IssuesList;
