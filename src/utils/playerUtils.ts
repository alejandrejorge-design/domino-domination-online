// Utility functions for handling player data securely

export interface SafePlayerData {
  id: string;
  game_room_id: string;
  user_id: string;
  display_name: string;
  position: number;
  hand: any[];
  score: number;
  is_current_player: boolean;
  is_connected: boolean;
  joined_at: string;
  hand_count?: number;
}

/**
 * Filters player data to ensure other players' hands are not exposed
 * Only the current user can see their own hand, others see empty hands
 */
export const filterPlayerData = (players: SafePlayerData[], currentUserId: string): SafePlayerData[] => {
  return players.map(player => {
    // Normalize hand to an array for counting and safe return
    let normalizedHand: any[] = [];
    try {
      if (Array.isArray(player.hand)) {
        normalizedHand = player.hand as any[];
      } else if (typeof player.hand === 'string') {
        normalizedHand = JSON.parse(player.hand as string) || [];
      }
    } catch {
      normalizedHand = [];
    }

    return {
      ...player,
      hand: player.user_id === currentUserId ? normalizedHand : [],
      hand_count: normalizedHand.length,
    } as SafePlayerData;
  });
};

/**
 * Gets the current user's player data with full hand information
 */
export const getCurrentPlayerData = (players: SafePlayerData[], currentUserId: string): SafePlayerData | null => {
  return players.find(player => player.user_id === currentUserId) || null;
};