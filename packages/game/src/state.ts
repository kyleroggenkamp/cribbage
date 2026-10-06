/**
 * Server-authoritative game state and the hand lifecycle. Pure: the only
 * randomness (the shuffled deck) is passed in, so transitions are deterministic
 * and testable. Uses @deercamp/engine for every rule.
 */

import {
  type Card,
  type PlayerCount,
  DEAL_CONFIG,
  dealHands,
  cutStarter,
  hisHeels,
  cardsEqual,
  countShow,
  seatUnitMap,
  type ShowResult,
} from '@deercamp/engine';
import { initPegging, applyPlay as pegApply, type PeggingState } from './pegging.js';

export type Phase = 'discarding' | 'pegging' | 'show' | 'done';

export interface GameConfig {
  readonly playerCount: PlayerCount;
  readonly target: number; // 121 or 61
  readonly isBot: boolean[]; // per seat
  readonly botCribIterations?: number; // bot discard sim speed (default 2000)
}

export interface HandState {
  handNumber: number;
  dealerSeat: number;
  phase: Phase;
  dealt: Card[][]; // per seat (hidden)
  kept: (Card[] | null)[]; // per seat after discard
  crib: Card[];
  stock: Card[]; // remaining deck (hidden)
  starter: Card | null;
  discarded: boolean[];
  pegging: PeggingState | null;
  pegCredited: number[]; // pegging points already added to unit scores
  show: ShowResult | null;
}

export interface GameEvent {
  readonly kind: string;
  readonly seat?: number;
  readonly unit?: number;
  readonly points?: number;
  readonly text: string;
}

export interface GameState {
  config: GameConfig;
  status: 'playing' | 'over';
  dealerSeat: number;
  scores: number[]; // per unit
  unitOfSeat: number[];
  handNumber: number;
  hand: HandState | null;
  processed: string[];
  winnerUnit: number | null;
  events: GameEvent[];
}

export function newGame(config: GameConfig, firstDealer = 0): GameState {
  const unitOfSeat = seatUnitMap(config.playerCount);
  const unitCount = Math.max(...unitOfSeat) + 1;
  return {
    config,
    status: 'playing',
    dealerSeat: firstDealer,
    scores: new Array<number>(unitCount).fill(0),
    unitOfSeat,
    handNumber: 0,
    hand: null,
    processed: [],
    winnerUnit: null,
    events: [],
  };
}

/** Add points to a unit; returns true if it reached the target and won. */
function award(game: GameState, unit: number, points: number): boolean {
  if (points <= 0) return false;
  game.scores[unit]! += points;
  if (game.scores[unit]! >= game.config.target) {
    game.status = 'over';
    game.winnerUnit = unit;
    if (game.hand) game.hand.phase = 'done';
    return true;
  }
  return false;
}

/** Deal a new hand from a pre-shuffled deck. */
export function dealHand(game: GameState, shuffledDeck: Card[]): void {
  const pc = game.config.playerCount;
  const { hands, cribSeed, stock } = dealHands(pc, shuffledDeck);
  game.handNumber += 1;
  game.hand = {
    handNumber: game.handNumber,
    dealerSeat: game.dealerSeat,
    phase: 'discarding',
    dealt: hands,
    kept: new Array<Card[] | null>(pc).fill(null),
    crib: [...cribSeed],
    stock,
    starter: null,
    discarded: new Array<boolean>(pc).fill(false),
    pegging: null,
    pegCredited: new Array<number>(pc).fill(0),
    show: null,
  };
  game.events.push({ kind: 'deal', text: `Hand ${game.handNumber} dealt` });
}

export function applyDiscard(game: GameState, seat: number, cards: Card[]): void {
  const hand = game.hand;
  if (!hand || hand.phase !== 'discarding') throw new Error('not in the discard phase');
  const cfg = DEAL_CONFIG[game.config.playerCount];
  if (hand.discarded[seat]) throw new Error('seat already discarded');
  if (cards.length !== cfg.discardsEach) throw new Error(`must discard ${cfg.discardsEach}`);
  const dealt = hand.dealt[seat]!;
  for (const c of cards) {
    if (!dealt.some((d) => cardsEqual(d, c))) throw new Error('discard not in hand');
  }
  hand.kept[seat] = dealt.filter((d) => !cards.some((c) => cardsEqual(c, d)));
  hand.crib.push(...cards);
  hand.discarded[seat] = true;

  if (hand.discarded.every(Boolean)) finalizeDiscards(game);
}

/** All discards in: cut the starter, peg his heels, open the play. */
function finalizeDiscards(game: GameState): void {
  const hand = game.hand!;
  const starter = cutStarter(hand.stock);
  hand.starter = starter;
  hand.stock = hand.stock.slice(1);

  const dealerUnit = game.unitOfSeat[hand.dealerSeat]!;
  const heels = hisHeels(starter);
  if (heels > 0) {
    game.events.push({ kind: 'his-heels', seat: hand.dealerSeat, unit: dealerUnit, points: heels, text: 'His heels for 2' });
    if (award(game, dealerUnit, heels)) return; // his heels can win the game
  }

  const leadSeat = (hand.dealerSeat + 1) % game.config.playerCount;
  hand.phase = 'pegging';
  hand.pegging = initPegging(hand.kept as Card[][], leadSeat);
}

export function playCard(game: GameState, seat: number, card: Card): void {
  const hand = game.hand;
  if (!hand || hand.phase !== 'pegging' || !hand.pegging) throw new Error('not in the play phase');
  pegApply(hand.pegging, seat, card);
  if (creditPegging(game)) return; // a peg can win the game mid-play
  if (hand.pegging.done) runShow(game);
}

/** Move newly-scored pegging points into unit scores; stop on a win. */
function creditPegging(game: GameState): boolean {
  const hand = game.hand!;
  const peg = hand.pegging!;
  for (let seat = 0; seat < game.config.playerCount; seat++) {
    const delta = peg.pegPoints[seat]! - hand.pegCredited[seat]!;
    if (delta > 0) {
      hand.pegCredited[seat] = peg.pegPoints[seat]!;
      const unit = game.unitOfSeat[seat]!;
      if (award(game, unit, delta)) return true;
    }
  }
  return false;
}

/** Count the show in order, applying scores and stopping at the target. */
function runShow(game: GameState): void {
  const hand = game.hand!;
  hand.phase = 'show';
  const result = countShow({
    playerCount: game.config.playerCount,
    hands: hand.kept as Card[][],
    crib: hand.crib,
    starter: hand.starter!,
    dealerSeat: hand.dealerSeat,
    unitScoresBefore: game.scores,
    target: game.config.target,
  });
  hand.show = result;
  for (const step of result.steps) {
    game.scores[step.unit] = step.unitScoreAfter;
    game.events.push({
      kind: 'show',
      unit: step.unit,
      points: step.score.total,
      text: `${step.source === 'crib' ? 'Crib' : `Seat ${step.source}`} counts ${step.score.total}`,
    });
    if (step.won) {
      game.status = 'over';
      game.winnerUnit = step.unit;
      break;
    }
  }
  hand.phase = 'done';
}

/** Rotate the deal to the left and deal the next hand. */
export function nextHand(game: GameState, shuffledDeck: Card[]): void {
  if (game.status !== 'playing') throw new Error('game is over');
  if (!game.hand || game.hand.phase !== 'done') throw new Error('current hand not finished');
  game.dealerSeat = (game.dealerSeat + 1) % game.config.playerCount;
  dealHand(game, shuffledDeck);
}
