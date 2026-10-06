import { describe, it, expect } from 'vitest';
import { playPegging } from '../src/play.js';
import { h } from './helpers.js';

describe('playPegging — the play flow (REQUIREMENTS 3.5, Section 8)', () => {
  it('31 scores 2 only (no extra go) and the final card scores 1', () => {
    // Traced by hand with the firstLegal chooser:
    //  KC QD 5C 6D -> 10,20,25,31 (seat1 pegs 31 for 2), reset,
    //  9C 7D 3C 8D -> 9,16,19,27 (seat1 pegs last card for 1).
    const hands = [h('KC 5C 9C 3C'), h('QD 6D 7D 8D')];
    const { pegPoints, log } = playPegging(hands, 0);

    const thirtyOne = log.find((e) => e.countAfter === 31);
    expect(thirtyOne).toBeDefined();
    expect(thirtyOne!.points).toBe(2);
    expect(thirtyOne!.seat).toBe(1);
    // No go/last-card entry is ever attached to a 31.
    expect(log.some((e) => e.kind !== 'play' && e.countAfter === 31)).toBe(
      false,
    );

    const last = log[log.length - 1]!;
    expect(last.kind).toBe('last-card');
    expect(last.points).toBe(1);
    expect(last.seat).toBe(1);

    // seat1: 31 (2) + last card (1) = 3; seat0 scores nothing here.
    expect(pegPoints).toEqual([0, 3]);
  });

  it('awards the go to the last player to lay a card (3-player, multiple gos)', () => {
    // Three kings go down to 30; nobody else can play, so all three "go".
    // The last to lay a card (seat 2, the third king) takes the go.
    const hands = [h('KC KD 2C 3C'), h('KH 4D 5D 6D'), h('KS 7D 8D 9D')];
    const { log } = playPegging(hands, 0);

    const firstGo = log.find((e) => e.kind === 'go');
    expect(firstGo).toBeDefined();
    expect(firstGo!.seat).toBe(2);
    expect(firstGo!.points).toBe(1);
    expect(firstGo!.countAfter).toBe(30);
  });

  it('conserves cards: every dealt card is played exactly once', () => {
    const hands = [h('AC 2C 3C 4C'), h('5D 6D 7D 8D')];
    const { log } = playPegging(hands, 0);
    const plays = log.filter((e) => e.kind === 'play');
    expect(plays).toHaveLength(8);
  });
});
