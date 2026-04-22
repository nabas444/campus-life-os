-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.utility_kind AS ENUM (
  'electricity', 'water', 'internet', 'gas', 'heating',
  'security', 'equipment', 'other'
);

CREATE TYPE public.outage_status AS ENUM (
  'reported', 'confirmed', 'resolved', 'dismissed'
);

CREATE TYPE public.outage_severity AS ENUM (
  'minor', 'partial', 'major'
);

-- =========================
-- utility_categories
-- =========================
CREATE TABLE public.utility_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dorm_id UUID NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.utility_kind NOT NULL DEFAULT 'other',
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dorm_id, name)
);

CREATE INDEX idx_utility_categories_dorm ON public.utility_categories(dorm_id);

ALTER TABLE public.utility_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view utility categories"
ON public.utility_categories FOR SELECT TO authenticated
USING (public.is_dorm_member(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins create utility categories"
ON public.utility_categories FOR INSERT TO authenticated
WITH CHECK (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins update utility categories"
ON public.utility_categories FOR UPDATE TO authenticated
USING (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins delete utility categories"
ON public.utility_categories FOR DELETE TO authenticated
USING (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE TRIGGER trg_utility_categories_updated
BEFORE UPDATE ON public.utility_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- outages (the official record)
-- =========================
CREATE TABLE public.outages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dorm_id UUID NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.utility_categories(id) ON DELETE CASCADE,
  status public.outage_status NOT NULL DEFAULT 'reported',
  severity public.outage_severity NOT NULL DEFAULT 'partial',
  summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outages_dorm ON public.outages(dorm_id);
CREATE INDEX idx_outages_category ON public.outages(category_id);
CREATE INDEX idx_outages_status ON public.outages(status);
CREATE INDEX idx_outages_started_at ON public.outages(started_at DESC);

ALTER TABLE public.outages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view outages"
ON public.outages FOR SELECT TO authenticated
USING (public.is_dorm_member(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins create outages"
ON public.outages FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'))
);

CREATE POLICY "Admins update outages"
ON public.outages FOR UPDATE TO authenticated
USING (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins delete outages"
ON public.outages FOR DELETE TO authenticated
USING (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE TRIGGER trg_outages_updated
BEFORE UPDATE ON public.outages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-stamp ended_at when status flips to resolved
CREATE OR REPLACE FUNCTION public.outages_autoclose()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' AND NEW.ended_at IS NULL THEN
    NEW.ended_at := now();
  END IF;
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' AND NEW.confirmed_at IS NULL THEN
    NEW.confirmed_at := now();
    NEW.confirmed_by := COALESCE(NEW.confirmed_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_outages_autoclose
BEFORE UPDATE ON public.outages
FOR EACH ROW EXECUTE FUNCTION public.outages_autoclose();

-- Notify all dorm members when an outage is confirmed or resolved
CREATE OR REPLACE FUNCTION public.notify_outage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cat_name TEXT;
BEGIN
  SELECT name INTO cat_name FROM public.utility_categories WHERE id = NEW.category_id;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('confirmed', 'resolved') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT dm.user_id,
           'system'::notification_type,
           CASE NEW.status
             WHEN 'confirmed' THEN 'Outage confirmed: ' || cat_name
             WHEN 'resolved'  THEN 'Restored: ' || cat_name
           END,
           COALESCE(NEW.summary, ''),
           '/utilities'
    FROM public.dorm_members dm
    WHERE dm.dorm_id = NEW.dorm_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_outages_notify
AFTER UPDATE ON public.outages
FOR EACH ROW EXECUTE FUNCTION public.notify_outage_change();

-- =========================
-- outage_reports (member-submitted)
-- =========================
CREATE TABLE public.outage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dorm_id UUID NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.utility_categories(id) ON DELETE CASCADE,
  outage_id UUID REFERENCES public.outages(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL,
  note TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outage_reports_dorm ON public.outage_reports(dorm_id);
CREATE INDEX idx_outage_reports_category ON public.outage_reports(category_id);
CREATE INDEX idx_outage_reports_outage ON public.outage_reports(outage_id);
CREATE INDEX idx_outage_reports_reported_at ON public.outage_reports(reported_at DESC);

ALTER TABLE public.outage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view outage reports"
ON public.outage_reports FOR SELECT TO authenticated
USING (public.is_dorm_member(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Members create outage reports"
ON public.outage_reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid() AND public.is_dorm_member(auth.uid(), dorm_id));

CREATE POLICY "Reporter or admin deletes outage report"
ON public.outage_reports FOR DELETE TO authenticated
USING (
  reporter_id = auth.uid()
  OR public.is_dorm_admin_of(auth.uid(), dorm_id)
  OR public.has_role(auth.uid(), 'system_admin')
);

CREATE POLICY "Admins update outage reports"
ON public.outage_reports FOR UPDATE TO authenticated
USING (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

-- =========================
-- Realtime
-- =========================
ALTER TABLE public.utility_categories REPLICA IDENTITY FULL;
ALTER TABLE public.outages REPLICA IDENTITY FULL;
ALTER TABLE public.outage_reports REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.utility_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outage_reports;

-- =========================
-- Seed default categories for existing dorms
-- =========================
INSERT INTO public.utility_categories (dorm_id, name, kind, description, icon, created_by)
SELECT d.id, x.name, x.kind::public.utility_kind, x.description, x.icon, d.created_by
FROM public.dorms d
CROSS JOIN (VALUES
  ('Electricity', 'electricity', 'Power supply to the building', 'zap'),
  ('Water', 'water', 'Cold and hot water supply', 'droplet'),
  ('Internet', 'internet', 'Wi-Fi and wired internet', 'wifi')
) AS x(name, kind, description, icon)
ON CONFLICT (dorm_id, name) DO NOTHING;

-- Auto-seed defaults when a new dorm is created
CREATE OR REPLACE FUNCTION public.seed_default_utility_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.utility_categories (dorm_id, name, kind, description, icon, created_by)
  VALUES
    (NEW.id, 'Electricity', 'electricity', 'Power supply to the building', 'zap', NEW.created_by),
    (NEW.id, 'Water', 'water', 'Cold and hot water supply', 'droplet', NEW.created_by),
    (NEW.id, 'Internet', 'internet', 'Wi-Fi and wired internet', 'wifi', NEW.created_by)
  ON CONFLICT (dorm_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_utility_categories
AFTER INSERT ON public.dorms
FOR EACH ROW EXECUTE FUNCTION public.seed_default_utility_categories();