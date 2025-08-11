-- Fix RLS policies to allow joining rooms without circular dependency

-- Drop the existing policy that causes the circular dependency
DROP POLICY IF EXISTS "Game players are viewable by room participants" ON public.game_players;

-- Create a new policy that allows viewing players in any room
-- This is safe because room IDs are not secret and players need to see who's in rooms to join
CREATE POLICY "Game players are viewable by authenticated users" 
ON public.game_players 
FOR SELECT 
TO authenticated
USING (true);

-- Also allow users to join any room (not just their own user_id)
-- But they can only insert with their own user_id (checked by the existing policy)
-- This fixes the issue where users couldn't query existing players before joining