-- Fix the foreign key constraint and ensure profile creation
-- First, let's add the missing foreign key for gateway_tokens
ALTER TABLE public.gateway_tokens 
ADD CONSTRAINT gateway_tokens_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Create a profile for any users who don't have one
INSERT INTO public.profiles (user_id, username, phone_number)
SELECT u.id, u.username, u.phone_number 
FROM public.users u 
LEFT JOIN public.profiles p ON u.id = p.user_id 
WHERE p.user_id IS NULL;