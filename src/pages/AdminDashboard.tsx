import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Users, RefreshCw, Settings, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GameRoom {
  id: string;
  name: string;
  status: string;
  current_players: number;
  max_players: number;
  created_at: string;
  updated_at: string;
  host_id: string;
}

interface GamePlayer {
  id: string;
  user_id: string;
  display_name: string;
  game_room_id: string;
  is_connected: boolean;
  joined_at: string;
  score: number;
}

interface AdminStats {
  totalRooms: number;
  activeRooms: number;
  totalPlayers: number;
  waitingRooms: number;
}

const AdminDashboard = () => {
  const [gameRooms, setGameRooms] = useState<GameRoom[]>([]);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [stats, setStats] = useState<AdminStats>({ totalRooms: 0, activeRooms: 0, totalPlayers: 0, waitingRooms: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    setupRealtimeSubscriptions();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch game rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('game_rooms')
        .select('*')
        .order('created_at', { ascending: false });

      if (roomsError) throw roomsError;

      // Fetch all players
      const { data: playersData, error: playersError } = await supabase
        .from('game_players')
        .select('*')
        .order('joined_at', { ascending: false });

      if (playersError) throw playersError;

      setGameRooms(roomsData || []);
      setPlayers(playersData || []);

      // Calculate stats
      const totalRooms = roomsData?.length || 0;
      const activeRooms = roomsData?.filter(room => room.status === 'in_progress').length || 0;
      const waitingRooms = roomsData?.filter(room => room.status === 'waiting').length || 0;
      const totalPlayers = playersData?.length || 0;

      setStats({ totalRooms, activeRooms, totalPlayers, waitingRooms });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to fetch data: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const roomsChannel = supabase
      .channel('admin-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms' }, () => {
        fetchData();
      })
      .subscribe();

    const playersChannel = supabase
      .channel('admin-players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(playersChannel);
    };
  };

  const deleteRoom = async (roomId: string) => {
    try {
      // First delete all players in the room
      await supabase
        .from('game_players')
        .delete()
        .eq('game_room_id', roomId);

      // Then delete the game state
      await supabase
        .from('game_state')
        .delete()
        .eq('game_room_id', roomId);

      // Finally delete the room
      const { error } = await supabase
        .from('game_rooms')
        .delete()
        .eq('id', roomId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Room deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to delete room: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const cleanupOldRooms = async () => {
    try {
      const { error } = await supabase.rpc('cleanup_old_game_rooms');
      if (error) throw error;

      toast({
        title: "Success",
        description: "Old rooms cleaned up successfully",
      });
      
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to cleanup rooms: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      waiting: 'outline',
      in_progress: 'default',
      finished: 'secondary',
    };
    
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getRoomPlayers = (roomId: string) => {
    return players.filter(player => player.game_room_id === roomId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg font-semibold">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/')} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Game
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Settings className="w-8 h-8" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground">Monitor and manage game rooms</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={cleanupOldRooms} variant="outline" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Cleanup Old Rooms
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRooms}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Games</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeRooms}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waiting Rooms</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.waitingRooms}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Players</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPlayers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Game Rooms Table */}
        <Card>
          <CardHeader>
            <CardTitle>Game Rooms</CardTitle>
            <CardDescription>All active and waiting game rooms</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Players</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gameRooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.name}</TableCell>
                    <TableCell>{getStatusBadge(room.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setSelectedRoom(selectedRoom === room.id ? null : room.id)}
                        className="p-0 h-auto"
                      >
                        {room.current_players}/{room.max_players}
                      </Button>
                    </TableCell>
                    <TableCell>{new Date(room.created_at).toLocaleString()}</TableCell>
                    <TableCell>{new Date(room.updated_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button
                        onClick={() => deleteRoom(room.id)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Player Details */}
        {selectedRoom && (
          <Card>
            <CardHeader>
              <CardTitle>Players in Room</CardTitle>
              <CardDescription>
                {gameRooms.find(r => r.id === selectedRoom)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player Name</TableHead>
                    <TableHead>Connected</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getRoomPlayers(selectedRoom).map((player) => (
                    <TableRow key={player.id}>
                      <TableCell className="font-medium">{player.display_name || 'Anonymous'}</TableCell>
                      <TableCell>
                        <Badge variant={player.is_connected ? 'default' : 'destructive'}>
                          {player.is_connected ? 'Online' : 'Offline'}
                        </Badge>
                      </TableCell>
                      <TableCell>{player.score}</TableCell>
                      <TableCell>{new Date(player.joined_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;