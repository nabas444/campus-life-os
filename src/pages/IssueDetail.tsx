import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, MapPin, Trash2 } from "lucide-react";
import { StatusBadge, CategoryBadge, PriorityBadge } from "@/components/issues/issueMeta";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Issue = Database["public"]["Tables"]["issues"]["Row"];
type Status = Database["public"]["Enums"]["issue_status"];
type Attachment = Database["public"]["Tables"]["issue_attachments"]["Row"];

const IssueDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [reporterName, setReporterName] = useState<string>("Member");
  const [attachments, setAttachments] = useState<(Attachment & { url: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: i } = await supabase.from("issues").select("*").eq("id", id).maybeSingle();
      if (!i) {
        setLoading(false);
        return;
      }
      setIssue(i as Issue);

      const [{ data: prof }, { data: atts }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", i.reporter_id).maybeSingle(),
        supabase.from("issue_attachments").select("*").eq("issue_id", id),
      ]);
      if (prof?.full_name) setReporterName(prof.full_name);

      const withUrls = await Promise.all(
        (atts ?? []).map(async (a) => {
          const { data } = await supabase.storage
            .from("issue-attachments")
            .createSignedUrl(a.storage_path, 60 * 60);
          return { ...a, url: data?.signedUrl ?? "" };
        }),
      );
      setAttachments(withUrls);
      setLoading(false);
    };
    load();
  }, [id]);

  const updateStatus = async (status: Status) => {
    if (!issue) return;
    setUpdating(true);
    const { error } = await supabase.from("issues").update({ status }).eq("id", issue.id);
    setUpdating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setIssue({ ...issue, status });
    toast.success("Status updated");
  };

  const deleteIssue = async () => {
    if (!issue) return;
    if (!confirm("Delete this issue? This cannot be undone.")) return;
    const { error } = await supabase.from("issues").delete().eq("id", issue.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Issue deleted");
    navigate("/issues");
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!issue) {
    return (
      <AppShell>
        <Card className="p-8 text-center">
          <p>Issue not found.</p>
          <Button asChild className="mt-4" variant="ghost">
            <Link to="/issues">Back to issues</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  const canEdit = user?.id === issue.reporter_id || isAdmin;
  const canChangeStatus = isAdmin;
  const initials = reporterName.slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <Card className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={issue.category} />
              <PriorityBadge priority={issue.priority} />
              <StatusBadge status={issue.status} />
            </div>
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={deleteIssue} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold text-primary">{issue.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span>{reporterName}</span>
            </div>
            <span>·</span>
            <span>{format(new Date(issue.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
            {issue.location && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {issue.location}
                </span>
              </>
            )}
          </div>

          {issue.description && (
            <div className="mt-6 whitespace-pre-wrap rounded-lg bg-secondary/40 p-4 text-sm leading-relaxed">
              {issue.description}
            </div>
          )}

          {attachments.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Attachments</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square overflow-hidden rounded-md border border-border transition-base hover:opacity-80"
                  >
                    <img src={a.url} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {canChangeStatus && (
            <div className="mt-6 flex items-center gap-3 rounded-lg border border-dashed border-border bg-secondary/30 p-4">
              <span className="text-sm font-medium">Update status:</span>
              <Select value={issue.status} onValueChange={(v) => updateStatus(v as Status)} disabled={updating}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              {updating && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

export default IssueDetail;
