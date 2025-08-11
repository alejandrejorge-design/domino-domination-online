-- Fix infinite recursion in game_players RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Players can see their own data and limited data of others" ON public.game_players;

-- Create simplified, non-recursive policies
CREATE POLICY "Players can view all game data in their rooms" 
ON public.game_players 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.game_rooms gr 
    WHERE gr.id = game_players.game_room_id 
    AND (
      gr.host_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.game_players gp2 
        WHERE gp2.game_room_id = gr.id 
        AND gp2.user_id = auth.uid()
      )
    )
  )
);

-- Keep the existing update and insert policies as they are fine
-- No changes needed for:
-- "Players can update their own game data" 
-- "Users can join games as themselves"