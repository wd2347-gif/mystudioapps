# MyPartyGame playable: game contract

One self-contained HTML page shown full-screen in our apps' interstitial WebView (and openable in a browser).
The shell (`shell.html`) owns the page: header, title row, play area, bottom bar ("other game" + "install"),
sound, haptics, confetti, touch hint, bridge, language, set choice. A game only builds its play area.

```
playable/_src/mypartygame/
  shell.html        the page; /*@@CSS@@*/ in <style>, /*@@GAMES@@*/ in the first <script>
  sets.js           var SETS = [ ['a','b','c'], ... ];   (12 sets, single quotes, ids [a-z0-9_])
  games/<id>.js     one game: GAMES['<id>'] = { ... }
  games/<id>.css    optional, that game's CSS only
  INTERFACE.md      this file
```

Build: `python3 playable/_src/build.py mypartygame` writes `playable/mypartygame/index.html`
(refuses a long dash anywhere, refuses a set that names a missing game).
Test build of just your games: `python3 playable/_src/build.py mypartygame --only id1,id2,id3 --out <file>`
(the page then has exactly one set: those ids in that order).

Rules that never change: the bridge messages are only `ready`, `switch:2`, `switch:3`, `install` (the shell sends them, games never do);
nothing on screen may show how many games remain; the top-right 64x64 px is the app's close button (the header keeps it empty, games live below it).

---

## 1. Registering a game

Each `games/<id>.js` is wrapped in its own function scope (all game files share one `<script>`, so a top-level
`function draw()` in two games would collide) and adds exactly one entry to the global `GAMES`:

```js
(function () {
  'use strict';
  var T = { ko: { ... }, ja: { ... }, en: { ... } };   // the game's own words
  GAMES['pirate'] = {
    name:   { ko: '해적 룰렛', ja: '海賊ルーレット', en: 'Pirate Barrel' },  // EXACTLY the app's name (lib/games/texts.dart)
    tip:    { ko: '...', ja: '...', en: '...' },  // one short line under the name
    cat:    'bet',        // chip: 'bet' | 'party' | 'duel' | 'solo'
    who:    '2+',         // optional chip part: '1' | '2' | '1+' | '2+'
    accent: '#D9363E',    // the app's GameInfo.color (lib/games/catalog.dart)
    full:   false,        // optional: true removes the 16px side padding of ctx.el (edge-to-edge boards)
    make:   function (ctx) { ...; return { resize: ..., frame: ..., redraw: ..., destroy: ..., debug: ... }; }
  };
})();
```

| field | required | used for |
|---|---|---|
| `name` | yes | title row (`{ko,ja,en}`), exact app name |
| `tip` | yes | grey line under the title. One natural line, no counts of games or levels, no "NEW", no long dash. It never wraps: at 320 px the shell shrinks it a little (down to 11 px), so keep it short |
| `cat` | yes | chip text: bet = 내기할 때 / 賭けるとき / For bets, party = 모여서 / みんなで / Get together, duel = 둘이서 대결 / ふたりで対決 / Head to head, solo = 혼자서도 / ひとりでも / Solo |
| `who` | no | chip suffix: '1' 1인용 / 1人用 / 1 player, '2' 2인 / 2人 / 2 players, '1+' 1인 이상 / 1人以上 / 1 or more, '2+' 2인 이상 / 2人以上 / 2 or more. Omit it for games played against the computer |
| `chip` | no | `{ko,ja,en}` replaces the cat/who chip entirely (rarely needed) |

Title row at narrow widths (320 px): the shell shrinks the name (down to 15 px) and the chip (down to 9.5 px); if the chip still does not fit it drops the `who` part, so a long name like 'Crocodile Teeth' keeps a whole chip.
| `accent` | yes | chip tint, `.act` button colour, `--acc*` CSS variables, `ctx.accent` |
| `full` | no | edge-to-edge play area |
| `make` | yes | builds the game (below) |

## 2. Lifecycle

1. The shell creates `<div class="g g-<id>">` (`ctx.el`), sets `--acc`, `--acc-ink`, `--acc-soft`, `--acc-glow` on it,
   appends it to the play area (it is in the DOM and laid out), then calls `make(ctx)`.
