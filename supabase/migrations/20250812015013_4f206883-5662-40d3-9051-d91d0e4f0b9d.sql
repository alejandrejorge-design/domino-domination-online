
-- 1) Deduplicate any accidental duplicates per (game_room_id, user_id) before adding constraint
WITH dups AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY game_room_id, user_id ORDER BY joined_at ASC, id ASC) AS rn
  FROM public.game_players
)
DELETE FROM public.game_players gp
USING dups
WHERE gp.id = dups.id
  AND dups.rn > 1;

-- 2) Add unique constraint to ensure a user can only appear once per room
DO $$
BEGIN
  ALTER TABLE public.game_players
  ADD CONSTRAINT game_players_room_user_unique UNIQUE (game_room_id, user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3) Atomic join function that assigns the first free seat and updates room counts
CREATE OR REPLACE FUNCTION public.join_game_room_atomic(
  p_game_room_id uuid,
  p_display_name text DEFAULT NULL
)
RETURNS TABLE(player_id uuid, position integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_max_players int;
  v_free_pos int;
  v_existing_id uuid;
  v_room_exists boolean;
  v_display text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the room row to serialize joins for this room
  SELECT TRUE, max_players
  INTO v_room_exists, v_max_players
  FROM public.game_rooms
  WHERE id = p_game_room_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_room_exists THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- Reconnection path: if the user already has a row, just mark connected and return
  SELECT id
  INTO v_existing_id
  FROM public.game_players
  WHERE game_room_id = p_game_room_id
    AND user_id = v_user_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.game_players
    SET is_connected = true
    WHERE id = v_existing_id;

    PERFORM public.recount_game_room_players(p_game_room_id);

    RETURN QUERY
    SELECT v_existing_id, (SELECT position FROM public.game_players WHERE id = v_existing_id);
    RETURN;
  END IF;

  -- Capacity check using current rows
  IF (SELECT COUNT(*) FROM public.game_players WHERE game_room_id = p_game_room_id) >= v_max_players THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  -- Find first free seat [0..max_players-1]
  SELECT gs.pos
  INTO v_free_pos
  FROM generate_series(0, v_max_players - 1) AS gs(pos)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.game_players gp
    WHERE gp.game_room_id = p_game_room_id
      AND gp.position = gs.pos
  )
  ORDER BY gs.pos
  LIMIT 1;

  IF v_free_pos IS NULL THEN
    RAISE EXCEPTION 'No available positions';
  END IF;

  -- Determine display name, fallback to 'Player'
  v_display := COALESCE(p_display_name, 'Player');

  INSERT INTO public.game_players (
    game_room_id, user_id, display_name, position, hand, score, is_current_player, is_connected
  )
  VALUES (
    p_game_room_id, v_user_id, v_display, v_free_pos, '[]'::jsonb, 0, false, true
  )
  RETURNING id, position INTO player_id, position;

  -- Recount room players so lobby stays correct
  PERFORM public.recount_game_room_players(p_game_room_id);

  RETURN;
END;
$$;

-- 4) Ensure the recount trigger is attached to game_players
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_game_players_recount ON public.game_players;
  CREATE TRIGGER trg_game_players_recount
  AFTER INSERT OR UPDATE OR DELETE ON public.game_players
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_update_game_room_player_count();
END $$;
