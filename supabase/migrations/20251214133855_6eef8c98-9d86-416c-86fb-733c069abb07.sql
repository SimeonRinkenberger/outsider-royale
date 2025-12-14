-- The app doesn't use Supabase Auth - it uses custom localStorage-based user IDs
-- The host_user_id check with auth.uid() won't work
-- We need to allow updates via the application logic instead

-- Revert lobby update policy to allow updates (application controls this)
DROP POLICY IF EXISTS "Host can update their lobby" ON public.lobbies;

CREATE POLICY "Anyone can update lobbies" 
ON public.lobbies 
FOR UPDATE 
USING (true);

-- Revert lobby delete policy
DROP POLICY IF EXISTS "Host can delete their lobby" ON public.lobbies;

CREATE POLICY "Anyone can delete lobbies" 
ON public.lobbies 
FOR DELETE 
USING (true);