2. `make` builds DOM / canvases inside `ctx.el`, wires input with `ctx.on`, calls `ctx.hint(...)`, and returns:

| method | required | called |
|---|---|---|
| `resize()` | yes | right after `make` returns, and after every layout change (rotation, window resize). Size everything here from `ctx.el` / your containers. Must be cheap and idempotent |
| `frame(dt)` | no | every animation frame while the loop runs; `dt` in seconds, clamped to 0.05. Return `true` to keep getting frames, anything else lets the loop sleep. Call `ctx.wake()` to start it again (on input, timers). The loop pauses while the page is hidden |
| `redraw()` | no | when the device switches light/dark (`ctx.dark` already updated). Repaint canvases |
| `destroy()` | no | when the viewer moves to the next game. Stop your own things (e.g. `seq++` for stale callbacks) |
| `debug()` | yes | returns a small plain JSON-safe object of the game state for tests (`window.__pf.state()` with `?test=1`) |

3. After `destroy()` the shell removes every listener added with `ctx.on`, every timer from `ctx.later` / `ctx.every`,
   the hint, the confetti, and `ctx.el` itself. Anything you add with plain `addEventListener` on `window` or `document`,
   or plain `setTimeout`, is your problem: use the ctx versions. `ctx.alive` turns false at that moment
   (callbacks from `ctx.later` simply do not run after it).
4. If `make` throws, the shell logs it and shows the next game of the set instead (tests treat that as a failure).
   If `frame` throws, the shell logs it once and stops calling `frame` for that game.

## 3. Coordinates and size

- All ctx coordinates are CSS px relative to the top-left of `ctx.el` (its padding box, so the 16px side padding is included).
  `ctx.local(pointerEvent)` converts a pointer/touch event; `ctx.burst(x, y)` and `ctx.hint({x, y})` take the same space.
  Inside your own child elements use their own boxes as usual.
- `ctx.el` is `position:absolute; inset:0; display:flex; flex-direction:column; align-items:center` with 16px side padding
  (plus safe areas). Give your board `flex:1; min-height:0` and size it in `resize()`.
- `ctx.box()` → `{ w, h }` content size inside the padding. `ctx.dpr` = devicePixelRatio capped at 2; always use it for canvases
  (`ctx.canvas()` does).
- The page is a column at most 9:16 of the window height, centred: phones use the full width; tablet landscape gets a centred column
  (1024x768 → 432x768, 1366x1024 → 576x1024, play area about 432x540 and 576x800). Never stretch to the window.
- Play-area sizes you must handle (approx. width x height of `ctx.el`): 320x368 (iPhone SE 1st gen), 360x540, 390x636, 430x720,
  432x540 (tablet landscape), 576x806 (big tablet). Fit square boards with `min(w, h)`, keep a sensible max (about 440 to 560 px),
  centre them, and keep touch targets at least 44 px.
- `--u` (on `:root`) is 1% of the column width; use `clamp(min, calc(var(--u) * k), max)` for text that should scale.

## 4. ctx reference

Identity and text
- `ctx.id`, `ctx.pos` (1..3 position in the set), `ctx.lang` ('ko' | 'ja' | 'en'), `ctx.name` (game name in this language)
- `ctx.pick(obj)` → `obj[lang]` (falls back to `obj.en`); typical: `var t = ctx.pick(T);`
- `ctx.fmt(str, a, b, ...)` replaces `{0}`, `{1}`; `ctx.fmt(str, { n: 3 })` replaces `{n}`
- `ctx.esc(str)` HTML-escapes; `ctx.mk(tag, className, innerHTML)` creates an element (not appended)
- `ctx.rnd(n)` → a random integer 0..n-1 (`Math.floor(Math.random() * n)`)
- `ctx.names` six sample player names for this language (ko 민지 서윤 하린 도윤 지호 준서, ja ハルト ユイ ソウタ ミオ レン ヒナ, en Mia Leo Ava Noah Zoe Max)

Colour
- `ctx.accent` (hex), `ctx.dark` (live boolean), `ctx.SLOTS` the app's 12 player colours (kPlayerColors order:
  #FF5C7A #3E9BFF #FFB020 #2FC85E #A368FF #00C2C7 #FF7A3D #8C9BAB #E0A526 #5B4BDB #D9363E #8D6E4A), `ctx.PALETTE` the first six (confetti)
