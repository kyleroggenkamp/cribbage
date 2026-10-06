import { describe, it, expect } from 'vitest';
import {
  standRankBand,
  summarizePlayerGame,
  buttonBuckOfGame,
  handPointsLost,
} from '../src/grader/scores.js';

describe('scores and ranks (REQUIREMENTS 4A.4)', () => {
  it('maps average points lost to the right stand-rank band', () => {
    expect(standRankBand(0).key).toBe('trophy-buck');
    expect(standRankBand(0.5).key).toBe('trophy-buck'); // inclusive upper bound
    expect(standRankBand(0.51).key).toBe('eight-pointer');
    expect(standRankBand(1.5).key).toBe('eight-pointer');
    expect(standRankBand(2).key).toBe('spikehorn');
    expect(standRankBand(3).key).toBe('spikehorn');
    expect(standRankBand(3.01).key).toBe('button-buck');
    expect(standRankBand(100).key).toBe('button-buck');
  });

  it('sums a player game and averages per hand', () => {
    const hands = [
      handPointsLost(1, 0.5),
      handPointsLost(0, 2),
      handPointsLost(0.5, 0),
    ];
    const g = summarizePlayerGame(hands);
    expect(g.discardLost).toBeCloseTo(1.5, 10);
    expect(g.peggingLost).toBeCloseTo(2.5, 10);
    expect(g.totalLost).toBeCloseTo(4, 10);
    expect(g.handsGraded).toBe(3);
    expect(g.avgLost).toBeCloseTo(4 / 3, 10);
    expect(g.band.key).toBe('eight-pointer'); // 1.33 avg
  });

  it('a player with no graded hands has avg 0 and the top rank', () => {
    const g = summarizePlayerGame([]);
    expect(g.avgLost).toBe(0);
    expect(g.band.key).toBe('trophy-buck');
  });

  it('Button Buck of the Game is the most points lost, ties included', () => {
    expect(buttonBuckOfGame([1, 3, 3, 2])).toEqual([1, 2]);
    expect(buttonBuckOfGame([5, 1, 2])).toEqual([0]);
    expect(buttonBuckOfGame([])).toEqual([]);
  });
});
