/**
 * A playing card drawn in CSS (REQUIREMENTS §5.3): off-white face (#ECE4D2, the
 * --card-face token, never pure white), suit glyphs forced to text with U+FE0E
 * (never emoji), red vs black distinguished by colour AND symbol. Card backs
 * are dark green with a small deer-track mark. No copied card art.
 */

import type { Card as EngineCard, Rank, Suit } from '@deercamp/engine';

const SUIT_GLYPH: Record<Suit, string> = {
  S: '♠︎', // ♠
  H: '♥︎', // ♥
  D: '♦︎', // ♦
  C: '♣︎', // ♣
};
const isRed = (s: Suit) => s === 'H' || s === 'D';

export type CardSize = 'sm' | 'md' | 'lg';
const DIMS: Record<CardSize, { w: number; h: number; rank: number; suit: number; pip: number }> = {
  sm: { w: 34, h: 48, rank: 13, suit: 11, pip: 18 },
  md: { w: 46, h: 66, rank: 17, suit: 14, pip: 26 },
  lg: { w: 58, h: 84, rank: 22, suit: 18, pip: 34 },
};

export interface CardProps {
  card?: EngineCard; // omit for a face-down back
  size?: CardSize;
  highlighted?: boolean; // scoring card in a breakdown
  selected?: boolean; // picked in hand
  dimmed?: boolean;
  onClick?: () => void;
}

export function Card({ card, size = 'md', highlighted, selected, dimmed, onClick }: CardProps) {
  const d = DIMS[size];
  const common: React.CSSProperties = {
    width: d.w,
    height: d.h,
    borderRadius: 6,
    position: 'relative',
    flex: '0 0 auto',
    transition: 'transform 120ms ease',
    transform: selected ? 'translateY(-10px)' : undefined,
    opacity: dimmed ? 0.5 : 1,
    cursor: onClick ? 'pointer' : 'default',
    boxShadow: highlighted
      ? '0 0 0 3px var(--accent)'
      : selected
        ? '0 0 0 2px var(--accent)'
        : '0 1px 2px rgba(0,0,0,0.5)',
  };

  if (!card) {
    // Face-down back: dark green with a deer-track mark.
    return (
      <div
        onClick={onClick}
        aria-label="face down card"
        style={{ ...common, background: '#1f3222', border: '1px solid #2c3326' }}
      >
        <svg viewBox="0 0 24 24" width={d.w * 0.6} height={d.h * 0.6} style={{ position: 'absolute', inset: 0, margin: 'auto', opacity: 0.5 }}>
          {/* two small deer-track cloven prints */}
          <path d="M9 7c-1 2-1 4 0 5 1-1 1-3 0-5zM11 7c1 2 1 4 0 5-1-1-1-3 0-5z" fill="#7faf4a" />
          <path d="M13 13c-1 2-1 4 0 5 1-1 1-3 0-5zM15 13c1 2 1 4 0 5-1-1-1-3 0-5z" fill="#7faf4a" />
        </svg>
      </div>
    );
  }

  const color = isRed(card.suit) ? '#9b1c1c' : '#161a13';
  const glyph = SUIT_GLYPH[card.suit];
  const rankLabel = card.rank;

  return (
    <div
      onClick={onClick}
      aria-label={`${rankLabel} of ${card.suit}`}
      style={{ ...common, background: 'var(--card-face)', border: '1px solid #cdbfa0' }}
    >
      <span style={{ position: 'absolute', top: 2, left: 4, color, fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 700, fontSize: d.rank, lineHeight: 1 }}>
        {rankLabel}
      </span>
      <span style={{ position: 'absolute', top: 2 + d.rank, left: 4, color, fontSize: d.suit, lineHeight: 1 }}>{glyph}</span>
      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color, fontSize: d.pip }}>{glyph}</span>
    </div>
  );
}

export type { EngineCard, Rank, Suit };
