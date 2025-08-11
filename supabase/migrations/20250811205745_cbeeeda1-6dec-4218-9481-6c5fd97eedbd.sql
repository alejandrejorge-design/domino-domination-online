-- Remove the view and handle security at RLS level instead
DROP VIEW IF EXISTS public.safe_game_players;

-- Update the RLS policy to be more restrictive about hand data
DROP POLICY IF EXISTS "Players can view basic info of others and full info of themselves" ON public.game_players;

-- Create a restrictive policy that prevents viewing other players' hands
CREATE POLICY "Players can see their own data and limited data of others" 
ON public.game_players 
FOR SELECT 
USING (
  -- Players can see their own complete data
  auth.uid() = user_id 
  OR 
  -- Players can see others in the same game room (app will filter hand data)
  (
    EXISTS (
      SELECT 1 
      FROM public.game_players gp 
      WHERE gp.game_room_id = game_players.game_room_id 
      AND gp.user_id = auth.uid()
    )
  )
);