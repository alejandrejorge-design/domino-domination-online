import { PlacedDomino, Domino } from '@/types/domino';

export interface LayoutPosition {
  x: number;
  y: number;
  rotation: number;
  direction: 'north' | 'south' | 'east' | 'west';
  isCornerTurn: boolean;
}

export interface LayoutBounds {
  width: number;
  height: number;
  padding: number;
}

const TILE_WIDTH = 64; // 16 * 4 (w-16)
const TILE_HEIGHT = 128; // 32 * 4 (h-32)
const TILE_SPACING = 8;

export class DominoLayoutEngine {
  private bounds: LayoutBounds;
  private currentDirection: 'north' | 'south' | 'east' | 'west' = 'east';
  private currentX: number = 0;
  private currentY: number = 0;
  private chainLength: number = 0;

  constructor(bounds: LayoutBounds) {
    this.bounds = bounds;
    // Start in center
    this.currentX = bounds.width / 2;
    this.currentY = bounds.height / 2;
  }

  calculateNextPosition(domino: Domino, side: 'left' | 'right', isFirst: boolean = false): LayoutPosition {
    if (isFirst) {
      // First domino always placed horizontally in center
      return {
        x: this.currentX,
        y: this.currentY,
        rotation: 0,
        direction: 'east',
        isCornerTurn: false
      };
    }

    const isDouble = domino.isDouble;
    let rotation = 0;
    let deltaX = 0;
    let deltaY = 0;
    let newDirection = this.currentDirection;
    let isCornerTurn = false;

    // Calculate movement based on current direction
    switch (this.currentDirection) {
      case 'east':
        deltaX = TILE_WIDTH + TILE_SPACING;
        deltaY = 0;
        rotation = isDouble ? 90 : 0; // Doubles are perpendicular
        break;
      case 'west':
        deltaX = -(TILE_WIDTH + TILE_SPACING);
        deltaY = 0;
        rotation = isDouble ? 90 : 0;
        break;
      case 'north':
        deltaX = 0;
        deltaY = -(TILE_HEIGHT + TILE_SPACING);
        rotation = isDouble ? 0 : 90; // Doubles stay horizontal, regular tiles vertical
        break;
      case 'south':
        deltaX = 0;
        deltaY = TILE_HEIGHT + TILE_SPACING;
        rotation = isDouble ? 0 : 90;
        break;
    }

    // Check for boundary collision and corner turn
    const nextX = this.currentX + deltaX;
    const nextY = this.currentY + deltaY;

    if (this.shouldTurnCorner(nextX, nextY)) {
      // Turn corner
      newDirection = this.getCornerDirection(this.currentDirection, nextX, nextY);
      isCornerTurn = true;
      
      // Recalculate position for corner turn
      const cornerPos = this.calculateCornerPosition(domino, newDirection);
      return {
        ...cornerPos,
        isCornerTurn: true
      };
    }

    // Update engine state
    this.currentX = nextX;
    this.currentY = nextY;
    this.currentDirection = newDirection;
    this.chainLength++;

    return {
      x: this.currentX,
      y: this.currentY,
      rotation,
      direction: newDirection,
      isCornerTurn
    };
  }

  private shouldTurnCorner(x: number, y: number): boolean {
    const margin = TILE_WIDTH + 20; // Safety margin
    return (
      x <= margin || 
      x >= this.bounds.width - margin ||
      y <= margin || 
      y >= this.bounds.height - margin
    );
  }

  private getCornerDirection(
    currentDir: 'north' | 'south' | 'east' | 'west',
    x: number,
    y: number
  ): 'north' | 'south' | 'east' | 'west' {
    // Determine turn direction based on which boundary we hit
    if (x <= TILE_WIDTH + 20) {
      // Hit left boundary
      return currentDir === 'north' ? 'east' : 'north';
    } else if (x >= this.bounds.width - TILE_WIDTH - 20) {
      // Hit right boundary
      return currentDir === 'north' ? 'west' : 'south';
    } else if (y <= TILE_HEIGHT + 20) {
      // Hit top boundary
      return currentDir === 'east' ? 'south' : 'west';
    } else {
      // Hit bottom boundary
      return currentDir === 'east' ? 'north' : 'east';
    }
  }

  private calculateCornerPosition(
    domino: Domino,
    newDirection: 'north' | 'south' | 'east' | 'west'
  ): LayoutPosition {
    // Calculate corner position with proper spacing
    let cornerX = this.currentX;
    let cornerY = this.currentY;
    let rotation = 0;

    const isDouble = domino.isDouble;

    switch (newDirection) {
      case 'north':
        cornerY -= TILE_HEIGHT + TILE_SPACING;
        rotation = isDouble ? 0 : 90;
        break;
      case 'south':
        cornerY += TILE_HEIGHT + TILE_SPACING;
        rotation = isDouble ? 0 : 90;
        break;
      case 'east':
        cornerX += TILE_WIDTH + TILE_SPACING;
        rotation = isDouble ? 90 : 0;
        break;
      case 'west':
        cornerX -= TILE_WIDTH + TILE_SPACING;
        rotation = isDouble ? 90 : 0;
        break;
    }

    // Update engine state
    this.currentX = cornerX;
    this.currentY = cornerY;
    this.currentDirection = newDirection;
    this.chainLength++;

    return {
      x: cornerX,
      y: cornerY,
      rotation,
      direction: newDirection,
      isCornerTurn: false
    };
  }

  // Update position for left-side placement (prepending to chain)
  updateForLeftPlacement(): void {
    // When adding to left, we need to shift perspective
    // The "current" position becomes the left end
    this.chainLength++;
  }

  reset(): void {
    this.currentX = this.bounds.width / 2;
    this.currentY = this.bounds.height / 2;
    this.currentDirection = 'east';
    this.chainLength = 0;
  }
}

export function createPlacedDomino(
  domino: Domino,
  position: LayoutPosition,
  side: 'left' | 'right',
  connectionSide: 'left' | 'right'
): PlacedDomino {
  return {
    ...domino,
    x: position.x,
    y: position.y,
    rotation: position.rotation,
    side,
    direction: position.direction,
    isCornerTurn: position.isCornerTurn,
    connectionSide
  };
}