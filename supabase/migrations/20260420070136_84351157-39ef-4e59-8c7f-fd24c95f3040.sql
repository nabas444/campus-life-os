
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('student', 'dorm_admin', 'system_admin');
CREATE TYPE public.issue_status AS ENUM ('pending', 'in_progress', 'resolved');
CREATE TYPE public.issue_category AS ENUM ('utilities', 'maintenance', 'noise', 'security', 'other');
CREATE TYPE public.issue_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.notification_type AS ENUM ('issue_status', 'issue_new', 'announcement', 'system');

-- =========================================
-- UTILITY: updated_at trigger
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- USER ROLES (separate table — security best practice)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role checker
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- =========================================
-- DORMS
-- =========================================
CREATE TABLE public.dorms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dorms ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER dorms_updated_at BEFORE UPDATE ON public.dorms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- DORM MEMBERS
-- =========================================
CREATE TABLE public.dorm_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dorm_id UUID NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  room_number TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dorm_id)
);
ALTER TABLE public.dorm_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_dorm_members_user ON public.dorm_members(user_id);
CREATE INDEX idx_dorm_members_dorm ON public.dorm_members(dorm_id);

-- Helper: is user member of given dorm?
CREATE OR REPLACE FUNCTION public.is_dorm_member(_user_id UUID, _dorm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dorm_members
    WHERE user_id = _user_id AND dorm_id = _dorm_id
  );
$$;

-- Helper: is user an admin (dorm_admin) of given dorm?
CREATE OR REPLACE FUNCTION public.is_dorm_admin_of(_user_id UUID, _dorm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dorm_members dm
    JOIN public.user_roles ur ON ur.user_id = dm.user_id
    WHERE dm.user_id = _user_id
      AND dm.dorm_id = _dorm_id
      AND ur.role = 'dorm_admin'
  );
$$;

-- Helper: get a user's dorm ids
CREATE OR REPLACE FUNCTION public.user_dorm_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dorm_id FROM public.dorm_members WHERE user_id = _user_id;
$$;

-- =========================================
-- DORM INVITES
-- =========================================
CREATE TABLE public.dorm_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dorm_id UUID NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role_granted public.app_role NOT NULL DEFAULT 'student',
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dorm_invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_dorm_invites_code ON public.dorm_invites(code);

-- =========================================
-- ISSUES
-- =========================================
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dorm_id UUID NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category public.issue_category NOT NULL,
  priority public.issue_priority NOT NULL DEFAULT 'medium',
  status public.issue_status NOT NULL DEFAULT 'pending',
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER issues_updated_at BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_issues_dorm ON public.issues(dorm_id);
CREATE INDEX idx_issues_reporter ON public.issues(reporter_id);
CREATE INDEX idx_issues_status ON public.issues(status);

-- =========================================
-- ISSUE ATTACHMENTS
-- =========================================
CREATE TABLE public.issue_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.issue_attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_issue_attachments_issue ON public.issue_attachments(issue_id);

-- =========================================
-- NOTIFICATIONS
-- =========================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read);

-- =========================================
-- AUTO-CREATE PROFILE + ROLE ON SIGNUP
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- ISSUE STATUS CHANGE → NOTIFY REPORTER
-- =========================================
CREATE OR REPLACE FUNCTION public.notify_on_issue_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      OLD.reporter_id,
      'issue_status',
      'Issue update: ' || NEW.title,
      'Status changed to ' || NEW.status::text,
      '/issues/' || NEW.id::text
    );

    IF NEW.status = 'resolved' THEN
      NEW.resolved_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER issues_notify_status
  BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_issue_status_change();

-- =========================================
-- RLS POLICIES
-- =========================================

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view profiles in their dorms" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.dorm_members dm1
      JOIN public.dorm_members dm2 ON dm1.dorm_id = dm2.dorm_id
      WHERE dm1.user_id = auth.uid() AND dm2.user_id = profiles.user_id
    )
  );
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'system_admin'));
CREATE POLICY "System admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

-- dorms
CREATE POLICY "Members view their dorms" ON public.dorms
  FOR SELECT TO authenticated USING (
    public.is_dorm_member(auth.uid(), id) OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "System admins create dorms" ON public.dorms
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'system_admin'));
CREATE POLICY "Dorm admins update their dorm" ON public.dorms
  FOR UPDATE TO authenticated USING (
    public.is_dorm_admin_of(auth.uid(), id) OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "System admins delete dorms" ON public.dorms
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'system_admin'));

-- dorm_members
CREATE POLICY "Members view co-members" ON public.dorm_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_dorm_member(auth.uid(), dorm_id)
    OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Users join dorm as themselves" ON public.dorm_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users leave own membership" ON public.dorm_members
  FOR DELETE TO authenticated USING (
    user_id = auth.uid()
    OR public.is_dorm_admin_of(auth.uid(), dorm_id)
    OR public.has_role(auth.uid(), 'system_admin')
  );

-- dorm_invites
CREATE POLICY "Anyone signed in can lookup invite by code" ON public.dorm_invites
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Dorm admins create invites for their dorm" ON public.dorm_invites
  FOR INSERT TO authenticated WITH CHECK (
    public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Dorm admins update their invites" ON public.dorm_invites
  FOR UPDATE TO authenticated USING (
    public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Dorm admins delete their invites" ON public.dorm_invites
  FOR DELETE TO authenticated USING (
    public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin')
  );

-- issues
CREATE POLICY "Members view dorm issues" ON public.issues
  FOR SELECT TO authenticated USING (
    public.is_dorm_member(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Members create issues in their dorm" ON public.issues
  FOR INSERT TO authenticated WITH CHECK (
    reporter_id = auth.uid() AND public.is_dorm_member(auth.uid(), dorm_id)
  );
CREATE POLICY "Reporter or dorm admin updates issue" ON public.issues
  FOR UPDATE TO authenticated USING (
    reporter_id = auth.uid()
    OR public.is_dorm_admin_of(auth.uid(), dorm_id)
    OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Reporter or dorm admin deletes issue" ON public.issues
  FOR DELETE TO authenticated USING (
    reporter_id = auth.uid()
    OR public.is_dorm_admin_of(auth.uid(), dorm_id)
    OR public.has_role(auth.uid(), 'system_admin')
  );

-- issue_attachments
CREATE POLICY "View attachments for visible issues" ON public.issue_attachments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_attachments.issue_id
        AND (public.is_dorm_member(auth.uid(), i.dorm_id) OR public.has_role(auth.uid(), 'system_admin'))
    )
  );
CREATE POLICY "Upload attachments to own issues" ON public.issue_attachments
  FOR INSERT TO authenticated WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_attachments.issue_id
        AND public.is_dorm_member(auth.uid(), i.dorm_id)
    )
  );
CREATE POLICY "Delete own attachments" ON public.issue_attachments
  FOR DELETE TO authenticated USING (uploaded_by = auth.uid());

-- notifications
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =========================================
-- STORAGE: issue-attachments bucket
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-attachments', 'issue-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload to own folder in issue-attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'issue-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated view issue-attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'issue-attachments');

CREATE POLICY "Users delete own files in issue-attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'issue-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
