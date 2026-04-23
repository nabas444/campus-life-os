-- Scope enum
CREATE TYPE public.todo_scope AS ENUM ('personal', 'dorm');

-- Lists table
CREATE TABLE public.todo_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope public.todo_scope NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  dorm_id UUID REFERENCES public.dorms(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT todo_lists_scope_consistency CHECK (
    (scope = 'personal' AND dorm_id IS NULL) OR
    (scope = 'dorm' AND dorm_id IS NOT NULL)
  )
);

CREATE INDEX idx_todo_lists_owner ON public.todo_lists(owner_id);
CREATE INDEX idx_todo_lists_dorm ON public.todo_lists(dorm_id) WHERE dorm_id IS NOT NULL;

-- Items table
CREATE TABLE public.todo_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.todo_lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  assigned_to UUID,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_todo_items_list ON public.todo_items(list_id);
CREATE INDEX idx_todo_items_assigned ON public.todo_items(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_todo_items_due ON public.todo_items(due_at) WHERE due_at IS NOT NULL AND completed_at IS NULL;

-- updated_at triggers
CREATE TRIGGER update_todo_lists_updated_at
  BEFORE UPDATE ON public.todo_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_todo_items_updated_at
  BEFORE UPDATE ON public.todo_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;

-- ============ todo_lists policies ============
CREATE POLICY "View own personal lists or dorm lists in member dorms"
ON public.todo_lists FOR SELECT
TO authenticated
USING (
  (scope = 'personal' AND owner_id = auth.uid())
  OR (scope = 'dorm' AND public.is_dorm_member(auth.uid(), dorm_id))
  OR public.has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Create own personal lists or dorm lists as dorm member"
ON public.todo_lists FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    (scope = 'personal' AND dorm_id IS NULL)
    OR (scope = 'dorm' AND public.is_dorm_member(auth.uid(), dorm_id))
  )
);

CREATE POLICY "Owner or dorm admin updates list"
ON public.todo_lists FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR (scope = 'dorm' AND public.is_dorm_admin_of(auth.uid(), dorm_id))
  OR public.has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Owner or dorm admin deletes list"
ON public.todo_lists FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  OR (scope = 'dorm' AND public.is_dorm_admin_of(auth.uid(), dorm_id))
  OR public.has_role(auth.uid(), 'system_admin'::app_role)
);

-- ============ todo_items policies ============
CREATE POLICY "View items in accessible lists"
ON public.todo_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.todo_lists l
    WHERE l.id = todo_items.list_id
      AND (
        (l.scope = 'personal' AND l.owner_id = auth.uid())
        OR (l.scope = 'dorm' AND public.is_dorm_member(auth.uid(), l.dorm_id))
        OR public.has_role(auth.uid(), 'system_admin'::app_role)
      )
  )
);

CREATE POLICY "Create items in accessible lists"
ON public.todo_items FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.todo_lists l
    WHERE l.id = todo_items.list_id
      AND (
        (l.scope = 'personal' AND l.owner_id = auth.uid())
        OR (l.scope = 'dorm' AND public.is_dorm_member(auth.uid(), l.dorm_id))
      )
  )
);

CREATE POLICY "Update items in accessible lists"
ON public.todo_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.todo_lists l
    WHERE l.id = todo_items.list_id
      AND (
        (l.scope = 'personal' AND l.owner_id = auth.uid())
        OR (l.scope = 'dorm' AND public.is_dorm_member(auth.uid(), l.dorm_id))
        OR public.has_role(auth.uid(), 'system_admin'::app_role)
      )
  )
);

CREATE POLICY "Creator, assignee, or admin deletes item"
ON public.todo_items FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.todo_lists l
    WHERE l.id = todo_items.list_id
      AND (
        (l.scope = 'personal' AND l.owner_id = auth.uid())
        OR (l.scope = 'dorm' AND public.is_dorm_admin_of(auth.uid(), l.dorm_id))
      )
  )
  OR public.has_role(auth.uid(), 'system_admin'::app_role)
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.todo_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.todo_items;
ALTER TABLE public.todo_lists REPLICA IDENTITY FULL;
ALTER TABLE public.todo_items REPLICA IDENTITY FULL;