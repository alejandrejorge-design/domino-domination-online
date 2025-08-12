
-- Enable realtime for game tables and make it idempotent

-- 1) Ensure full row data for updates/deletes
ALTER TABLE public.game_players REPLICA IDENTITY FULL;
ALTER TABLE public.game_rooms   REPLICA IDENTITY FULL;
ALTER TABLE public.game_state   REPLICA IDENTITY FULL;

-- 2) Add tables to the supabase_realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
  END IF;
END $$;
