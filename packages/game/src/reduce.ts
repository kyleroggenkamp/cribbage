/**
 * The single entry point: apply one action to the game, idempotently. The
 * Supabase Edge Function is a thin shell around this — load state, reduce,
 * persist, broadcast. `nextBotAction` lets the shell drive camp bots.
 */

import { type Card, botDiscard, botPegChoice } from '@deercamp/engine';
import {
  type GameState,
  dealHand,
  nextHand,
  applyDiscard,
  playCard,
} from './state.js';

export type Action =
  | { id: string; type: 'deal'; deck: Card[] }
  | { id: string; type: 'discard'; seat: number; cards: Card[] }
  | { id: string; type: 'play'; seat: number; card: Card };

/**
 * Apply `action`. Returns the same game unchanged if the action id was already
 * applied (safe retry — the §1A weak-signal guarantee). Mutates in place.
 */
export function reduce(game: GameState, action: Action): GameState {
  if (game.processed.includes(action.id)) return game;

  switch (action.type) {
    case 'deal': {
      if (game.status !== 'playing') throw new Error('game is over');
      if (game.hand && game.hand.phase !== 'done') throw new Error('a hand is already in progress');
      if (!game.hand) dealHand(game, action.deck);
      else nextHand(game, action.deck);
      break;
    }
    case 'discard':
      applyDiscard(game, action.seat, action.cards);
      break;
    case 'play':
      playCard(game, action.seat, action.card);
      break;
  }

  game.processed.push(action.id);
  return game;
}

/**
 * The action a camp bot should take right now, or null if it's a human's turn
 * / nothing to do. The id is deterministic so retries stay idempotent. `deal`
 * is never a bot action (the server issues it with a fresh shuffled deck).
 */
export function nextBotAction(game: GameState): Action | null {
  if (game.status !== 'playing' || !game.hand) return null;
  const hand = game.hand;
  const { playerCount, isBot, botCribIterations } = game.config;

  if (hand.phase === 'discarding') {
    for (let seat = 0; seat < playerCount; seat++) {
      if (isBot[seat] && !hand.discarded[seat]) {
        const cribIsMine = game.unitOfSeat[seat] === game.unitOfSeat[hand.dealerSeat];
        const cards = botDiscard({
          playerCount,
          dealt: hand.dealt[seat]!,
          cribIsMine,
          seed: `h${hand.handNumber}s${seat}`,
          cribSimIterations: botCribIterations,
        });
        return { id: `bot:discard:${hand.handNumber}:${seat}`, type: 'discard', seat, cards };
      }
    }
    return null;
  }

  if (hand.phase === 'pegging' && hand.pegging && !hand.pegging.done) {
    const seat = hand.pegging.turn;
    if (!isBot[seat]) return null;
    const seen: Card[] = [...hand.dealt[seat]!, hand.starter!, ...hand.pegging.played];
    const card = botPegChoice({
      handRemaining: hand.pegging.hands[seat]!,
      series: hand.pegging.series,
      count: hand.pegging.count,
      seen,
    });
    if (!card) return null; // shouldn't happen: the awaited seat has a legal play
    return {
      id: `bot:play:${hand.handNumber}:${hand.pegging.playedCount}`,
      type: 'play',
      seat,
      card,
    };
  }

  return null;
}

/** Apply all pending bot actions until a human must act (or the game ends). */
export function runBots(game: GameState, limit = 1000): GameState {
  for (let i = 0; i < limit; i++) {
    const action = nextBotAction(game);
    if (!action) break;
    reduce(game, action);
  }
  return game;
}
