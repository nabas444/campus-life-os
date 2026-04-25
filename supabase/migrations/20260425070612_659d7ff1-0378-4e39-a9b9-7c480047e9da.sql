-- 2. block_assignments: links a block_admin user to a block name
CREATE TABLE public.block_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  block TEXT NOT NULL,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, block)
);

ALTER TABLE public.block_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own block assignments"
  ON public.block_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "System admins manage block assignments"
  ON public.block_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

-- 3. block_tokens: one-shot keys pre-bound to a block name
CREATE TABLE public.block_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  block TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by UUID,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  note TEXT
);

ALTER TABLE public.block_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can lookup block tokens"
  ON public.block_tokens FOR SELECT TO authenticated USING (true);

CREATE POLICY "System admins manage block tokens"
  ON public.block_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

-- 4. Helper: is user a block_admin for a given block name?
CREATE OR REPLACE FUNCTION public.is_block_admin_of(_user_id UUID, _block TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.block_assignments ba
    JOIN public.user_roles ur ON ur.user_id = ba.user_id AND ur.role = 'block_admin'
    WHERE ba.user_id = _user_id
      AND _block IS NOT NULL
      AND lower(ba.block) = lower(_block)
  );
$$;

-- 5. Update is_dorm_admin_of so block admins inherit dorm-admin rights for dorms in their block
CREATE OR REPLACE FUNCTION public.is_dorm_admin_of(_user_id UUID, _dorm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.dorm_members dm
      JOIN public.user_roles ur ON ur.user_id = dm.user_id
      WHERE dm.user_id = _user_id
        AND dm.dorm_id = _dorm_id
        AND ur.role = 'dorm_admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.dorms d
      WHERE d.id = _dorm_id
        AND d.block IS NOT NULL
        AND public.is_block_admin_of(_user_id, d.block)
    );
$$;

-- 6. redeem_block_token: claim a block-admin assignment with a key
CREATE OR REPLACE FUNCTION public.redeem_block_token(_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_token public.block_tokens%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_token FROM public.block_tokens
   WHERE code = upper(trim(_code))
   FOR UPDATE;

  IF v_token.id IS NULL THEN
    RAISE EXCEPTION 'Invalid block key';
  END IF;
  IF v_token.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'This block key has already been used';
  END IF;
  IF v_token.expires_at IS NOT NULL AND v_token.expires_at < now() THEN
    RAISE EXCEPTION 'This block key has expired';
  END IF;

  -- Grant block_admin role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user, 'block_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Assign the block (idempotent)
  INSERT INTO public.block_assignments (user_id, block, assigned_by)
  VALUES (v_user, v_token.block, v_token.created_by)
  ON CONFLICT (user_id, block) DO NOTHING;

  -- Mark token consumed
  UPDATE public.block_tokens
     SET used_by = v_user, used_at = now()
   WHERE id = v_token.id;

  RETURN v_token.block;
END;
$$;