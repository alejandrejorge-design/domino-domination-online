-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create game_rooms table
CREATE TABLE public.game_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'finished')),
  max_players INTEGER NOT NULL DEFAULT 4 CHECK (max_players >= 2 AND max_players <= 4),
  current_players INTEGER NOT NULL DEFAULT 0 CHECK (current_players >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create game_players table
CREATE TABLE public.game_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_room_id UUID NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  position INTEGER NOT NULL CHECK (position >= 0 AND position <= 3),
  hand JSONB DEFAULT '[]'::jsonb,
  score INTEGER NOT NULL DEFAULT 0,
  is_current_player BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_room_id, user_id),
  UNIQUE(game_room_id, position)
);

-- Create game_state table
CREATE TABLE public.game_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_room_id UUID NOT NULL UNIQUE REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  current_player_id UUID REFERENCES auth.users(id),
  placed_dominoes JSONB DEFAULT '[]'::jsonb,
  left_end INTEGER,
  right_end INTEGER,
  dominoes JSONB DEFAULT '[]'::jsonb,
  turn_order JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for game_rooms
CREATE POLICY "Game rooms are viewable by everyone" 
ON public.game_rooms FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create game rooms" 
ON public.game_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update their game room" 
ON public.game_rooms FOR UPDATE USING (auth.uid() = host_id);

-- Create RLS policies for game_players
CREATE POLICY "Game players are viewable by room participants" 
ON public.game_players FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp 
    WHERE gp.game_room_id = game_players.game_room_id 
    AND gp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join games as themselves" 
ON public.game_players FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players can update their own game data" 
ON public.game_players FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for game_state
CREATE POLICY "Game state is viewable by room participants" 
ON public.game_state FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp 
    WHERE gp.game_room_id = game_state.game_room_id 
    AND gp.user_id = auth.uid()
  )
);

CREATE POLICY "Room host can manage game state" 
ON public.game_state FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.game_rooms gr 
    WHERE gr.id = game_state.game_room_id 
    AND gr.host_id = auth.uid()
  )
);

-- Create function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_rooms_updated_at
  BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_state_updated_at
  BEFORE UPDATE ON public.game_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();