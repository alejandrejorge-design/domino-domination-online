import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Auth from '@/components/Auth';
import GameLobby from '@/components/GameLobby';
import MultiplayerGameRoom from '@/components/MultiplayerGameRoom';
import DominoGame from '@/components/DominoGame';
import { Button } from '@/components/ui/button';
import { Users, Computer } from 'lucide-react';

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'menu' | 'lobby' | 'game' | 'singleplayer'>('menu');
  const [gameRoomId, setGameRoomId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-lg font-semibold">Loading...</div></div>;

  if (!user) return <Auth onAuthSuccess={() => setCurrentView('menu')} />;

  if (currentView === 'menu') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-20 h-20 bg-accent rounded-lg flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Domino Domination</h1>
          <Button onClick={() => setCurrentView('lobby')} className="w-full h-16 text-lg" size="lg">
            <Users className="w-6 h-6 mr-3" />Multiplayer Online
          </Button>
          <Button onClick={() => setCurrentView('singleplayer')} variant="outline" className="w-full h-16 text-lg" size="lg">
            <Computer className="w-6 h-6 mr-3" />Practice vs AI
          </Button>
          <Button onClick={() => supabase.auth.signOut()} variant="ghost" size="sm">Sign Out</Button>
        </div>
      </div>
    );
  }

  if (currentView === 'lobby') {
    return <GameLobby user={user} onJoinGame={(roomId) => { setGameRoomId(roomId); setCurrentView('game'); }} onSignOut={() => supabase.auth.signOut()} />;
  }

  if (currentView === 'game' && gameRoomId) {
    return <MultiplayerGameRoom gameRoomId={gameRoomId} user={user} onLeaveRoom={() => { setGameRoomId(null); setCurrentView('lobby'); }} />;
  }

  if (currentView === 'singleplayer') {
    return (
      <div className="relative">
        <Button onClick={() => setCurrentView('menu')} variant="outline" size="sm" className="absolute top-4 left-4 z-50">← Back</Button>
        <DominoGame />
      </div>
    );
  }

  return null;
};

export default Index;
