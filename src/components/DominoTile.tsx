import { Domino } from '@/types/domino';
import { cn } from '@/lib/utils';

interface DominoTileProps {
  domino: Domino;
  onClick?: () => void;
  className?: string;
  rotation?: number;
  size?: 'small' | 'medium' | 'large';
  isPlayable?: boolean;
  selected?: boolean;
  playable?: boolean;
}

const DominoTile = ({ 
  domino, 
  onClick, 
  className, 
  rotation = 0, 
  size = 'medium',
  isPlayable = false,
  selected = false,
  playable = false
}: DominoTileProps) => {
  const renderPips = (value: number, isLeft: boolean) => {
    const pipPositions = {
      0: [],
      1: [4], // center
      2: [0, 8], // top-left, bottom-right
      3: [0, 4, 8], // top-left, center, bottom-right
      4: [0, 2, 6, 8], // corners
      5: [0, 2, 4, 6, 8], // corners + center
      6: [0, 1, 2, 6, 7, 8], // two columns
    };

    const positions = pipPositions[value as keyof typeof pipPositions] || [];
    
    return (
      <div className={cn(
        "relative grid grid-cols-3 grid-rows-3 gap-0.5",
        size === 'small' ? "w-6 h-6" : size === 'large' ? "w-12 h-12" : "w-8 h-8"
      )}>
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full",
              positions.includes(i) ? "bg-domino-pip" : "transparent",
              size === 'small' ? "w-1 h-1" : size === 'large' ? "w-2 h-2" : "w-1.5 h-1.5"
            )}
          />
        ))}
      </div>
    );
  };

  const sizeClasses = {
    small: "w-12 h-24",
    medium: "w-16 h-32",
    large: "w-20 h-40"
  };

  return (
    <div
      className={cn(
        "relative cursor-pointer transition-all duration-200",
        "bg-gradient-to-br from-domino-face to-domino-back",
        "border-2 border-domino-border rounded-lg",
        "shadow-[var(--shadow-domino)]",
        "hover:scale-105 hover:shadow-lg",
        (isPlayable || playable) && "ring-2 ring-accent ring-opacity-50",
        selected && "ring-4 ring-accent scale-105",
        sizeClasses[size],
        className
      )}
      onClick={onClick}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* Top half */}
      <div className="absolute top-1 left-1 right-1 h-[calc(50%-4px)] border-b border-domino-border/30 flex items-center justify-center">
        {renderPips(domino.left, true)}
      </div>
      
      {/* Bottom half */}
      <div className="absolute bottom-1 left-1 right-1 h-[calc(50%-4px)] flex items-center justify-center">
        {renderPips(domino.right, false)}
      </div>
      
      {/* Center divider line for doubles */}
      {domino.isDouble && (
        <div className="absolute left-1/2 top-1 bottom-1 w-px bg-domino-border/30 transform -translate-x-1/2" />
      )}
    </div>
  );
};

export default DominoTile;