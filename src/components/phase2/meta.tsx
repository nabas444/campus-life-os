import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Cpu,
  ChefHat,
  Sparkles,
  Wrench,
  BookOpen,
  Dumbbell,
  Gamepad2,
  Package,
  GraduationCap,
  Plug,
  Lock,
  Boxes,
} from "lucide-react";

type ItemCat = Database["public"]["Enums"]["item_category"];
type ResourceCat = Database["public"]["Enums"]["resource_category"];
type BorrowStatus = Database["public"]["Enums"]["borrow_status"];
type BookingStatus = Database["public"]["Enums"]["booking_status"];

export const ITEM_CATEGORY_META: Record<ItemCat, { label: string; Icon: typeof Cpu }> = {
  electronics: { label: "Electronics", Icon: Cpu },
  kitchen: { label: "Kitchen", Icon: ChefHat },
  cleaning: { label: "Cleaning", Icon: Sparkles },
  tools: { label: "Tools", Icon: Wrench },
  books: { label: "Books", Icon: BookOpen },
  sports: { label: "Sports", Icon: Dumbbell },
  games: { label: "Games", Icon: Gamepad2 },
  other: { label: "Other", Icon: Package },
};

export const RESOURCE_CATEGORY_META: Record<ResourceCat, { label: string; Icon: typeof Cpu }> = {
  study_room: { label: "Study room", Icon: GraduationCap },
  kitchen: { label: "Kitchen", Icon: ChefHat },
  laundry: { label: "Laundry", Icon: Sparkles },
  recreation: { label: "Recreation", Icon: Dumbbell },
  charging: { label: "Charging station", Icon: Plug },
  locker: { label: "Locker", Icon: Lock },
  equipment: { label: "Equipment", Icon: Boxes },
  other: { label: "Other", Icon: Package },
};

export const ITEM_CATEGORIES = Object.entries(ITEM_CATEGORY_META).map(([value, m]) => ({
  value: value as ItemCat,
  label: m.label,
}));

export const RESOURCE_CATEGORIES = Object.entries(RESOURCE_CATEGORY_META).map(([value, m]) => ({
  value: value as ResourceCat,
  label: m.label,
}));

export const BorrowStatusBadge = ({ status }: { status: BorrowStatus }) => {
  const map: Record<BorrowStatus, string> = {
    requested: "bg-info/15 text-info border-info/20",
    approved: "bg-success/15 text-success border-success/20",
    denied: "bg-destructive/15 text-destructive border-destructive/20",
    borrowed: "bg-warning/15 text-warning border-warning/30",
    returned: "bg-muted text-muted-foreground border-border",
    overdue: "bg-destructive/20 text-destructive border-destructive/30",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  const labels: Record<BorrowStatus, string> = {
    requested: "Requested",
    approved: "Approved",
    denied: "Denied",
    borrowed: "Borrowed",
    returned: "Returned",
    overdue: "Overdue",
    cancelled: "Cancelled",
  };
  return (
    <Badge variant="outline" className={cn("border font-medium", map[status])}>
      {labels[status]}
    </Badge>
  );
};

export const BookingStatusBadge = ({ status }: { status: BookingStatus }) => {
  const map: Record<BookingStatus, string> = {
    confirmed: "bg-success/15 text-success border-success/20",
    cancelled: "bg-muted text-muted-foreground border-border",
    completed: "bg-info/15 text-info border-info/20",
    no_show: "bg-destructive/15 text-destructive border-destructive/20",
  };
  return (
    <Badge variant="outline" className={cn("border font-medium capitalize", map[status])}>
      {status.replace("_", " ")}
    </Badge>
  );
};

export const TrustBadge = ({ score, total }: { score: number; total: number }) => {
  // score = on-time / total (0-1). total < 3 => "new"
  if (total < 3) {
    return (
      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
        🌱 New borrower
      </Badge>
    );
  }
  if (score >= 0.9) {
    return (
      <Badge className="bg-success/15 text-success border-success/30 border">
        ⭐ Trusted · {Math.round(score * 100)}%
      </Badge>
    );
  }
  if (score >= 0.7) {
    return (
      <Badge className="bg-info/15 text-info border-info/30 border">
        👍 Reliable · {Math.round(score * 100)}%
      </Badge>
    );
  }
  if (score >= 0.5) {
    return (
      <Badge className="bg-warning/15 text-warning border-warning/30 border">
        ⚠️ Mixed · {Math.round(score * 100)}%
      </Badge>
    );
  }
  return (
    <Badge className="bg-destructive/15 text-destructive border-destructive/30 border">
      🚩 Often late · {Math.round(score * 100)}%
    </Badge>
  );
};
