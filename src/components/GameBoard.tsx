import { PlacedDomino } from '@/types/domino';
import DominoTile from './DominoTile';
import { cn } from '@/lib/utils';

interface GameBoardProps {
  placedDominoes: PlacedDomino[];
  onBoardClick?: (side: 'left' | 'right') => void;
  leftEnd: number | null;
  rightEnd: number | null;
}

const GameBoard = ({ placedDominoes, onBoardClick, leftEnd, rightEnd }: GameBoardProps) => {
  return (
    <div className="relative w-full h-full min-h-[400px] flex items-center justify-center overflow-hidden">
      {/* Game table background */}
      <div className="absolute inset-0 bg-gradient-to-br from-game-table to-game-felt rounded-xl border-4 border-wood-border shadow-[var(--shadow-game)]" />
      
      {/* Table pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full bg-[radial-gradient(circle_at_center,transparent_40%,hsl(var(--game-felt))_70%)]" />
      </div>

      {/* Center area for domino placement */}
      <div className="relative z-10 w-full h-full">
        {placedDominoes.length === 0 ? (
          // Empty board state
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="w-24 h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <div className="text-2xl">🎯</div>
              </div>
              <p className="text-lg font-medium">Waiting for first domino...</p>
              <p className="text-sm">The player with the highest double starts!</p>
            </div>
          </div>
        ) : (
          // Domino chain with absolute positioning
          <>
            {/* Placed dominoes */}
            {placedDominoes.map((domino, index) => (
              <div
                key={domino.id}
                className="absolute transition-all duration-500 ease-in-out"
                style={{
                  left: `${domino.x}px`,
                  top: `${domino.y}px`,
                  transform: `translate(-50%, -50%) rotate(${domino.rotation}deg)`,
                  zIndex: 10 + index,
                }}
              >
                <DominoTile
                  domino={domino}
                  size="medium"
                  className={cn(
                    "shadow-lg transition-all duration-300",
                    domino.isCornerTurn && "ring-2 ring-accent/30"
                  )}
                />
                
                {/* Connection indicator for debugging */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-accent text-accent-foreground text-xs px-1 rounded">
                    {domino.direction} {domino.connectionSide}
                  </div>
                )}
              </div>
            ))}

            {/* Play area indicators */}
            {leftEnd !== null && onBoardClick && placedDominoes.length > 0 && (
              <button
                onClick={() => onBoardClick('left')}
                className="absolute w-16 h-16 border-2 border-dashed border-accent/60 rounded-full flex items-center justify-center hover:bg-accent/10 transition-all duration-200 z-20 bg-background/80 backdrop-blur-sm"
                style={{
                  left: `${placedDominoes[0].x - 80}px`,
                  top: `${placedDominoes[0].y}px`,
                  transform: 'translate(-50%, -50%)'
                }}
                title={`Play on left end (${leftEnd})`}
              >
                <span className="text-accent font-bold text-lg">{leftEnd}</span>
              </button>
            )}

            {rightEnd !== null && onBoardClick && placedDominoes.length > 0 && (
              <button
                onClick={() => onBoardClick('right')}
                className="absolute w-16 h-16 border-2 border-dashed border-accent/60 rounded-full flex items-center justify-center hover:bg-accent/10 transition-all duration-200 z-20 bg-background/80 backdrop-blur-sm"
                style={{
                  left: `${placedDominoes[placedDominoes.length - 1].x + 80}px`,
                  top: `${placedDominoes[placedDominoes.length - 1].y}px`,
                  transform: 'translate(-50%, -50%)'
                }}
                title={`Play on right end (${rightEnd})`}
              >
                <span className="text-accent font-bold text-lg">{rightEnd}</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Game info overlay */}
      <div className="absolute top-4 left-4 bg-secondary/80 backdrop-blur-sm rounded-lg px-4 py-2">
        <div className="text-sm font-medium text-secondary-foreground">
          Dominoes on Board: {placedDominoes.length}
        </div>
        {leftEnd !== null && rightEnd !== null && (
          <div className="text-xs text-muted-foreground">
            Ends: {leftEnd} • {rightEnd}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameBoard;