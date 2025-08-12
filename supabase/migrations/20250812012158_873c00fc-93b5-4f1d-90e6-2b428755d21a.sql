-- Add policy to allow room players to update game_state (for making moves)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_state' AND policyname = 'Players can update game state'
  ) THEN
    CREATE POLICY "Players can update game state"
    ON public.game_state
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.game_players gp
        WHERE gp.game_room_id = game_state.game_room_id
          AND gp.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Add policy to allow host to update player rows in their room (deal hands, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_players' AND policyname = 'Host can update players in their room'
  ) THEN
    CREATE POLICY "Host can update players in their room"
    ON public.game_players
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.game_rooms gr
        WHERE gr.id = game_players.game_room_id
          AND gr.host_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Create helper function to recount current_players on a room
CREATE OR REPLACE FUNCTION public.recount_game_room_players(room_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.game_rooms
  SET current_players = (
    SELECT COUNT(*) FROM public.game_players
    WHERE game_room_id = room_id AND is_connected = true
  ), updated_at = now()
  WHERE id = room_id;
$$;

-- Create trigger function to call recount on changes to game_players
CREATE OR REPLACE FUNCTION public.trg_update_game_room_player_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.recount_game_room_players(NEW.game_room_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM public.recount_game_room_players(NEW.game_room_id);
    IF (NEW.game_room_id IS DISTINCT FROM OLD.game_room_id) THEN
      PERFORM public.recount_game_room_players(OLD.game_room_id);
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.recount_game_room_players(OLD.game_room_id);
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'game_players_update_count'
  ) THEN
    CREATE TRIGGER game_players_update_count
    AFTER INSERT OR UPDATE OR DELETE ON public.game_players
    FOR EACH ROW EXECUTE FUNCTION public.trg_update_game_room_player_count();
  END IF;
END $$;