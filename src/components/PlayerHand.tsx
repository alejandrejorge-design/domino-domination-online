import { Player } from '@/types/domino';
import DominoTile from './DominoTile';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  player: Player;
  onDominoClick?: (dominoId: string) => void;
  position: 'bottom' | 'left' | 'top' | 'right';
  isCurrentPlayer?: boolean;
  playableDominoes?: string[];
}

const PlayerHand = ({ 
  player, 
  onDominoClick, 
  position, 
  isCurrentPlayer = false,
  playableDominoes = []
}: PlayerHandProps) => {
  const isVertical = position === 'left' || position === 'right';
  const isOpposite = position === 'top';
  
  const getPositionClasses = () => {
    switch (position) {
      case 'bottom':
        return 'bottom-4 left-1/2 transform -translate-x-1/2 flex-row';
      case 'top':
        return 'top-4 left-1/2 transform -translate-x-1/2 flex-row';
      case 'left':
        return 'left-4 top-1/2 transform -translate-y-1/2 flex-col';
      case 'right':
        return 'right-4 top-1/2 transform -translate-y-1/2 flex-col';
      default:
        return '';
    }
  };

  const getDominoRotation = () => {
    switch (position) {
      case 'left':
        return -90;
      case 'right':
        return 90;
      default:
        return 0;
    }
  };

  return (
    <div className={cn("absolute z-10", getPositionClasses())}>
      {/* Player name and info */}
      <div className={cn(
        "mb-2 text-center",
        isVertical && "mb-0 mr-2 text-sm writing-mode-vertical",
        isOpposite && "mb-0 mt-2"
      )}>
        <div className={cn(
          "px-3 py-1 rounded-full text-sm font-medium",
          "bg-secondary/80 backdrop-blur-sm",
          isCurrentPlayer ? "bg-accent text-accent-foreground ring-2 ring-accent/50" : "text-secondary-foreground"
        )}>
          {player.name}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {player.hand.length} dominoes • Score: {player.score}
        </div>
      </div>

      {/* Hand of dominoes */}
      <div className={cn(
        "flex gap-1",
        isVertical ? "flex-col" : "flex-row",
        position === 'top' && "flex-row-reverse"
      )}>
        {player.hand.map((domino, index) => (
          <div
            key={domino.id}
            className={cn(
              "transition-all duration-200",
              isCurrentPlayer && playableDominoes.includes(domino.id) && "hover:transform hover:scale-110"
            )}
            style={{
              zIndex: player.hand.length - index,
              ...(position === 'bottom' && {
                marginLeft: index > 0 ? '-8px' : '0'
              }),
              ...(position === 'top' && {
                marginRight: index > 0 ? '-8px' : '0'
              }),
              ...(isVertical && {
                marginTop: index > 0 ? '-12px' : '0'
              })
            }}
          >
            <DominoTile
              domino={domino}
              onClick={isCurrentPlayer ? () => onDominoClick?.(domino.id) : undefined}
              rotation={getDominoRotation()}
              size={position === 'bottom' ? 'medium' : 'small'}
              isPlayable={isCurrentPlayer && playableDominoes.includes(domino.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerHand;