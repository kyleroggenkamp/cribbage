'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { getGameState } from './rpc';
import { errorMessage } from './errors';
import type { GameState } from './types';

export type ConnStatus = 'connecting' | 'connected' | 'weak' | 'offline';

/**
 * Subscribe to a game and keep its state fresh. Follows §1A/§6: on ANY change
 * (or on reconnect) it refetches the FULL state via get_game_state rather than
 * replaying events, and surfaces a connection status for the top bar.
 */
export function useGameState(gameId: string | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnStatus>('connecting');
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    try {
      const next = await getGameState(gameId);
      if (mounted.current) {
        setState(next);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    }
  }, [gameId]);

  useEffect(() => {
    mounted.current = true;
    if (!gameId) return;

    void refresh();

    const channel = supabase()
      .channel(`game:${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seats', filter: `game_id=eq.${gameId}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hands', filter: `game_id=eq.${gameId}` }, () => void refresh())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConn('connected');
          void refresh(); // full resync on (re)subscribe
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConn('weak');
        } else if (status === 'CLOSED') {
          setConn('offline');
        }
      });

    const online = () => void refresh();
    const offline = () => setConn('offline');
    if (typeof window !== 'undefined') {
      window.addEventListener('online', online);
      window.addEventListener('offline', offline);
    }

    return () => {
      mounted.current = false;
      void supabase().removeChannel(channel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', online);
        window.removeEventListener('offline', offline);
      }
    };
  }, [gameId, refresh]);

  return { state, error, conn, refresh };
}