- `ctx.rgba(hex, alpha)`, `ctx.inkOn(hex)` → '#1B1F1A' or '#FFFFFF' for text on that colour, `ctx.token('--ink')` reads a CSS token
- CSS tokens (light / dark): `--bg` #F6F7F4 / #0E110D, `--surface` #FFFFFF / #191D18, `--ink` #12150F / #F1F3EE, `--soft` #6B726A / #9BA49A,
  `--line` #D8DCD5 / #3A4137, `--hair` #EBEEEA / #2C332B, `--green` #2FC85E, `--board` #D9E3D6 / #20261F, `--slot` #E9EFE7 / #2A3128,
  `--veil` translucent page colour, `--shadow`. On `ctx.el`: `--acc`, `--acc-ink`, `--acc-soft` (16% / 24% dark), `--acc-glow` (32%).
- `ctx.FONT` the page font stack for canvas text: `g.font = '800 20px ' + ctx.FONT`. `ctx.TAU` = 2π.

Input and time
- `ctx.on(target, type, fn, opts)` addEventListener that is removed on switch (works for `window` too)
- `ctx.later(fn, ms)` → id, `ctx.every(fn, ms)` → id, `ctx.clear(id)`
- `ctx.wake()` start/continue the frame loop
- Use pointer events (`pointerdown` for game input: it feels instant; `click` only for real buttons). The whole page has
  `touch-action:none` and blocks scrolling/zoom, so you never need `preventDefault` for that. Multi-touch: track `e.pointerId`.

Drawing
- `ctx.canvas(parent?, className?)` → `{ cv, g, w, h, fit(w?, h?) }`: appends a canvas to `parent` (default `ctx.el`);
  `fit()` sizes it to the parent's client box (or the given CSS size) at `ctx.dpr` and sets `g`'s transform, so you draw in CSS px.
  Call `fit` in `resize()`. Cache static art (boards, backgrounds) on an offscreen canvas and `drawImage` it per frame.
- `ctx.button(label, iconSvg?)` → `<button class="act">` in the accent colour (not appended). Icons: `ctx.ICON.spin`, `.again`,
  `.play`, `.spark`, `.fire`, `.swap`, `.trophy` (inline SVG strings).

Feedback (sound, haptics and visuals together, at the moment of the touch)
- `ctx.sfx.*` WebAudio synth, silent until the first touch unlocks it:
  `click()` button, `peg()` tiny tick, `tick(hi)` clock tick, `beep(hi)` countdown beep (hi = the final long one), `go()` start,
  `whoosh(delay?)` pass/swish, `pop(k?)` bubble/tap pop (k 0..1 pitch), `ding()` correct/score, `fail()` wrong buzzer,
  `thud()` wooden knock (sword in barrel), `chomp()` bite/snap, `boing()` spring/launch, `bump()` blocked move, `swipe()` slide,
  `merge(v)` merge note rising with v, `bang()` party popper, `boom()` explosion, `stamp()` result stamp, `win()` fanfare,
  `lose()` sad three notes, plus raw `tone(freq, dur, type, vol, freq2?, delay?)` and `noise(dur, vol, f1, f2, filterType?, attack?, delay?)`.
  Rapid-fire games (tap war) may call `pop()` up to about 20 times a second; throttle beyond that.
- `ctx.buzz(ms | pattern)` vibration (Android; ignored elsewhere and before the first tap), `ctx.click()` = click sound + 10 ms buzz
- `ctx.burst(x, y, n = 80, { speed = 650, size = 1, ring = false, round = false, colors })` confetti from a point in ctx.el coordinates,
  `ctx.burstAt(element, n, opts)` from an element's centre, `ctx.rain(n = 50, colors?)` confetti from the top
- `ctx.shake()` shakes the whole page 0.7 s, `ctx.flash(c1 = '#FFFFFF', c2 = '#FF8A3D')` full-screen flash (c1, then c2, fading out)

