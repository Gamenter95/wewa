-- Ensure unique usernames without failing signups and attach trigger to auth.users
-- 1) Make sure a unique index exists on profiles.username (safe if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'profiles_username_key'
  ) THEN
    CREATE UNIQUE INDEX profiles_username_key ON public.profiles(username);
  END IF;
END $$;

-- 2) Replace the handle_new_user() function to auto-generate a unique username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  base_username TEXT;
  sanitized_base TEXT;
  phone TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  -- Pull desired values from auth.user metadata
  base_username := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'username'), ''), split_part(COALESCE(NEW.email, 'user'), '@', 1));
  phone := NEW.raw_user_meta_data ->> 'phone_number';

  -- Sanitize and normalize the base username
  sanitized_base := regexp_replace(lower(base_username), '[^a-z0-9_]+', '', 'g');
  IF sanitized_base = '' THEN
    sanitized_base := 'user';
  END IF;

  final_username := sanitized_base;

  -- Ensure uniqueness by appending an incrementing suffix if needed
  WHILE EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.username = final_username
  ) LOOP
    suffix := suffix + 1;
    final_username := sanitized_base || suffix::text;
  END LOOP;

  -- Insert the profile row safely
  INSERT INTO public.profiles (user_id, username, phone_number)
  VALUES (NEW.id, final_username, phone);

  RETURN NEW;
END;
$$;

-- 3) Attach trigger to auth.users (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;