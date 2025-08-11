-- Fix security issue with function search path
DROP FUNCTION IF EXISTS public.get_user_game_rooms(uuid);

-- Recreate function with proper search path
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