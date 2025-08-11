-- Fix the security definer view issue by recreating without security_barrier
DROP VIEW IF EXISTS public.safe_game_players;

-- Create a secure view that automatically filters hand data based on the current user
-- This uses RLS on the underlying table instead of security_barrier
CREATE VIEW public.safe_game_players AS
SELECT 
  id,
  game_room_id,
  user_id,
  display_name,
  position,
  score,
  is_connected,
  is_current_player,
  joined_at,
  -- Only show hand data if it's the current user's data
  CASE 
    WHEN user_id = auth.uid() THEN hand 
    ELSE '[]'::jsonb 
  END as hand
FROM public.game_players;

-- Grant select permissions
GRANT SELECT ON public.safe_game_players TO authenticated;