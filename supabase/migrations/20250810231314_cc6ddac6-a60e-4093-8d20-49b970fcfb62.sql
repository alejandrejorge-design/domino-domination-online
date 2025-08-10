-- Add automatic cleanup for old game rooms
CREATE OR REPLACE FUNCTION public.cleanup_old_game_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete game rooms that are in 'waiting' status and haven't been updated in 5 minutes
  DELETE FROM public.game_rooms 
  WHERE status = 'waiting' 
    AND updated_at < NOW() - INTERVAL '5 minutes';
END;
$$;