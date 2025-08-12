import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { filterPlayerData } from '@/utils/playerUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Play, Copy, Check } from 'lucide-react';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import { useToast } from '@/hooks/use-toast';
import DominoTile from './DominoTile';
import GameBoard from './GameBoard';

type GamePlayer = {
  id: string;
  game_room_id: string;
  user_id: string;
  display_name: string;
  position: number;
  hand: any[];
  score: number;
  is_current_player: boolean;
  is_connected: boolean;
  joined_at: string;
};

interface MultiplayerGameRoomProps {
  gameRoomId: string;
  user: any;
  onLeaveRoom: () => void;
}

const MultiplayerGameRoom = ({ gameRoomId, user, onLeaveRoom }: MultiplayerGameRoomProps) => {
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [gameRoom, setGameRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const {
    gameState,
    placedDominoes,
    selectedDomino,
    playableDominoes,
    startGame,
    handleDominoClick,
    handleBoardClick,
    isHost,
  } = useMultiplayerGame(gameRoomId, user);

  useEffect(() => {
    joinGameRoom().then(() => {
      fetchGameRoom();
      fetchPlayers();
    });

    // Subscribe to real-time updates
    const playersSubscription = supabase
      .channel(`game_players_${gameRoomId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'game_players', filter: `game_room_id=eq.${gameRoomId}` },
        () => {
          fetchPlayers();
        }
      )
      .subscribe();

    const roomSubscription = supabase
      .channel(`game_room_${gameRoomId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${gameRoomId}` },
        () => {
          fetchGameRoom();
        }
      )
      .subscribe();

    // Cleanup when leaving
    return () => {
      playersSubscription.unsubscribe();
      roomSubscription.unsubscribe();
      leaveGameRoom();
    };
  }, [gameRoomId, user.id]);

  const fetchGameRoom = async () => {
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', gameRoomId)
        .single();

      if (error) throw error;
      setGameRoom(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch game room details",
        variant: "destructive",
      });
    }
  };

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_room_id', gameRoomId)
        .order('position');

      if (error) throw error;
      
      // Filter player data to ensure security - only current user can see their own hand
      const rawPlayers = (data || []).map(player => ({
        ...player,
        hand: Array.isArray(player.hand) ? player.hand : []
      }));
      const filteredPlayers = filterPlayerData(rawPlayers, user.id);
      setPlayers(filteredPlayers);
    } catch (error: any) {
      console.error('Fetch players error:', error);
      toast({
        title: "Error",
        description: `Failed to fetch players: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const joinGameRoom = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({
          title: 'Authentication Error',
          description: 'Please sign in again to join the game.',
          variant: 'destructive',
        });
        return;
      }

      const displayName = session.user.user_metadata?.display_name || session.user.email;

      const { error } = await supabase.rpc('join_game_room_atomic', {
        p_game_room_id: gameRoomId,
        p_display_name: displayName,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Join room error:', error);
      toast({
        title: 'Error',
        description: `Failed to join game room: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const leaveGameRoom = async () => {
    try {
      await supabase
        .from('game_players')
        .update({ is_connected: false })
        .eq('game_room_id', gameRoomId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(gameRoomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Room ID copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy room ID",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-foreground mb-2">Loading game room...</div>
          <div className="text-muted-foreground">Please wait while we set up your game</div>
        </div>
      </div>
    );
  }

  const canStartGame = players.length >= 2 && gameRoom?.status === 'waiting' && isHost;
  const currentPlayer = players.find(p => p.user_id === user.id);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={onLeaveRoom} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Leave Room
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{gameRoom?.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Room ID: {gameRoomId.slice(0, 8)}...</span>
                <Button 
                  onClick={copyRoomId} 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant={gameRoom?.status === 'playing' ? 'default' : 'secondary'}>
              {gameRoom?.status === 'waiting' ? 'Waiting for players' : 
               gameRoom?.status === 'playing' ? 'Game in progress' : 'Game finished'}
            </Badge>
            
            {canStartGame && (
              <Button onClick={startGame}>
                <Play className="w-4 h-4 mr-2" />
                Start Game
              </Button>
            )}
          </div>
        </div>

        {gameRoom?.status === 'waiting' ? (
          /* Waiting Room */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((position) => {
              const player = players.find(p => p.position === position);
              const isHost = player && gameRoom?.host_id === player.user_id;
              return (
                <Card key={position} className={player ? 'border-accent' : 'border-dashed'}>
                  <CardHeader className="text-center">
                    <CardTitle className="text-sm">
                      {player ? (
                        <div className="flex items-center justify-center gap-2">
                          <span>{player.display_name}</span>
                          {isHost && (
                            <Badge variant="secondary" className="text-xs">
                              Host
                            </Badge>
                          )}
                        </div>
                      ) : (
                        `Player ${position + 1} Slot`
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    {player ? (
                      <div>
                        <Badge variant={player.is_connected ? 'default' : 'secondary'} className="mt-2">
                          {player.is_connected ? 'Connected' : 'Disconnected'}
                        </Badge>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">Waiting for player...</div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Game Area */
          <div className="relative w-full h-[600px] bg-gradient-to-br from-game-table to-game-felt rounded-xl border-4 border-wood-border shadow-[var(--shadow-game)]">
            <GameBoard
              placedDominoes={placedDominoes}
              onBoardClick={selectedDomino ? handleBoardClick : undefined}
              leftEnd={gameState?.left_end || null}
              rightEnd={gameState?.right_end || null}
            />

            {/* Player Hand */}
            {currentPlayer && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <div className="flex gap-2 p-2 bg-secondary/80 backdrop-blur-sm rounded-lg">
                  {currentPlayer.hand.map((domino: any) => (
                    <div
                      key={domino.id}
                      onClick={() => (gameState?.current_player_id === user.id ? handleDominoClick(domino.id) : null)}
                      className={`cursor-pointer transform transition-all duration-200 ${
                        gameState?.current_player_id === user.id && playableDominoes.includes(domino.id)
                          ? 'hover:scale-110 hover:-translate-y-2 ring-2 ring-accent'
                          : gameState?.current_player_id === user.id
                          ? 'hover:scale-105 opacity-60'
                          : 'opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <DominoTile
                        domino={domino}
                        rotation={0}
                        selected={selectedDomino === domino.id}
                        playable={gameState?.current_player_id === user.id && playableDominoes.includes(domino.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other Players Info */}
            <div className="absolute top-4 right-4 space-y-2">
              {players.filter(p => p.user_id !== user.id).map((player) => (
                <div
                  key={player.id}
                  className={`bg-secondary/80 backdrop-blur-sm rounded-lg p-3 ${
                    player.is_current_player ? 'ring-2 ring-accent' : ''
                  }`}
                >
                  <div className="font-medium text-secondary-foreground">{player.display_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {player.hand.length} dominoes • {player.score} points
                  </div>
                </div>
              ))}
            </div>

            {/* Selected domino indicator */}
            {selectedDomino && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                <div className="bg-accent/90 backdrop-blur-sm rounded-lg p-4 text-center">
                  <div className="text-accent-foreground font-medium mb-2">
                    Choose which end to play on
                  </div>
                  <div className="text-sm text-accent-foreground/80">
                    Click on the left or right end of the domino chain
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Game Instructions */}
        <div className="mt-6 bg-muted/50 backdrop-blur-sm rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-2">
            {gameRoom?.status === 'waiting' ? 'Waiting for Players' : 'How to Play:'}
          </h3>
          {gameRoom?.status === 'waiting' ? (
            <p className="text-sm text-muted-foreground">
              Share the room ID with friends to invite them. Need at least 2 players to start.
              {isHost && ' As the host, you can start the game when ready.'}
            </p>
          ) : (
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Match the number of pips on your domino to either end of the chain</li>
              <li>• Click on a highlighted domino in your hand to play it</li>
              <li>• If both ends are playable, click on the end you want to play on</li>
              <li>• The first player to play all their dominoes wins the round!</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiplayerGameRoom;
