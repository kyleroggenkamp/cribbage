'use client';

/**
 * Dev-only visual preview of the themed game screens with mock data, so the
 * look can be reviewed without a running backend. Not linked from the app.
 */

import { GameTable } from '@/ui/GameTable';
import { CountScreen } from '@/ui/CountScreen';
import { Pegboard } from '@/ui/Pegboard';
import type { EngineCard } from '@/ui/Card';

const C = (rank: string, suit: string): EngineCard => ({ rank, suit }) as EngineCard;

export default function Preview() {
  return (
    <div className="flex flex-col gap-8 py-6">
      <Section title="Game table (pegging)">
        <GameTable
          teams={[
            { name: 'You', score: 64 },
            { name: 'Taylor', score: 58 },
          ]}
          lanes={[
            { label: 'You', color: 'var(--peg-a)', front: 64, back: 61 },
            { label: 'Taylor', color: 'var(--peg-b)', front: 58, back: 55 },
          ]}
          opponents={[{ name: 'Taylor', cardCount: 3, isTurn: false, isDealer: true, color: 'var(--peg-b)' }]}
          starter={C('5', 'H')}
          cribCount={4}
          cribLabel="Taylor's crib"
          series={[C('6', 'C'), C('4', 'D'), C('5', 'S')]}
          count={15}
          lastEvent="Taylor: run of 3 for 3"
          statusLine="Your turn. Count is 15."
          myHand={[C('4', 'D'), C('5', 'S'), C('6', 'C'), C('J', 'H')]}
          selectedIndices={[3]}
          primaryEnabled
        />
      </Section>

      <Section title="The show (count breakdown)">
        <CountScreen
          countOrder={[
            { name: 'Taylor', current: true },
            { name: 'You', current: false },
            { name: 'Crib', current: false },
          ]}
          who="Taylor's hand"
          hand={[C('4', 'D'), C('5', 'S'), C('6', 'C'), C('J', 'H')]}
          starter={C('5', 'H')}
          lines={[
            { label: 'fifteen', points: 2, cardIndices: [0, 1, 2] },
            { label: 'fifteen', points: 2, cardIndices: [3, 4] },
            { label: 'pair', points: 2, cardIndices: [1, 4] },
            { label: 'run of 3', points: 3, cardIndices: [0, 1, 2] },
            { label: 'run of 3', points: 3, cardIndices: [0, 4, 2] },
            { label: 'nobs', points: 1, cardIndices: [3, 4] },
          ]}
          total={17}
          scoreBefore={58}
          scoreAfter={75}
          canAdvance
        />
      </Section>

      <Section title="Pegboard near the buck pole (3 players, skunk line)">
        <div className="mx-auto px-4" style={{ maxWidth: 260 }}>
          <div className="panel">
            <Pegboard
              lanes={[
                { label: 'You', color: 'var(--peg-a)', front: 112, back: 108 },
                { label: 'Dave', color: 'var(--peg-b)', front: 96, back: 92 },
                { label: 'Mike', color: 'var(--peg-c)', front: 74, back: 70 },
              ]}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 px-4 font-num text-sm uppercase tracking-wide text-ink-dim">{title}</h3>
      <div className="border-y border-divider">{children}</div>
    </div>
  );
}
