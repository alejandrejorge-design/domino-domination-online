-- Fix infinite recursion by using security definer function
-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "game_players_select_policy" ON public.game_players;

-- Create a security definer function to get user's game rooms
CREATE OR REPLACE FUNCTION public.get_user_game_rooms(user_uuid uuid)
RETURNS TABLE(room_id uuid) AS $$
BEGIN
  -- Return rooms where user is host
  RETURN QUERY
  SELECT gr.id
  FROM public.game_rooms gr
  WHERE gr.host_id = user_uuid;
  
  -- Return rooms where user is a player (using a direct query without referencing game_players in policy)
  RETURN QUERY
  SELECT DISTINCT gp.game_room_id
  FROM public.game_players gp
  WHERE gp.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create new SELECT policy using the security definer function
CREATE POLICY "game_players_select_policy" 
ON public.game_players 
FOR SELECT 
USING (
  game_room_id IN (
    SELECT room_id FROM public.get_user_game_rooms(auth.uid())
  )
);