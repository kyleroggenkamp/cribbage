'use client';

import { useEffect, useState } from 'react';
import { GameTable } from './GameTable';
import type { EngineCard } from './Card';
import type { TableView } from '@/net/gameView';
import { getVocabulary } from '@/themes/vocabulary';

const t = getVocabulary('deer-camp');

/**
 * Binds the live view model to the interactive table: manage card selection for
 * the current phase (pick N to throw while discarding; pick one legal card to
 * peg) and fire the confirm. Selection resets whenever the server state moves.
 */
export function LiveGame({
  view,
  onDiscard,
  onPlay,
  onHold,
}: {
  view: TableView;
  onDiscard: (cards: EngineCard[]) => void;
  onPlay: (card: EngineCard) => void;
  onHold?: () => void;
}) {
  const [sel, setSel] = useState<number[]>([]);

  const isDiscard = view.discardTarget != null;
  const isPeg = view.playableIndices.length > 0;

  // Clear the selection whenever the actionable state changes (e.g. after a
  // move lands and the fresh state arrives).
  useEffect(() => {
    setSel([]);
  }, [view.phase, view.count, view.myHand.length, isDiscard, isPeg]);

  function onCardTap(i: number) {
    if (isDiscard) {
      setSel((cur) =>
        cur.includes(i) ? cur.filter((x) => x !== i) : cur.length < (view.discardTarget ?? 0) ? [...cur, i] : cur,
      );
    } else if (isPeg) {
      setSel([i]);
    }
  }

  const primaryEnabled = isDiscard ? sel.length === view.discardTarget : isPeg ? sel.length === 1 : false;
  const primaryLabel = isDiscard ? 'Throw to crib' : t.play;

  function onPrimary() {
    if (isDiscard) onDiscard(sel.map((i) => view.myHand[i]!));
    else if (isPeg && sel[0] != null) onPlay(view.myHand[sel[0]]!);
    setSel([]);
  }

  return (
    <GameTable
      teams={view.teams}
      lanes={view.lanes}
      opponents={view.opponents}
      starter={view.starter}
      cribCount={view.cribCount}
      series={view.series}
      count={view.count}
      statusLine={view.statusLine}
      myHand={view.myHand}
      selectedIndices={sel}
      playableIndices={isPeg ? view.playableIndices : isDiscard ? null : []}
      onCardTap={onCardTap}
      primaryLabel={primaryLabel}
      primaryEnabled={primaryEnabled}
      onPrimary={onPrimary}
      onHold={onHold}
    />
  );
}
