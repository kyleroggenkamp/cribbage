/**
 * The show / count screen (REQUIREMENTS §5.3, §3.8): count-order strip, the
 * hand + starter, a line-by-line breakdown with a running total, and the side's
 * score change. Each count shows >= 3s before Next is enabled (handled by the
 * container, not here).
 */

import { Card, type EngineCard } from './Card';

export interface CountLine {
  label: string; // "15", "pair", "run of 3", "nobs"
  points: number;
  cardIndices: number[]; // which of [hand..., starter] this scores
}

export interface CountScreenProps {
  countOrder: { name: string; current: boolean }[];
  who: string; // "Kyle's hand" / "The crib"
  hand: EngineCard[];
  starter: EngineCard;
  lines: CountLine[];
  total: number;
  scoreBefore: number;
  scoreAfter: number;
  canAdvance: boolean;
}

export function CountScreen(props: CountScreenProps) {
  const all = [...props.hand, props.starter];
  let running = 0;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4">
      <div className="mb-3 flex justify-center gap-2">
        {props.countOrder.map((c, i) => (
          <span
            key={i}
            className={`rounded-full px-2 py-0.5 text-xs ${c.current ? 'bg-accent text-bg' : 'border border-divider text-ink-dim'}`}
          >
            {c.name}
          </span>
        ))}
      </div>

      <h2 className="text-center font-body text-lg font-bold">{props.who}</h2>

      <div className="mt-3 flex items-end justify-center gap-2">
        {props.hand.map((c, i) => (
          <Card key={i} card={c} size="lg" />
        ))}
        <span className="mx-1 self-center text-ink-dim">+</span>
        <Card card={props.starter} size="lg" highlighted />
      </div>

      <section className="panel mt-4 flex flex-col gap-1">
        {props.lines.length === 0 && <div className="text-center text-ink-dim">Nothing. (0)</div>}
        {props.lines.map((ln, i) => {
          running += ln.points;
          return (
            <div key={i} className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                {ln.cardIndices.map((idx) => (
                  <Card key={idx} card={all[idx]} size="sm" highlighted />
                ))}
                <span className="ml-2">{ln.label}</span>
              </span>
              <span className="font-num text-lg">
                for <span className="text-accent-ink">{running}</span>
              </span>
            </div>
          );
        })}
      </section>

      <div className="mt-4 text-center">
        <span className="font-num text-4xl text-accent-ink">+{props.total}</span>
        <div className="text-ink-dim">
          {props.scoreBefore} &rarr; <span className="text-ink">{props.scoreAfter}</span>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <button className="btn-primary w-full" disabled={!props.canAdvance}>
          Next
        </button>
      </div>
    </main>
  );
}