Touch hint
- `ctx.hint(target, { kind = 'tap', dx, dy, delay = 450 })` shows a pulsing white hand with a ripple ring.
  `target`: an element (its centre), `{ x, y }` in ctx.el coordinates, or a function returning `{ x, y }` (re-evaluated on resize,
  use it for things drawn on a canvas). `kind`: 'tap' (press + ring), 'hold' (press and stay), 'swipe' (moves by dx, dy px),
  'drag' (slower swipe). The first `pointerdown` anywhere inside the game hides it. `ctx.hint(null)` hides it; you may show
  it again later (e.g. after a long idle), but normally call it once in `make`, pointing at the first thing to touch.

## 5. Look, feel and flow

- Look like the real game in the app: read `my_party/lib/games/list/<id>.dart` (painters, colour constants, sizes, the
  `XxxArt` card painter) and reproduce shapes, colours and motion. Light and dark both (`ctx.dark`; the app has dark variants).
- Understandable in 1 to 2 seconds: one obvious thing to touch, pointed at by `ctx.hint`. No setup screens (no name entry, no player
  count, no mode pickers): start in the most fun default. Multi-player games are played against the computer or by one person
  passing the phone; use `ctx.names` for turns / results.
- Never dead-end: when a round ends, show the result for a beat (about 1.2 to 2.5 s), then restart or continue by itself
  (`ctx.later`), or keep an obvious "again" control that the next tap anywhere also triggers. A viewer who keeps tapping must keep playing.
- Satisfying: every touch gets sound + haptic + visual at once; big moments get `burst` / `shake` / `flash`.
- Rounds short: the whole loop of one game should fit in about 20 seconds.
- Text: ko / ja / en only. In-game words come from the app: Dart `Tr(...)` constants are in the order
  **ko, en, ja**, zh, es, fr, de, pt, ar (careful: English is second, Japanese third). Never show a long dash or "--"; use ":" (ja "："). Hyphens are fine.
  No counts of games/levels, no "NEW". Keep visible strings short enough for 320 px.
- Do not touch shell elements (header, title row, bottom bar, `#stage`) and do not post bridge messages.

## 6. CSS

- Put it in `games/<id>.css`; scope every selector under `.g-<id>` and prefix keyframes with `<id>-` (all games share one `<style>`).
- Shell classes you may use: `.act` (accent button, 52 to 62 px tall, max 380 px wide), `.pf-pop` (one quick scale bump),
  keyframes `pf-enter` (slide-in), and the tokens above. Light/dark: use the tokens or `@media (prefers-color-scheme: dark)`.
- System fonts only (`font: inherit`). No `@import`, no `url(...)` to anything outside a tiny data URI.

## 7. Performance and size

- 60 fps on a mid Android WebView: draw only in `frame`, no layout reads (`getBoundingClientRect`, `offsetWidth`) inside `frame`,
  no `shadowBlur` on many shapes per frame, cap particles (about 100), reuse gradients/paths where possible,
  return `false` from `frame` when nothing moves (the loop sleeps; `ctx.wake()` on the next input).
- No external resources at all (no images, fonts, CDNs, fetch). Draw everything (canvas or inline SVG).
- Readable JS, ideally 8 to 20 KB per game (CSS extra). The whole built page must stay under 400 KB.
- The page must post `ready` within 3 s on a slow phone: do nothing heavy in `make` (precompute lazily or in small steps).

## 8. debug()

Return a small plain object that lets a test see progress without reading pixels, e.g.
`{ phase: 'play' | 'result', round: 3, score: [2, 1], turn: 'Mia', loser: null, taps: 12 }`.
Cheap, no DOM nodes, no functions, no cycles. The harness prints it after each action.

## 9. Testing

1. Build your games (any three ids, in the order you want to test):
   `cd /Users/ymc/Desktop/claude/mystudioapps && python3 playable/_src/build.py mypartygame --only roulette,pirate,tower --out <scratch>/t.html`
2. Copy the harness `/private/tmp/claude-501/-Users-ymc-Desktop-claude/bf7a249d-3bcb-42ef-8181-67aaeffe411f/scratchpad/pf_party/pf_cdp.mjs`
   into your own scratch folder. It starts headless Chrome (`/Applications/Google Chrome.app`) with its own temporary
   `--user-data-dir`, injects a fake `window.XPromo` that records messages in `window.__xp`, has a 90 s hard timeout and always
   kills Chrome at the end. Node 22+ (built-in WebSocket).
