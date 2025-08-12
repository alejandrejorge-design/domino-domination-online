-- 1) Create or replace the atomic join function
CREATE OR REPLACE FUNCTION public.join_game_room_atomic(
  p_game_room_id uuid,
  p_display_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_max_players int;
  v_positions int[];
  v_next_pos int;
  v_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure the room exists and lock it while we work
  SELECT max_players INTO v_max_players
  FROM public.game_rooms
  WHERE id = p_game_room_id
  FOR UPDATE;

  IF v_max_players IS NULL THEN
    RAISE EXCEPTION 'Game room not found';
  END IF;

  -- If already a player in this room, mark as connected and update display name
  SELECT EXISTS (
    SELECT 1 FROM public.game_players
    WHERE game_room_id = p_game_room_id AND user_id = v_user_id
    FOR UPDATE
  ) INTO v_exists;

  IF v_exists THEN
    UPDATE public.game_players
    SET is_connected = true,
        display_name = COALESCE(p_display_name, display_name),
        joined_at = NOW()
    WHERE game_room_id = p_game_room_id AND user_id = v_user_id;

    PERFORM public.recount_game_room_players(p_game_room_id);
    RETURN;
  END IF;

  -- Lock players in room to compute seat atomically
  PERFORM 1 FROM public.game_players WHERE game_room_id = p_game_room_id FOR UPDATE;

  -- Collect used positions
  SELECT array_agg(position ORDER BY position) INTO v_positions
  FROM public.game_players
  WHERE game_room_id = p_game_room_id;

  -- Find first available position from 0..max_players-1
  v_next_pos := 0;
  WHILE v_next_pos < COALESCE(v_max_players, 4) LOOP
    IF v_positions IS NULL OR NOT v_next_pos = ANY (v_positions) THEN
      EXIT;
    END IF;
    v_next_pos := v_next_pos + 1;
  END LOOP;

  IF v_next_pos >= v_max_players THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  -- Insert player row (or reconnect if concurrent insert happened)
  INSERT INTO public.game_players (
    game_room_id, user_id, display_name, position, is_connected, is_current_player, score, hand
  ) VALUES (
    p_game_room_id, v_user_id, p_display_name, v_next_pos, true, false, 0, '[]'::jsonb
  )
  ON CONFLICT (game_room_id, user_id)
  DO UPDATE SET
    is_connected = EXCLUDED.is_connected,
    display_name = COALESCE(EXCLUDED.display_name, public.game_players.display_name),
    joined_at = NOW();

  -- Touch room timestamp and recount players
  UPDATE public.game_rooms
  SET updated_at = now()
  WHERE id = p_game_room_id;

  PERFORM public.recount_game_room_players(p_game_room_id);
END;
$$;

-- 2) Enforce uniqueness to prevent duplicate memberships and seats
CREATE UNIQUE INDEX IF NOT EXISTS ux_game_players_room_user
  ON public.game_players (game_room_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_game_players_room_position
  ON public.game_players (game_room_id, position);

-- 3) Attach trigger to keep current_players accurate on any change
DROP TRIGGER IF EXISTS trg_game_players_recount ON public.game_players;
CREATE TRIGGER trg_game_players_recount
AFTER INSERT OR UPDATE OR DELETE ON public.game_players
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_game_room_player_count();