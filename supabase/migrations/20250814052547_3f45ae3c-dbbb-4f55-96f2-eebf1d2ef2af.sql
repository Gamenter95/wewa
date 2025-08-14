-- Fix the generate_gateway_token function to use gen_random_uuid() instead of gen_random_bytes()
CREATE OR REPLACE FUNCTION public.generate_gateway_token(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  token_string TEXT;
BEGIN
  -- Use gen_random_uuid() which is available instead of gen_random_bytes()
  token_string := 'gwt_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  
  -- Deactivate any existing active tokens for this user
  UPDATE public.gateway_tokens 
  SET is_active = false 
  WHERE user_id = user_uuid AND is_active = true;

  -- Insert the new token
  INSERT INTO public.gateway_tokens (user_id, token, is_active, gateway_enabled)
  VALUES (user_uuid, token_string, true, true);

  RETURN token_string;
END;
$$;