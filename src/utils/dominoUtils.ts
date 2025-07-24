import { Domino, Player } from '@/types/domino';

// Create standard 28-piece double-six domino set
export const createDominoSet = (): Domino[] => {
  const dominoes: Domino[] = [];
  let id = 0;
  
  for (let left = 0; left <= 6; left++) {
    for (let right = left; right <= 6; right++) {
      dominoes.push({
        id: `domino-${id++}`,
        left,
        right,
        isDouble: left === right,
      });
    }
  }
  
  return dominoes;
};

// Shuffle array using Fisher-Yates algorithm
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Deal dominoes to players
export const dealDominoes = (dominoes: Domino[], playerCount: number = 4): { playerHands: Domino[][], boneyard: Domino[] } => {
  const shuffled = shuffleArray(dominoes);
  const handSize = 7; // Standard domino hand size for 4 players
  const playerHands: Domino[][] = [];
  
  for (let i = 0; i < playerCount; i++) {
    playerHands.push(shuffled.slice(i * handSize, (i + 1) * handSize));
  }
  
  const boneyard = shuffled.slice(playerCount * handSize);
  return { playerHands, boneyard };
};

// Find the player with the highest double to start
export const findStartingPlayer = (players: Player[]): number => {
  let highestDouble = -1;
  let startingPlayerIndex = 0;
  
  players.forEach((player, index) => {
    player.hand.forEach((domino) => {
      if (domino.isDouble && domino.left > highestDouble) {
        highestDouble = domino.left;
        startingPlayerIndex = index;
      }
    });
  });
  
  return startingPlayerIndex;
};

// Check if a domino can be played on either end
export const canPlayDomino = (domino: Domino, leftEnd: number | null, rightEnd: number | null): boolean => {
  if (leftEnd === null && rightEnd === null) return true; // First play
  
  return (
    (leftEnd !== null && (domino.left === leftEnd || domino.right === leftEnd)) ||
    (rightEnd !== null && (domino.left === rightEnd || domino.right === rightEnd))
  );
};

// Get the correct orientation for a domino when placed
export const getPlayOrientation = (domino: Domino, targetEnd: number, side: 'left' | 'right'): { left: number; right: number } => {
  if (domino.left === targetEnd) {
    return { left: domino.left, right: domino.right };
  } else {
    return { left: domino.right, right: domino.left };
  }
};