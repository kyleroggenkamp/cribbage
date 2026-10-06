import { describe, it, expect } from 'vitest';
import { countShow, seatUnitMap, countOrder } from '../src/show.js';
import { h, c } from './helpers.js';

describe('the show order and counting out (REQUIREMENTS 3.6-3.7)', () => {
  it('counts out: the non-dealer reaches the target and wins before the dealer counts', () => {
    // 2-player, dealer = seat 0, so the non-dealer (seat 1) counts first.
    // Seat 1 holds the 29 hand and is already at 115 -> wins mid-show.
    const result = countShow({
      playerCount: 2,
      hands: [h('2C 3C 4C 6C'), h('5C 5D 5H JS')],
      crib: h('7C 8C 9C 10C'),
      starter: c('5S'),
      dealerSeat: 0,
      unitScoresBefore: [118, 115],
      target: 121,
    });

    expect(result.winner).toBe(1);
    // The engine stops the instant the target is reached: only one step.
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.source).toBe(1);
    expect(result.steps[0]!.won).toBe(true);
    expect(result.steps[0]!.unitScoreAfter).toBe(144);
  });

  it('count order puts the dealer last and starts to the dealer left', () => {
    expect(countOrder(3, 0)).toEqual([1, 2, 0]);
    expect(countOrder(3, 2)).toEqual([0, 1, 2]);
    expect(countOrder(4, 1)).toEqual([2, 3, 0, 1]);
  });

  it('4-player scores by team: partners (opposite seats) share a unit', () => {
    expect(seatUnitMap(4)).toEqual([0, 1, 0, 1]);

    const result = countShow({
      playerCount: 4,
      // Seats 0 and 2 are partners (unit 0). Give each a small hand.
      hands: [h('2C 3D 4H 6S'), h('2D 3H 4S 6C'), h('5C 5D 5H 7S'), h('8C 9D JH QS')],
      crib: h('AC AD AH 8S'),
      starter: c('KC'),
      dealerSeat: 3, // crib goes to unit 1
      unitScoresBefore: [0, 0],
      target: 121,
    });

    // Seat 0 and seat 2 both pay into unit 0; their totals are summed there.
    const unit0Steps = result.steps.filter((s) => s.unit === 0);
    const unit0Total = unit0Steps.reduce((acc, s) => acc + s.score.total, 0);
    expect(unit0Steps.map((s) => s.source).sort()).toEqual([0, 2]);
    expect(unit0Total).toBeGreaterThan(0);
    expect(result.winner).toBeNull();
  });

  it('the crib counts last and into the dealer unit', () => {
    const result = countShow({
      playerCount: 2,
      hands: [h('2C 3D 4H 7S'), h('2D 3H 4S 7C')],
      crib: h('5C 5D 5H 5S'),
      starter: c('9C'),
      dealerSeat: 0,
      unitScoresBefore: [0, 0],
      target: 121,
    });
    const lastStep = result.steps[result.steps.length - 1]!;
    expect(lastStep.source).toBe('crib');
    expect(lastStep.unit).toBe(0); // dealer's unit
  });
});