3. Modes (`node pf_cdp.mjs <page.html> <outDir> <mode>`; env `W`, `H`, `LANG2` = ko|ja|en, `DARK=1`, `PRE` = screenshot prefix):
   - `shots`: loads positions 1..3 of set 1, screenshots each, prints `__pf` state and a layout check
     (`issues` must be empty: no dots/counters, nothing in the close-button zone, nothing outside the column; `centred` true).
   - `game`: env `POS` (1..3) and `ACT`, a `;`-separated action list:
     `tap:<css selector>`, `tapxy:FX,FY` (fractions of the `.g` box), `hold:FX,FY,MS`, `hold2:FX1,FY1,FX2,FY2,MS` (two fingers),
     `swipe:FX,FY,DX,DY`, `drag:FX,FY,DX,DY,MS` (FX, FY are fractions of the `.g` box; DX, DY are CSS px), `wait:MS`, `shot:name`, `state`, `check`, `other` (presses "other game"),
     `fps:MS` (rAF intervals: avg and worst ms).
     Example: `W=360 H=740 LANG2=ja POS=2 ACT='shot:a;tapxy:0.5,0.5;wait:600;state;fps:2000;shot:b' node pf_cdp.mjs t.html out game`
   - `flow` (shell regression with roulette, bomb, g2048 as set 1) and `sets` (needs a page with several sets).
   The last line `errors [...]` must be `[]` (exceptions, console errors and browser error logs).
4. Check at least 360x740 and 1024x768, plus 320x568 and one dark run; look at the screenshots. Query params for manual checks:
   `?lang=ja&set=N&game=K&test=1` (`window.__pf.set() / ids() / game() / state()`).

## 10. Minimal example

```js
/* games/demo.js: tap the ball, it hops and scores; after 5 taps a small celebration, then it starts over by itself. */
(function () {
  'use strict';
  var T = { ko: { score: '점수 {n}' }, ja: { score: 'スコア {n}' }, en: { score: 'Score {n}' } };
  GAMES['demo'] = {
    name: { ko: '데모', ja: 'デモ', en: 'Demo' },
    tip: { ko: '공을 눌러 튀겨요', ja: 'ボールをタップして弾ませよう', en: 'Tap the ball to bounce it' },
    cat: 'solo', who: '1', accent: '#3E9BFF',
    make: function (ctx) {
      var t = ctx.pick(T);
      var label = ctx.mk('div', 'sc'); ctx.el.appendChild(label);
      var wrap = ctx.mk('div', 'pl'); ctx.el.appendChild(wrap);
      var c = ctx.canvas(wrap), g = c.g;
      var x = 0, y = 0, r = 30, hop = 0, n = 0, phase = 'play';
      function paintLabel() { label.textContent = ctx.fmt(t.score, { n: n }); }
      function draw() {
        g.clearRect(0, 0, c.w, c.h);
        g.fillStyle = ctx.accent;
        g.beginPath(); g.arc(x, y - hop * 40, r * (1 + 0.1 * hop), 0, ctx.TAU); g.fill();
      }
      ctx.on(wrap, 'pointerdown', function (e) {
        if (phase !== 'play') return;
        var p = ctx.local(e);
        var bx = x + wrap.offsetLeft, by = y + wrap.offsetTop;      // ball in ctx.el coordinates
        if (Math.hypot(p.x - bx, p.y - by) > r * 1.6) return;
        hop = 1; n++; paintLabel();
        ctx.sfx.pop(); ctx.buzz(12); ctx.wake();
        if (n >= 5) {
          phase = 'won'; ctx.sfx.win(); ctx.burst(bx, by, 90);
          ctx.later(function () { n = 0; phase = 'play'; paintLabel(); }, 1800);
        }
      });
      ctx.hint(function () { return { x: x + wrap.offsetLeft, y: y + wrap.offsetTop }; });
      paintLabel();
      return {
        resize: function () { c.fit(); x = c.w / 2; y = c.h * 0.6; r = Math.max(24, Math.min(c.w, c.h) * 0.12); draw(); },
        frame: function (dt) { hop = Math.max(0, hop - dt * 3); draw(); return hop > 0; },
        redraw: draw,
        debug: function () { return { phase: phase, taps: n }; }
      };
    }
  };
})();
```

