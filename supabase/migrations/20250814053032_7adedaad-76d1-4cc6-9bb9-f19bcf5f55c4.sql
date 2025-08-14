-- Create missing profiles for users who don't have one
INSERT INTO public.profiles (user_id, username, phone_number)
SELECT u.id, u.username, u.phone_number 
FROM public.users u 
LEFT JOIN public.profiles p ON u.id = p.user_id 
WHERE p.user_id IS NULL;