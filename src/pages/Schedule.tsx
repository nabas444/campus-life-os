import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { addDays, addWeeks, format, isSameDay, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { parseIcs, type ParsedEvent } from "@/lib/icsParser";

interface Course {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  instructor: string | null;
  color: string;
  created_at: string;
}

interface ClassSession {
  id: string;
  user_id: string;
  course_id: string;
  title: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  ics_uid: string | null;
  source: string;
}

const COURSE_COLORS = [
  { name: "blue", bg: "bg-info/15", border: "border-info/40", text: "text-info", dot: "bg-info" },
  { name: "amber", bg: "bg-warning/15", border: "border-warning/40", text: "text-warning", dot: "bg-warning" },
  { name: "emerald", bg: "bg-success/15", border: "border-success/40", text: "text-success", dot: "bg-success" },
  { name: "rose", bg: "bg-destructive/15", border: "border-destructive/40", text: "text-destructive", dot: "bg-destructive" },
  { name: "violet", bg: "bg-accent/15", border: "border-accent/40", text: "text-accent-foreground", dot: "bg-accent" },
  { name: "slate", bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", dot: "bg-primary" },
];

const colorClasses = (color: string) =>
  COURSE_COLORS.find((c) => c.name === color) ?? COURSE_COLORS[0];

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am – 22pm
const HOUR_HEIGHT = 56; // px

const Schedule = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "list">("week");
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [editSession, setEditSession] = useState<ClassSession | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const [coursesRes, sessionsRes] = await Promise.all([
        supabase
          .from("courses")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("class_sessions")
          .select("*")
          .order("starts_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setCourses((coursesRes.data ?? []) as Course[]);
      setSessions((sessionsRes.data ?? []) as ClassSession[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("schedule-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "courses", filter: `user_id=eq.${user.id}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_sessions", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const day of weekDays) {
      const key = format(day, "yyyy-MM-dd");
      map.set(
        key,
        sessions.filter((s) => isSameDay(new Date(s.starts_at), day)),
      );
    }
    return map;
  }, [sessions, weekDays]);

  const upcomingByDay = useMemo(() => {
    const now = new Date();
    const future = sessions.filter((s) => new Date(s.ends_at) > now);
    const groups = new Map<string, ClassSession[]>();
    for (const s of future.slice(0, 50)) {
      const key = format(new Date(s.starts_at), "yyyy-MM-dd");
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).slice(0, 14);
  }, [sessions]);

  const courseById = (id: string) => courses.find((c) => c.id === id);

  const todaysCount = useMemo(() => {
    const today = new Date();
    return sessions.filter((s) => isSameDay(new Date(s.starts_at), today)).length;
  }, [sessions]);

  const createCourse = async (
    name: string,
    code: string,
    instructor: string,
    color: string,
  ) => {
    if (!user) return;
    const { error } = await supabase.from("courses").insert({
      user_id: user.id,
      name: name.trim(),
      code: code.trim() || null,
      instructor: instructor.trim() || null,
      color,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Course "${name}" added`);
    setCreateCourseOpen(false);
  };

  const deleteCourse = async (course: Course) => {
    if (
      !confirm(
        `Delete "${course.name}" and all its scheduled sessions? This can't be undone.`,
      )
    )
      return;
    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Course deleted");
  };

  const saveSession = async (input: {
    id?: string;
    course_id: string;
    title: string;
    location: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => {
    if (!user) return;
    const starts = new Date(`${input.date}T${input.startTime}`);
    const ends = new Date(`${input.date}T${input.endTime}`);
    if (ends <= starts) {
      toast.error("End time must be after start time");
      return;
    }
    const payload = {
      user_id: user.id,
      course_id: input.course_id,
      title: input.title.trim() || null,
      location: input.location.trim() || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      source: "manual",
    };
    const { error } = input.id
      ? await supabase.from("class_sessions").update(payload).eq("id", input.id)
      : await supabase.from("class_sessions").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(input.id ? "Session updated" : "Session added");
    setCreateSessionOpen(false);
    setEditSession(null);
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from("class_sessions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Session removed");
    setEditSession(null);
  };

  const importIcs = async (events: ParsedEvent[], courseId: string) => {
    if (!user || events.length === 0) return 0;
    const rows = events.map((ev) => ({
      user_id: user.id,
      course_id: courseId,
      title: ev.summary,
      location: ev.location,
      starts_at: ev.starts_at.toISOString(),
      ends_at: ev.ends_at.toISOString(),
      ics_uid: ev.uid,
      source: "ics",
    }));
    // Insert in batches of 100, ignoring duplicates from the unique index
    let imported = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { data, error } = await supabase
        .from("class_sessions")
        .upsert(batch, {
          onConflict: "user_id,ics_uid,starts_at",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) {
        toast.error(error.message);
        return imported;
      }
      imported += data?.length ?? 0;
    }
    return imported;
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Your class timetable. Add manually or import from your university calendar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {todaysCount > 0 && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {todaysCount} class{todaysCount > 1 ? "es" : ""} today
            </Badge>
          )}
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={courses.length === 0}>
                <Upload className="h-4 w-4" />
                Import .ics
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Import from calendar file</DialogTitle>
              </DialogHeader>
              <ImportIcsForm
                courses={courses}
                onImport={importIcs}
                onDone={() => setImportOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={createCourseOpen} onOpenChange={setCreateCourseOpen}>
            <DialogTrigger asChild>
              <Button variant="soft" size="sm">
                <BookOpen className="h-4 w-4" />
                New course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Add a course</DialogTitle>
              </DialogHeader>
              <CourseForm onSubmit={createCourse} />
            </DialogContent>
          </Dialog>

          <Dialog
            open={createSessionOpen || !!editSession}
            onOpenChange={(o) => {
              if (!o) {
                setCreateSessionOpen(false);
                setEditSession(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                variant="hero"
                size="sm"
                disabled={courses.length === 0}
                onClick={() => setCreateSessionOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editSession ? "Edit class session" : "Add class session"}
                </DialogTitle>
              </DialogHeader>
              <SessionForm
                courses={courses}
                session={editSession}
                onSubmit={saveSession}
                onDelete={editSession ? () => deleteSession(editSession.id) : undefined}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : courses.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarDays className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <h3 className="font-display text-lg font-semibold">Start with a course</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a course first, then either add sessions manually or import from a .ics file.
          </p>
          <Button
            variant="hero"
            size="sm"
            className="mt-4"
            onClick={() => setCreateCourseOpen(true)}
          >
            <BookOpen className="h-4 w-4" />
            Add my first course
          </Button>
        </Card>
      ) : (
        <>
          {/* Course chips */}
          <div className="mb-4 flex flex-wrap gap-2">
            {courses.map((c) => {
              const cls = colorClasses(c.color);
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                    cls.bg,
                    cls.border,
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", cls.dot)} />
                  <span className="font-medium">{c.code ? `${c.code} · ` : ""}{c.name}</span>
                  <button
                    onClick={() => deleteCourse(c)}
                    className="ml-1 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    title="Delete course"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <Tabs value={view} onValueChange={(v) => setView(v as "week" | "list")}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="list">Upcoming</TabsTrigger>
              </TabsList>
              {view === "week" && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setWeekStart(addWeeks(weekStart, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
                    }
                  >
                    {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {view === "week" ? (
              <WeekGrid
                weekDays={weekDays}
                sessionsByDay={sessionsByDay}
                courseById={courseById}
                onClickSession={(s) => setEditSession(s)}
              />
            ) : (
              <UpcomingList
                groups={upcomingByDay}
                courseById={courseById}
                onClickSession={(s) => setEditSession(s)}
              />
            )}
          </Tabs>
        </>
      )}
    </AppShell>
  );
};

// ============== Week grid ==============
const WeekGrid = ({
  weekDays,
  sessionsByDay,
  courseById,
  onClickSession,
}: {
  weekDays: Date[];
  sessionsByDay: Map<string, ClassSession[]>;
  courseById: (id: string) => Course | undefined;
  onClickSession: (s: ClassSession) => void;
}) => {
  const today = new Date();
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border">
        <div className="border-r border-border" />
        {weekDays.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "border-r border-border px-2 py-2 text-center last:border-r-0",
                isToday && "bg-accent/10",
              )}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {format(d, "EEE")}
              </div>
              <div
                className={cn(
                  "font-display text-lg font-semibold",
                  isToday ? "text-accent-foreground" : "text-foreground",
                )}
              >
                {format(d, "d")}
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
        {/* Hours column */}
        <div className="border-r border-border">
          {HOURS.map((h) => (
            <div
              key={h}
              className="relative border-b border-border/50 text-[10px] text-muted-foreground"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="absolute -top-1.5 right-1.5">
                {h.toString().padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const daySessions = sessionsByDay.get(key) ?? [];
          const isToday = isSameDay(d, today);
          return (
            <div
              key={key}
              className={cn(
                "relative border-r border-border last:border-r-0",
                isToday && "bg-accent/5",
              )}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="border-b border-border/50"
                  style={{ height: HOUR_HEIGHT }}
                />
              ))}

              {daySessions.map((s) => {
                const course = courseById(s.course_id);
                const cls = course ? colorClasses(course.color) : COURSE_COLORS[0];
                const start = new Date(s.starts_at);
                const end = new Date(s.ends_at);
                const startHour = start.getHours() + start.getMinutes() / 60;
                const endHour = end.getHours() + end.getMinutes() / 60;
                const top = (startHour - HOURS[0]) * HOUR_HEIGHT;
                const height = Math.max(24, (endHour - startHour) * HOUR_HEIGHT - 2);
                if (top < 0 || startHour >= HOURS[HOURS.length - 1] + 1) return null;
                return (
                  <button
                    key={s.id}
                    onClick={() => onClickSession(s)}
                    className={cn(
                      "absolute left-1 right-1 overflow-hidden rounded-sm border-l-2 px-1.5 py-1 text-left text-[11px] leading-tight transition-base hover:shadow-md",
                      cls.bg,
                      cls.border,
                      cls.text,
                    )}
                    style={{ top, height }}
                  >
                    <div className="truncate font-semibold">
                      {course?.code ?? course?.name ?? "Class"}
                    </div>
                    <div className="truncate opacity-80">
                      {format(start, "HH:mm")}–{format(end, "HH:mm")}
                    </div>
                    {s.location && (
                      <div className="truncate text-[10px] opacity-70">{s.location}</div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ============== Upcoming list ==============
const UpcomingList = ({
  groups,
  courseById,
  onClickSession,
}: {
  groups: [string, ClassSession[]][];
  courseById: (id: string) => Course | undefined;
  onClickSession: (s: ClassSession) => void;
}) => {
  if (groups.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-sm text-muted-foreground">No upcoming sessions.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map(([dayKey, items]) => {
        const date = new Date(dayKey + "T00:00");
        const isToday = isSameDay(date, new Date());
        return (
          <div key={dayKey}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="font-display text-sm font-semibold text-primary">
                {isToday ? "Today" : format(date, "EEEE")}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(date, "MMM d")}
              </span>
            </div>
            <Card className="divide-y divide-border p-0">
              {items.map((s) => {
                const course = courseById(s.course_id);
                const cls = course ? colorClasses(course.color) : COURSE_COLORS[0];
                const start = new Date(s.starts_at);
                const end = new Date(s.ends_at);
                return (
                  <button
                    key={s.id}
                    onClick={() => onClickSession(s)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-base hover:bg-secondary/40"
                  >
                    <div className={cn("h-10 w-1 rounded-full", cls.dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {course?.name ?? "Class"}
                        {course?.code && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {course.code}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(start, "HH:mm")}–{format(end, "HH:mm")}
                        </span>
                        {s.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {s.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {s.source === "ics" && (
                      <Badge variant="outline" className="text-[10px]">ICS</Badge>
                    )}
                  </button>
                );
              })}
            </Card>
          </div>
        );
      })}
    </div>
  );
};

// ============== Course form ==============
const CourseForm = ({
  onSubmit,
}: {
  onSubmit: (
    name: string,
    code: string,
    instructor: string,
    color: string,
  ) => Promise<void>;
}) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [instructor, setInstructor] = useState("");
  const [color, setColor] = useState(COURSE_COLORS[0].name);
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        await onSubmit(name, code, instructor, color);
        setSubmitting(false);
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="cn">Name</Label>
        <Input
          id="cn"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Algorithms & Data Structures"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cc">Code (optional)</Label>
          <Input
            id="cc"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CS 201"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ci">Instructor (optional)</Label>
          <Input
            id="ci"
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
            placeholder="Dr. Smith"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {COURSE_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setColor(c.name)}
              className={cn(
                "h-8 w-8 rounded-full border-2 transition-base",
                c.dot,
                color === c.name
                  ? "border-foreground scale-110"
                  : "border-transparent opacity-70 hover:opacity-100",
              )}
              aria-label={c.name}
            />
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" variant="hero" disabled={submitting || !name.trim()}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save course
        </Button>
      </DialogFooter>
    </form>
  );
};

// ============== Session form ==============
const SessionForm = ({
  courses,
  session,
  onSubmit,
  onDelete,
}: {
  courses: Course[];
  session: ClassSession | null;
  onSubmit: (input: {
    id?: string;
    course_id: string;
    title: string;
    location: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => Promise<void>;
  onDelete?: () => void;
}) => {
  const initial = useMemo(() => {
    if (session) {
      const s = new Date(session.starts_at);
      const e = new Date(session.ends_at);
      return {
        course_id: session.course_id,
        title: session.title ?? "",
        location: session.location ?? "",
        date: format(s, "yyyy-MM-dd"),
        startTime: format(s, "HH:mm"),
        endTime: format(e, "HH:mm"),
      };
    }
    return {
      course_id: courses[0]?.id ?? "",
      title: "",
      location: "",
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "10:30",
    };
  }, [session, courses]);

  const [courseId, setCourseId] = useState(initial.course_id);
  const [title, setTitle] = useState(initial.title);
  const [location, setLocation] = useState(initial.location);
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!courseId) return;
        setSubmitting(true);
        await onSubmit({
          id: session?.id,
          course_id: courseId,
          title,
          location,
          date,
          startTime,
          endTime,
        });
        setSubmitting(false);
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label>Course</Label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.code ? `${c.code} — ` : ""}{c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="st">Title (optional)</Label>
        <Input
          id="st"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Lecture 5: Graphs"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sl">Location (optional)</Label>
        <Input
          id="sl"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Room 204"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="sd">Date</Label>
          <Input id="sd" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ss">Start</Label>
          <Input id="ss" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="se">End</Label>
          <Input id="se" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        {onDelete ? (
          <Button type="button" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        ) : <span />}
        <Button type="submit" variant="hero" disabled={submitting || !courseId}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {session ? "Save changes" : "Add session"}
        </Button>
      </DialogFooter>
    </form>
  );
};

// ============== ICS import form ==============
const ImportIcsForm = ({
  courses,
  onImport,
  onDone,
}: {
  courses: Course[];
  onImport: (events: ParsedEvent[], courseId: string) => Promise<number>;
  onDone: () => void;
}) => {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [parsed, setParsed] = useState<ParsedEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      const events = parseIcs(text);
      if (events.length === 0) {
        toast.error("No events found in this file");
        return;
      }
      setParsed(events);
    } catch (e) {
      toast.error("Couldn't read this file");
    }
  };

  const doImport = async () => {
    if (!parsed || !courseId) return;
    setBusy(true);
    const inserted = await onImport(parsed, courseId);
    setBusy(false);
    toast.success(
      `Imported ${inserted} session${inserted === 1 ? "" : "s"}` +
        (inserted < parsed.length
          ? ` · ${parsed.length - inserted} skipped (duplicates)`
          : ""),
    );
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Assign to course</Label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.code ? `${c.code} — ` : ""}{c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          All imported sessions will belong to this course. Tip: import each course separately
          for best color-coding.
        </p>
      </div>

      <div
        className="rounded-md border-2 border-dashed border-border p-6 text-center transition-base hover:bg-secondary/40"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        role="button"
        tabIndex={0}
      >
        <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">
          {parsed ? `${parsed.length} events ready to import` : "Drop a .ics file or click to browse"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Recurring weekly classes are expanded for the next 6 months.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </div>

      {parsed && parsed.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-secondary/30 p-2 text-xs">
          {parsed.slice(0, 5).map((ev, i) => (
            <div key={i} className="flex justify-between gap-2 py-0.5">
              <span className="truncate font-medium">{ev.summary}</span>
              <span className="shrink-0 text-muted-foreground">
                {format(ev.starts_at, "MMM d, HH:mm")}
              </span>
            </div>
          ))}
          {parsed.length > 5 && (
            <div className="pt-1 text-center text-muted-foreground">
              + {parsed.length - 5} more
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        <Button
          variant="hero"
          onClick={doImport}
          disabled={!parsed || !courseId || busy}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Import {parsed ? parsed.length : ""} session{parsed?.length === 1 ? "" : "s"}
        </Button>
      </DialogFooter>
    </div>
  );
};

export default Schedule;
