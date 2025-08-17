export interface Domino {
  id: string;
  left: number;
  right: number;
  isDouble: boolean;
}

export interface Player {
  id: string;
  name: string;
  hand: Domino[];
  score: number;
  isCurrentPlayer: boolean;
}

export interface GameState {
  players: Player[];
  board: Domino[];
  boneyard: Domino[];
  currentPlayerIndex: number;
  gamePhase: 'waiting' | 'playing' | 'finished';
  leftEnd: number | null;
  rightEnd: number | null;
}

export interface PlacedDomino extends Domino {
  x: number;
  y: number;
  rotation: number;
  side: 'left' | 'right';
  direction: 'north' | 'south' | 'east' | 'west';
  isCornerTurn: boolean;
  connectionSide: 'left' | 'right'; // Which end connects to the chain
}