```css
/* games/demo.css */
.g-demo .sc { flex: none; margin-top: 8px; font-size: clamp(18px, calc(var(--u) * 5), 24px); font-weight: 900; }
.g-demo .pl { position: relative; flex: 1; width: 100%; min-height: 0; }
.g-demo .pl canvas { position: absolute; left: 0; top: 0; }
```

## 11. The pool (12 games, ids as in the app)

| id | Dart | ko / ja / en name (exact) | accent | cat, who | status |
|---|---|---|---|---|---|
| roulette | lib/games/list/roulette.dart | 돌림판 / ルーレット / Spin Wheel | #FFB020 | bet, 2+ | done (ported) |
| bomb | lib/games/list/bomb.dart | 폭탄 돌리기 / 爆弾リレー / Hot Bomb | #FF7A3D | bet, 2+ | done (ported) |
| g2048 | lib/games/list/g2048.dart | 2048 / 2048 / 2048 | #FFB020 | solo, 1 | done (ported) |
| pirate | lib/games/list/pirate.dart | 해적 룰렛 / 海賊ルーレット / Pirate Barrel | #D9363E | bet, 2+ | done (ported) |
| croc | lib/games/list/croc.dart | 악어 이빨 / ワニの歯 / Crocodile Teeth | #2FB36B | bet, 2+ | done (ported) |
| balloon | lib/games/list/balloon.dart | 풍선 펌프 / 風船ポンプ / Balloon Pump | #FF5C7A | bet, 2+ | done (ported) |
| finger | lib/games/list/finger.dart | 손가락 뽑기 / 指ルーレット / Finger Picker | #FF5C7A | bet, 2+ | done (ported) |
| tapwar | lib/games/list/tapwar.dart | 연타 줄다리기 / 連打つなひき / Tap Tug of War | #D9363E | duel (vs computer) | done (ported) |
| reaction | lib/games/list/reaction.dart | 반응속도 대결 / 反射神経バトル / Reaction Duel | #3E9BFF | duel (vs computer) | done (ported) |
| airhockey | lib/games/list/airhockey.dart | 에어하키 / エアホッケー / Air Hockey | #00C2C7 | duel (vs computer) | done (ported) |
| tower | lib/games/list/tower.dart | 탑 쌓기 / タワー積み / Stack Tower | #FF7A3D | solo, 1 | done (ported) |
| apple | lib/games/list/apple.dart | 사과 게임 / りんご10 / Apple 10 | #E5484D | solo, 1 | done (ported) |

