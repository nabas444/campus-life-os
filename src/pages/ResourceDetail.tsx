import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Calendar as CalendarIcon, Loader2, Trash2 } from "lucide-react";
import { format, isSameDay, addMinutes, startOfDay, isBefore } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RESOURCE_CATEGORY_META } from "@/components/phase2/meta";
import type { Database } from "@/integrations/supabase/types";

type Resource = Database["public"]["Tables"]["resources"]["Row"];
type Booking = Database["public"]["Tables"]["resource_bookings"]["Row"];

const ResourceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, primaryDormId, isAdmin } = useAuth();
  const [resource, setResource] = useState<Resource | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data: r } = await supabase.from("resources").select("*").eq("id", id).maybeSingle();
    setResource(r as Resource | null);
    if (!r) {
      setLoading(false);
      return;
    }
    const dayStart = startOfDay(date);
    const dayEnd = addMinutes(dayStart, 24 * 60);
    const { data: b } = await supabase
      .from("resource_bookings")
      .select("*")
      .eq("resource_id", id)
      .eq("status", "confirmed")
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at");
    setBookings((b ?? []) as Booking[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`resource-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resource_bookings", filter: `resource_id=eq.${id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, date]);

  const slots = useMemo(() => {
    if (!resource) return [];
    const out: { start: Date; isBooked: boolean; isMine: boolean; bookingId?: string; isPast: boolean }[] = [];
    const day = startOfDay(date);
    const slotMin = resource.default_slot_minutes;
    const total = ((resource.close_hour - resource.open_hour) * 60) / slotMin;
    const now = new Date();
    for (let i = 0; i < total; i++) {
      const start = addMinutes(addMinutes(day, resource.open_hour * 60), i * slotMin);
      const end = addMinutes(start, slotMin);
      const overlap = bookings.find(
        (b) => new Date(b.starts_at) < end && new Date(b.ends_at) > start,
      );
      out.push({
        start,
        isBooked: !!overlap,
        isMine: overlap?.user_id === user?.id,
        bookingId: overlap?.id,
        isPast: isBefore(start, now),
      });
    }
    return out;
  }, [resource, bookings, date, user]);

  const book = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !resource || !primaryDormId || !selectedSlot) return;
    const fd = new FormData(e.currentTarget);
    const ends = addMinutes(selectedSlot, duration);
    setSubmitting(true);
    const { error } = await supabase.from("resource_bookings").insert({
      resource_id: resource.id,
      user_id: user.id,
      dorm_id: primaryDormId,
      starts_at: selectedSlot.toISOString(),
      ends_at: ends.toISOString(),
      purpose: ((fd.get("purpose") as string) || "").trim() || null,
      status: "confirmed",
    });
    setSubmitting(false);
    if (error) {
      // The trigger raises 23505 on overlap
      if (error.code === "23505" || error.message.toLowerCase().includes("already booked")) {
        toast.error("That slot just got booked. Try another.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Booked!");
    setSelectedSlot(null);
    load();
  };

  const cancelBooking = async (bookingId: string) => {
    const { error } = await supabase
      .from("resource_bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cancelled");
    load();
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

  if (!resource) {
    return (
      <AppShell>
        <Card className="p-8 text-center">Resource not found.</Card>
      </AppShell>
    );
  }

  const meta = RESOURCE_CATEGORY_META[resource.category];
  const Icon = meta.Icon;
  const maxSlots = Math.floor(resource.max_booking_minutes / resource.default_slot_minutes);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground">
            <Icon className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-3xl font-semibold text-primary">{resource.name}</h1>
            <p className="text-sm text-muted-foreground">
              {meta.label} · open {String(resource.open_hour).padStart(2, "0")}:00–
              {String(resource.close_hour).padStart(2, "0")}:00 · capacity {resource.capacity}
            </p>
            {resource.description && (
              <p className="mt-2 text-sm text-muted-foreground">{resource.description}</p>
            )}
          </div>
        </div>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-primary">Availability</h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, "EEE, MMM d")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={(d) => d < startOfDay(new Date())}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Slot grid */}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {slots.map((s) => {
              const label = format(s.start, "HH:mm");
              if (s.isPast && !isSameDay(s.start, date) === false && s.isPast) {
                return (
                  <div
                    key={s.start.toISOString()}
                    className="rounded-md border border-dashed border-border p-2 text-center text-xs text-muted-foreground/50"
                  >
                    {label}
                  </div>
                );
              }
              if (s.isBooked) {
                return (
                  <div
                    key={s.start.toISOString()}
                    className={cn(
                      "rounded-md border p-2 text-center text-xs font-medium",
                      s.isMine
                        ? "border-accent/40 bg-accent-soft text-accent"
                        : "border-border bg-secondary text-muted-foreground",
                    )}
                    title={s.isMine ? "Your booking" : "Booked"}
                  >
                    {label}
                    <div className="text-[9px] uppercase tracking-wider">{s.isMine ? "yours" : "booked"}</div>
                    {s.isMine && s.bookingId && (
                      <button
                        onClick={() => cancelBooking(s.bookingId!)}
                        className="mt-1 text-[9px] text-destructive hover:underline"
                      >
                        cancel
                      </button>
                    )}
                  </div>
                );
              }
              return (
                <button
                  key={s.start.toISOString()}
                  onClick={() => {
                    setSelectedSlot(s.start);
                    setDuration(resource.default_slot_minutes);
                  }}
                  className="rounded-md border border-border bg-background p-2 text-center text-xs font-medium transition-base hover:border-accent hover:bg-accent-soft hover:text-accent"
                >
                  {label}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Tap any open slot to book. Max {resource.max_booking_minutes / 60}h per booking.
          </p>
        </Card>

        {/* Booking dialog */}
        <Dialog open={!!selectedSlot} onOpenChange={(o) => !o && setSelectedSlot(null)}>
          <DialogContent>
            {selectedSlot && (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display">Book {resource.name}</DialogTitle>
                  <DialogDescription>
                    {format(selectedSlot, "EEEE, MMM d 'at' HH:mm")}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={book} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Duration</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: maxSlots }, (_, i) => (i + 1) * resource.default_slot_minutes).map(
                        (mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setDuration(mins)}
                            className={cn(
                              "rounded-md border p-2 text-sm font-medium transition-base",
                              duration === mins
                                ? "border-accent bg-accent text-accent-foreground"
                                : "border-border hover:border-accent",
                            )}
                          >
                            {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="purpose">Purpose (optional)</Label>
                    <Input id="purpose" name="purpose" placeholder="e.g. Group study" />
                  </div>
                  <div className="rounded-md bg-secondary/40 p-3 text-sm">
                    <strong>{format(selectedSlot, "HH:mm")}</strong> →{" "}
                    <strong>{format(addMinutes(selectedSlot, duration), "HH:mm")}</strong>
                  </div>
                  <DialogFooter>
                    <Button type="submit" variant="hero" disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Confirm booking
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
};

export default ResourceDetail;
