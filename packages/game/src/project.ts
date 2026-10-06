/**
 * Project the authoritative GameState into the public-safe rows the client
 * reads (games/hands) and each seat's own cards (private_cards). The Edge
 * Function persists these; keeping the mapping here (pure) makes it testable.
 *
 * NO hidden information leaks into the public rows: hands carries the starter
 * (only once cut), the running count, and the current series — never a card
 * that isn't legally visible. Per-seat cards go to private_cards, which RLS
 * then restricts to their owner (and reveals to all at the show).
 */

import { type Card, cardId } from '@deercamp/engine';
import { type GameState } from './state.js';

export interface PublicGame {
  status: 'playing' | 'over';
  dealer_seat: number;
  scores: number[];
  winner_unit: number | null;
}

export interface PublicHand {
  hand_number: number;
  dealer_seat: number;
  phase: string;
  starter: string | null;
  turn_seat: number | null;
  running_count: number;
  series: string[];
}

/** A card row for one seat (the Edge Function fills player_id from the seats map). */
export interface PrivateCardRow {
  seat_index: number;
  kind: 'dealt' | 'kept' | 'crib';
  cards: string[];
  /** true => player_id must be set to null (the crib has no single owner). */
  shared: boolean;
}

export interface ProjectedState {
  game: PublicGame;
  hand: PublicHand | null;
  privateCards: PrivateCardRow[];
}

const ids = (cards: readonly Card[]) => cards.map(cardId);

export function project(game: GameState): ProjectedState {
  const publicGame: PublicGame = {
    status: game.status,
    dealer_seat: game.dealerSeat,
    scores: [...game.scores],
    winner_unit: game.winnerUnit,
  };

  if (!game.hand) {
    return { game: publicGame, hand: null, privateCards: [] };
  }

  const h = game.hand;
  const hand: PublicHand = {
    hand_number: h.handNumber,
    dealer_seat: h.dealerSeat,
    phase: h.phase,
    starter: h.starter ? cardId(h.starter) : null,
    turn_seat: h.pegging && !h.pegging.done ? h.pegging.turn : null,
    running_count: h.pegging ? h.pegging.count : 0,
    series: h.pegging ? ids(h.pegging.series) : [],
  };

  const privateCards: PrivateCardRow[] = [];
  for (let seat = 0; seat < game.config.playerCount; seat++) {
    const kept = h.kept[seat];
    // Before discarding, a player sees their full dealt hand; after, the 4 kept.
    if (kept) privateCards.push({ seat_index: seat, kind: 'kept', cards: ids(kept), shared: false });
    else privateCards.push({ seat_index: seat, kind: 'dealt', cards: ids(h.dealt[seat]!), shared: false });
  }
  // The crib (owned by nobody; RLS reveals it at the show).
  privateCards.push({ seat_index: h.dealerSeat, kind: 'crib', cards: ids(h.crib), shared: true });

  return { game: publicGame, hand, privateCards };
}
