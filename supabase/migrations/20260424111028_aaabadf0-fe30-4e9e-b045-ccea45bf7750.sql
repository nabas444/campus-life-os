-- 1. New dorm identity fields
ALTER TABLE public.dorms
  ADD COLUMN IF NOT EXISTS block TEXT,
  ADD COLUMN IF NOT EXISTS dorm_number TEXT;

-- 2. One-shot representative tokens (system admin issues -> rep redeems)
CREATE TABLE IF NOT EXISTS public.rep_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by UUID,
  used_at TIMESTAMPTZ,
  dorm_id UUID,
  expires_at TIMESTAMPTZ,
  note TEXT
);

ALTER TABLE public.rep_tokens ENABLE ROW LEVEL SECURITY;

-- System admins manage tokens
CREATE POLICY "System admins manage rep tokens"
ON public.rep_tokens
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'system_admin'))
WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

-- Anyone signed in can look up by code (needed to validate before redeem)
CREATE POLICY "Authenticated users can lookup rep tokens"
ON public.rep_tokens
FOR SELECT
TO authenticated
USING (true);

-- 3. Atomic redemption RPC: validates token + creates dorm + grants role
CREATE OR REPLACE FUNCTION public.redeem_rep_token(
  _code TEXT,
  _dorm_name TEXT,
  _block TEXT,
  _dorm_number TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_token public.rep_tokens%ROWTYPE;
  v_dorm_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _dorm_name IS NULL OR length(trim(_dorm_name)) = 0 THEN
    RAISE EXCEPTION 'Dorm name is required';
  END IF;

  SELECT * INTO v_token FROM public.rep_tokens
   WHERE code = upper(trim(_code))
   FOR UPDATE;

  IF v_token.id IS NULL THEN
    RAISE EXCEPTION 'Invalid representative key';
  END IF;
  IF v_token.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'This representative key has already been used';
  END IF;
  IF v_token.expires_at IS NOT NULL AND v_token.expires_at < now() THEN
    RAISE EXCEPTION 'This representative key has expired';
  END IF;

  -- Create the dorm
  INSERT INTO public.dorms (name, block, dorm_number, created_by)
  VALUES (trim(_dorm_name), NULLIF(trim(_block),''), NULLIF(trim(_dorm_number),''), v_user)
  RETURNING id INTO v_dorm_id;

  -- Add rep as member
  INSERT INTO public.dorm_members (user_id, dorm_id)
  VALUES (v_user, v_dorm_id);

  -- Grant dorm_admin role (idempotent on (user_id, role))
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user, 'dorm_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Mark token consumed
  UPDATE public.rep_tokens
     SET used_by = v_user, used_at = now(), dorm_id = v_dorm_id
   WHERE id = v_token.id;

  RETURN v_dorm_id;
END;
$$;

-- 4. Allow dorm reps (admins of a dorm) to mint member invite codes for their own dorm.
-- The existing policy already covers this (is_dorm_admin_of OR system_admin) — no change needed.
-- But ensure user_roles has unique(user_id, role) to support the ON CONFLICT above.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

-- 5. Index for fast token lookup (UNIQUE already creates one on code, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_rep_tokens_code ON public.rep_tokens (code);