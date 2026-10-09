'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSignedIn, currentUserId } from '@/net/auth';
import {
  joinCamp,
  addBot,
  removeBot,
  setReady,
  updateSeatSettings,
  startGame,
} from '@/net/rpc';
import { useGameState, type ConnStatus } from '@/net/useGameState';
import { createWebActionQueue } from '@/net/actionQueueWeb';
import type { ActionQueue } from '@/net/actionQueue';
import { toTableView } from '@/net/gameView';
import { errorMessage } from '@/net/errors';
import { LiveGame } from '@/ui/LiveGame';
import type { EngineCard } from '@/ui/Card';
import { storage, KEYS } from '@/device/storage';
import { share } from '@/device/share';
import { getVocabulary } from '@/themes/vocabulary';
import type { SeatRow } from '@/net/types';

const t = getVocabulary('deer-camp');

const CONN_LABEL: Record<ConnStatus, string> = {
  connecting: 'connecting…',
  connected: 'connected',
  weak: 'weak signal',
  offline: 'offline, reconnecting…',
};

export default function Lobby() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const { state, conn, error } = useGameState(gameId);

  // The offline action queue (created lazily in the browser, not at build time).
  const queueRef = useRef<ActionQueue | null>(null);
  useEffect(() => {
    queueRef.current = createWebActionQueue();
  }, []);
  function send(action: Record<string, unknown>) {
    if (!gameId) return;
    const id = crypto.randomUUID();
    queueRef.current?.enqueue(gameId, id, { id, ...action });
  }

  // The host deals the first hand once the game starts (subsequent hands deal
  // automatically after each show). This self-heals: as long as the game is
  // playing with no hand yet, the host keeps re-sending `deal` every few
  // seconds until a hand appears. A deal is a safe no-op once the hand exists
  // (the server only initialises the first time), so a lost or cold-started
  // first send can no longer wedge the table at "Dealing…".
  useEffect(() => {
    if (!state || !gameId || !myId) return;
    const amHost = state.game.host_player_id === myId;
    const needsDeal = state.game.status === 'playing' && !state.hand && amHost;
    if (!needsDeal) return;
    send({ type: 'deal' });
    const timer = setInterval(() => send({ type: 'deal' }), 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, gameId, myId]);

  // Resolve the camp code from the URL, sign in, and join (idempotent).
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c');
    if (!c) {
      router.replace('/');
      return;
    }
    setCode(c.toUpperCase());
    const name = storage.get(KEYS.displayName);
    if (!name) {
      // No name on this device: send them through Home to enter one.
      router.replace('/');
      return;
    }
    (async () => {
      try {
        await ensureSignedIn();
        setMyId(await currentUserId());
        const res = await joinCamp(c.toUpperCase(), name, storage.get(KEYS.standName));
        setGameId(res.game_id);
      } catch (e) {
        setFatal(errorMessage(e));
      }
    })();
  }, [router]);

  if (fatal) return <Centered>{fatal}</Centered>;
  if (!state) return <Centered>Joining {code}…</Centered>;

  const { game, seats } = state;
  const isHost = game.host_player_id === myId;
  const openHumanSeats = seats.filter((s) => !s.player_id && !s.is_bot);
  const canStart = isHost && game.status === 'lobby' && openHumanSeats.length === 0;
  const mySeat = seats.find((s) => s.player_id === myId) ?? null;

  async function invite() {
    await share.shareLink(window.location.href, `Join my ${t.camp}: ${code}`);
  }

  if (game.status === 'playing' || game.status === 'over') {
    if (!state.hand) return <Centered>Dealing…</Centered>;
    const view = toTableView(state, myId);
    const seatIdx = mySeat?.seat_index ?? null;
    return (
      <LiveGame
        view={view}
        onDiscard={(cards: EngineCard[]) => seatIdx != null && send({ type: 'discard', seat: seatIdx, cards })}
        onPlay={(card: EngineCard) => seatIdx != null && send({ type: 'play', seat: seatIdx, card })}
        onHold={() => {
          /* Deer! Hold is wired in the next build step */
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-ink-dim">{t.campCode}</p>
          <p className="font-num text-3xl tracking-widest text-accent-ink">{game.camp_code}</p>
        </div>
        <ConnPill conn={conn} />
      </header>

      <button className="btn-secondary" onClick={invite}>
        {t.invite}
      </button>

      <section className="panel flex flex-col gap-2">
        <h2 className="font-body font-bold">
          {t.stand}s ({game.player_count}-player
          {game.player_count === 4 ? ', two teams' : ''})
        </h2>
        {seats.map((s) => (
          <SeatRowView
            key={s.seat_index}
            seat={s}
            isMe={s.player_id === myId}
            isHost={isHost}
            fourPlayer={game.player_count === 4}
            onAddBot={() => addBot(game.id, s.seat_index)}
            onRemoveBot={() => removeBot(game.id, s.seat_index)}
          />
        ))}
      </section>

      {mySeat && (
        <section className="panel flex flex-col gap-3">
          <h2 className="font-body font-bold">Your settings</h2>
          <Toggle
            label={t.silent}
            on={mySeat.silent}
            onChange={(v) => updateSeatSettings(game.id, { silent: v })}
          />
          <Toggle
            label={t.standMode}
            on={mySeat.stand_mode}
            onChange={(v) => updateSeatSettings(game.id, { standMode: v })}
          />
          <Toggle
            label={t.ready}
            on={mySeat.ready}
            onChange={(v) => setReady(game.id, v)}
          />
        </section>
      )}

      {isHost ? (
        <button
          className="btn-primary"
          disabled={!canStart}
          onClick={() => startGame(game.id)}
        >
          {canStart ? t.start : `${openHumanSeats.length} ${t.stand}(s) still open`}
        </button>
      ) : (
        <p className="text-center text-ink-dim">{t.waitingForHost}</p>
      )}

      {error && <p className="text-center text-accent-ink">{error}</p>}
    </main>
  );
}

function SeatRowView(props: {
  seat: SeatRow;
  isMe: boolean;
  isHost: boolean;
  fourPlayer: boolean;
  onAddBot: () => void;
  onRemoveBot: () => void;
}) {
  const { seat, isMe, isHost, fourPlayer } = props;
  const filled = seat.player_id || seat.is_bot;
  const label = seat.is_bot ? t.campBot : seat.display_name ?? '(open)';
  return (
    <div className="flex items-center justify-between rounded-lg border border-divider px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: fourPlayer ? (seat.team === 0 ? 'var(--peg-a)' : 'var(--peg-c)') : 'var(--peg-a)' }}
          aria-hidden
        />
        <span className={filled ? 'text-ink' : 'text-ink-dim'}>
          {label}
          {isMe && ' (you)'}
          {seat.stand_name ? ` · ${seat.stand_name}` : ''}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {filled && seat.ready && <span className="text-xs text-accent-ink">ready</span>}
        {isHost && !filled && (
          <button className="btn-secondary text-sm" onClick={props.onAddBot}>
            {t.addBot}
          </button>
        )}
        {isHost && seat.is_bot && (
          <button className="btn-secondary text-sm" onClick={props.onRemoveBot}>
            {t.removeBot}
          </button>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className="flex items-center justify-between rounded-lg border border-divider px-3 py-3"
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
    >
      <span>{label}</span>
      <span className={`font-num ${on ? 'text-accent-ink' : 'text-ink-dim'}`}>{on ? 'ON' : 'OFF'}</span>
    </button>
  );
}

function ConnPill({ conn }: { conn: ConnStatus }) {
  const color = conn === 'connected' ? 'var(--peg-c)' : conn === 'weak' ? 'var(--accent)' : 'var(--text-secondary)';
  return (
    <span className="flex items-center gap-2 text-xs text-ink-dim">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {CONN_LABEL[conn]}
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      {children}
    </main>
  );
}
