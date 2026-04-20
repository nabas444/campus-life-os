import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Package, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { BorrowStatusBadge, TrustBadge, ITEM_CATEGORY_META } from "@/components/phase2/meta";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type Req = Database["public"]["Tables"]["borrow_requests"]["Row"] & {
  items: Database["public"]["Tables"]["items"]["Row"] | null;
};

const BorrowRequests = () => {
  const { user, primaryDormId } = useAuth();
  const [outgoing, setOutgoing] = useState<Req[]>([]);
  const [incoming, setIncoming] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [trust, setTrust] = useState<{ score: number; total: number }>({ score: 0, total: 0 });

  const load = async () => {
    if (!user || !primaryDormId) return;

    const [out, inc, trustData] = await Promise.all([
      supabase
        .from("borrow_requests")
        .select("*, items(*)")
        .eq("borrower_id", user.id)
        .order("created_at", { ascending: false }),
      // Incoming: items I own
      supabase
        .from("borrow_requests")
        .select("*, items!inner(*)")
        .eq("items.owner_id", user.id)
        .neq("borrower_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("user_trust_stats").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    setOutgoing((out.data ?? []) as Req[]);
    setIncoming((inc.data ?? []) as Req[]);

    if (trustData.data) {
      const total = trustData.data.total_borrows ?? 0;
      const onTime = trustData.data.on_time_returns ?? 0;
      setTrust({ score: total > 0 ? onTime / total : 1, total });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user, primaryDormId]);

  const updateStatus = async (id: string, status: Database["public"]["Enums"]["borrow_status"]) => {
    const updates: any = { status };
    if (status === "borrowed") updates.borrowed_at = new Date().toISOString();
    if (status === "returned") updates.returned_at = new Date().toISOString();
    const { error } = await supabase.from("borrow_requests").update(updates).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Updated");
    load();
  };

  if (!primaryDormId) {
    return (
      <AppShell>
        <Card className="p-8 text-center">Join a dorm first.</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Borrow activity</h1>
          <p className="text-sm text-muted-foreground">Your requests and items lent to others</p>
        </div>
        <div className="flex items-center gap-3">
          <TrustBadge score={trust.score} total={trust.total} />
          <Button asChild variant="outline">
            <Link to="/borrow">Browse items</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="outgoing">
          <TabsList>
            <TabsTrigger value="outgoing">
              <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" /> I'm borrowing ({outgoing.length})
            </TabsTrigger>
            <TabsTrigger value="incoming">
              <ArrowUpFromLine className="mr-1.5 h-3.5 w-3.5" /> Lending out ({incoming.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="outgoing" className="mt-4">
            {outgoing.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-3">
                {outgoing.map((r) => (
                  <RequestRow
                    key={r.id}
                    req={r}
                    role="borrower"
                    onAction={updateStatus}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="incoming" className="mt-4">
            {incoming.length === 0 ? (
              <EmptyState message="No one's asked to borrow your items yet." />
            ) : (
              <div className="space-y-3">
                {incoming.map((r) => (
                  <RequestRow key={r.id} req={r} role="owner" onAction={updateStatus} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
};

const RequestRow = ({
  req,
  role,
  onAction,
}: {
  req: Req;
  role: "borrower" | "owner";
  onAction: (id: string, status: Database["public"]["Enums"]["borrow_status"]) => void;
}) => {
  const Icon = req.items ? ITEM_CATEGORY_META[req.items.category].Icon : Package;
  const isOverdue =
    req.status === "borrowed" && new Date(req.requested_until) < new Date();
  const displayStatus = isOverdue ? "overdue" : req.status;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-secondary">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-display text-lg font-semibold text-primary">
                {req.items?.name ?? "Item"}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(req.requested_from), "MMM d")} →{" "}
                {format(new Date(req.requested_until), "MMM d")}
                <span className="ml-2">· requested {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</span>
              </div>
            </div>
            <BorrowStatusBadge status={displayStatus} />
          </div>
          {req.notes && (
            <p className="mt-2 rounded-md bg-secondary/40 p-2 text-sm text-muted-foreground">{req.notes}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {role === "owner" && req.status === "requested" && (
              <>
                <Button size="sm" variant="accent" onClick={() => onAction(req.id, "approved")}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAction(req.id, "denied")}>
                  <XCircle className="h-3.5 w-3.5" /> Deny
                </Button>
              </>
            )}
            {role === "owner" && req.status === "approved" && (
              <Button size="sm" variant="accent" onClick={() => onAction(req.id, "borrowed")}>
                Mark as handed over
              </Button>
            )}
            {role === "owner" && (req.status === "borrowed" || isOverdue) && (
              <Button size="sm" variant="accent" onClick={() => onAction(req.id, "returned")}>
                <RotateCcw className="h-3.5 w-3.5" /> Mark returned
              </Button>
            )}
            {role === "borrower" && req.status === "requested" && (
              <Button size="sm" variant="outline" onClick={() => onAction(req.id, "cancelled")}>
                Cancel request
              </Button>
            )}
            {role === "borrower" && (req.status === "borrowed" || isOverdue) && (
              <Button size="sm" variant="accent" onClick={() => onAction(req.id, "returned")}>
                <RotateCcw className="h-3.5 w-3.5" /> Mark returned
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

const EmptyState = ({ message = "No activity yet." }: { message?: string }) => (
  <Card className="p-12 text-center">
    <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">{message}</p>
  </Card>
);

export default BorrowRequests;
