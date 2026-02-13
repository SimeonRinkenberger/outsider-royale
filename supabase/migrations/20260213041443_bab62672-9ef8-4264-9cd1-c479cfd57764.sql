
-- Drop the restrictive insert policy that requires auth_user_id = auth.uid()
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;

-- Create a permissive insert policy that allows anyone to create a profile
-- (matches the old code behavior where profiles were created without auth)
CREATE POLICY "insert_profile" ON public.profiles
FOR INSERT
WITH CHECK (true);
