-- Courses
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  instructor TEXT,
  color TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_user ON public.courses(user_id);

-- Class sessions
CREATE TABLE public.class_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  ics_uid TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_sessions_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX idx_class_sessions_user_time ON public.class_sessions(user_id, starts_at);
CREATE INDEX idx_class_sessions_course ON public.class_sessions(course_id);
CREATE UNIQUE INDEX class_sessions_ics_unique
  ON public.class_sessions(user_id, ics_uid, starts_at)
  WHERE ics_uid IS NOT NULL;

-- Triggers
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_sessions_updated_at
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own courses"
ON public.courses FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users create own courses"
ON public.courses FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own courses"
ON public.courses FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users delete own courses"
ON public.courses FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users view own class sessions"
ON public.class_sessions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users create own class sessions"
ON public.class_sessions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own class sessions"
ON public.class_sessions FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users delete own class sessions"
ON public.class_sessions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.courses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_sessions;
ALTER TABLE public.courses REPLICA IDENTITY FULL;
ALTER TABLE public.class_sessions REPLICA IDENTITY FULL;