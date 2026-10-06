import { describe, it, expect } from 'vitest';
import { scorePegCard } from '../src/score-pegging.js';
import { h, c } from './helpers.js';

describe('scorePegCard — single play (REQUIREMENTS 3.5, Section 8)', () => {
  it('reaching 15 scores 2', () => {
    const s = scorePegCard(h('7C'), c('8D'));
    expect(s.total).toBe(15);
    expect(s.points).toBe(2);
  });

  it('reaching 31 scores 2 (not 3), even though it is the last card', () => {
    // The per-card scorer gives 31 its 2. The separate "go"/"last card" point
    // is never added on a 31 (that is enforced in the play flow).
    const s = scorePegCard(h('KC 5D 6H'), c('KS'));
    expect(s.total).toBe(31);
    expect(s.points).toBe(2);
    expect(s.events.some((e) => e.type === 'thirty-one')).toBe(true);
    expect(s.events.some((e) => e.type === 'fifteen')).toBe(false);
  });

  it('scores pairs: 2, 6, 12 for pair / three / four of a kind', () => {
    expect(scorePegCard(h('7C'), c('7D')).points).toBe(2);
    expect(scorePegCard(h('7C 7D'), c('7H')).points).toBe(6);
    expect(scorePegCard(h('7C 7D 7H'), c('7S')).points).toBe(12);
  });

  it('scores a run built out of order: 5, 3, 4 = run of 3', () => {
    const s = scorePegCard(h('5C 3D'), c('4H'));
    expect(s.points).toBe(3);
    expect(s.events.some((e) => e.type === 'run')).toBe(true);
  });

  it('extends the run: 4, 6, 5, then 3 = run of 4', () => {
    const s = scorePegCard(h('4C 6D 5H'), c('3S'));
    expect(s.points).toBe(4);
  });

  it('a run is broken by an interrupting card', () => {
    // 3, 4, 5 would be a run, but an intervening 9 at the tail breaks it.
    const s = scorePegCard(h('3C 4D 5H'), c('9S'));
    expect(s.events.some((e) => e.type === 'run')).toBe(false);
    expect(s.points).toBe(0);
  });

  it('throws on a play that would exceed 31', () => {
    expect(() => scorePegCard(h('KC KD KH'), c('2S'))).toThrow();
  });
});
