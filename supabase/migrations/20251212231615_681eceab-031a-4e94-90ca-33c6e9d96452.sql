-- Fix the lobby update policy - remove the OR true bypass
DROP POLICY IF EXISTS "Host can update their lobby" ON public.lobbies;

CREATE POLICY "Host can update their lobby" 
ON public.lobbies 
FOR UPDATE 
USING (host_user_id = auth.uid());

-- Also fix the delete policy which has the same issue
DROP POLICY IF EXISTS "Host can delete their lobby" ON public.lobbies;

CREATE POLICY "Host can delete their lobby" 
ON public.lobbies 
FOR DELETE 
USING (host_user_id = auth.uid());