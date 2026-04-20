import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarRange, Loader2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { format, isPast } from "date-fns";
import { toast } from "sonner";
import { BookingStatusBadge, RESOURCE_CATEGORY_META } from "@/components/phase2/meta";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["resource_bookings"]["Row"] & {
  resources: Database["public"]["Tables"]["resources"]["Row"] | null;
};

const MyBookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("resource_bookings")
      .select("*, resources(*)")
      .eq("user_id", user.id)
      .order("starts_at", { ascending: false });
    setBookings((data ?? []) as Booking[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const cancel = async (id: string) => {
    const { error } = await supabase.from("resource_bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cancelled");
    load();
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">My bookings</h1>
          <p className="text-sm text-muted-foreground">Your reserved time slots</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/resources">Browse resources</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : bookings.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarRange className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const Icon = b.resources ? RESOURCE_CATEGORY_META[b.resources.category].Icon : CalendarRange;
            const past = isPast(new Date(b.ends_at));
            return (
              <Card key={b.id} className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/resources/${b.resource_id}`}
                    className="font-display text-lg font-semibold text-primary hover:underline"
                  >
                    {b.resources?.name ?? "Resource"}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(b.starts_at), "EEE, MMM d · HH:mm")} →{" "}
                    {format(new Date(b.ends_at), "HH:mm")}
                  </div>
                  {b.purpose && <div className="mt-1 text-sm">{b.purpose}</div>}
                </div>
                <BookingStatusBadge status={b.status} />
                {b.status === "confirmed" && !past && (
                  <Button variant="ghost" size="icon" onClick={() => cancel(b.id)} className="text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
};

export default MyBookings;
