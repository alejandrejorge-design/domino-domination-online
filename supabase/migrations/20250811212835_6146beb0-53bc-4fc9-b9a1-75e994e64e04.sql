-- Fix infinite recursion in game_players RLS policies completely
-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Players can view all game data in their rooms" ON public.game_players;
DROP POLICY IF EXISTS "Players can update their own game data" ON public.game_players;
DROP POLICY IF EXISTS "Users can join games as themselves" ON public.game_players;

-- Create completely non-recursive policies
-- Policy 1: Allow players to see all players in rooms they are part of
CREATE POLICY "game_players_select_policy" 
ON public.game_players 
FOR SELECT 
USING (
  game_room_id IN (
    SELECT gr.id 
    FROM public.game_rooms gr 
    WHERE gr.host_id = auth.uid()
  )
  OR 
  game_room_id IN (
    SELECT DISTINCT gp.game_room_id 
    FROM public.game_players gp 
    WHERE gp.user_id = auth.uid()
  )
);

-- Policy 2: Allow users to update their own player data
CREATE POLICY "game_players_update_policy" 
ON public.game_players 
FOR UPDATE 
USING (user_id = auth.uid());

-- Policy 3: Allow users to insert themselves into games
CREATE POLICY "game_players_insert_policy" 
ON public.game_players 
FOR INSERT 
WITH CHECK (user_id = auth.uid());