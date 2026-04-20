
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.item_category AS ENUM (
  'electronics', 'kitchen', 'cleaning', 'tools', 'books', 'sports', 'games', 'other'
);
CREATE TYPE public.borrow_status AS ENUM (
  'requested', 'approved', 'denied', 'borrowed', 'returned', 'overdue', 'cancelled'
);
CREATE TYPE public.resource_category AS ENUM (
  'study_room', 'kitchen', 'laundry', 'recreation', 'charging', 'locker', 'equipment', 'other'
);
CREATE TYPE public.booking_status AS ENUM (
  'confirmed', 'cancelled', 'completed', 'no_show'
);

-- =========================================
-- ITEMS
-- =========================================
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dorm_id UUID NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL = dorm-owned (shared inventory)
  name TEXT NOT NULL,
  description TEXT,
  category public.item_category NOT NULL DEFAULT 'other',
  image_url TEXT,
  condition TEXT,
  max_loan_days INTEGER NOT NULL DEFAULT 7,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER items_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_items_dorm ON public.items(dorm_id);
CREATE INDEX idx_items_owner ON public.items(owner_id);

-- =========================================
-- BORROW REQUESTS
-- =========================================
CREATE TABLE public.borrow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dorm_id UUID NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  status public.borrow_status NOT NULL DEFAULT 'requested',
  requested_from TIMESTAMPTZ NOT NULL,
  requested_until TIMESTAMPTZ NOT NULL,
  borrowed_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requested_until > requested_from)
);
ALTER TABLE public.borrow_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER borrow_requests_updated_at BEFORE UPDATE ON public.borrow_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_borrow_item ON public.borrow_requests(item_id);
CREATE INDEX idx_borrow_borrower ON public.borrow_requests(borrower_id);
CREATE INDEX idx_borrow_status ON public.borrow_requests(status);

-- =========================================
-- RESOURCES
-- =========================================
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dorm_id UUID NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category public.resource_category NOT NULL DEFAULT 'other',
  image_url TEXT,
  capacity INTEGER NOT NULL DEFAULT 1,
  open_hour SMALLINT NOT NULL DEFAULT 6,    -- 0-23
  close_hour SMALLINT NOT NULL DEFAULT 23,  -- 1-24, exclusive end
  default_slot_minutes SMALLINT NOT NULL DEFAULT 30,
  max_booking_minutes SMALLINT NOT NULL DEFAULT 120,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (close_hour > open_hour),
  CHECK (open_hour BETWEEN 0 AND 23 AND close_hour BETWEEN 1 AND 24)
);
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER resources_updated_at BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_resources_dorm ON public.resources(dorm_id);

-- =========================================
-- RESOURCE BOOKINGS
-- =========================================
CREATE TABLE public.resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dorm_id UUID NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  purpose TEXT,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
ALTER TABLE public.resource_bookings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER resource_bookings_updated_at BEFORE UPDATE ON public.resource_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bookings_resource ON public.resource_bookings(resource_id, starts_at);
CREATE INDEX idx_bookings_user ON public.resource_bookings(user_id);

-- =========================================
-- CONFLICT PREVENTION TRIGGER
-- Prevents overlapping confirmed bookings on the same resource
-- =========================================
CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    IF EXISTS (
      SELECT 1 FROM public.resource_bookings rb
      WHERE rb.resource_id = NEW.resource_id
        AND rb.status = 'confirmed'
        AND rb.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND rb.starts_at < NEW.ends_at
        AND rb.ends_at > NEW.starts_at
    ) THEN
      RAISE EXCEPTION 'This time slot is already booked. Please pick another time.'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_no_overlap
  BEFORE INSERT OR UPDATE ON public.resource_bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_overlap();

-- =========================================
-- BORROW STATUS NOTIFICATIONS
-- =========================================
CREATE OR REPLACE FUNCTION public.notify_on_borrow_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_owner UUID;
  item_name TEXT;
BEGIN
  SELECT owner_id, name INTO item_owner, item_name FROM public.items WHERE id = NEW.item_id;

  -- New request: notify item owner if peer item
  IF TG_OP = 'INSERT' AND item_owner IS NOT NULL AND item_owner <> NEW.borrower_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      item_owner,
      'system',
      'New borrow request',
      'Someone wants to borrow "' || item_name || '"',
      '/borrow/requests/' || NEW.id::text
    );
  END IF;

  -- Status change: notify borrower
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.borrower_id,
      'system',
      'Borrow request: ' || NEW.status::text,
      '"' || item_name || '" — ' || NEW.status::text,
      '/borrow/requests/' || NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER borrow_requests_notify
  AFTER INSERT OR UPDATE ON public.borrow_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_borrow_request();

