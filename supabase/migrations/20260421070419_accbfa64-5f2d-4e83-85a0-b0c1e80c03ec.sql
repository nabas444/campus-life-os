-- ============ ENUMS ============
CREATE TYPE public.presence_state AS ENUM ('free', 'busy', 'studying', 'away', 'offline');
CREATE TYPE public.channel_kind AS ENUM ('dorm_default', 'topic');

-- ============ PRESENCE ============
CREATE TABLE public.presence_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  state public.presence_state NOT NULL DEFAULT 'offline',
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.presence_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view co-member presence"
  ON public.presence_status FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.dorm_members dm1
      JOIN public.dorm_members dm2 ON dm1.dorm_id = dm2.dorm_id
      WHERE dm1.user_id = auth.uid() AND dm2.user_id = presence_status.user_id
    )
    OR public.has_role(auth.uid(), 'system_admin')
  );

CREATE POLICY "Users insert own presence"
  ON public.presence_status FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own presence"
  ON public.presence_status FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own presence"
  ON public.presence_status FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_presence_updated
  BEFORE UPDATE ON public.presence_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ANNOUNCEMENTS ============
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dorm_id UUID NOT NULL,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (public.is_dorm_member(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins create announcements"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'))
  );

CREATE POLICY "Admins update announcements"
  ON public.announcements FOR UPDATE TO authenticated
  USING (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins delete announcements"
  ON public.announcements FOR DELETE TO authenticated
  USING (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE TRIGGER trg_announcements_updated
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CHAT CHANNELS ============
CREATE TABLE public.chat_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dorm_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  kind public.channel_kind NOT NULL DEFAULT 'topic',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dorm_id, name)
);
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view channels in their dorm"
  ON public.chat_channels FOR SELECT TO authenticated
  USING (public.is_dorm_member(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Members create topic channels"
  ON public.chat_channels FOR INSERT TO authenticated
  WITH CHECK (public.is_dorm_member(auth.uid(), dorm_id) AND created_by = auth.uid());

CREATE POLICY "Admins update channels"
  ON public.chat_channels FOR UPDATE TO authenticated
  USING (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin') OR created_by = auth.uid());

CREATE POLICY "Admins delete channels"
  ON public.chat_channels FOR DELETE TO authenticated
  USING (public.is_dorm_admin_of(auth.uid(), dorm_id) OR public.has_role(auth.uid(), 'system_admin') OR created_by = auth.uid());

-- ============ CHANNEL MEMBERS (for topic rooms) ============
CREATE TABLE public.chat_channel_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

-- Helper to check channel access via the channel's dorm
CREATE OR REPLACE FUNCTION public.can_access_channel(_user_id UUID, _channel_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channels c
    WHERE c.id = _channel_id
      AND public.is_dorm_member(_user_id, c.dorm_id)
  );
$$;

CREATE POLICY "Channel members visible to dorm"
  ON public.chat_channel_members FOR SELECT TO authenticated
  USING (public.can_access_channel(auth.uid(), channel_id));

CREATE POLICY "Users join channels themselves"
  ON public.chat_channel_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_channel(auth.uid(), channel_id));

CREATE POLICY "Users leave channels themselves"
  ON public.chat_channel_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ DIRECT THREADS ============
CREATE TABLE public.direct_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a UUID NOT NULL,
  user_b UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
ALTER TABLE public.direct_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view their threads"
  ON public.direct_threads FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Co-members create threads"
  ON public.direct_threads FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND EXISTS (
      SELECT 1 FROM public.dorm_members dm1
      JOIN public.dorm_members dm2 ON dm1.dorm_id = dm2.dorm_id
      WHERE dm1.user_id = user_a AND dm2.user_id = user_b
    )
  );

CREATE POLICY "Participants update thread"
  ON public.direct_threads FOR UPDATE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- ============ CHAT MESSAGES (channel or DM) ============
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID,
  thread_id UUID,
  sender_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (channel_id IS NOT NULL AND thread_id IS NULL)
    OR (channel_id IS NULL AND thread_id IS NOT NULL)
  )
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_chat_messages_channel ON public.chat_messages (channel_id, created_at DESC);
CREATE INDEX idx_chat_messages_thread ON public.chat_messages (thread_id, created_at DESC);

CREATE POLICY "Members read channel/thread messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    (channel_id IS NOT NULL AND public.can_access_channel(auth.uid(), channel_id))
    OR (
      thread_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.direct_threads t
        WHERE t.id = thread_id AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
      )
    )
  );

CREATE POLICY "Members send channel/thread messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (channel_id IS NOT NULL AND public.can_access_channel(auth.uid(), channel_id))
      OR (
        thread_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.direct_threads t
          WHERE t.id = thread_id AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
        )
      )
    )
  );

CREATE POLICY "Senders delete own messages"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- Trigger: bump direct_threads.last_message_at on new DM
CREATE OR REPLACE FUNCTION public.bump_thread_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE public.direct_threads
      SET last_message_at = NEW.created_at
      WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_thread
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_thread_last_message();

-- ============ AUTO-CREATE DEFAULT CHANNEL PER DORM ============
CREATE OR REPLACE FUNCTION public.create_default_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chat_channels (dorm_id, name, description, kind, created_by)
  VALUES (NEW.id, 'general', 'Dorm-wide chat', 'dorm_default', NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dorm_default_channel
  AFTER INSERT ON public.dorms
  FOR EACH ROW EXECUTE FUNCTION public.create_default_channel();

-- Backfill default channels for existing dorms
INSERT INTO public.chat_channels (dorm_id, name, description, kind, created_by)
SELECT d.id, 'general', 'Dorm-wide chat', 'dorm_default', d.created_by
FROM public.dorms d
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_channels c WHERE c.dorm_id = d.id AND c.kind = 'dorm_default'
);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.presence_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_threads;

ALTER TABLE public.presence_status REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.announcements REPLICA IDENTITY FULL;
ALTER TABLE public.direct_threads REPLICA IDENTITY FULL;