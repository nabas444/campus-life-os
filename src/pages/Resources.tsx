import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarRange, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { RESOURCE_CATEGORY_META } from "@/components/phase2/meta";
import type { Database } from "@/integrations/supabase/types";

type Resource = Database["public"]["Tables"]["resources"]["Row"];

const Resources = () => {
  const { primaryDormId, isAdmin } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!primaryDormId) return;
    supabase
      .from("resources")
      .select("*")
      .eq("dorm_id", primaryDormId)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        setResources((data ?? []) as Resource[]);
        setLoading(false);
      });
  }, [primaryDormId]);

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
          <h1 className="font-display text-3xl font-semibold text-primary">Shared resources</h1>
          <p className="text-sm text-muted-foreground">Book a slot — first come, first served</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/resources/my">My bookings</Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="hero">
              <Link to="/admin">
                <Plus className="h-4 w-4" /> Manage in admin
              </Link>
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : resources.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarRange className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No bookable resources yet.</p>
          {isAdmin && (
            <Button asChild className="mt-4" variant="hero">
              <Link to="/admin">Add the first one</Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => {
            const meta = RESOURCE_CATEGORY_META[r.category];
            const Icon = meta.Icon;
            return (
              <Link
                key={r.id}
                to={`/resources/${r.id}`}
                className="group block rounded-xl border border-border bg-card p-5 transition-base hover:border-primary/30 hover:shadow-md"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-hero text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg font-semibold text-primary">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{meta.label}</div>
                  </div>
                </div>
                {r.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
                )}
                <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {String(r.open_hour).padStart(2, "0")}:00–{String(r.close_hour).padStart(2, "0")}:00
                  </span>
                  <span>Cap: {r.capacity}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
};

export default Resources;