-- =========================================
-- BOOKING NOTIFICATIONS
-- =========================================
CREATE OR REPLACE FUNCTION public.notify_on_booking_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resource_name TEXT;
BEGIN
  SELECT name INTO resource_name FROM public.resources WHERE id = NEW.resource_id;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.user_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'system',
      'Booking ' || NEW.status::text,
      resource_name || ' booking was ' || NEW.status::text,
      '/resources/' || NEW.resource_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_notify
  AFTER UPDATE ON public.resource_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_booking_change();

-- =========================================
-- TRUST STATS VIEW
-- =========================================
CREATE OR REPLACE VIEW public.user_trust_stats
WITH (security_invoker = true) AS
SELECT
  br.borrower_id AS user_id,
  COUNT(*) FILTER (WHERE br.status IN ('returned', 'overdue', 'borrowed')) AS total_borrows,
  COUNT(*) FILTER (WHERE br.status = 'returned' AND br.returned_at IS NOT NULL AND br.returned_at <= br.requested_until) AS on_time_returns,
  COUNT(*) FILTER (WHERE br.status = 'returned' AND br.returned_at IS NOT NULL AND br.returned_at > br.requested_until) AS late_returns,
  COUNT(*) FILTER (WHERE br.status = 'overdue') AS currently_overdue
FROM public.borrow_requests br
GROUP BY br.borrower_id;

-- =========================================
-- RLS POLICIES
-- =========================================

-- items
CREATE POLICY "Members view items in their dorm" ON public.items
  FOR SELECT TO authenticated USING (
    public.is_dorm_member(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Members list personal items" ON public.items
  FOR INSERT TO authenticated WITH CHECK (
    owner_id = auth.uid() AND public.is_dorm_member(auth.uid(), dorm_id)
  );
CREATE POLICY "Dorm admins create dorm items" ON public.items
  FOR INSERT TO authenticated WITH CHECK (
    owner_id IS NULL AND (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'))
  );
CREATE POLICY "Owners or admins update items" ON public.items
  FOR UPDATE TO authenticated USING (
    owner_id = auth.uid()
    OR public.is_dorm_admin_of(auth.uid(), dorm_id)
    OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Owners or admins delete items" ON public.items
  FOR DELETE TO authenticated USING (
    owner_id = auth.uid()
    OR public.is_dorm_admin_of(auth.uid(), dorm_id)
    OR public.has_role(auth.uid(), 'system_admin')
  );

-- borrow_requests
CREATE POLICY "Members view borrow requests in dorm" ON public.borrow_requests
  FOR SELECT TO authenticated USING (
    borrower_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.items i WHERE i.id = borrow_requests.item_id AND i.owner_id = auth.uid())
    OR public.is_dorm_admin_of(auth.uid(), dorm_id)
    OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Members create own borrow requests" ON public.borrow_requests
  FOR INSERT TO authenticated WITH CHECK (
    borrower_id = auth.uid() AND public.is_dorm_member(auth.uid(), dorm_id)
  );
CREATE POLICY "Borrower or owner or admin updates request" ON public.borrow_requests
  FOR UPDATE TO authenticated USING (
    borrower_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.items i WHERE i.id = borrow_requests.item_id AND i.owner_id = auth.uid())
    OR public.is_dorm_admin_of(auth.uid(), dorm_id)
    OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Borrower or admin deletes request" ON public.borrow_requests
  FOR DELETE TO authenticated USING (
    borrower_id = auth.uid()
    OR public.is_dorm_admin_of(auth.uid(), dorm_id)
    OR public.has_role(auth.uid(), 'system_admin')
  );

-- resources
CREATE POLICY "Members view resources in dorm" ON public.resources
  FOR SELECT TO authenticated USING (
    public.is_dorm_member(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Dorm admins create resources" ON public.resources
  FOR INSERT TO authenticated WITH CHECK (
    public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Dorm admins update resources" ON public.resources
  FOR UPDATE TO authenticated USING (
    public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Dorm admins delete resources" ON public.resources
  FOR DELETE TO authenticated USING (
    public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin')
  );

-- resource_bookings
CREATE POLICY "Members view dorm bookings" ON public.resource_bookings
  FOR SELECT TO authenticated USING (
    public.is_dorm_member(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "Members create own bookings" ON public.resource_bookings
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND public.is_dorm_member(auth.uid(), dorm_id)
  );
CREATE POLICY "User or admin update booking" ON public.resource_bookings
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid()
    OR public.is_dorm_admin_of(auth.uid(), dorm_id)
    OR public.has_role(auth.uid(), 'system_admin')
  );
CREATE POLICY "User or admin delete booking" ON public.resource_bookings
  FOR DELETE TO authenticated USING (
    user_id = auth.uid()
    OR public.is_dorm_admin_of(auth.uid(), dorm_id)
    OR public.has_role(auth.uid(), 'system_admin')
  );
