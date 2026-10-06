/**
 * The game table (REQUIREMENTS §5.3), portrait phone first. Presentational: it
 * takes plain props so it renders from mock data now and from live GameState
 * later. One-handed layout — all actions sit in the bottom half; the Deer! Hold
 * and primary Play button are the bottom row; no drag gestures.
 */

import { Card, type EngineCard } from './Card';
import { Pegboard, type PegLane } from './Pegboard';
import { getVocabulary } from '../themes/vocabulary';

const t = getVocabulary('deer-camp');

export interface TableTeam {
  name: string;
  score: number;
}
export interface TableOpponent {
  name: string;
  standName?: string;
  cardCount: number;
  isTurn: boolean;
  isDealer: boolean;
  color: string;
}
export interface GameTableProps {
  teams: TableTeam[];
  lanes: PegLane[];
  opponents: TableOpponent[];
  starter: EngineCard;
  cribCount: number;
  cribIsDealers: string; // whose crib, e.g. "Kyle's crib"
  series: EngineCard[];
  count: number;
  lastEvent?: string; // orange line, e.g. "Mike: run of 4 for 4"
  statusLine: string;
  myHand: EngineCard[];
  selectedIndex: number | null;
  canPlay: boolean;
}

export function GameTable(props: GameTableProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-3 py-3">
      {/* Pegboard + scores */}
      <section className="panel !p-3">
        <Pegboard lanes={props.lanes} />
        <div className="mt-2 flex justify-around">
          {props.teams.map((tm, i) => (
            <div key={i} className="text-center">
              <div className="text-xs text-ink-dim">{tm.name}</div>
              <div className="font-num text-2xl" style={{ color: props.lanes[i]?.color }}>
                {tm.score}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Opponents */}
      <section className="mt-2 flex flex-wrap gap-2">
        {props.opponents.map((o, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${o.isTurn ? 'border-accent' : 'border-divider'}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />
            <span className="text-sm">
              {o.name}
              {o.isDealer && <span className="ml-1 text-xs text-bone">(deal)</span>}
            </span>
            <span className="flex gap-0.5" aria-label={`${o.cardCount} cards`}>
              {Array.from({ length: o.cardCount }, (_, k) => (
                <Card key={k} size="sm" />
              ))}
            </span>
          </div>
        ))}
      </section>

      {/* Starter + crib */}
      <section className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-dim">Cut</span>
          <Card card={props.starter} size="md" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-dim">{props.cribIsDealers}</span>
          <div className="relative">
            {Array.from({ length: props.cribCount }, (_, k) => (
              <span key={k} style={{ display: 'inline-block', marginLeft: k === 0 ? 0 : -26 }}>
                <Card size="sm" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pegging area */}
      <section className="mt-3 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-dim">The play</span>
          <span className="font-num text-3xl">{props.count}</span>
        </div>
        <div className="mt-1 flex min-h-[70px] flex-wrap gap-1">
          {props.series.map((c, i) => (
            <Card key={i} card={c} size="md" dimmed={i < props.series.length - 1 && false} />
          ))}
        </div>
        {props.lastEvent && <div className="mt-1 text-accent-ink">{props.lastEvent}</div>}
      </section>

      {/* Status + my hand + actions (bottom half) */}
      <section className="sticky bottom-0 bg-bg pb-1 pt-2">
        <div className="mb-2 text-center font-body">{props.statusLine}</div>
        <div className="mb-3 flex justify-center gap-1">
          {props.myHand.map((c, i) => (
            <Card key={i} card={c} size="lg" selected={props.selectedIndex === i} />
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1">{t.deerHold}</button>
          <button className="btn-primary flex-[2]" disabled={!props.canPlay}>
            {t.play}
          </button>
        </div>
      </section>
    </main>
  );
}