Briefs the games were built from (details: the Dart file):
- **pirate**: wooden barrel in 2.5D (plank stripes #8A5226 / #C07A3C / #DC9A55, grey hoops #4E5964), two rows of slots around the front;
  the pirate's head (skin #F5C49C, red bandana #C8363B, eye patch) peeks out the top and glances at each new sword.
  Tap an empty slot: a sword (steel #DDE3EA, gold hilt #FFC94A) slides in (`thud` + tick), the barrel jiggles; one hidden slot
  launches the pirate spinning high (`boing`, confetti, result pill with the current turn's name), he drops back, a new round starts by itself.
  Turns rotate through `ctx.names`. Hint: tap a front slot.
- **croc**: crocodile seen from the front with the mouth wide open (skin #45C46F, dark #2F9A55, belly #CDEFC0, palate #F58BA0,
  tongue #FFA3B5), a curved row of white lower teeth. Tap a tooth: it sinks (click + low hum), the jaw trembles a bit more each time;
  one sore tooth snaps the upper jaw shut (`chomp`, `shake`, short red/pink flash), "{name} got bitten" (croc.dart _tBitten), then it
  opens again for a new round. Hint: tap a middle tooth.
- **balloon**: pink balloon (#FF5C7A / #FF9AAE, knot #E8455F) on a stand fed by a hand pump (grey #5B6670 / #B8C2CC) and a hose.
  Tap the pump: the handle pushes down, an air bubble runs along the hose, the balloon swells with a soft wobble and more shine;
  pop point hidden (shorter than the app's 8 to 30 so it pops within about 15 s of tapping). POP: rubber shreds + confetti + forfeit
  line with the name whose turn it was (turn passes by itself after 1 to 3 pumps), then a fresh balloon. Hint: tap the pump handle.
- **finger**: full-bleed (`full: true`) dark purple radial board (#2A2140 to #120F19). Every finger (pointerId) gets a breathing ring
  in a player colour (`pop` on touch). It must work with one finger or a mouse: when only one finger is down, 2 or 3 "friend" rings
  fade in at random spots so there is someone to pick. Hold still 2 s: three `beep`s with a big faint 3, 2, 1, rings spin and shrink,
  then one is picked: its colour floods the screen, white ring + star, `win` + confetti. Lifting all fingers (or 2.5 s later) starts
  over. Real multi-touch keeps working (each finger its own ring). Hint: 'hold' in the middle.
- **tapwar**: vs the computer. Top half pink #FF5C7A (computer, its text rotated 180°), bottom half blue #3E9BFF (you), a vertical rope
  (#E3B577 / #B5813F) with a red bow (#E5484D) in the middle and fists at both ends, faint arrows flowing toward each player.
  Tap anywhere in your half: `pop`, white ripple ring, the rope jerks toward you; the computer taps at a slightly varying human pace
  (beatable by fast tapping). Bow over your line wins the round (app words _tPull "당겨요!", _tAlmost, _tHold); short rounds,
  best of three, then trophy + confetti and a new match by itself. Hint: tap in the bottom half.
- **reaction**: vs the computer. Dark board #15181C, top half the computer (rotated text), bottom half you, a badge in the middle.
  Grey "ready" (#3A4048, app _tReady) for a random 1.5 to 4 s, then both halves turn green #2FC85E with "now!" (_tNow) and a beep.
  First tap scores (ding, gold #FFB020 crown, your ms shown); tapping on grey = "too soon" (_tTooSoon, red #E5484D) and the point
  goes to the computer. Computer reacts in about 230 to 420 ms. First to 3 wins (app _kWinTo), then a new match by itself.
  Hint: tap your half (show it once the screen turns green the first time, or on the grey half with the 'tap' kind).
- **airhockey**: vs the computer, vertical table centred (light: surface #F6FCFD, rim gradient #3FDCE0 to #00AAB0, air-hole dots,
  centre line and circle, goal arcs and posts in player colours, goal slots #0D3B3E; dark: surface #14272A, rim #1F6B6F to #134447).
  You drag the bottom mallet (pink #FF5C7A) within your half; the computer's top mallet (blue #3E9BFF) defends and strikes;
  puck #1C2333. Wall `tick`, mallet hit `thud`/`pop`, goal big score pop + confetti. Short matches (first to a few goals), then restart
  by itself. Keep physics simple but solid (substeps, no tunnelling). Hint: 'drag' on your mallet toward the puck.
- **tower**: soft sky gradient (light #DFF2FF to #F3E6FF, ground #F2FBF0 to #E2F0FF; dark #0F1A22 / #1A1230), a slab slides left
  and right; tap anywhere to drop it. The overhang is cut and falls as debris; within tolerance it snaps to "Perfect!" (_tPerfect)
  with a ring and combo; pastel slab colours HSL(hue0 + level * 11, 62%, 70% (60% dark)); the camera rises; speed grows per floor.
  A miss ends the run: floors count, then a new tower by itself. Hint: tap in the middle.
- **apple**: light green board (#E8F5E4, dark #1B2619) full of red apples (#F0484E / #C92F3A, leaf #3BB75E, stem #6B4A2B) with
  white numbers 1 to 9. Drag a rectangle: the box is blue #3E9BFF under 10, green #2FC85E at exactly 10, red #E5484D over 10, with the
  running sum; release on 10 and those apples pop off with gold sparkles. Smaller grid than the app (cells at least about 32 px,
  e.g. 8 x 6 on phones), generator like AppleBoard.generate (neighbouring pairs that make 10), refill or a new board by itself.
  Hint: 'drag' across a pair that makes 10.
