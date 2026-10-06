'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCamp, joinCamp } from '@/net/rpc';
import { storage, KEYS } from '@/device/storage';
import { getVocabulary } from '@/themes/vocabulary';
import type { PlayerCount } from '@/net/types';

const t = getVocabulary('deer-camp');
const THEME_ID = 'deer-camp';

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [stand, setStand] = useState('');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [gameLength, setGameLength] = useState<61 | 121>(121);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(storage.get(KEYS.displayName) ?? '');
    setStand(storage.get(KEYS.standName) ?? '');
  }, []);

  function remember() {
    storage.set(KEYS.displayName, name.trim());
    storage.set(KEYS.standName, stand.trim());
  }

  async function guard(fn: () => Promise<void>) {
    setError(null);
    if (!name.trim()) {
      setError('Enter a name first.');
      return;
    }
    setBusy(true);
    try {
      remember();
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const onCreate = () =>
    guard(async () => {
      const camp = await createCamp({
        playerCount,
        gameLength: playerCount === 2 ? gameLength : 121,
        skunk: true,
        manualCounting: false,
        muggins: false,
        standReport: 'each_hand',
        themeId: THEME_ID,
        displayName: name.trim(),
        standName: stand.trim() || null,
      });
      router.push(`/camp?c=${camp.camp_code}`);
    });

  const onJoin = () =>
    guard(async () => {
      const code = joinCode.trim().toUpperCase();
      if (!code) throw new Error('Enter a camp code.');
      await joinCamp(code, name.trim(), stand.trim() || null);
      router.push(`/camp?c=${code}`);
    });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-4 py-8">
      <header className="text-center">
        <h1 className="font-title text-3xl text-accent-ink">{t.appTitle}</h1>
        <p className="mt-1 text-ink-dim">{t.tagline}</p>
      </header>

      <section className="panel flex flex-col gap-3">
        <label className="text-sm text-ink-dim" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kyle"
          autoComplete="off"
        />
        <label className="text-sm text-ink-dim" htmlFor="stand">
          {t.standName} (optional)
        </label>
        <input
          id="stand"
          className="field"
          value={stand}
          onChange={(e) => setStand(e.target.value)}
          placeholder="e.g. Ridge stand"
          autoComplete="off"
        />
      </section>

      <section className="panel flex flex-col gap-3">
        <h2 className="font-body text-lg font-bold">{t.newCamp}</h2>
        <div className="flex gap-2">
          {([2, 3, 4] as const).map((n) => (
            <button
              key={n}
              className={`btn flex-1 ${playerCount === n ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPlayerCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
        {playerCount === 2 && (
          <div className="flex gap-2">
            {([121, 61] as const).map((len) => (
              <button
                key={len}
                className={`btn flex-1 ${gameLength === len ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setGameLength(len)}
              >
                {len}
              </button>
            ))}
          </div>
        )}
        <button className="btn-primary" disabled={busy} onClick={onCreate}>
          {t.newCamp}
        </button>
      </section>

      <section className="panel flex flex-col gap-3">
        <h2 className="font-body text-lg font-bold">{t.joinCamp}</h2>
        <input
          className="field uppercase tracking-widest"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder={t.campCode}
          maxLength={5}
          autoComplete="off"
        />
        <button className="btn-secondary" disabled={busy} onClick={onJoin}>
          {t.joinCamp}
        </button>
      </section>

      {error && <p className="text-center text-accent-ink">{error}</p>}
    </main>
  );
}
