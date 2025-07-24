import { useDominoGame } from '@/hooks/useDominoGame';
import GameBoard from './GameBoard';
import PlayerHand from './PlayerHand';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users, Trophy } from 'lucide-react';

const DominoGame = () => {
  const {
    gameState,
    placedDominoes,
    selectedDomino,
    playableDominoes,
    startNewGame,
    handleDominoClick,
    handleBoardClick,
    currentPlayer,
  } = useDominoGame();

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between bg-secondary/80 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-secondary-foreground">Domino Domination</h1>
              <p className="text-sm text-muted-foreground">4-Player Online Dominoes</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Current Turn</div>
              <div className="font-semibold text-secondary-foreground">{currentPlayer?.name}</div>
            </div>
            
            <Button onClick={startNewGame} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              New Game
            </Button>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="max-w-7xl mx-auto relative">
        <div className="relative w-full h-[600px] bg-gradient-to-br from-game-table to-game-felt rounded-xl border-4 border-wood-border shadow-[var(--shadow-game)]">
          
          {/* Game Board */}
          <GameBoard
            placedDominoes={placedDominoes}
            onBoardClick={selectedDomino ? handleBoardClick : undefined}
            leftEnd={gameState.leftEnd}
            rightEnd={gameState.rightEnd}
          />

          {/* Player Hands */}
          {gameState.players.map((player, index) => {
            const positions = ['bottom', 'left', 'top', 'right'] as const;
            return (
              <PlayerHand
                key={player.id}
                player={player}
                position={positions[index]}
                onDominoClick={index === 0 ? handleDominoClick : undefined}
                isCurrentPlayer={player.isCurrentPlayer}
                playableDominoes={index === 0 ? playableDominoes : []}
              />
            );
          })}

          {/* Selected domino indicator */}
          {selectedDomino && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="bg-accent/90 backdrop-blur-sm rounded-lg p-4 text-center">
                <div className="text-accent-foreground font-medium mb-2">
                  Choose which end to play on
                </div>
                <div className="text-sm text-accent-foreground/80">
                  Click on the left or right end of the domino chain
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Game Status */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          {gameState.players.map((player, index) => (
            <div
              key={player.id}
              className={`bg-secondary/60 backdrop-blur-sm rounded-lg p-4 text-center transition-all ${
                player.isCurrentPlayer ? 'ring-2 ring-accent bg-accent/10' : ''
              }`}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                {player.isCurrentPlayer && <Trophy className="w-4 h-4 text-accent" />}
                <div className="font-medium text-secondary-foreground">{player.name}</div>
              </div>
              <div className="text-sm text-muted-foreground">
                {player.hand.length} dominoes
              </div>
              <div className="text-lg font-bold text-secondary-foreground">
                {player.score} points
              </div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-muted/50 backdrop-blur-sm rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-2">How to Play:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Match the number of pips on your domino to either end of the chain</li>
            <li>• Click on a highlighted domino in your hand to play it</li>
            <li>• If both ends are playable, click on the end you want to play on</li>
            <li>• The first player to play all their dominoes wins the round!</li>
            <li>• {gameState.boneyard.length} dominoes remain in the boneyard</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DominoGame;