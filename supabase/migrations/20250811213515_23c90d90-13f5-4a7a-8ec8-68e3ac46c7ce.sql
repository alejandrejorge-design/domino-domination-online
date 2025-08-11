-- Fix security issue with function search path by recreating everything
-- Drop policy first
DROP POLICY IF EXISTS "game_players_select_policy" ON public.game_players;

-- Drop and recreate function with proper search path
DROP FUNCTION IF EXISTS public.get_user_game_rooms(uuid);

CREATE OR REPLACE FUNCTION public.get_user_game_rooms(user_uuid uuid)
RETURNS TABLE(room_id uuid) 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  -- Return rooms where user is host
  RETURN QUERY
  SELECT gr.id
  FROM public.game_rooms gr
  WHERE gr.host_id = user_uuid;
  
  -- Return rooms where user is a player
  RETURN QUERY
  SELECT DISTINCT gp.game_room_id
  FROM public.game_players gp
  WHERE gp.user_id = user_uuid;
END;
$$;

-- Recreate policy using the secure function
CREATE POLICY "game_players_select_policy" 
ON public.game_players 
FOR SELECT 
USING (
  game_room_id IN (
    SELECT room_id FROM public.get_user_game_rooms(auth.uid())
  )
);