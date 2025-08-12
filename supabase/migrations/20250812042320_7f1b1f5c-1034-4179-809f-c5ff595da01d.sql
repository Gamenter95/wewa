-- Add explicit deny-all RLS policies for security clarity
-- Users table: deny all operations (service role bypasses RLS when needed)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_no_select'
  ) THEN
    CREATE POLICY users_no_select ON public.users FOR SELECT USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_no_insert'
  ) THEN
    CREATE POLICY users_no_insert ON public.users FOR INSERT WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_no_update'
  ) THEN
    CREATE POLICY users_no_update ON public.users FOR UPDATE USING (false) WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_no_delete'
  ) THEN
    CREATE POLICY users_no_delete ON public.users FOR DELETE USING (false);
  END IF;
END $$;

-- Sessions table: deny all operations
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'sessions_no_select'
  ) THEN
    CREATE POLICY sessions_no_select ON public.sessions FOR SELECT USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'sessions_no_insert'
  ) THEN
    CREATE POLICY sessions_no_insert ON public.sessions FOR INSERT WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'sessions_no_update'
  ) THEN
    CREATE POLICY sessions_no_update ON public.sessions FOR UPDATE USING (false) WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'sessions_no_delete'
  ) THEN
    CREATE POLICY sessions_no_delete ON public.sessions FOR DELETE USING (false);
  END IF;
END $$;