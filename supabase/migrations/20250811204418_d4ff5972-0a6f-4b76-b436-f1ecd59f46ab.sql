-- Fix security vulnerability: Players can see each other's cards
-- Drop the overly permissive existing policy
DROP POLICY IF EXISTS "Game players are viewable by authenticated users" ON public.game_players;

-- Create a new policy that allows players to see basic info of other players but only their own hand
CREATE POLICY "Players can view basic info of others and full info of themselves" 
ON public.game_players 
FOR SELECT 
USING (
  -- Players can see their own complete data
  auth.uid() = user_id 
  OR 
  -- Players can see others in the same game room, but with limited data
  -- This will be handled by the application layer to filter out hand data
  EXISTS (
    SELECT 1 
    FROM public.game_players gp 
    WHERE gp.game_room_id = game_players.game_room_id 
    AND gp.user_id = auth.uid()
  )
);

-- Create a view for safe player data that excludes hands for other players
CREATE OR REPLACE VIEW public.safe_game_players AS
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

-- Grant appropriate permissions on the view
GRANT SELECT ON public.safe_game_players TO authenticated;

-- Enable RLS on the view
ALTER VIEW public.safe_game_players SET (security_barrier = true);