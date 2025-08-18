import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createDominoSet, dealDominoes, findStartingPlayer, canPlayDomino, getPlayOrientation } from '@/utils/dominoUtils';
import { DominoLayoutEngine, createPlacedDomino } from '@/utils/dominoLayoutUtils';
import type { Domino, PlacedDomino } from '@/types/domino';

export const useMultiplayerGame = (gameRoomId: string, user: any) => {
  const [gameState, setGameState] = useState<any>(null);
  const [placedDominoes, setPlacedDominoes] = useState<PlacedDomino[]>([]);
  const [selectedDomino, setSelectedDomino] = useState<string | null>(null);
  const [playableDominoes, setPlayableDominoes] = useState<string[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [layoutEngine] = useState(() => new DominoLayoutEngine({ width: 1200, height: 600, padding: 40 }));
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
        
        console.log('🎯 Debug: fetchGameState - current player data:', {
          currentPlayer,
          gameState: data,
          userId: user.id,
          isFirstMove: !data.left_end && !data.right_end
        });
        
        // Parse player hand from JSON with improved error handling
        let playerHand: Domino[] = [];
        try {
          if (typeof currentPlayer?.hand === 'string') {
            const parsed = JSON.parse(currentPlayer.hand);
            playerHand = Array.isArray(parsed) ? parsed : [];
          } else if (Array.isArray(currentPlayer?.hand)) {
            playerHand = currentPlayer.hand as unknown as Domino[];
          } else {
            console.warn('🎯 Debug: Invalid hand format:', currentPlayer?.hand);
            playerHand = [];
          }
        } catch (e) {
          console.error('🎯 Debug: Hand parsing error:', e, currentPlayer?.hand);
          playerHand = [];
        }
        
        console.log('🎯 Debug: Player hand parsed:', playerHand);
        
        // Check if this is the first move (no dominoes on board)
        const isFirstMove = !data.left_end && !data.right_end;
        console.log('🎯 Debug: Is first move?', isFirstMove);
        
        // Find the highest double for the first move
        const findHighestDouble = (hand: Domino[]): Domino | null => {
          let highestDouble: Domino | null = null;
          hand.forEach(domino => {
            if (domino.isDouble && (highestDouble === null || domino.left > highestDouble.left)) {
              highestDouble = domino;
            }
          });
          return highestDouble;
        };
        
        let playable: string[] = [];
        
        if (isFirstMove) {
          // For the first move, only the highest double is playable
          const startingDomino = findHighestDouble(playerHand);
          console.log('🎯 Debug: Starting domino (highest double):', startingDomino);
          playable = startingDomino ? [startingDomino.id] : [];
        } else {
          // For subsequent moves, check against board ends
          playable = playerHand
            .filter((domino: Domino) => {
              const canPlay = canPlayDomino(domino, data.left_end, data.right_end);
              console.log('🎯 Debug: Domino playability check:', {
                domino: domino.id,
                leftVal: domino.left,
                rightVal: domino.right,
                boardLeftEnd: data.left_end,
                boardRightEnd: data.right_end,
                canPlay
              });
              return canPlay;
            })
            .map((domino: Domino) => domino.id);
        }
          
        console.log('🎯 Debug: Final playable dominoes:', playable);
        setPlayableDominoes(playable);
        } else {
          setPlayableDominoes([]);
        }
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  const getCurrentPlayer = useCallback(async () => {
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
  }, [gameRoomId, user.id]);

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
          .update({ hand: ((playerHands[i] || []) as any) })
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
    console.log('🎯 handleDominoClick called with dominoId:', dominoId);
    console.log('🎯 Current playableDominoes state:', playableDominoes);
    console.log('🎯 Current gameState:', gameState);
    console.log('🎯 Current user id:', user.id);
    console.log('🎯 Current player id from gameState:', gameState?.current_player_id);
    
    // Only the current player (from game_state) can act
    if (gameState?.current_player_id !== user.id) {
      console.log('🎯 Not current player, returning early');
      return;
    }

    const currentPlayer = await getCurrentPlayer();
    console.log('🎯 Current player data:', currentPlayer);

    // Parse player hand
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
    console.log('🎯 Found domino in hand:', domino);
    if (!domino) {
      toast({
        title: 'Error',
        description: 'Domino not found in your hand.',
        variant: 'destructive',
      });
      return;
    }

    // Check if this is the first move
    const isFirstMove = !gameState?.left_end && !gameState?.right_end;
    console.log('🎯 Is first move?', isFirstMove);

    // Fallback playability check (don't rely solely on playableDominoes state)
    let canPlayThisDomino = false;
    let playabilityReason = '';

    if (isFirstMove) {
      // For first move, check if this is the highest double
      const highestDouble = playerHand
        .filter(d => d.isDouble)
        .sort((a, b) => b.left - a.left)[0];
      
      canPlayThisDomino = domino.id === highestDouble?.id;
      playabilityReason = canPlayThisDomino 
        ? 'First move: This is the highest double' 
        : `First move: You must play the highest double (${highestDouble?.left}-${highestDouble?.left})`;
    } else {
      // For subsequent moves, check against board ends
      const leftEnd = gameState?.left_end;
      const rightEnd = gameState?.right_end;
      const canPlayLeft = leftEnd === null || domino.left === leftEnd || domino.right === leftEnd;
      const canPlayRight = rightEnd === null || domino.left === rightEnd || domino.right === rightEnd;
      
      canPlayThisDomino = canPlayLeft || canPlayRight;
      playabilityReason = canPlayThisDomino 
        ? 'Can play on available ends' 
        : `Cannot match board ends (${leftEnd}, ${rightEnd}) with domino (${domino.left}, ${domino.right})`;
    }

    console.log('🎯 Fallback playability check:', { canPlayThisDomino, playabilityReason });
    console.log('🎯 playableDominoes.includes check:', playableDominoes.includes(dominoId));

    // Use fallback check if playableDominoes state seems incorrect
    if (!canPlayThisDomino) {
      toast({
        title: 'Cannot Play',
        description: playabilityReason,
        variant: 'destructive',
      });
      return;
    }

    // Additional check: if playableDominoes doesn't include this domino but our fallback says it's playable,
    // it might be a timing issue with the state
    if (!playableDominoes.includes(dominoId) && canPlayThisDomino) {
      console.log('🎯 WARNING: playableDominoes state seems stale, but domino is actually playable');
    }

    // Check if we need to select which end to play on
    const canPlayLeft = gameState.left_end === null || domino.left === gameState.left_end || domino.right === gameState.left_end;
    const canPlayRight = gameState.right_end === null || domino.left === gameState.right_end || domino.right === gameState.right_end;

    if (canPlayLeft && canPlayRight && gameState.left_end !== null && gameState.right_end !== null) {
      setSelectedDomino(dominoId);
      return;
    }

    // Auto-play if only one end is available
    const side = canPlayLeft ? 'left' : 'right';
    await playDomino(dominoId, side);
  }, [gameState, playableDominoes, toast, getCurrentPlayer]);

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

      const leftEnd = gameState.left_end;
      const rightEnd = gameState.right_end;

      // Determine if this is the very first move
      const isFirstMove = (leftEnd === null && rightEnd === null) || placedDominoes.length === 0;

      // Validate the chosen side specifically (prevents illegal side placement)
      if (!isFirstMove) {
        if (side === 'left') {
          if (leftEnd !== null && domino.left !== leftEnd && domino.right !== leftEnd) {
            toast({
              title: 'Illegal move',
              description: `Domino ${domino.left}-${domino.right} doesn't match left end (${leftEnd}).`,
              variant: 'destructive',
            });
            return;
          }
        } else {
          if (rightEnd !== null && domino.left !== rightEnd && domino.right !== rightEnd) {
            toast({
              title: 'Illegal move',
              description: `Domino ${domino.left}-${domino.right} doesn't match right end (${rightEnd})..`,
              variant: 'destructive',
            });
            return;
          }
        }
      }

      // Calculate new ends
      let newLeftEnd = leftEnd;
      let newRightEnd = rightEnd;

      if (isFirstMove) {
        // First move: both ends are set from the played domino
        newLeftEnd = domino.left;
        newRightEnd = domino.right;
      } else if (side === 'left') {
        if (leftEnd === domino.left) newLeftEnd = domino.right;
        else if (leftEnd === domino.right) newLeftEnd = domino.left;
      } else {
        if (rightEnd === domino.left) newRightEnd = domino.right;
        else if (rightEnd === domino.right) newRightEnd = domino.left;
      }

      // Calculate position using layout engine
      const position = layoutEngine.calculateNextPosition(domino, side, isFirstMove);
      
      // Determine which end of the domino connects to the chain
      let connectionSide: 'left' | 'right' = 'left';
      if (!isFirstMove) {
        if (side === 'left') {
          connectionSide = (leftEnd === domino.left) ? 'left' : 'right';
        } else {
          connectionSide = (rightEnd === domino.left) ? 'left' : 'right';
        }
      }
      
      const newPlacedDomino = createPlacedDomino(domino, position, side, connectionSide);

      // Update player's hand  
      const newHand = playerHand.filter((d: Domino) => d.id !== dominoId);
      await supabase
        .from('game_players')
        .update({ hand: (newHand as any) })
        .eq('id', currentPlayer.id);

      // Determine next player from turn_order
      const order: string[] = Array.isArray(gameState?.turn_order) ? (gameState.turn_order as unknown as string[]) : [];
      const currentIdx = Math.max(0, order.indexOf(user.id));
      const nextPlayerId = order.length > 0 ? order[(currentIdx + 1) % order.length] : user.id;

      // Update game state: prepend for left, append for right
      const newPlacedDominoes = side === 'left'
        ? [newPlacedDomino, ...placedDominoes]
        : [...placedDominoes, newPlacedDomino];

      await supabase
        .from('game_state')
        .update({
          left_end: newLeftEnd as any,
          right_end: newRightEnd as any,
          placed_dominoes: newPlacedDominoes as any,
          current_player_id: nextPlayerId,
        } as any)
        .eq('game_room_id', gameRoomId);

      setSelectedDomino(null);

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

  const passTurn = async () => {
    try {
      // Only the current player can pass
      if (gameState?.current_player_id !== user.id) return;

      // Prevent passing if player has a playable domino
      if (playableDominoes.length > 0) {
        toast({
          title: 'Cannot Pass',
          description: 'You have a playable domino.',
          variant: 'destructive',
        });
        return;
      }

      // Fetch all players to determine if anyone can play
      const { data: players, error: playersError } = await supabase
        .from('game_players')
        .select('id, user_id, hand, position')
        .eq('game_room_id', gameRoomId)
        .order('position');
      if (playersError) throw playersError;

      const leftEnd = gameState?.left_end ?? null;
      const rightEnd = gameState?.right_end ?? null;

      const anyoneCanPlay = (players || []).some((p) => {
        let hand: Domino[] = [];
        try {
          if (typeof p.hand === 'string') hand = JSON.parse(p.hand as any);
          else if (Array.isArray(p.hand)) hand = p.hand as unknown as Domino[];
        } catch {
          hand = [];
        }
        return hand.some((d) => canPlayDomino(d, leftEnd, rightEnd));
      });

      if (!anyoneCanPlay) {
        // End the game: update room status and clear current player
        await supabase.from('game_rooms').update({ status: 'finished' }).eq('id', gameRoomId);
        await supabase.from('game_state').update({ current_player_id: null as any }).eq('game_room_id', gameRoomId);

        toast({
          title: 'Round Ended',
          description: 'No one can play. Hands are revealed.',
        });
        return;
      }

      // Advance to next player
      const order: string[] = Array.isArray(gameState?.turn_order) ? (gameState.turn_order as unknown as string[]) : [];
      const currentIdx = Math.max(0, order.indexOf(user.id));
      const nextPlayerId = order.length > 0 ? order[(currentIdx + 1) % order.length] : user.id;

      await supabase
        .from('game_state')
        .update({ current_player_id: nextPlayerId } as any)
        .eq('game_room_id', gameRoomId);

      toast({ title: 'Passed', description: 'Turn passed to next player.' });
    } catch (error: any) {
      console.error('Pass turn error:', error);
      toast({ title: 'Error', description: 'Failed to pass turn', variant: 'destructive' });
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
    passTurn,
  };
};