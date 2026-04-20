import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, Loader2, CheckCircle2 } from "lucide-react";

type Status = Database["public"]["Enums"]["issue_status"];
type Category = Database["public"]["Enums"]["issue_category"];
type Priority = Database["public"]["Enums"]["issue_priority"];

export const StatusBadge = ({ status }: { status: Status }) => {
  const map: Record<Status, { label: string; cls: string; Icon: typeof Clock }> = {
    pending: { label: "Pending", cls: "bg-info/15 text-info border-info/20", Icon: Clock },
    in_progress: { label: "In Progress", cls: "bg-warning/15 text-warning border-warning/30", Icon: Loader2 },
    resolved: { label: "Resolved", cls: "bg-success/15 text-success border-success/20", Icon: CheckCircle2 },
  };
  const { label, cls, Icon } = map[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 border font-medium", cls)}>
      <Icon className={cn("h-3 w-3", status === "in_progress" && "animate-spin")} />
      {label}
    </Badge>
  );
};

export const CategoryBadge = ({ category }: { category: Category }) => {
  const labels: Record<Category, string> = {
    utilities: "Utilities",
    maintenance: "Maintenance",
    noise: "Noise",
    security: "Security",
    other: "Other",
  };
  return (
    <Badge variant="secondary" className="font-medium">
      {labels[category]}
    </Badge>
  );
};

export const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const map: Record<Priority, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-info/15 text-info",
    high: "bg-warning/15 text-warning",
    urgent: "bg-destructive/15 text-destructive",
  };
  return <Badge className={cn("border-0 font-medium capitalize", map[priority])}>{priority}</Badge>;
};

export const CATEGORY_OPTIONS: { value: Category; label: string; description: string }[] = [
  { value: "utilities", label: "Utilities", description: "Water, electricity, internet, AC" },
  { value: "maintenance", label: "Maintenance", description: "Furniture, plumbing, cleanliness, pests" },
  { value: "noise", label: "Noise & Social", description: "Disturbances, conflicts" },
  { value: "security", label: "Security & Safety", description: "Locks, suspicious activity, emergencies" },
  { value: "other", label: "Other", description: "Anything else" },
];

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];
