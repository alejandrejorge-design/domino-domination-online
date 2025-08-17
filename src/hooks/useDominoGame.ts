import { useState, useCallback, useMemo } from 'react';
import { GameState, Player, Domino, PlacedDomino } from '@/types/domino';
import { 
  createDominoSet, 
  dealDominoes, 
  findStartingPlayer, 
  canPlayDomino,
  getPlayOrientation 
} from '@/utils/dominoUtils';
import { DominoLayoutEngine, createPlacedDomino } from '@/utils/dominoLayoutUtils';
import { useToast } from '@/hooks/use-toast';

export const useDominoGame = () => {
  const { toast } = useToast();
  const [layoutEngine] = useState(() => new DominoLayoutEngine({ width: 1200, height: 600, padding: 40 }));
  
  const [gameState, setGameState] = useState<GameState>(() => {
    const dominoes = createDominoSet();
    const { playerHands, boneyard } = dealDominoes(dominoes, 4);
    
    const players: Player[] = [
      { id: 'player-1', name: 'You', hand: playerHands[0], score: 0, isCurrentPlayer: false },
      { id: 'player-2', name: 'Player 2', hand: playerHands[1], score: 0, isCurrentPlayer: false },
      { id: 'player-3', name: 'Player 3', hand: playerHands[2], score: 0, isCurrentPlayer: false },
      { id: 'player-4', name: 'Player 4', hand: playerHands[3], score: 0, isCurrentPlayer: false },
    ];
    
    const startingPlayerIndex = findStartingPlayer(players);
    players[startingPlayerIndex].isCurrentPlayer = true;
    
    return {
      players,
      board: [],
      boneyard,
      currentPlayerIndex: startingPlayerIndex,
      gamePhase: 'playing',
      leftEnd: null,
      rightEnd: null,
    };
  });

  const [placedDominoes, setPlacedDominoes] = useState<PlacedDomino[]>([]);
  const [selectedDomino, setSelectedDomino] = useState<string | null>(null);

  // Get playable dominoes for current player
  const playableDominoes = useMemo(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return [];
    
    return currentPlayer.hand
      .filter(domino => canPlayDomino(domino, gameState.leftEnd, gameState.rightEnd))
      .map(domino => domino.id);
  }, [gameState.players, gameState.currentPlayerIndex, gameState.leftEnd, gameState.rightEnd]);

  // Start new game
  const startNewGame = useCallback(() => {
    const dominoes = createDominoSet();
    const { playerHands, boneyard } = dealDominoes(dominoes, 4);
    
    const players: Player[] = [
      { id: 'player-1', name: 'You', hand: playerHands[0], score: 0, isCurrentPlayer: false },
      { id: 'player-2', name: 'Player 2', hand: playerHands[1], score: 0, isCurrentPlayer: false },
      { id: 'player-3', name: 'Player 3', hand: playerHands[2], score: 0, isCurrentPlayer: false },
      { id: 'player-4', name: 'Player 4', hand: playerHands[3], score: 0, isCurrentPlayer: false },
    ];
    
    const startingPlayerIndex = findStartingPlayer(players);
    players[startingPlayerIndex].isCurrentPlayer = true;
    
    setGameState({
      players,
      board: [],
      boneyard,
      currentPlayerIndex: startingPlayerIndex,
      gamePhase: 'playing',
      leftEnd: null,
      rightEnd: null,
    });
    
    setPlacedDominoes([]);
    setSelectedDomino(null);
    
    toast({
      title: "New Game Started!",
      description: `${players[startingPlayerIndex].name} goes first with the highest double.`,
    });
  }, [toast]);

  // Play a domino
  const playDomino = useCallback((dominoId: string, side?: 'left' | 'right') => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const domino = currentPlayer.hand.find(d => d.id === dominoId);
    
    if (!domino || !canPlayDomino(domino, gameState.leftEnd, gameState.rightEnd)) {
      toast({
        title: "Invalid Move",
        description: "This domino cannot be played here.",
        variant: "destructive",
      });
      return;
    }

    let placementSide = side;
    
    // For first domino or when only one end is available
    if (gameState.leftEnd === null && gameState.rightEnd === null) {
      placementSide = 'left'; // First domino
    } else if (gameState.leftEnd === null) {
      placementSide = 'left';
    } else if (gameState.rightEnd === null) {
      placementSide = 'right';
    } else if (!placementSide) {
      // Player needs to choose which end
      setSelectedDomino(dominoId);
      return;
    }

    // Calculate new ends
    let newLeftEnd = gameState.leftEnd;
    let newRightEnd = gameState.rightEnd;
    
    if (placementSide === 'left') {
      const oriented = getPlayOrientation(domino, gameState.leftEnd || domino.left, 'left');
      newLeftEnd = gameState.leftEnd === oriented.left ? oriented.right : oriented.left;
    } else {
      const oriented = getPlayOrientation(domino, gameState.rightEnd || domino.right, 'right');
      newRightEnd = gameState.rightEnd === oriented.right ? oriented.left : oriented.right;
    }

    // Calculate position using layout engine
    const isFirstMove = placedDominoes.length === 0;
    const position = layoutEngine.calculateNextPosition(domino, placementSide, isFirstMove);
    
    // Determine connection side
    let connectionSide: 'left' | 'right' = 'left';
    if (!isFirstMove) {
      if (placementSide === 'left') {
        connectionSide = (gameState.leftEnd === domino.left) ? 'left' : 'right';
      } else {
        connectionSide = (gameState.rightEnd === domino.left) ? 'left' : 'right';
      }
    }
    
    const newPlacedDomino = createPlacedDomino(domino, position, placementSide, connectionSide);

    // Update game state
    setGameState(prev => {
      const newPlayers = [...prev.players];
      newPlayers[prev.currentPlayerIndex].hand = newPlayers[prev.currentPlayerIndex].hand.filter(d => d.id !== dominoId);
      
      // Move to next player
      const nextPlayerIndex = (prev.currentPlayerIndex + 1) % 4;
      newPlayers[prev.currentPlayerIndex].isCurrentPlayer = false;
      newPlayers[nextPlayerIndex].isCurrentPlayer = true;

      return {
        ...prev,
        players: newPlayers,
        board: [...prev.board, domino],
        currentPlayerIndex: nextPlayerIndex,
        leftEnd: newLeftEnd,
        rightEnd: newRightEnd,
      };
    });

    setPlacedDominoes(prev => [...prev, newPlacedDomino]);
    setSelectedDomino(null);
    
    toast({
      title: "Domino Played!",
      description: `${currentPlayer.name} played ${domino.left}-${domino.right}`,
    });
  }, [gameState, placedDominoes, toast]);

  // Handle domino selection
  const handleDominoClick = useCallback((dominoId: string) => {
    if (gameState.currentPlayerIndex !== 0) return; // Only allow human player to play
    
    if (!playableDominoes.includes(dominoId)) {
      toast({
        title: "Cannot Play",
        description: "This domino cannot be played on either end.",
        variant: "destructive",
      });
      return;
    }

    playDomino(dominoId);
  }, [gameState.currentPlayerIndex, playableDominoes, playDomino, toast]);

  // Handle board click for side selection
  const handleBoardClick = useCallback((side: 'left' | 'right') => {
    if (selectedDomino) {
      playDomino(selectedDomino, side);
    }
  }, [selectedDomino, playDomino]);

  return {
    gameState,
    placedDominoes,
    selectedDomino,
    playableDominoes,
    startNewGame,
    handleDominoClick,
    handleBoardClick,
    currentPlayer: gameState.players[gameState.currentPlayerIndex],
  };
};