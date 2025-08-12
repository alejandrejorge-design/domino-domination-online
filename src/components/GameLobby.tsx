import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Play, LogOut, RefreshCw } from 'lucide-react';

type GameRoom = {
  id: string;
  name: string;
  host_id: string;
  status: 'waiting' | 'in_progress' | 'finished';
  max_players: number;
  current_players: number;
  created_at: string;
  updated_at: string;
};

interface GameLobbyProps {
  user: any;
  onJoinGame: (gameRoomId: string) => void;
  onSignOut: () => void;
}

const GameLobby = ({ user, onJoinGame, onSignOut }: GameLobbyProps) => {
  const [gameRooms, setGameRooms] = useState<GameRoom[]>([]);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchGameRooms();
    
    // Subscribe to real-time updates for game rooms
    const roomsSubscription = supabase
      .channel('game_rooms_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'game_rooms' },
        () => {
          fetchGameRooms();
        }
      )
      .subscribe();

    // Subscribe to game players changes to update room counts
    const playersSubscription = supabase
      .channel('game_players_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'game_players' },
        () => {
          fetchGameRooms();
        }
      )
      .subscribe();

    return () => {
      roomsSubscription.unsubscribe();
      playersSubscription.unsubscribe();
    };
  }, []);

  const fetchGameRooms = async () => {
    setLoading(true);
    try {
      // Clean up old rooms first
      await supabase.rpc('cleanup_old_game_rooms');
      
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGameRooms((data || []).map(room => ({
        ...room,
        status: room.status as 'waiting' | 'in_progress' | 'finished'
      })));
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch game rooms",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createGameRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setCreating(true);
    try {
      // Validate active session before creating room
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) { console.warn('Session error on createGameRoom:', sessionError); }
      if (!sessionData?.session?.user) {
        toast({ title: 'Authentication required', description: 'Please sign in again and retry.', variant: 'destructive' });
        setCreating(false);
        return;
      }

      const tryCreateOnce = async () => {
        const { data, error } = await supabase
          .from('game_rooms')
          .insert({
            name: roomName.trim(),
            host_id: user.id,
            status: 'waiting',
            max_players: 4,
            current_players: 1,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      };

      let room: any = null;
      let lastErr: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          room = await tryCreateOnce();
          lastErr = null;
          break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`Create room attempt ${attempt} failed:`, err?.message || err);
          if (attempt >= 3) break;
          await new Promise((res) => setTimeout(res, 300 * attempt));
          await supabase.auth.getSession();
        }
      }

      if (lastErr) throw lastErr;

      // Join the created room
      onJoinGame(room.id);
      
      toast({
        title: "Room Created!",
        description: `Game room "${roomName}" has been created.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to create game room: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
      setRoomName('');
    }
  };

  const joinGameRoom = async (roomId: string) => {
    try {
      // Validate active session before joining
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        toast({ title: 'Authentication required', description: 'Please sign in to join rooms.', variant: 'destructive' });
        return;
      }
      // Check if room is still available
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .select('current_players, max_players')
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;

      if (room.current_players >= room.max_players) {
        toast({
          title: "Room Full",
          description: "This game room is already full.",
          variant: "destructive",
        });
        return;
      }

      onJoinGame(roomId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to join game room",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Domino Domination</h1>
              <p className="text-muted-foreground">Welcome, {user.user_metadata?.display_name || user.email}</p>
            </div>
          </div>
          <Button onClick={onSignOut} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Room */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Game Room
                </CardTitle>
                <CardDescription>
                  Start a new dominoes game and invite others to join
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createGameRoom} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="roomName">Room Name</Label>
                    <Input
                      id="roomName"
                      type="text"
                      placeholder="Enter room name"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating ? "Creating..." : "Create Room"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Available Rooms */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Available Game Rooms
                    </CardTitle>
                    <CardDescription>
                      Join an existing game or wait for others to join yours
                    </CardDescription>
                  </div>
                  <Button
                    onClick={fetchGameRooms}
                    disabled={loading}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading game rooms...
                  </div>
                ) : gameRooms.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No game rooms available. Create one to get started!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gameRooms.map((room) => (
                      <div
                        key={room.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors bg-card"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-card-foreground">{room.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {room.current_players}/{room.max_players} players
                          </p>
                        </div>
                        <Button 
                          onClick={() => joinGameRoom(room.id)}
                          disabled={room.current_players >= room.max_players}
                          size="sm"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {room.current_players >= room.max_players ? 'Full' : 'Join'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLobby;