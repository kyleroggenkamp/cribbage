# Deer Camp Cribbage (PWA): Requirements for Claude Code

Design mockup: "Deer Camp Cribbage" design canvas (lobby, pegging turn, the show, game on hold, game over, pegboard). Match its layout, colors, and wording unless this document says otherwise.

## 0. Instructions to Claude Code
- Build in the phases in Section 9, in order. Do not start a phase until the previous phase's acceptance criteria pass.
- The rules engine (Section 3) is the core of the product. It must be a pure TypeScript module with no UI or network code, and it must have full unit test coverage before any UI is built on it.
- When a cribbage rule is ambiguous, follow the American Cribbage Congress (ACC) rules and leave a code comment citing the rule.
- Ask before adding any paid service or any dependency not listed in Section 7.

## 1. Product summary
A mobile-first progressive web app (installable, works on iPhone and Android) for Minnesota deer hunters to play cribbage with each other while sitting in **separate deer stands**, each on their own phone over 4G/5G cellular. It supports:
- 2-player (head to head)
- 3-player (every player for themselves)
- 4-player (always two teams of two, partners sit opposite; no individual 4-player mode)

Each human plays on **their own device**. Players join a game with a short room code or share link. Empty seats can be filled by a computer opponent. Hosted on Vercel.

**Non-goals (v1):** accounts with passwords, matchmaking with strangers, free-form chat (canned razz messages only, Section 4A.6), wagering, ads, season leaderboards, tournaments.

## 1A. Deer stand conditions (these override anything else in this document)
The players are sitting still and quiet in the woods, wearing gloves, in the cold, with weak cell signal and phones in their pockets between turns. Every requirement below is mandatory.

**Silence**
- The app never plays a sound by default. The "Silent" setting is on by default and set per player in the lobby.
- With Silent on, the only alert is one short vibration when it becomes your turn (or when a hold ends). Nothing vibrates for other players' moves.
- Where the device can't vibrate from the web (iPhone Safari), rely on the push notification in the next section, with the notification sound left to the phone's own settings. Explain this on the setup screen.

**Turn notifications**
- Players lock their phones between turns, so a turn alert must arrive even when the app is closed: use Web Push notifications ("Your turn. Count is 18.").
- iPhone only supports web push for apps added to the Home Screen (iOS 16.4 or later). The first-run screen must walk each player through "Add to Home Screen" and allowing notifications, and the lobby shows a warning next to any player whose notifications are off.
- Notifications carry no card details (they show on a lock screen).

**"Deer!" hold**
- A "Deer! Hold" button is always visible during play (see the mockup). Any player can press it at any time, including when it isn't their turn.
- A hold freezes the game for everyone: no moves, no count timers, no away-player-to-bot replacement, no notifications. Every other player sees "Game on hold. [Name] has one in sight." with how long the hold has been on.
- Only the player who called the hold can resume it. The host can release it with a confirm step (for when someone forgets).
- When the hold ends, everyone gets one vibration/notification and play resumes exactly where it stopped.

**No time pressure**
- No turn timers. A player may take 20 minutes to play a card.
- The host's "replace with bot" option appears only after a player has been unreachable for 10+ minutes and never during a hold. It is never automatic.
- The 3-second minimum on count screens stays, but counts never auto-advance. Each player advances on their own phone.

**Weak cellular signal**
- Assume 1 bar of LTE: 5–15 second round trips, frequent short drops, and full disconnects for minutes at a time.
- Every action (discard, play card, hold, resume) is sent with a unique ID so a retry can never apply it twice. If it doesn't reach the server, the app queues it and retries automatically until confirmed.
- The UI shows the move as "sending…" until the server confirms. It never silently loses a move.
- The top bar always shows connection status (connected / weak / offline, reconnecting).
- On reconnect, the app fetches the full current game state instead of replaying missed events.
- Keep payloads small (no images from the server during play; all art is bundled in the app).

