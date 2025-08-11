-- Fix linter: set secure search_path on functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, phone_number)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'phone_number'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_gateway_token(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  token_string TEXT;
BEGIN
  token_string := 'gwt_' || encode(gen_random_bytes(32), 'hex');
  
  UPDATE public.gateway_tokens 
  SET is_active = false 
  WHERE user_id = user_uuid AND is_active = true;

  INSERT INTO public.gateway_tokens (user_id, token)
  VALUES (user_uuid, token_string);

  RETURN token_string;
END;
$$;