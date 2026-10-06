import { describe, it, expect } from 'vitest';
import { type Card } from '../src/cards.js';
import { botDiscard } from '../src/bots/discard.js';
import { botPegChoice, makeBotChooser } from '../src/bots/pegging.js';
import { botMoveDelayMs, BOT_MOVE_DELAY_MS } from '../src/bots/config.js';
import { playPegging, type CardChooser } from '../src/play.js';
import { h, c } from './helpers.js';

const keyOf = (cards: Card[]) =>
  cards.map((x) => `${x.rank}${x.suit}`).sort().join(',');

describe('camp bot discard (REQUIREMENTS Section 4)', () => {
  it('throws the highest-value discard (keeps 5-5-5-J, throws 2-9)', () => {
    const discard = botDiscard({
      playerCount: 2,
      dealt: h('5C 5D 5H JS 2C 9D'),
      cribIsMine: true,
      seed: 'g:0',
    });
    expect(keyOf(discard)).toBe(keyOf(h('2C 9D')));
  });

  it('throws one card in 3-player', () => {
    const discard = botDiscard({
      playerCount: 3,
      dealt: h('5C 5D 5H JS 2C'),
      cribIsMine: false,
      seed: 'g:1',
    });
    expect(discard).toHaveLength(1);
  });
});

describe('camp bot pegging (REQUIREMENTS Section 4)', () => {
  it('plays the evaluator-best card (takes the 15 when available)', () => {
    const choice = botPegChoice({
      handRemaining: h('8D 2C'),
      series: h('7C'),
      count: 7,
      seen: h('7C 8D 2C'),
    });
    expect(`${choice!.rank}${choice!.suit}`).toBe('8D');
  });

  it('plays the only legal card on a forced play', () => {
    const choice = botPegChoice({
      handRemaining: h('AC KD'), // KD (10) would exceed 31 at count 30
      series: h('KH KS KC'),
      count: 30,
      seen: h('KH KS KC AC KD'),
    });
    expect(`${choice!.rank}${choice!.suit}`).toBe('AC');
  });

  it('returns null when it has no legal play (automatic Go)', () => {
    const choice = botPegChoice({
      handRemaining: h('KD'),
      series: h('KH KS KC'),
      count: 30,
      seen: h('KH KS KC KD'),
    });
    expect(choice).toBeNull();
  });

  it('drives a full bot-vs-bot play to completion', () => {
    const dealt = [h('5C 6D 7H 8S'), h('5D 6C 7S 9D')];
    const starter = c('2H');
    const chooser: CardChooser = (ctx) =>
      makeBotChooser({ dealtHand: dealt[ctx.seat]!, starter })(ctx);
    const { log } = playPegging(dealt, 0, chooser);
    expect(log.filter((e) => e.kind === 'play')).toHaveLength(8);
  });
});

describe('bot move delay (REQUIREMENTS Section 4)', () => {
  it('is within the 1-2 second range', () => {
    expect(botMoveDelayMs(() => 0)).toBe(BOT_MOVE_DELAY_MS.min);
    expect(botMoveDelayMs(() => 1)).toBe(BOT_MOVE_DELAY_MS.max);
    const d = botMoveDelayMs(() => 0.5);
    expect(d).toBeGreaterThanOrEqual(BOT_MOVE_DELAY_MS.min);
    expect(d).toBeLessThanOrEqual(BOT_MOVE_DELAY_MS.max);
  });
});
