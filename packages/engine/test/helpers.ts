import { parseCards, type Card } from '../src/cards.js';

/** Terse card list from a space- or comma-separated string: h('5H 5S 5C JD'). */
export function h(spec: string): Card[] {
  return parseCards(spec.split(/[\s,]+/).filter(Boolean));
}

/** Single card. */
export function c(spec: string): Card {
  return h(spec)[0]!;
}
