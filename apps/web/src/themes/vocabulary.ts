/**
 * Theme vocabulary (REQUIREMENTS §5.1A). ALL user-facing themed words come from
 * here, keyed. A quick check: searching outside src/themes for "buck/deer/
 * stand/camp" should find nothing user-facing. v1 ships only the deer-camp
 * theme; `base` holds neutral strings a theme can leave alone.
 */

export interface Vocabulary {
  appTitle: string;
  tagline: string;
  camp: string;        // a game room
  campCode: string;
  stand: string;       // a seat
  standName: string;
  campBot: string;     // a computer player
  newCamp: string;
  joinCamp: string;
  playBots: string;
  invite: string;
  start: string;
  ready: string;
  waitingForHost: string;
  addBot: string;
  removeBot: string;
  silent: string;
  standMode: string;
  notifications: string;
}

/** Neutral base strings (theme-independent). */
export const base: Vocabulary = {
  appTitle: 'Cribbage',
  tagline: 'Play cribbage on your phones.',
  camp: 'game',
  campCode: 'Game code',
  stand: 'seat',
  standName: 'Seat name',
  campBot: 'Bot',
  newCamp: 'New game',
  joinCamp: 'Join game',
  playBots: 'Play the bots',
  invite: 'Invite',
  start: 'Start',
  ready: 'Ready',
  waitingForHost: 'Waiting for the host to start…',
  addBot: 'Add bot',
  removeBot: 'Remove bot',
  silent: 'Silent',
  standMode: 'Dim screen',
  notifications: 'Turn alerts',
};

export const deerCamp: Vocabulary = {
  appTitle: 'Deer Camp Cribbage',
  tagline: 'Cribbage from separate deer stands.',
  camp: 'camp',
  campCode: 'Camp code',
  stand: 'stand',
  standName: 'Stand name',
  campBot: 'Camp bot',
  newCamp: 'New camp',
  joinCamp: 'Join camp',
  playBots: 'Play the camp bots',
  invite: 'Invite to camp',
  start: 'Start the hunt',
  ready: 'Ready',
  waitingForHost: 'Waiting for the host to start the hunt…',
  addBot: 'Add camp bot',
  removeBot: 'Remove camp bot',
  silent: 'Silent',
  standMode: 'Stand mode (dim)',
  notifications: 'Turn alerts',
};

const THEMES: Record<string, Vocabulary> = {
  'deer-camp': deerCamp,
  base,
};

export function getVocabulary(themeId: string): Vocabulary {
  return THEMES[themeId] ?? deerCamp;
}
