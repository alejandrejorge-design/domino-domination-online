import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createDominoSet, dealDominoes, findStartingPlayer, canPlayDomino, getPlayOrientation } from '@/utils/dominoUtils';
import type { Domino, PlacedDomino } from '@/types/domino';

export const useMultiplayerGame = (gameRoomId: string, user: any) => {
  const [gameState, setGameState] = useState<any>(null);
  const [placedDominoes, setPlacedDominoes] = useState<PlacedDomino[]>([]);
  const [selectedDomino, setSelectedDomino] = useState<string | null>(null);
  const [playableDominoes, setPlayableDominoes] = useState<string[]>([]);
  const [isHost, setIsHost] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkIfHost();
    fetchGameState();

    // Subscribe to game state changes
    const subscription = supabase
      .channel(`game_state_${gameRoomId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'game_state', filter: `game_room_id=eq.${gameRoomId}` },
        () => {
          fetchGameState();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [gameRoomId, user.id]);

  const checkIfHost = async () => {
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('host_id')
        .eq('id', gameRoomId)
        .single();

      if (error) throw error;
      setIsHost(data.host_id === user.id);
    } catch (error) {
      console.error('Error checking host status:', error);
    }
  };

  const fetchGameState = async () => {
    try {
      const { data, error } = await supabase
        .from('game_state')
        .select('*')
        .eq('game_room_id', gameRoomId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setGameState(data);
        
        // Parse placed dominoes from JSON
        let parsedPlacedDominoes: PlacedDomino[] = [];
        try {
          if (typeof data.placed_dominoes === 'string') {
            parsedPlacedDominoes = JSON.parse(data.placed_dominoes);
          } else if (Array.isArray(data.placed_dominoes)) {
            parsedPlacedDominoes = data.placed_dominoes as unknown as PlacedDomino[];
          }
        } catch (e) {
          parsedPlacedDominoes = [];
        }
        setPlacedDominoes(parsedPlacedDominoes);
        
        // Calculate playable dominoes for current user (based on game_state.current_player_id)
        if (data.current_player_id === user.id) {
          const currentPlayer = await getCurrentPlayer();
          // Parse player hand from JSON
          let playerHand: Domino[] = [];
          try {
            if (typeof currentPlayer?.hand === 'string') {
              playerHand = JSON.parse(currentPlayer?.hand as any);
            } else if (Array.isArray(currentPlayer?.hand)) {
              playerHand = currentPlayer?.hand as unknown as Domino[];
            }
          } catch (e) {
            playerHand = [];
          }
          
          const playable = playerHand
            .filter((domino: Domino) => canPlayDomino(domino, data.left_end, data.right_end))
            .map((domino: Domino) => domino.id);
          setPlayableDominoes(playable);
        } else {
          setPlayableDominoes([]);
        }
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  const getCurrentPlayer = async () => {
    try {
      const { data, error } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_room_id', gameRoomId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting current player:', error);
      return null;
    }
  };

  const startGame = useCallback(async () => {
    if (!isHost) return;

    try {
      // Create domino set and deal hands
      const dominoes = createDominoSet();
      const { playerHands, boneyard } = dealDominoes(dominoes, 4);

      // Get all players
      const { data: players, error: playersError } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_room_id', gameRoomId)
        .order('position');

      if (playersError) throw playersError;

      // Update each player's hand (host can update due to policy)
      for (let i = 0; i < players.length; i++) {
        await supabase
          .from('game_players')
          .update({ hand: JSON.stringify(playerHands[i] || []) })
          .eq('id', players[i].id);
      }

      // Determine turn order and starting player
      const turnOrder: string[] = players.map((p) => p.user_id);
      const startingPlayerIndex = findStartingPlayer(
        players.map((p) => ({
          ...p,
          name: p.display_name || '',
          isCurrentPlayer: false,
          hand: playerHands[p.position] || [],
        }))
      );
      const startingPlayerId = players[startingPlayerIndex].user_id;

      // Reset existing game state (if any), then insert a clean one
      await supabase.from('game_state').delete().eq('game_room_id', gameRoomId);
      const { error: stateError } = await supabase
        .from('game_state')
        .insert({
          game_room_id: gameRoomId,
          left_end: null as any,
          right_end: null as any,
          placed_dominoes: [] as any,
          current_player_id: startingPlayerId,
          turn_order: turnOrder as any,
          dominoes: boneyard as any,
        } as any);
      if (stateError) throw stateError;

      // Update room status
      const { error: roomError } = await supabase.from('game_rooms').update({ status: 'in_progress' }).eq('id', gameRoomId);
      if (roomError) throw roomError;

      toast({
        title: 'Game Started!',
        description: `${players[startingPlayerIndex].display_name} goes first.`,
      });
    } catch (error: any) {
      console.error('Start game error:', error);
      toast({
        title: 'Error',
        description: `Failed to start game: ${error.message}`,
        variant: 'destructive',
      });
    }
  }, [gameRoomId, isHost, toast]);

  const handleDominoClick = useCallback(async (dominoId: string) => {
    // Only the current player (from game_state) can act
    if (gameState?.current_player_id !== user.id) return;

    const currentPlayer = await getCurrentPlayer();

    if (!playableDominoes.includes(dominoId)) {
      toast({
        title: 'Cannot Play',
        description: 'This domino cannot be played on either end.',
        variant: 'destructive',
      });
      return;
    }

    // Check if we need to select which end to play on
    let playerHand: Domino[] = [];
    try {
      if (typeof currentPlayer?.hand === 'string') {
        playerHand = JSON.parse(currentPlayer?.hand);
      } else if (Array.isArray(currentPlayer?.hand)) {
        playerHand = currentPlayer?.hand as unknown as Domino[];
      }
    } catch (e) {
      playerHand = [];
    }
    
    const domino = playerHand.find((d: Domino) => d.id === dominoId);
    if (!domino) return;

    const canPlayLeft = gameState.left_end === null || domino.left === gameState.left_end || domino.right === gameState.left_end;
    const canPlayRight = gameState.right_end === null || domino.left === gameState.right_end || domino.right === gameState.right_end;

    if (canPlayLeft && canPlayRight && gameState.left_end !== null && gameState.right_end !== null) {
      setSelectedDomino(dominoId);
      return;
    }

    // Auto-play if only one end is available
    const side = canPlayLeft ? 'left' : 'right';
    await playDomino(dominoId, side);
  }, [gameState, playableDominoes, toast]);

  const handleBoardClick = useCallback(async (side: 'left' | 'right') => {
    if (selectedDomino) {
      await playDomino(selectedDomino, side);
      setSelectedDomino(null);
    }
  }, [selectedDomino]);

  const playDomino = async (dominoId: string, side: 'left' | 'right') => {
    try {
      // Only the current player (from game_state) can act
      if (gameState?.current_player_id !== user.id) return;

      const currentPlayer = await getCurrentPlayer();

      let playerHand: Domino[] = [];
      try {
        if (typeof currentPlayer?.hand === 'string') {
          playerHand = JSON.parse(currentPlayer?.hand);
        } else if (Array.isArray(currentPlayer?.hand)) {
          playerHand = currentPlayer?.hand as unknown as Domino[];
        }
      } catch (e) {
        playerHand = [];
      }
      
      const domino = playerHand.find((d: Domino) => d.id === dominoId);
      if (!domino) return;

      // Calculate new ends and placement
      let newLeftEnd = gameState.left_end;
      let newRightEnd = gameState.right_end;
      
      if (side === 'left') {
        const oriented = getPlayOrientation(domino, gameState.left_end ?? domino.left, 'left');
        newLeftEnd = gameState.left_end === oriented.left ? oriented.right : oriented.left;
      } else {
        const oriented = getPlayOrientation(domino, gameState.right_end ?? domino.right, 'right');
        newRightEnd = gameState.right_end === oriented.right ? oriented.left : oriented.right;
      }

      // Create placed domino
      const newPlacedDomino: PlacedDomino = {
        ...domino,
        x: placedDominoes.length * 70,
        y: 0,
        rotation: 0,
        side,
      };

      // Update player's hand  
      const newHand = playerHand.filter((d: Domino) => d.id !== dominoId);
      await supabase
        .from('game_players')
        .update({ hand: JSON.stringify(newHand) })
        .eq('id', currentPlayer.id);

      // Determine next player from turn_order
      const order: string[] = Array.isArray(gameState?.turn_order) ? (gameState.turn_order as unknown as string[]) : [];
      const currentIdx = Math.max(0, order.indexOf(user.id));
      const nextPlayerId = order.length > 0 ? order[(currentIdx + 1) % order.length] : user.id;

      // Update game state
      const newPlacedDominoes = [...placedDominoes, newPlacedDomino];
      await supabase
        .from('game_state')
        .update({
          left_end: newLeftEnd as any,
          right_end: newRightEnd as any,
          placed_dominoes: newPlacedDominoes as any,
          current_player_id: nextPlayerId,
        } as any)
        .eq('game_room_id', gameRoomId);

      toast({
        title: 'Domino Played!',
        description: `You played ${domino.left}-${domino.right}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to play domino',
        variant: 'destructive',
      });
    }
  };

  return {
    gameState,
    placedDominoes,
    selectedDomino,
    playableDominoes,
    startGame,
    handleDominoClick,
    handleBoardClick,
    isHost,
  };
};