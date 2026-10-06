/**
 * Cards: the vocabulary the whole engine is built on.
 *
 * Rank order for runs is A-2-3-...-10-J-Q-K (ace low only; Q-K-A is NOT a run).
 * Counting value: Ace = 1, 2-10 face value, J/Q/K = 10 (REQUIREMENTS 3.1).
 */

export const RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
] as const;

export type Rank = (typeof RANKS)[number];

export const SUITS = ['S', 'H', 'D', 'C'] as const;
export type Suit = (typeof SUITS)[number];

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

/**
 * Ordinal position in the run sequence, 1..13 (A=1 ... K=13).
 * Used for detecting runs and for the first-deal low-card cut.
 */
export function rankOrder(rank: Rank): number {
  return RANKS.indexOf(rank) + 1;
}

/**
 * Pegging / counting value: A=1, 2-10 face, J/Q/K=10 (REQUIREMENTS 3.1).
 */
export function cardValue(rank: Rank): number {
  switch (rank) {
    case 'A':
      return 1;
    case 'J':
    case 'Q':
    case 'K':
    case '10':
      return 10;
    default:
      return Number(rank);
  }
}

export function makeCard(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

/** A fresh, ordered 52-card deck. */
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Stable string id, e.g. "5H", "10S", "KD". Useful for keys and logs. */
export function cardId(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

const SUIT_ALIASES: Record<string, Suit> = {
  S: 'S',
  SPADES: 'S',
  '♠': 'S',
  H: 'H',
  HEARTS: 'H',
  '♥': 'H',
  D: 'D',
  DIAMONDS: 'D',
  '♦': 'D',
  C: 'C',
  CLUBS: 'C',
  '♣': 'C',
};

const RANK_ALIASES: Record<string, Rank> = {
  A: 'A',
  ACE: 'A',
  '1': 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  T: '10',
  J: 'J',
  JACK: 'J',
  Q: 'Q',
  QUEEN: 'Q',
  K: 'K',
  KING: 'K',
};

/**
 * Parse a card token like "5H", "10S", "TC", "KD" (case-insensitive).
 * Throws on anything it can't read, so bad CLI input fails loudly.
 */
export function parseCard(token: string): Card {
  const t = token.trim().toUpperCase();
  if (t.length < 2) {
    throw new Error(`Cannot parse card: "${token}"`);
  }
  const suitChar = t.slice(-1);
  const rankChars = t.slice(0, -1);
  const suit = SUIT_ALIASES[suitChar];
  const rank = RANK_ALIASES[rankChars];
  if (!suit || !rank) {
    throw new Error(
      `Cannot parse card: "${token}" (expected rank+suit, e.g. 5H, 10S, KD)`,
    );
  }
  return { rank, suit };
}

export function parseCards(tokens: string[]): Card[] {
  return tokens.map(parseCard);
}