**Stand mode (dim display)**
- Dark theme is the default and the only theme in v1 (see mockup colors). No white screens, flashes, or full-screen bright animations anywhere, including loading and transitions. The goal is a phone that doesn't light up a hunter's face at dawn or dusk.
- Card faces use an off-white (#ECE4D2), not pure white.
- A "Stand mode" setting (on by default) dims further by lowering overall brightness about 30% with a dark overlay.

**Gloves and cold**
- Every tap target is at least 48×48 px, with primary buttons at least 56 px tall. No drag gestures, no long-press, no small close "X" buttons.
- One-handed use: all game actions sit in the bottom half of the screen.
- Phones die fast in the cold. All state lives on the server, so a phone that shuts off and restarts rejoins with nothing lost.
- Battery: no continuous animations or polling loops while waiting. Screen wake lock is off by default (players lock their phones between turns), with an optional "Keep screen on" setting.

## 2. Users and core flows
1. **Create game ("camp"):** host picks player count (2/3/4), game length (121 default; 61 option for 2-player), and rule options (Section 3.9). The app generates a 5-character camp code (letters and numbers, excluding look-alikes like O/0 and I/1) and a share link (sent by text message using the native share sheet).
2. **Join game:** a player opens the link or enters the code, types a display name and an optional stand name (e.g., "Ridge stand"), with no signup, and picks a seat. In 4-player, the seat picked sets the team. Name and stand are remembered on that phone for next time.
3. **Fill seats:** host can put a computer opponent in any empty seat.
4. **Play:** the full cribbage hand cycle (Section 3) repeats until someone wins.
5. **Rejoin:** if a phone locks, the app closes, or the connection drops, reopening the link restores that player's seat, hand, and the full game state. This is mandatory for a phone game.
6. **Rematch:** after a game ends, one tap starts a new game with the same seats.
7. **Solo:** start a camp and fill every other seat with camp bots. This runs through the same server as multiplayer (it needs signal). Offline solo play is not in v1.

## 3. Rules engine (must be exact)

### 3.1 Deck and cards
- Standard 52-card deck. Ace = 1, 2–10 at face value, J/Q/K = 10 for counting. Rank order for runs: A-2-3-…-10-J-Q-K (ace is low only; Q-K-A is not a run).
- Shuffles use a cryptographically secure random source (`crypto.getRandomValues` / Node `crypto`). In online play, shuffling happens on the server only.

### 3.2 First deal and dealer rotation
- First dealer: each player cuts a card; lowest card deals (ace low). Ties re-cut.
- Deal passes to the left (clockwise) each hand.

### 3.3 Deal and discard by player count
| Players | Cards dealt each | Extra to crib from deck | Each discards to crib | Hand size after discard |
|---|---|---|---|---|
| 2 | 6 | 0 | 2 | 4 |
| 3 | 5 | 1 | 1 | 4 |
| 4 | 5 | 0 | 1 | 4 |

The crib always ends up with 4 cards and belongs to the dealer (in 4-player, to the dealer's team).

### 3.4 Starter card
- After all discards, the player to the dealer's right cuts, and the top card of the remaining deck is turned up as the starter.
- If the starter is a Jack, the dealer immediately pegs 2 ("his heels"). This can win the game.

### 3.5 The play (pegging)
- The player to the dealer's left leads; play goes clockwise. Each player plays one card at a time, announcing the running total, which cannot exceed 31.
- A player who cannot play without exceeding 31 says "Go". Play continues with the next player who can play. The last player to lay a card before the count resets scores 1 for the go, or 2 if the total is exactly 31 (not 3).
- After a go or 31, the count resets to 0 and the player to the left of the last player to play leads the next series. Players with no cards left are skipped.
- The last card of the play scores 1 (unless it made 31, which scores 2 only).
- Pegging points during play:
  - Total reaches 15: 2
  - Total reaches 31: 2
  - Pair (same rank as previous card): 2; three of a kind: 6; four of a kind: 12
  - Run of 3+ among the most recent cards in the current series, in any order, with no other cards in between: 1 per card. Re-evaluate after every card (e.g., 4, 6, 5 = run of 3; then 3 = run of 4).
  - Pairs and runs do not carry across a count reset.
- In 4-player, points pegged by either partner go to the team.

### 3.6 Counting hands (the show)
Count order is strict: starting with the player to the dealer's left, going clockwise, the dealer's hand last, then the crib. Each hand counts with the starter as a fifth card.
- Fifteens: each distinct combination of cards totaling 15 = 2
- Pairs: each pair = 2 (three of a kind = 6, four of a kind = 12)
- Runs: 1 per card in each distinct run of 3+ (double runs, triple runs, and double-double runs are counted by combination)
- Flush in hand: 4 if all four hand cards share a suit; 5 if the starter also matches
- Flush in crib: only 5, when all four crib cards and the starter share a suit (4-card crib flushes do not count)
- Nobs: 1 for a Jack in the hand or crib matching the starter's suit
- Maximum possible hand: 29

### 3.7 Winning
- First player or team to reach the target (121 or 61) wins **immediately**, including mid-play or mid-count. Because of the strict count order, the player counting first can win before the dealer counts ("counting out"). The engine must stop scoring the moment the target is reached.
- Skunk (option, default on): winner scores a skunk if loser is below 91 (below 31 in a 61-point game) and a double skunk if below 61. Display only; no stats needed in v1.

### 3.8 Scoring display
- Default: auto-count. The app computes each hand's score and shows the breakdown (e.g., "15 for 2, 15 for 4, pair for 6, run for 9, nobs for 10") with the scoring cards highlighted, before pegging it.
- Each count shows for at least 3 seconds before "Next" is enabled. Each player advances through the counts on their own phone; the game waits for no one, and the next deal starts when all counts are done on the server.

### 3.9 Game options (set at game creation)
- Game length: 121 / 61 (61 only for 2-player)
- Skunk on/off
- Manual counting on/off: each player enters their own hand score; the app accepts it even if wrong
- Muggins (only when manual counting is on): after a player under-counts, opponents get a short window to claim the missed points
- 4-player is always two teams of two. Do not build a 4-player individual mode.

## 4. Computer opponent
- Easy level only in v1.
- Discard: use the same discard evaluator as the play grader (Section 4A.2) and pick the discard with the highest expected value.
- Pegging: use the same pegging evaluator as the play grader (Section 4A.3) and pick its best card.
- Add a 1–2 second delay before bot moves so humans can follow.

## 4A. Play grader ("Stand report")
A grader that silently works out the statistically best decision at every point in each player's hand, compares it with what the player actually did, and reports how many points each player gave away. The purpose is bragging rights and giving the worst player a hard time.

### 4A.1 Core principles
- **This is math, not an AI model.** Don't call any AI or LLM API. The best play is computed exactly (or by simulation) from the rules engine. It costs nothing to run and gives the same answer every time.
- **Grade decisions, not luck.** A player dealt garbage who makes the best possible discard gets a perfect grade. A player dealt a 24 who throws the wrong cards gets marked down. The measure is always *expected points lost compared to the best choice*, never raw points scored.
- **Silent until decisions are locked, and never leaks cards.** Grading runs on the server. Nothing shows while a player is still deciding. Results are released in two steps:
  1. **Discard score:** as soon as every player's discard is locked in (the crib is set), everyone sees each player's discard score as numbers only (Section 4A.5). No cards, no kept-hand values, no "best was…" suggestion, since those would reveal hands before pegging.
  2. **Card details and pegging grades:** only after the show for that hand is finished.
- **Never slows the game.** Grading runs in the background after each decision. If it isn't finished when the hand ends, the recap shows "Grading…" and fills in when ready.
- A pure TypeScript module inside the rules engine package, with no UI or network code, unit tested like the rest of the engine.

### 4A.2 Discard grading
For each player's discard:
1. List every legal discard: 15 options in 2-player (choose 2 of 6), 5 options in 3- and 4-player (choose 1 of 5).
2. For each option, compute **expected hand value**: the average score of the 4 kept cards across every possible starter card from the cards the player can't see (46 in 2-player, 47 in 3/4-player). This is exact.
3. For each option, estimate **expected crib value** for the cards thrown, by simulation: fill the rest of the crib and the starter with random unseen cards at least 2,000 times and average the crib score. Add it if the crib belongs to the player (or their team); subtract it if it belongs to an opponent. Seed the random generator from the game ID + hand number so re-running a grade always gives the same result.
4. Discard value = expected hand value ± expected crib value. The best option is the highest.
5. **Discard points lost** = best option's value − chosen option's value (0 when the player picked the best option; never negative).
6. **Discard rank:** sort all legal options from best to worst by value and record where the chosen option falls, e.g., 1st of 15 (best possible), 13th of 15 (3rd worst), 15th of 15 (worst possible). Options whose values are within 0.05 of each other share a rank, so a player isn't marked down for a tie.
7. Store the best option, the chosen option, both values, and the rank for the recap.

### 4A.3 Pegging grading
For each card a player lays during the play:
1. For each legal card, compute **net value** = points scored immediately by playing it − the expected points the next opponent scores in reply, averaged over the cards that opponent could hold (cards the player hasn't seen, weighted equally) and assuming the opponent replies with their highest-scoring card.
2. **Pegging points lost** = best card's net value − chosen card's net value (0 when the choice was best).
3. **Pegging rank:** the same ranking as discards, among the legal cards for that play (e.g., "best of 3", "worst of 3"), with the same tie rule.
4. Forced plays (only one legal card) and automatic "Go"s aren't graded or ranked.
4. Note for Claude Code: this is a one-move look-ahead and less exact than discard grading. That's acceptable for v1. Show pegging and discard results separately so the less precise number doesn't blur the exact one.

### 4A.4 Scores and ranks
- Per hand, per player: discard points lost, pegging points lost, total points lost.
- Per game, per player: total points lost and average points lost per hand.
- **Stand rank** for each player each game, from average points lost per hand:
  | Avg points lost per hand | Rank |
  |---|---|
  | 0 to 0.5 | Trophy Buck |
  | 0.5 to 1.5 | Eight-Pointer |
  | 1.5 to 3 | Spikehorn |
  | over 3 | Button Buck |
  Put these thresholds in one config file so they're easy to tune after the field test.
- The player with the most points lost in a game gets the **"Button Buck of the Game"** award, shown on the game-over screen. Ties go to both players.
- In 4-player, each player is graded individually even though scoring is by team, so partners can blame each other.
- Camp bots are graded too, so humans can be compared with them.

### 4A.5 Where results appear
- **Discard scoreboard** (the moment the crib is set, before the starter is cut, to all players):
  - A panel ranking every player's discard relative to **their own hand**, not to other players' cards. The headline for each player is their discard rank in plain words:
    - "Best possible throw" (rank 1)
    - "2nd best of 15", "3rd best of 15"… for the top half
    - "3rd worst of 15", "2nd worst of 15"… for the bottom half
    - "Worst possible throw" (last rank)
  - Under the headline, smaller: "gave away X.X points". Keep both: rank alone can mislead when the options are close (2nd best might cost 0.1 points or 5 points), so the points show how much it mattered.
  - Players are listed from best to worst by points given away.
  - No cards are shown anywhere on this panel: not what was thrown, not what the best throw would have been.
  - The score includes the crib effect: throwing good cards into an opponent's crib costs points, and feeding your own crib earns them (Section 4A.2 step 3).
  - Mark the best discarder of the hand ("Cleanest throw") and the worst ("Button Buck throw"), with ties shown for all.
  - A running game total for each player (total discard points given away so far) under this hand's number.
  - This is the only grading info shown before the play. It shows no cards and no expected hand values.
  - The discard evaluation must finish within 2 seconds of the last discard (2-player worst case) so this panel doesn't hold up the game. If it takes longer, the game continues and the panel fills in when ready.
  - It never vibrates or sends a notification.
- **Pegging ranks** are shown with the hand recap after the show, never during the play, so they can't hint at what anyone is still holding. Each graded play is listed in the same words (e.g., "Dave: worst of 3 on his second card, gave away 2.0").
- **Hand recap** (after the show, before the next deal): each player's discard rank and pegging ranks, plus the hand's total points given away. The worst decision of the hand is highlighted. All hands have been shown at the count by this point, so the recap may also show which cards were best, e.g., "Dave threw 5♠ 5♥ (3rd worst of 15), best was J♥ 6♣".
- **Game over screen:** each player's stand rank, total points lost, the Button Buck award, and the luck vs. skill split (Section 4A.7).
- **My hand review** (optional, tap to open): my discards and pegging choices from the whole game, each next to the best choice and its value. Visible to that player only.
- Host setting at camp creation: "Stand report after each hand" (default, including the discard scoreboard) or "End of game only" (hides the discard scoreboard and hand recaps until the game ends).
- Everything reported uses the phrase "gave away X points", rounded to one decimal.

### 4A.6 Razzing ("Hollering across the swamp")
Your v1 non-goals rule out chat, and free-form chat is a moderation and distraction headache. So razzing is a short set of one-tap messages instead:
- On the discard scoreboard, after a hand recap, or on the game-over screen, a "Razz" button opens canned messages, e.g., "Nice throw, Button Buck." / "You pitched a 5 into my crib? Thanks." / "Were you looking at a deer or your cards?" / "Even the camp bot knew that one." / "Gave away more points than you've shot deer." Store them in a config file so the group can edit the list.
- A razz goes to one player or to everyone, and shows as a banner next time the recipient opens the app.
- Razzes follow the stand rules: **no vibration, no sound, no push notification** (a razz must never make a phone buzz in a stand).
- Limit: 3 razzes per player per hand, so it doesn't turn into spam.
- Razzes can't be sent during a hold.

### 4A.7 Luck vs. skill
Separates what the cards did for a player from what the player did with them, so the group can settle whether someone won on cards or on play.

**Luck** (per player, per hand, computed after the show, since it needs the real starter and crib):
- **Deal luck** = the best discard value available from the cards dealt (Section 4A.2) − the average best discard value across all deals in the same situation. That average is a fixed baseline for each case (2-player dealer / non-dealer, 3-player dealer / non-dealer, 4-player dealer's team / non-dealer's team). Compute it once at build time by simulating at least 100,000 random deals, and store it in the config file.
- **Cut luck** = the kept hand's actual score with the real starter − its expected score over all possible starters.
- **Crib luck** (only for the dealer, or the dealer's team in 4-player) = the crib's actual score − its expected score from the grader's crib estimate.
- **Pegging luck** = how many pegging points the cards dealt to everyone favored this player, compared with an average hand. Pegging is a real share of every game's points and swings a lot from hand to hand, so leaving it out would make the excuse line and the rankings noticeably wrong. How to compute it (after the show, when every hand is known):
  1. Define a fixed **standard pegging policy**: the pegging evaluator's choice (Section 4A.3), with ties broken by a fixed rule so the result is deterministic.
  2. Replay the hand's pegging with every player's actual kept cards, everyone using the standard policy. The points each player (or team) scores in that replay are their **expected pegging** for this deal.
  3. **Pegging luck** = expected pegging − the average pegging for the same seat position (dealer / non-dealer, by player count). That baseline is computed at build time by replaying at least 100,000 random deals with the standard policy, and stored in config.
  4. What really happened at the table minus the replay is play, not luck, and is already covered by the pegging grades.
  5. Note: a player's kept cards are partly their own choice. The grader's discard values don't include pegging value in v1 (see roadmap R10), so pegging luck counts the kept pegging hand as luck. Accept this for v1.
- **Total luck** = deal luck + cut luck + crib luck + pegging luck. Positive = the cards helped; negative = they hurt.

**Skill** = −(total points given away) from Sections 4A.2–4A.3. Zero is perfect; more negative is worse.

**Where it shows:**
- **Hand recap:** one line per player: "Cards +4.2 · Play −3.6".
- **Game over:** each player's (and each team's) game totals, e.g., "Dave & Mike: cards +14.0, play −9.1". Add one headline sentence for the winner in plain words, picked from:
  - Luck clearly bigger than skill loss: "Won on cards."
  - Skill loss small and luck near zero or negative: "Won on play."
  - Otherwise: "Earned it with a little help."
  Put the thresholds for these in the config file.
- **Game-over "excuse line":** for each losing player or team, one line comparing them with the winner, worded from the loser's side: "Lost by 4. Your cards were 11.2 points worse than Dave's. You gave away 3.1 fewer points." It only appears when it makes the loser's case (worse cards, better play, or both); otherwise it's left off. In 3-player, compare each loser with the winner. In 4-player, compare teams. Add small type underneath: "Cards and play won't add up exactly to the final score."
- **Awards on the game-over screen:** "Horseshoe" for the luckiest player of the game and "Hard-luck hunter" for the unluckiest (ties go to both).
- Luck is never shown before the show for that hand.
- Round to one decimal. Always show the + or − sign.

### 4A.8 Hindsight ("Coulda, shoulda, woulda")
After the starter is cut, show what each player's hand would have scored with every other discard they could have made, next to what they actually got. Hindsight is entertainment, not skill: it **never** counts toward grades, ranks, awards for skill, or power rankings, since it's mostly luck.

**Calculation:** after the cut, score every legal discard option against the actual starter. After the show, when all crib cards are known, add each option's exact crib effect (plus if it's the player's own crib, minus for an opponent's). This is exact; there's no simulation.

**Two moments:**
1. **At the cut: private, on each player's own phone.** A one-line hindsight for that player only, kept-hand points only (the crib isn't known yet): "The cut gave you 7. Throwing 6♣ 9♦ instead would've been 14." Never shown to anyone else before the show, since it would reveal the hand.
2. **In the hand recap: public**, with full hand + crib numbers, and the cards named (all hands are shown by then):
   - Each player: actual vs. hindsight best, and the spread. "Kyle got 7. Throwing 6♣ 9♦ instead would've made 14."
   - **"Coulda shoulda"** callout for the biggest spread at the table that hand.

**Verdict, combining the grader (before the cut) with hindsight (after it):**
| Grader: right throw? | Cut favored their throw? | Tag |
|---|---|---|
| Yes | Yes | "Called it" |
| Yes | No | "Right call, wrong cut" |
| No | Yes | "Blind squirrel" (bad throw, cut bailed them out) |
| No | No | "Coulda shoulda woulda" |
"Right throw" = discard rank 1 (or tied for 1). "Cut favored it" = the actual throw was the hindsight best, or within 1 point of it (config).

**Stand stats:** biggest hindsight spread of the game on the game-over screen; biggest of the season in the ledger once R7 exists.

## 5. Screens and UI
The design canvas is the reference for every screen below.

### 5.1 Deer camp theme
- Name: "Deer Camp Cribbage". Vocabulary: a game room is a "camp"; seats are "stands"; a computer player is the "camp bot"; winning is "Tagged out!"; the finish hole is the "buck pole".
- Palette: forest-dark background #161A13, panels #22281D, dividers #2C3326, text #EEE8D8, secondary text #AAA691, blaze orange accent #FF6B1A (orange text on dark uses #FF7A2E), antler/bone #EFE3C6, board wood #4B3A27.
- Player/team peg colors: blaze orange and antler bone for 2 sides. For 3 players, add a third color that differs in **lightness** as well as hue from the other two (e.g., a mid green #7FAF4A), since orange and green alone look alike to red-green colorblind hunters.
- Fonts (Google Fonts): Alfa Slab One for titles, Barlow for body text, Barlow Condensed for numbers and card ranks.
- Icons: simple line drawings of antlers and deer tracks, drawn as inline SVG in the app. Don't use emoji. Don't copy trademarked camouflage patterns (Realtree, Mossy Oak, etc.) or any hunting brand's logos.
- Card backs: dark green with a small deer-track mark.

### 5.1A Theme system (build the plumbing in v1; ship only the deer camp theme)
The deer camp look is a **theme**, not hard-coded, so the app can later switch to a neutral or other skin without a rewrite.
- **A theme is one folder** (e.g., `src/themes/deer-camp/`) containing:
  - **Colors and fonts** as named tokens (background, panel, text, accent, team colors, card face, etc.). No color hex codes or font names anywhere else in the code.
  - **Vocabulary:** every themed word and phrase, by key: camp/game room, stand/seat, camp bot, "Tagged out!", buck pole, skunk line label, "Deer! Hold" and the hold messages, stand rank names (Trophy Buck → Button Buck), award names (Button Buck throw, Horseshoe, Hard-luck hunter, Robbed, Blind squirrel…), headlines.
  - **Razz list** (Section 4A.6) for that theme.
  - **Art:** pegboard styling, finish-hole icon, card back, app icon, and the other icons (antlers, deer tracks).
- **All user-facing text comes from the theme's vocabulary** (plus a shared base file for neutral text like "Your turn"). A quick check: searching the code outside `src/themes/` for "buck", "deer", "stand", or "camp" should find nothing user-facing.
- **Which theme is used:** set per camp by the host at camp creation (everyone in a game sees the same words, so razzes and awards make sense). The default is the deer camp theme. Store the theme ID with the game (for replay).
- **What is NOT theme:** behavior. Silent mode, stand mode (dim), holds, golden hour, and weak-signal handling are settings and features that work the same under every theme; only their labels come from the theme.
- **Proof it works (Phase 2 acceptance):** a throwaway "plain" test theme with neutral words and default colors can be switched on in development, and the whole game plays with no deer words or deer colors showing. It isn't shipped to users.

### 5.2 Pegboard ("trail to the buck pole")
- A wood-plank board with 4 rows of 30 holes (1–30, 31–60, 61–90, 91–120) in groups of 5, one lane per player/team in each row, and a final hole 121 labeled "Buck pole" with an antler icon.
- Row 91 is marked as the "skunk line".
- Two pegs per side, leapfrog style (the back peg shown dimmer); animate the front peg's move to each new score.
- Fits the full width of a 390 px phone screen without scrolling.

### 5.3 Screens
- **Home:** New camp, Join camp (code), Play the bots (a camp with bots in every other seat).
- **Lobby:** camp code, Invite button (native share sheet), seats grouped by team with stand names and ready status, "Add camp bot" on open seats, player-count and game-length pickers, Silent and Stand mode toggles, Start (host only, when all seats filled).
- **Game table (portrait phone first):**
  - Pegboard (5.2) with team names and scores underneath
  - Opponents' areas: name, card count, whose turn it is, and dealer marker
  - Starter card and crib indicator
  - Pegging area: cards played in the current series and the running count, in large type
  - My hand along the bottom; tap to select, tap again or press a button to confirm (no drag required)
  - Clear status line ("Your turn", "Select 2 cards for Kyle's crib", "Waiting for Taylor…")
  - "Go" is automatic when a player has no legal card; don't make them tap it
  - The last pegging event in orange text (e.g., "Mike: run of 4 for 4")
  - Bottom row: "Deer! Hold" button and the primary Play button
- **Home stretch banner ("We count 3 to your 2"):** near the end of the game, a small banner under the scores shows who gets more counting chances before someone reaches 121.
  - **When it shows:** once either side reaches the skunk line (91), or when the estimated hands left is 2 or fewer, whichever comes first.
  - **Hands left (estimate):** from the current scores and the average points per hand for dealer and non-dealer in this mode (the baselines built for luck vs. skill, Section 4A.7). Always worded as "about".
  - **Counts:** list each side's counting chances (hands and cribs) over those hands, from the deal rotation. Per hand: 2-player, dealer 2 (hand + crib) and non-dealer 1; 3-player, dealer 2 and each other player 1; 4-player teams, dealer's team 3 (two hands + crib) and the other team 2.
  - **Counting order:** say who counts first this hand (the non-dealer side), since that decides who can count out.
  - **Wording, from the viewer's side,** e.g., "Home stretch · about 1 hand left. We count 3 to your 2, but you count first." / "About 2 hands left. Counts are even, 3 to 3."
  - Uses public information only (scores, dealer, player count). Updates at the start of each hand and after the show.
  - Vocabulary for "Home stretch" comes from the theme (Section 5.1A).
- **Count screen ("The show"):** count-order strip, hand + starter, a line-by-line breakdown with running total, and the side's score change.
- **Hold screen:** see Section 1A.
- **Game over:** "Tagged out!", final scores, skunk label, final board, Rematch (same stands), Back to camp.
- Cards drawn with SVG/CSS in the app. Do not use card art, logos, or names copied from other cribbage apps. Suit symbols must render as text, not emoji (append U+FE0E).
- Colors: minimum 4.5:1 text contrast; the suit and rank must be readable on a small phone; red and black suits also distinguished by suit symbol.
- Landscape and tablet layouts must work but are secondary.

## 6. Online multiplayer
- **Server-authoritative.** Clients send actions only ("discard these cards", "play this card"). The server validates every action with the rules engine, then updates state. Never trust the client.
- **"The server" means Supabase**, not Next.js: game actions, grading, and push sending run in Supabase Edge Functions (which import the same TypeScript rules engine), plus database rules and functions. See Section 7A.
- **Hidden information.** A client must never receive another player's hand, the crib before the show, or the deck order. This must be enforced on the server/database, not just hidden in the UI. Anyone opening browser dev tools must not be able to see other hands.
- Real-time updates to all players within about 1 second on a good connection. On a weak one, the rules in Section 1A apply.
- Game state persists in the database, so a server restart or a player's reconnect loses nothing.
- Identity: anonymous sign-in plus a display name, stored on the device, so a returning player gets their seat back.
- **Stable player ID:** every stat, grade, and log entry is tied to the player's Supabase user ID, never to their display name (names change; two people can both be "Dave"). Use Supabase anonymous users in a way that lets them be upgraded to a permanent account later (email or Apple/Google sign-in) without losing their ID or history. This is required for R7, R7A, and R13; don't build the upgrade itself in v1.
- A camp stays open for 3 days (a hunting weekend), so players can leave and resume across multiple sits. Live game state can be cleared 7 days after the last move, but the action log and final results are kept (for replay and season stats).
- Hold state is stored on the server, not just shown in the UI, so it survives disconnects.
- **Keep a complete action log for every game:** an append-only, ordered record of every event (deal with all hands, discards, cut, each card played, each score with its reason and points, holds, razzes, guide calls), with timestamps. Clients can't read it until the game is over (except their own actions), and it's kept at least as long as the game. Roadmap items R7 and R11 (season ledger and replay) are built from it.
- **Version stamps:** every game records the version of the rules engine, the grader, and (once R12 exists) the win-chance model it was played with, so any old game can be re-checked or re-graded with a newer version and compared.
- **"Something's off" button:** on the hand recap and stand report, any player can flag a hand ("the score looks wrong" / "the grade looks wrong", plus an optional short note). The flag is stored with the game and hand number. Claude Code or Kyle can later pull every flagged hand, replay it from the log, and check it. This is the main way real-world mistakes in scoring or grading get found.
- Push notifications are sent by the server when the turn changes and when a hold ends.

## 7. Technical stack
- Next.js (App Router) + TypeScript, deployed on Vercel
- **Supabase** for Postgres, anonymous auth, and Realtime (Vercel serverless functions can't hold the live connections a multiplayer game needs; Supabase Realtime covers this on its free tier)
- Private hands stored in a table protected by row-level security so each player can read only their own cards
- PWA: web app manifest, icons, and a service worker via Serwist (not the unmaintained `next-pwa`); installable to the home screen
- Web Push with VAPID keys (the `web-push` npm package), sent from a Supabase Edge Function when the turn changes
- Tailwind CSS for styling
- Vitest for unit tests; Playwright for one end-to-end test of a full 2-player game

## 7A. Stay ready for a native app later
v1 is a free web app. A native iPhone/Android version (wrapped with Capacitor) may follow, so build v1 in a way that makes that a packaging job, not a rewrite:
- **The Next.js app must build as a static export** (`output: 'export'`). No Next.js API routes, server actions, middleware, or server-side rendering that needs a running server. All server logic lives in Supabase (Section 6).
- **Device features behind small interfaces:** vibration, notifications, wake lock, sharing, and local storage are each wrapped in one module (e.g., `src/device/haptics.ts`) with a web implementation now. A native implementation gets swapped in later without touching game code.
- **The rules engine and grader stay a separate package** (e.g., `packages/engine`) that both the web app and the Supabase Edge Functions import.
- Don't build anything native, add payments, or add app store work in v1. This section only prevents choices that would block it.

## 8. Testing requirements
The rules engine must pass unit tests for at least these cases before Phase 2 starts:
- 5♣ 5♦ 5♥ J♠ with starter 5♠ = 29
- 4-4-5-6 + starter 6 (double-double run) = 24
- 7-8-8-9 + starter 9 = 24 (double-double run with fifteens)
- 4-card hand flush = 4; 4-card flush + matching starter = 5; 4-card crib flush = 0; 5-card crib flush = 5
- Nobs counts only when the Jack is in hand, not when it is the starter
- His heels (starter Jack) = 2 to dealer
- Zero-point hand: 2♣ 4♦ 6♥ 8♠ with starter K♣ = 0
- Mockup hand: 4♦ 5♠ 6♣ J♥ with starter 5♥ = 17 (breakdown shown on the Count screen)
- Pegging: 15 = 2; 31 = 2 (not 3 with the go); pairs 2/6/12; run built out of order (5, 3, 4); run broken by an interrupting card; go awarded to the correct player in 3- and 4-player when multiple players say go
- Last card = 1
- Counting out: non-dealer reaches 121 during the show and wins before the dealer counts
- 3-player deal gives 5/5/5 + 1 to crib; 4-player partner points go to the team

Also:
- A test that deals 10,000 random hands and checks no score exceeds 29 and none is 19, 25, 26, or 27 (impossible hand scores)
- A security test confirming a player's API/database request cannot return another player's hand
- A weak-signal test: using Chrome's network throttling (or Playwright's offline mode), send a move while offline, go back online, and confirm the move applies exactly once
- Grader tests:
  - Dealt 5♣ 5♦ 5♥ J♠ 2♣ 9♦ in 2-player: the best discard keeps 5-5-5-J, and choosing it gives 0 points lost
  - Points lost is never negative, and is exactly 0 when the chosen option equals the best
  - Rank: choosing the best option gives "Best possible throw", choosing the lowest-value option gives "Worst possible throw", and two options within 0.05 points share a rank
  - Luck: over 10,000 simulated random hands, average total luck is within ±0.1 of zero for each case (confirms the baselines are right)
  - Luck: a hand whose actual score equals its expected score has cut luck of exactly 0
  - Home stretch: counts per hand match the table in Section 5.3 for 2-, 3-, and 4-player; "counts first" names the non-dealer side; the banner shows the same thing for two games with the same scores and dealer but different hands
  - Hindsight: for a known hand and starter, the hindsight best matches a hand-checked answer; the verdict tags follow the table in 4A.8; hindsight never changes any grade, rank, or skill number
  - Hindsight: before the show, only the player's own phone receives their hindsight line (security test)
  - Pegging luck: over 10,000 simulated random deals, the average pegging luck for each seat position is within ±0.1 of zero; the standard pegging policy gives the same result every time for the same hands
  - Luck: no luck data reaches any client before the show for that hand is complete
  - Expected hand value for a kept hand matches a hand-calculated average over all starters for at least 2 known hands
  - Same game ID + hand number gives identical crib estimates on repeated runs
  - Choosing a card that makes 15 when available scores better in pegging than a card that scores nothing (with equal risk)
  - No grading data reaches any client until every player's discard is locked; after that, only discard rank (position and number of options) and discard points lost are sent until the show is complete (no cards, kept-hand values, best options, or pegging grades) (security test)
  - Discard evaluation for a 2-player hand, including the crib simulation, finishes in under 2 seconds on the server
- A razz test: sending a razz triggers no push notification or vibration
- A hold test: during a hold, no action from any player is accepted except resume by the holder or release by the host

## 9. Build phases
Multiplayer is required at launch. There is no solo-only release, and no screen gets built twice: all game UI is built once, on top of the server. The engine comes first because the grader, bots, and luck numbers are all worthless if scoring is wrong.

**Phase 1: Engine and grader (no UI, a few days)**
- Rules engine (Section 3) with every Section 8 engine test passing
- Play grader and luck vs. skill (Sections 4A.1–4A.4, 4A.7), including pegging luck with the standard pegging policy and its baselines, and hindsight (4A.8), with their tests passing, including the cross-check against published discard tables
- Camp bots (Section 4) using the grader
- A command-line tool Kyle can run to check the math, e.g. `npm run deal` prints a random dealt hand with every discard option ranked (value, points given away), and `npm run score -- 5H 5S 5C JD 5D` scores a hand
- Accept: all engine and grader tests green; Kyle has checked a set of hands by hand and agrees with the scores and rankings

**Phase 2: Multiplayer game (the product)**
- Supabase setup, lobby, camp codes, join links, real-time play, reconnect, hidden hands
- The full table UI, pegboard, and theme from the mockups (Section 5), built directly on the server with no local-only version
- Everything in Section 1A: queued/retried moves, connection status, Deer! hold, no timers
- Home stretch banner (Section 5.3)
- Server-side grading: discard scoreboard when the crib is set, hand recap, and game-over stand report with luck vs. skill and the excuse line, the private hindsight line at the cut and public hindsight in the recap, plus razzing (Sections 4A.5–4A.8). This is the heart of the app and gets the most polish.
- Camp bots can fill any open seat, which also gives solo play against bots
- Accept: 4 phones on cellular data (Wi-Fi off) complete a 4-player game; one phone is put in airplane mode mid-hand for 2 minutes and rejoins with nothing lost; a hold called from a phone that isn't taking its turn freezes all 4 phones; the security and weak-signal tests pass

**Phase 3: Stand-ready launch**
- Installable PWA, Web Push turn notifications, first-run "Add to Home Screen" walkthrough, animations, manual counting, muggins, skunk, rematch
- Accept: Lighthouse PWA install check passes; installs on iPhone (Safari "Add to Home Screen") and Android Chrome; a locked iPhone and a locked Android phone each get a turn notification
- **Launch = end of Phase 3.** Turn notifications are required for play in the stand, since phones stay locked in pockets. Kyle's group can start playing games at home as soon as Phase 2 passes.

**Field test before opener**
- Play one full 4-player game with the real group from real stands (or the actual hunting property) before the season. Weak signal in the woods is the risk most likely to break this, and it can't be fully tested at home.

## 10. Deployment notes
- Environment variables for Supabase URL and keys and the VAPID push keys; the service role key and VAPID private key are server-only and never sent to the browser.
- README with step-by-step setup for a beginner: create Supabase project, run migrations, set Vercel env vars, deploy.

## 11. Roadmap (after launch). DO NOT BUILD in v1
Ideas for updates after launch, recorded so they aren't lost. Claude Code must not build any of these until Kyle moves one into a phase. v1 choices should avoid blocking them, but no extra work is required for them now.

### R1. "Ask the guide" (coaching)
A button that privately shows a player which discard fits the right strategy for the current score. Using it is announced to the table.

**Scope:** discards only. No pegging tips.

**What the guide shows (on the player's phone only):**
1. **Strategy for this hand, based on the score.** Use Del Colvert's "Theory of 26" (a typical player averages about 26 points per two hands, one as dealer and one not) to judge whether the player or team is on pace to reach 121:
   - **Behind, needs points: "Go for it."** Recommend the Hail Mary option.
   - **Ahead, protect the lead: "Play it safe."** Recommend the Safe option.
   - **About even: "Play the averages."** Recommend the Best option.
   - One plain-language sentence explaining why, e.g., "You're down 18 with about 2 hands left. You need a big hand, so take the upside."
   - Put the pace thresholds in the config file for tuning.
2. **Three options, each naming the cards to throw:**
   - **Best:** highest expected value (the grader's top choice, Section 4A.2).
   - **Hail Mary:** highest chance of the kept hand scoring 12 or more (threshold in config).
   - **Safe:** highest minimum kept-hand score over all starters; when there's a tie, the one that gives the least to an opponent's crib.
   - The option matching the recommended strategy is highlighted. When two or all three options are the same throw, say so ("Best and Safe agree").
3. These come from the same starter-by-starter results the grader already computes (the distribution instead of just the average). No new engine.

**Rules:**
- Host setting per camp: **Off / 3 per game (default) / Unlimited ("learning camp")**. The limit is per player, not per team.
- Using it shows the whole table "[Name] asked the guide ([N] left)". It never shows what the guide said, the cards, or the strategy.
- The guide is only available while that player is choosing a discard, and only on their own phone.
- A discard made after asking the guide is marked **"Guided"** in the hand recap and stand report.
- **Every award or rank a player earns in a game where they used the guide gets an asterisk (\*)**: Cleanest throw\*, Trophy Buck\*, Horseshoe\*, and so on, with "\* used the guide" in the legend.
- The stand report lists "Guide calls: N" for each player.
- Razz messages for it are added to the canned list, e.g., "Paid a guide and still missed."
- The server never releases guide output to anyone but the requesting player (same security rules as Section 4A.1). Add a security test for this.

### R2. Golden hour
The first and last light of the day are when deer move. The app gets out of the way.

**Definition:** from 30 minutes before sunrise to 30 minutes after sunrise, and from 30 minutes before sunset to 30 minutes after sunset, at the camp's location.

**Decision: golden hour pauses the whole game for everyone.** Cribbage is turn-based, so if one player is out, the game stalls on their turn anyway. A camp-wide pause is honest about that, and everyone should be watching the woods at those times regardless.

**Location:**
- The camp has one location, set when the camp is created: either the host's phone location (asked once, with permission) or a typed town or ZIP code. It is not tracked continuously, and no other player's location is ever used or stored.
- Sunrise and sunset are calculated on the device from that location and the date (e.g., the `suncalc` npm package), so this works with no signal.
- If players in one camp are in different places (a remote game), everyone uses the camp's location. Show the golden hour times in the lobby so no one is surprised.

**Behavior:**
- **5-minute warning:** a quiet banner on every screen: "Golden hour in 5 min." No vibration or notification.
- **At the start:** the game pauses like a Deer! hold (Section 1A): no moves, no notifications, no bot takeovers. Every screen shows "Golden hour. Phones down. Play resumes at 7:52."
- **At the end:** play resumes exactly where it stopped, with one buzz/notification to everyone.
- A Deer! hold that is on when golden hour ends stays on.
- Razzes sent just before it are held and shown after.

**Host setting per camp:** **Pause the game (default) / Quiet only** (play continues, but no turn notifications or buzzes during golden hour) **/ Off**. The host can also skip the next golden hour for one session ("We're at the cabin, keep playing").

**Note:** these times follow the definition above. They are not the legal shooting hours, and the app must not describe them as legal shooting times.

### R3. Sight-in mode (practice)
A solo drill: you're dealt a hand, you pick a discard, and you immediately see your rank and the best throw. It's built from the grader, and doubles as a way to spot-check grader correctness.

### R4. "Grandpa" hard camp bot
A bot that always makes the grader's best discard and the pegging evaluator's best play. It gives a skill benchmark ("You gave away more than Grandpa").

### R5. Camp bots razz you
Bots send canned razzes when a human makes a bad throw, using the same list and rules as Section 4A.6. It's fun in games with bots, and a way to tune the jokes.

### R6. Hold stats
Log every Deer! hold: who called it, how long it lasted, and whether it ended in a deer down. The game-over screen shows lines like "Dave: 4 holds, 0 deer."

### R7. Season camp ledger
Stats across every game in a season for a camp: Button Buck count, average points given away, luck vs. skill totals, best hand, guide calls, holds, deer tagged. Private to the camp. (This replaces the v1 non-goal "season leaderboards" for this camp-only version.)

### R7A. Camp power rankings
A ranking of who **plays** best, not who wins. It uses the season ledger (R7), so build it with or after R7.

**The ranking is by skill only:** average points given away per hand (discards plus pegging, Section 4A), lowest first, across every game in the season. Wins, margins, and luck don't count toward rank.
- Skill is measured on decisions, not on outcomes (Section 4A.1), so it stays steady from game to game. Luck is noisy; skill isn't. That's what makes a skill ranking fair after a modest number of games.
- **Guided discards (R1) are left out** of a player's skill average, and the ranking shows each player's guide calls next to their name.
- **Minimum sample:** a player is "provisional" (shown greyed, below ranked players) until they have 30 graded hands in the season. Put the number in config.
- Camp bots aren't ranked. If Grandpa (R4) exists, show his average as a reference line ("Grandpa: 0.3").

**Each row shows:**
- Rank and movement since the last game ("▲2")
- Skill: points given away per hand
- Luck: average card luck per hand (Section 4A.7), with a + or − sign
- Record (wins–losses)
- A tag when the player's skill rank and win rank are far apart (difference in config):
  - **"Robbed"**: plays better than their record. The cards cost them.
  - **"Horseshoe"**: record better than their play. The cards carried them.

**Head-to-head card gap.** For any two players, across the games they've played against each other: "In 6 games, Dave's cards averaged 1.3 points per hand better than yours. You gave away 0.8 fewer points per hand."

**Game-over excuse line:** already in v1 (Section 4A.7). The ledger stores each one so the season history keeps them.

**Naming:** "Camp Rankings" on the menu. The Robbed and Horseshoe tags carry the joke.

### R8. "Deer down" button
Separate from Hold. It ends that player's game (a camp bot finishes their seat), and logs "Mike tagged out 7:42 AM" to the season ledger (R7). Build after R7.

### R9. Native app and Camp Pass
Capacitor-wrapped iPhone and Android apps with native vibration and push. A possible paid one-time "Camp Pass" that unlocks hosting (friends join free), through RevenueCat. The v1 architecture rules in Section 7A keep this possible.

**Monetization options (only if the app is ever sold):**
- **Camp Pass** (above): a one-time purchase that unlocks hosting.
- **Cribbage Coach (R13):** paid single-player coaching: tracking, leak finder, hand review and what-if, drills, lessons, and unlimited guide in games against bots and in practice. This sells learning, not winning.
- **Cosmetics:** extra board and peg themes. New "sitting still in the cold" themes (duck blind, ice fishing house) reuse the stand conditions in Section 1A almost unchanged.

**Decision (2026-09-29): no paid advantage in multiplayer.** The guide in multiplayer games stays free and equal for everyone, limited only by the host's camp setting. No tokens, packs, or purchases that affect a multiplayer game. Reasons:
1. Paying to beat friends poisons a social game. Leaving guided decisions out of skill rankings doesn't fix it, because wins still count.
2. It contradicts the app's core promise of honest measurement of who plays best.
3. Competitive camps would disable it and casual camps wouldn't pay, so it wouldn't sell.
4. Consumable purchases are the most complex in-app purchase type (server balances, refunds, restores) for very little revenue.
5. Microtransactions in a traditional card game draw one-star reviews.
Don't reopen this without a new reason that addresses these points.

### R10. Grader v2: pegging-aware discards
The v1 grader values a discard by kept hand + crib only. Strong players also weigh how the kept cards will peg (e.g., keeping a hand that's easy to peg with). Add the expected pegging value of the kept cards (from simulated pegging with the standard policy) to each discard option's value. This makes "best throw" match expert judgment more often, and removes the pegging-hand-choice caveat from pegging luck (4A.7). It costs noticeably more computing per discard, so measure the speed against the 2-second rule in 4A.5 first.

### R11. Game story and replay
A look back at how the game played out, for the conversation after the game.

**Game story (on the game-over screen, and as a "Game story" tab):**
- **Score chart:** each side's score after every hand (and every peg, if readable), with lead changes marked.
- **Headline stats:** biggest lead (and who held it), biggest comeback (largest deficit the winner overcame), number of lead changes, biggest single hand or crib, biggest pegging run, closest the loser got in the final hands.
- Tie-ins to v1 stats: biggest "Coulda shoulda" spread, worst throw, Horseshoe / Hard-luck hunter.
- One auto-written headline from these, e.g., "Dave & Mike led by 22 at hand 5. You & Jen came back to win by 4."

**Replay (peg by peg, on the pegboard):** the game replayed as peg moves on the same "trail to the buck pole" board, like watching a race.
- **Every scoring event is one peg move:** fifteens, pairs, runs, go, last card, hand, crib, his heels. The back peg leapfrogs the front peg, like the real board. Each move shows a short label ("Mike: crib for 12").
- **Controls:** play / pause, speed (1×, 2×, 4×), and a timeline scrubber along the bottom that can be dragged to any moment. The scrubber is the one exception to the no-drag rule in Section 1A: replay is used at camp, not in the stand.
- **Highlight markers on the timeline**, and the replay pauses briefly with a callout when it reaches one:
  - **Overtake:** the lead changes ("You & Jen take the lead"). Lead changes during the first hand are ignored by default, since the lead flips on almost every peg early and would bury the real overtakes (config setting: "ignore overtakes in the first N hands", default 1).
  - **Max gap:** the biggest lead of the game
  - **Max recovery:** the start and end of the biggest comeback
  - **Big move:** any single score of 12 or more (config)
  - **Skunk line:** a side crosses 91 (or doesn't)
  - **Buck pole:** the winning peg
- **Lead chart** under the board (switchable to the win-chance chart once R12 exists): a line showing the lead over time (above the middle = one side ahead, below = the other). It makes gaps and comebacks obvious at a glance in a way the curvy board can't. It moves in sync with the replay.
- Tap any move to see that hand's cards, grader ranks, and hindsight verdict.
- Built with SVG and CSS animation on the existing pegboard component. No new libraries needed.
- Available only after the game ends, to players who were in it.

**v1 requirement this depends on (see Section 6):** every game must keep a complete, ordered log of every action from launch day. Otherwise games played before this feature exists can't be replayed.

### R12. Win chance
A live "% chance to win" for each player or team, visible throughout the game, and as a chart in the replay (R11).

**Display:**
- Live game: a small figure next to each side's score ("You & Jen 64%"), updated after every scoring event. Tapping it shows a one-line explanation ("Based on the score, who deals next, and average play").
- Replay: a win-chance chart that can be switched with the lead chart. It tells the story better than the lead chart, since a 29-point lead in hand 3 is worth less than a 10-point lead near the end. Add a "biggest swing" highlight: the single event that moved win chance the most.
- Game over: "Lowest win chance for the winner: 11% (hand 3)", which is the stat that makes a comeback official.
- Host setting per camp: on (default) / off.

**Uses public information only.** Win chance is computed from the scores, who's dealing, the phase of the hand (pegging, counting order), and player count. It must **never** use anyone's cards, the crib, or grader/hindsight data, or it would leak hands. A test must confirm that two games with identical scores and dealer but different hands show the same win chance.

**How to compute:**
- Build a lookup table offline for each mode (2-player, 3-player, 4-player teams): win probability for every combination of scores, dealer, and phase. Use simulated games with camp bots on both sides (at least 1,000,000 games per mode), or a dynamic-programming model built from simulated per-hand scoring distributions for dealer and non-dealer. Account for counting order near the finish (the non-dealer counts first and can count out).
- Ship the table with the app (small, precomputed), so it works offline and costs nothing at runtime.
- It assumes average play from everyone and doesn't know who the better player is.

**Verification logging (build with R12):**
- **Prediction log:** every time win chance is shown, store the game, the event number, each side's percentage, and the model version. Store what was actually shown, not a recomputed value, so the check tests what players saw.
- **Calibration report:** a command (`npm run calibration`) that reads the prediction log and the game results and prints, in plain language:
  - For each 10% bucket (0–10%, 10–20%, …): how many moments were predicted in it and how often that side actually won. A well-calibrated model wins about 65% of its "60–70%" moments.
  - One overall accuracy score, and the same numbers broken out by mode (2-player, 3-player, 4-player teams) and by phase of the game (early / middle / final stretch).
  - A clear warning when there isn't enough data to judge a bucket (fewer than 50 moments).
- A season of one hunting group is a few thousand scoring moments across a few dozen games. That's enough to spot a badly wrong model, not to fine-tune a good one. The report must say how much data it's based on.

**Improving it over time. Deliberate, not self-learning:**
- The model does **not** retrain itself automatically. With one group's data, an auto-learning model would chase noise, its numbers would drift between games, and nobody could test it. Changes are made on purpose: run the calibration report, adjust or rebuild the table, bump the model version, ship it.
- **Skill-adjusted odds (after R7A power rankings exist):** the biggest real improvement available. The base model assumes average players. Once each player has a measured skill rating (points given away per hand), adjust each side's expected scoring by the difference in skill, so the odds know Grandpa is better than the Button Buck. Skill ratings are already public on the rankings, so this doesn't leak cards. Show it as a separate setting ("Odds: average players / adjusted for skill"), and check it with the same calibration report.
- If the app is ever used by many camps (R9), pooled logs from all of them could support finer calibration. Still no AI/LLM; this stays statistics.

### R13. Cribbage Coach (paid single-player coaching)
A coaching product for a player who wants to get better, built on the grader. It's the main paid option in R9 (replaces the smaller "Guide Pass" idea there, which becomes a part of this). It tracks the player's own decisions in **every** game (multiplayer and against bots) and turns them into coaching. It never gives an advantage in live multiplayer (see the R9 decision).

**1. Performance tracking over time**
- Skill trend (points given away per hand) by week and month, overall and split into discards as dealer, discards as non-dealer, and pegging.
- **Leak finder:** rule-based detection of recurring mistakes, e.g., "You throw a 5 into your opponent's crib 3× more often than the best play would", "You break up runs to keep pairs", "You under-use the Safe option when ahead late". Each leak shows how many points per game it costs and links to examples from the player's own games.
- Milestones: best week, fewest points given away in a game, longest streak of best-possible throws.

**2. Hand review ("reverse-engineer the hand")**
- Open any hand from any past game (from the game log). See every discard option with its full distribution of outcomes over all starters (not just the average): best case, worst case, chance of 12+, crib effect.
- **What-if:** change the discard, change the cut, or change a pegging card, and replay the hand from there to see how it would have gone.
- In multiplayer games, other players' cards are only visible in review after the game has ended (the same as replay, R11).

**3. Drills**
- Sight-in mode (R3), but tuned to the player's leaks: if the leak finder says they misplay dealer discards, drills deal more of those spots.
- Positional drills: "You're down 14 with 2 hands left. Which throw?", using the guide's strategy logic (R1).

**4. Strategy lessons**
- Short interactive lessons: discard basics, feeding versus protecting the crib, pegging principles (15s and 31s, leading, avoiding pairs), and positional play (Theory of 26). Each uses real hands from the engine, and where possible from the player's own games.

**5. Coach conversation (optional AI, paid tier only)**
- Ask questions about any hand in plain language ("Why is keeping the 5 better here?").
- **This is the only place an AI/LLM may be used, and only if Kyle explicitly decides to allow it** (it's an exception to the rule in CLAUDE.md). Rules: the engine computes every number and passes it in; the AI only explains and must never invent a number or a rule; answers cite the engine's figures; the AI cost per question is covered by the subscription and capped per user.
- Without the AI, templated explanations built from the engine's numbers cover most "why" questions and cost nothing. Build those first.

**6. Named tactics and glossary**
The coach, leak finder, lessons, and callouts use cribbage's own vocabulary instead of only "points given away".
- **Glossary:** a built-in, searchable reference of cribbage terms with a short plain-language definition and an example hand from the engine: 29, "19" (zero hand), nobs, his heels / his nibs, pone, starter/cut, muggins, skunk / double skunk, pegging out, counting out, go, 31, pair royal, double pair royal, double run / double-double run, balking, salting the crib, playing on / playing off, positional play (Theory of 26), streets. Terms and usage vary by region; wording must be reviewed by Kyle before release.
- **Named-tactic detection:** a rule-based detector in the engine package (pure TypeScript, tested like the grader) that labels plays and discards from the game log. At minimum:
  - **Pegging leads:** safe low lead (4 or lower); leading a 5; leading from a pair (the pair trap)
  - **Pair trap sprung:** the opponent pairs the lead and the leader makes three of a kind
  - **Playing on / playing off:** playing into or away from a possible run
  - **Holding a low card for the go**
  - **Balking:** hard-to-score cards (e.g., a King with a far-apart card) thrown into an opponent's crib
  - **Salting your own crib:** 5s, pairs, or touching cards thrown to your own crib
  - **Positional play:** discard matches (or ignores) the Theory of 26 strategy for the current score (R1)
  Each tactic has a clear rule, examples, and tests. When a rule is a judgment call (e.g., what counts as a "far-apart" card), put the threshold in config.
- **Where names show up:**
  - **Leak finder:** "You led a 5 into a likely 10 eleven times this season (about 1.4 points each)." "When ahead late, you balked your opponent's crib 2 out of 9 times; the best play did it 7."
  - **Lessons:** organized around the named tactics (start with the 4 lead, the pair trap, balking, and the Theory of 26), each with drills from R3.
  - **Hand review and coach conversation:** explanations use the names ("This is a balk: the King and 9 are hard for Dave to use").
  - **Callouts in any game (v1 recap-style, once built):** positive moments like "Sprung the pair trap: 6 points" or "Counted out", usable in the stand report and replay (R11). These are labels only and never change grades.

**Product notes**
- Likely a subscription (ongoing tracking and lessons justify it) or a one-time unlock. Decide when R9 is decided.
- Neutral "Cribbage Coach" look, or selectable themes. The deer camp theme stays for camps.
- Some cribbage apps already offer hints and hand analysis. The difference here has to be the personal tracking, the leak finder, and coaching built from the player's own games.

### R14. More themes
Built on the v1 theme system (Section 5.1A). Each theme is its own vocabulary, colors, art, and razz list.
- **Classic / neutral:** a clean cribbage look for everyone else. Also the default look for Cribbage Coach (R13).
- **Other "sitting still in the cold" crowds:** duck blind, ice fishing house. Stand conditions (Section 1A) already fit them.
- Possible later: per-player display theme (each person sees their own skin while the shared game text stays in the host's theme). Only if players ask for it.
- If the app is ever sold, extra themes are the cosmetics option in R9.
