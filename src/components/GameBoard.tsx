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
      <div className="relative z-10 flex items-center justify-center min-w-[600px] min-h-[200px]">
        {placedDominoes.length === 0 ? (
          // Empty board state
          <div className="text-center text-muted-foreground">
            <div className="w-24 h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <div className="text-2xl">🎯</div>
            </div>
            <p className="text-lg font-medium">Waiting for first domino...</p>
            <p className="text-sm">The player with the highest double starts!</p>
          </div>
        ) : (
          // Domino chain
          <div className="flex items-center gap-1 flex-wrap justify-center max-w-4xl">
            {/* Left end indicator */}
            {leftEnd !== null && onBoardClick && (
              <button
                onClick={() => onBoardClick('left')}
                className="w-12 h-12 border-2 border-dashed border-accent/50 rounded-lg flex items-center justify-center hover:bg-accent/10 transition-colors mr-2"
                title={`Play on left end (${leftEnd})`}
              >
                <span className="text-accent font-bold">{leftEnd}</span>
              </button>
            )}

            {/* Placed dominoes */}
            {placedDominoes.map((domino, index) => (
              <div
                key={domino.id}
                className="relative transition-all duration-300"
                style={{
                  transform: `rotate(${domino.rotation}deg)`,
                  zIndex: placedDominoes.length - index,
                }}
              >
                <DominoTile
                  domino={domino}
                  size="medium"
                  className="shadow-lg"
                />
              </div>
            ))}

            {/* Right end indicator */}
            {rightEnd !== null && onBoardClick && (
              <button
                onClick={() => onBoardClick('right')}
                className="w-12 h-12 border-2 border-dashed border-accent/50 rounded-lg flex items-center justify-center hover:bg-accent/10 transition-colors ml-2"
                title={`Play on right end (${rightEnd})`}
              >
                <span className="text-accent font-bold">{rightEnd}</span>
              </button>
            )}
          </div>
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