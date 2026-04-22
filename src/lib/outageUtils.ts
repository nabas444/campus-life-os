import type { Database } from "@/integrations/supabase/types";

export type UtilityCategory = Database["public"]["Tables"]["utility_categories"]["Row"];
export type Outage = Database["public"]["Tables"]["outages"]["Row"];
export type OutageReport = Database["public"]["Tables"]["outage_reports"]["Row"];
export type UtilityKind = Database["public"]["Enums"]["utility_kind"];
export type OutageStatus = Database["public"]["Enums"]["outage_status"];
export type OutageSeverity = Database["public"]["Enums"]["outage_severity"];

export const KIND_LABEL: Record<UtilityKind, string> = {
  electricity: "Electricity",
  water: "Water",
  internet: "Internet",
  gas: "Gas",
  heating: "Heating",
  security: "Security",
  equipment: "Equipment",
  other: "Other",
};

export const STATUS_TONE: Record<OutageStatus, string> = {
  reported: "bg-amber-100 text-amber-900 border-amber-300",
  confirmed: "bg-destructive/15 text-destructive border-destructive/40",
  resolved: "bg-emerald-100 text-emerald-900 border-emerald-300",
  dismissed: "bg-muted text-muted-foreground border-border",
};

export const SEVERITY_TONE: Record<OutageSeverity, string> = {
  minor: "bg-secondary text-foreground",
  partial: "bg-amber-100 text-amber-900",
  major: "bg-destructive/15 text-destructive",
};

export function durationLabel(start: string, end?: string | null): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

/** Simple stats: total outages, total downtime, avg duration, most common hour. */
export function computeStats(outages: Outage[]) {
  const finished = outages.filter((o) => o.ended_at);
  const totalMs = finished.reduce(
    (s, o) => s + (new Date(o.ended_at!).getTime() - new Date(o.started_at).getTime()),
    0,
  );
  const avgMs = finished.length ? totalMs / finished.length : 0;

  const hours: number[] = Array(24).fill(0);
  outages.forEach((o) => {
    const h = new Date(o.started_at).getHours();
    hours[h] += 1;
  });
  const peakHour = hours.indexOf(Math.max(...hours));
  const peakCount = hours[peakHour];

  return {
    total: outages.length,
    totalDowntime: durationLabel(new Date(Date.now() - totalMs).toISOString()),
    avgDuration: avgMs ? durationLabel(new Date(Date.now() - avgMs).toISOString()) : "—",
    peakHour,
    peakCount,
    last7: outages.filter((o) => new Date(o.started_at).getTime() > Date.now() - 7 * 24 * 3600_000).length,
  };
}

export function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr} ${period}`;
}
