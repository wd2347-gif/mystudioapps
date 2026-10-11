# MyMiniGame playable: game interface

One page (`playable/myminigame/index.html`) is built from:

| file | what |
|---|---|
| `_src/myminigame/shell.html` | the page: header, title row, play area, bottom bar, sound, haptics, effects, hint, bridge, set picking. **Do not edit it from a game.** |
| `_src/myminigame/games/<id>.js` | one game. Registers `GAMES['<id>']`. |
| `_src/myminigame/games/<id>.css` | optional CSS for that game (only needed if you use DOM in `ctx.root`). |
| `_src/myminigame/sets.js` | `var SETS = [[...3 ids], ...]` (12 sets). |
| `_src/build.py` | `python3 playable/_src/build.py myminigame [--only a,b,c --out file]` inlines games + sets into the shell. |

Reference game: `games/whack.js` (두더지 잡기, complete port of `my_mini/lib/games/list/whack.dart`). Read it before writing yours.

## 1. File template

Every game file is wrapped in its own IIFE (the shell also isolates it, but keep your own scope clean):

```js
/* 한 줄 설명(한국어 OK): 어떤 앱 게임을 옮겼는지, 플레이어블에서 바꾼 점. */
(function () {
  'use strict';
  var TX = { /* your strings, always { ko, ja, en } */ };

  GAMES['<id>'] = {
    name:  { ko: '…', ja: '…', en: '…' },   // EXACTLY the app's name (my_mini/lib/games/texts.dart), see the pool table
    tip:   { ko: '…', ja: '…', en: '…' },   // one short natural line (the app's _tTip / _tHint is a good source)
    color: '#RRGGBB',                        // the game's colour from my_mini/lib/games/catalog.dart (title tile + PartyButton colour)
    kind:  'arcade' | 'puzzle' | 'brain',    // shown as the category chip (app names: 순발력 아케이드 / 퍼즐 / 두뇌 · 기억)
    make:  function (ctx) { /* … */ return api; }
  };
})();
```

Use only `GAMES` and `ctx`. Do not touch `window`, `document.body`, `localStorage`, `XPromo`, the bottom bar or the header.

## 2. Lifecycle

1. The shell picks a set, calls `make(ctx)` for position 1, then `api.layout(w, h)`, then one synchronous `update`-less `api.draw(g)`, then posts `'ready'` to the app. **So make() + layout() + the first draw must be fast (a few ms) and must already show the game.** No loading screen, no fade from black, no "Start" button.
2. Every animation frame while the page is visible: `api.update(dt)` then `api.draw(g)` (the frame loop always runs; it pauses only when the page is hidden).
3. Input: `api.down(p)`, `api.move(p)`, `api.up(p)` (up also on cancel / lost capture), `api.key(e)` for desktop testing.
4. "Another game": the shell calls `api.destroy()`, clears every `ctx.later` timer and `ctx.on` listener, empties `ctx.root`, clears the effects layer, then builds the next game. A game is never reused; the next time it is shown it gets a fresh `make()`.
5. `layout(w, h)` is called again whenever the play area changes size and when light / dark mode flips. It must not reset the game state (only recompute geometry and cached layers).
6. If `make()` throws, the shell skips that game (forward only). If a game call throws later, the shell logs it and keeps running. Tests treat any console error as a failure.

## 3. The API object returned by make()

| member | required | contract |
|---|---|---|
| `layout(w, h)` | yes | `w`, `h`: play area size in CSS px (never below 160). Compute your arena with `ctx.fit`, rebuild cached layers with `ctx.layer`. |
| `update(dt)` | yes | `dt` in seconds, clamped to ≤ 0.05. All motion and timers go here (no `setInterval`; use `ctx.later` only for rare one-shots). |
| `draw(g)` | yes | `g` is the play-area `CanvasRenderingContext2D`, already scaled for the pixel ratio, origin at the play area's top-left, units CSS px. The canvas is **cleared to transparent** before every call; the page background (`ctx.C.bg`) shows through. Leave `g` as you found it (balance `save`/`restore`). |
| `down(p)` / `move(p)` / `up(p)` | for touch games | `p = { id, x, y }` in the same coordinates as `draw`. `move`/`up` only come for pointers that went down on the canvas. Multi-touch: several ids. React **on down** (sound + haptic + visual at the same moment, app rule). |
| `key(e)` | optional | keydown, for desktop checks (arrows / space). |
| `hint()` | expected | where the viewer should touch: `{ x, y }` for a tap, `{ x, y, dx, dy }` for a drag/swipe from (x, y) by (dx, dy). `null` when nothing sensible. The shell draws a pulsing ring + finger there **until the first touch on this game**, and again after 8 s without touching. Point at a real target (the mole that is up, the bottle to pick, the lowest black tile …). Keep it stable (do not jump every frame). |
| `debug()` | expected | small JSON object for tests via `window.__pf.state()`: at least `phase`, a score/level/progress value, and **`targets`: play-area px points a test can tap** to make progress (or the swipe to do). |
| `destroy()` | optional | drop big arrays / layers. Timers and `ctx.on` listeners are cleaned up by the shell anyway. |

## 4. ctx reference

Identity and text

| name | |
|---|---|
| `ctx.id`, `ctx.lang` | game id; `'ko' | 'ja' | 'en'` |
| `ctx.t(o)` | pick `o[lang]` from `{ ko, ja, en }` (falls back to `en`) |
| `ctx.f(o, a, b, …)` | `t(o)` with `{0}`, `{1}` … replaced |
| `ctx.color`, `ctx.kind` | from your definition |
| `ctx.W`, `ctx.H`, `ctx.dpr` | current play area size and canvas pixel ratio (≤ 2, lower on huge tablets) |
| `ctx.dark` | prefers-color-scheme dark (the app follows the system) |
| `ctx.C` | app colour tokens for the current mode: `bg, outer, surface, ink, soft, line, hair, green, greenInk, onGreen` (light: `#F6F7F4 … #FFFFFF #12150F #6B726A …`, dark: `#0E110D … #191D18 #F1F3EE #9BA49A …`) |
| `ctx.PAL` | the app's 12 `kPlayerColors` (strawberry `#FF5C7A`, sky `#3E9BFF`, tangerine `#FFB020`, green `#2FC85E`, grape `#A368FF`, mint `#00C2C7`, carrot `#FF7A3D`, cloud `#8C9BAB`, honey `#E0A526`, indigo `#5B4BDB`, cherry `#D9363E`, choco `#8D6E4A`) |
| `ctx.now()` | seconds since this game started |
| `ctx.touched()` | has the viewer touched this game yet (use it to start a clock on first touch) |
| `ctx.hintOff()` | stop the hint now (e.g. after a successful first swipe that the shell can't know about) |

Sound (`ctx.sfx`, WebAudio synth, unlocked by the first touch; call on **down**)

| call | sound |
|---|---|
| `click()` | UI tick |
| `tick(hi)` | clock tick (last seconds) |
| `pop(pitch=1)` | bubble / balloon pop (raise pitch for combos) |
| `hit(power=1..3)` | bonk / strike |
| `place(vol=1)` | soft thud: miss, piece put down |
| `flip()` | card / tile flip |
| `whoosh(delay)`, `swish()` | air sweep; quick swipe |
| `slice()` | blade cut |
| `coin()`, `sparkle()` | bonus |
| `ding()` | correct / clear |
| `buzz()` | wrong |
| `win()`, `lose()` | fanfare; sad trombone |
| `stamp()` | big stamp (round over) |
| `beep(go)` | countdown beep, `go=true` for the start beep |
| `boom()` | explosion (bombs) |
| `boing()` | spring / bounce |
| `note(i, vol=1)` | marimba note, `i` = 0..6 → do mi sol do' mi' sol' do'' (tiles melody, combo ladders) |
| `glug(pitch)`, `cork()` | pouring water; cork pop |
| `tone(f, dur, type, vol, f2, delay, attack)`, `noise(dur, vol, f1, f2, filterType, attack, delay)` | raw synth for anything special |

Each named sound is rate-limited (~20-60 ms) so calling it every frame cannot pile up.

Haptics: `ctx.haptic(kind)` with `'light' | 'medium' | 'heavy' | 'success' | 'error'` or a ms number / pattern (navigator.vibrate, silently ignored where unsupported).

Effects (drawn on a layer above the game; **all coordinates are play-area px**, same as `draw`)

| call | |
|---|---|
| `ctx.fx.text(x, y, str, { color, size, rise, life, weight, shadow, stroke })` | the app's score pop: pops in at 1.5x, rises `rise` px/s, fades after 0.45 s |
| `ctx.fx.stars(x, y, n, colors, { speed, size, gravity })` | five-point stars bursting up and falling (hits) |
| `ctx.fx.ring(x, y, { r, width, color, life })` | expanding ring |
| `ctx.fx.burst(x, y, n, colors = PAL, { speed, size, ring, round })` | confetti from a point (clear / new best) |
| `ctx.fx.rain(n, colors)` | confetti from the top of the whole page |
| `ctx.shake(px, sec)` | shakes the whole play area (big hits, bombs) |
| `ctx.flash(color, sec, alpha)` | full play-area flash (prefer an in-arena flash for subtle ones, like whack) |
| `ctx.toast(text, sec)` | dark pill in the centre of the play area |

Drawing helpers

| call | |
|---|---|
| `ctx.fit(aspect, { maxW = 560, maxH, side = 16, pad = 6, top = 0, bottom = 0 })` | `{ x, y, w, h }`: largest rect with `w/h = aspect` inside the play area, centred, keeping a 16 px side gutter (same as the header) and `pad` top/bottom. Use it for your arena. |
| `ctx.layer(w, h, paint(c, w, h))` | offscreen canvas at the right pixel ratio; draw with `g.drawImage(layer, x, y, w, h)`. Cache static backgrounds here in `layout`. |
| `ctx.rrect(g, x, y, w, h, r | [tl, tr, br, bl])` | rounded-rect path (then `fill` / `stroke` / `clip`) |
| `ctx.text(g, str, x, y, { size, weight, color, align, base, maxW, min, shadow, blur, oy, stroke, lw, alpha })` | text with the app font stack; `maxW` shrinks to fit. Returns the size used. |
| `ctx.font(px, weight)`, `ctx.fitFont(g, str, maxW, px, weight, minPx)` | font string; fitted size |
| `ctx.rgba(hex, a)`, `ctx.shade(hex, dLightness)`, `ctx.mix(a, b, t)`, `ctx.inkOn(hex)` | colours; `shade` = HSL lightness shift like the app's `ArtBackground` (+0.12 / -0.08); `inkOn` = the app's text-on-colour rule (#1B1F1A or white) |
| `ctx.comma(n)` | 1,250 |
| `ctx.clamp, lerp, rand(a, b), rnd(n), pick(arr), shuffle(arr)` | maths |
| `ctx.ease.outQuad / inQuad / outCubic / inCubic / inOutCubic / outBack / elasticOut` | Flutter-like curves |

Other

| call | |
|---|---|
| `ctx.getBest()`, `ctx.best(score, lowerIsBetter)` | best score for this game in this browser (localStorage, safe in private mode). `best()` stores and returns `{ best, isNew }`; `isNew` is true for the first score too (same as the app's `host.record`). |
| `ctx.later(fn, ms)`, `ctx.cancel(id)` | one-shot timers, auto-cleared on switch |
| `ctx.on(el, type, fn, opts)` | listener auto-removed on switch |
| `ctx.root` | DOM layer over the canvas (`pointer-events: none`; give your own buttons `pointer-events: auto`, their events do NOT reach `down()`). Prefer canvas. The play area and `ctx.root` get class `g-<id>` while your game is shown: scope `games/<id>.css` under `.g-<id>`. |

## 5. Look and sizing

- **It must look like the game in the app.** Port the Dart painter: same colours (hex values from the Dart file), same shapes, same pieces, same feel. Draw everything in canvas: no images, no fonts, no emoji (they render differently per device), no external anything. `data:` URIs only if truly unavoidable.
- Your arena is a rounded card (`ctx.rrect(..., 26)` and clip), like the app's `ClipRRect(26)`; a soft shadow only in light mode (see whack). The game paints its own background inside the arena; outside it the page background shows.
- Sizes: phones 320-430 px wide give a play area of about 288-398 × 390-720 px (header ~75 px, title row ~55 px, bottom bar ~75 px). Tablets (1024×768, 1366×1024, also portrait): the page becomes a centred column `min(vw, max(320, 0.62 × vh))` wide (476 px at 1024×768, 635 px at 1366×1024), so the play area is about 444-603 × 560-810 px.
- Keep the app's arena aspect (e.g. whack 0.62, flappy / hoop 9:16, boards 1:1 plus a HUD strip) via `ctx.fit(aspect, { maxW: ~520 })`. **Never stretch**; scale everything from the arena width (`k = aw / 340`, clamped). Touch targets ≥ 44 px on a 320 px phone; give hit tests some slack.
- HUD inside the arena like the app (white pills `rgba(255,255,255,.9)`, ink `#3B2A1E` or the game's own), with trophy best via `ctx.getBest()`.
- The top-right 64×64 px of the page belongs to the app's close button; the shell header already keeps it free, so you never draw there.

## 6. Flow rules (owner)

- Instantly understandable in 1-2 s: the first frame already shows the board with something to do, and `hint()` points at it. No intro panel, no Start button, no 3-2-1 before the first touch. Start any clock on the first touch (`ctx.touched()` or your own flag); a short "시작!/スタート！/Go!" flash is fine.
- Short rounds (about 20-40 s, or one small level). Puzzles: tiny, always solvable levels (generate solvable states, like the app's generators); after a clear, confetti + `ding`/`win`, then the next level by itself.
- **Never a dead end.** Game over / time up / clear → a result moment (≤ 2-4 s, e.g. whack's result card) → it restarts or continues by itself; a tap during the result restarts at once.
- Satisfying feedback on every touch: sound + haptic + a visual at the same instant (on `down`).
- Text: **ko / ja / en only**, names exactly as the app (pool table below). Tips: one short natural line. No counts of games or levels anywhere ("1/3", "레벨 3/12" …), no "NEW". Never "—" or "--" in visible text: use ":" (Japanese "："). Hyphens are fine. Keep in-game words few (the app's own short words: 시작!, 시간 끝!, 새 기록!, 클리어!, 게임 끝 …).

## 7. Performance

- 60 fps on a mid Android WebView. Cache static backgrounds with `ctx.layer` in `layout`; per frame draw only what moves.
- Avoid `shadowBlur` on many objects per frame (cache shadows into layers), avoid creating gradients per object per frame when a cached sprite works, keep particles ≤ ~200, no per-frame DOM changes, no allocations in hot loops if easy to avoid.
- Size: aim for 12-25 KB per game file (whack is ~34 KB because it ports every painter; the whole page must stay under 400 KB). `build.py` prints the size.

## 8. Testing

Build only your game (repeat the id to get three positions, so the shell flow is exercised):

```sh
cd /Users/ymc/Desktop/claude/mystudioapps
python3 playable/_src/build.py myminigame --only <id>,<id>,<id> --out <your scratch>/t.html
# mix with the reference game: --only <id>,whack,<id>
```

Harness (copy it to your own scratch folder; node 22+, headless Chrome with its own profile, hard timeout, always kills Chrome):
`/private/tmp/claude-501/-Users-ymc-Desktop-claude/bf7a249d-3bcb-42ef-8181-67aaeffe411f/scratchpad/playable_sets/myminigame/pf_harness.mjs`

```sh
node pf_harness.mjs t.html <outDir> flow            # ready → tap the hint 10× per game → 'switch:2' → 'switch:3' → 'install'; screenshots
W=1024 H=768 node pf_harness.mjs t.html <outDir> flow
W=320 H=568 LANG2=ja node pf_harness.mjs t.html <outDir> shots    # also LANG2=en, DARK=1, W=1366 H=1024
GAME=1 SECS=35 EVERY=20 node pf_harness.mjs t.html <outDir> play # play a whole round by following hint(); then 3 end screenshots
SECS=5 node pf_harness.mjs t.html <outDir> perf                  # frame times while tapping
```

It serves the page at `/page.html?lang=..&test=1` with a fake `window.XPromo` and `/assets/*` from `mystudioapps/assets`. `?test=1` exposes `window.__pf = { set(), ids(), game(), state(), area(), hint() }` (`state()` is your `debug()`; `area()` / `hint()` are viewport px, ready for CDP touches). Other query: `?set=N` (1-based) forces a set, `?game=K` starts at position K.

Pass = no console errors or warnings, `'ready'` within ~50 ms of load, your `debug()` shows progress after the hint taps (score up / level cleared), round end → result → restart happens by itself, screenshots look like the app at 360×740, 320×568 (ja), 1024×768 and in dark mode. Look at the screenshots yourself.

## 9. Minimal example

Tested with the shell (flow mode, no errors). Not part of the pool.

```js
/* tapdot: minimal example. Tap the dot before it moves; 15 s rounds that restart by themselves. */
(function () {
  'use strict';
  var TX = { score: { ko: '{0}점!', ja: '{0}点！', en: '{0} points!' } };

  GAMES['tapdot'] = {
    name: { ko: '점 누르기', ja: 'ドットタップ', en: 'Dot Tap' },
    tip: { ko: '동그라미를 톡 눌러요', ja: '丸をタップしよう', en: 'Tap the circle' },
    color: '#3E9BFF',
    kind: 'arcade',
    make: function (ctx) {
      var A = { x: 0, y: 0, w: 1, h: 1 }, bg = null;
      var dot = { x: 0.5, y: 0.5, r: 0.12, t: 0 }, score = 0, left = 15, phase = 'play', wait = 0;

      function place() { dot.x = ctx.rand(0.2, 0.8); dot.y = ctx.rand(0.2, 0.8); dot.t = 0; }
      function px(d) { return { x: A.x + d.x * A.w, y: A.y + d.y * A.h, r: d.r * A.w }; }

      return {
        layout: function () {
          A = ctx.fit(0.75, { maxW: 480 });
          bg = ctx.layer(A.w, A.h, function (c, w, h) {
            ctx.rrect(c, 0, 0, w, h, 26); c.fillStyle = ctx.shade(ctx.color, 0.3); c.fill();
          });
        },
        update: function (dt) {
          dot.t += dt;
          if (phase === 'play') {
            if (ctx.touched()) left -= dt;          // the clock waits for the first touch
            if (dot.t > 1.6) place();
            if (left <= 0) { phase = 'end'; wait = 0; ctx.sfx.stamp(); ctx.toast(ctx.f(TX.score, score)); }
          } else if ((wait += dt) > 1.8) { phase = 'play'; score = 0; left = 15; place(); } // never a dead end
        },
        draw: function (g) {
          g.drawImage(bg, A.x, A.y, A.w, A.h);
          var p = px(dot), s = ctx.ease.outBack(Math.min(1, dot.t / 0.25));
          if (phase === 'play') { g.beginPath(); g.arc(p.x, p.y, Math.max(0.1, p.r * s), 0, Math.PI * 2); g.fillStyle = ctx.color; g.fill(); }
          ctx.text(g, String(score), A.x + A.w / 2, A.y + 36, { size: 30, weight: 900, color: '#FFFFFF', shadow: 'rgba(0,0,0,.3)' });
          ctx.text(g, Math.ceil(Math.max(0, left)) + 's', A.x + A.w - 20, A.y + 36, { size: 18, color: '#FFFFFF', align: 'right' });
        },
        down: function (p) {
          if (phase !== 'play') return;
          var d = px(dot);
          if (Math.hypot(p.x - d.x, p.y - d.y) <= d.r * 1.25) {    // generous touch target
            score++; ctx.sfx.pop(1 + score * 0.02); ctx.haptic('light');
            ctx.fx.stars(d.x, d.y, 8); ctx.fx.text(d.x, d.y - d.r, '+1');
            place();
          } else { ctx.sfx.place(0.5); }
        },
        hint: function () { if (phase !== 'play') return null; var d = px(dot); return { x: d.x, y: d.y }; },
        debug: function () { var d = px(dot); return { phase: phase, score: score, left: +left.toFixed(1), targets: [{ x: Math.round(d.x), y: Math.round(d.y) }] }; },
        destroy: function () { bg = null; }
      };
    }
  };
})();
```

## 10. The pool (12 games) and sets

Names are copied from `my_mini/lib/games/texts.dart`; colours from `catalog.dart`.

| id | kind | colour | ko / ja / en | Dart | playable brief |
|---|---|---|---|---|---|
| whack (done) | arcade | #8D6E4A | 두더지 잡기 / もぐらたたき / Mole Bop | lib/games/list/whack.dart | done: see games/whack.js |
| slice | arcade | #E5484D | 과일 자르기 / フルーツカット / Fruit Slice | slice.dart | Wooden plank background (5 brown planks, grain, knots, vignette). Fruits with cute faces (watermelon, orange, apple, banana, strawberry) arc up from below; swiping draws the glowing blade trail and cuts them into halves with juice splats; 3+ in one swipe = combo bonus; a bomb ends the round with a boom + flash; 3 misses (X marks) end it; restart after a beat. Hint: a swipe through the next fruit. |
| darts | arcade | #8C9BAB | 다트 꽂기 / ダーツスピン / Dart Spin | darts.dart | Navy gradient (#353B5E → #1A1D30) with a soft glow; a wooden target spinning (palette rings) with a few grey darts already stuck and an apple on the rim; tap to throw a red/yellow dart from the bottom; hitting a stuck dart bounces off = round over; sticking them all splits the target into pieces and the next stage spins differently. |
| tiles | arcade | #2B3140 | 피아노 건반 / タップタイル / Tap Tiles | tiles.dart | Four light lanes with black tiles falling; tap the lowest black tile, each tap plays the next marimba note (do mi sol do melody) with a ripple; tapping white or missing a tile blinks red and the board restarts after a beat; speed ramps up. Hint: the lowest black tile. |
| flappy | arcade | #3E9BFF | 날아라 새 / パタパタバード / Flap Flap | flappy.dart | 9:16 sky gradient (#3FA9FF → #DDF4FF), clouds, hills, bushes, candy-coloured pipes (strawberry, mint, lemon, grape, tangerine) with caps, round yellow bird with beak and wing; tap to flap, +1 per gap with rising notes; crash → feathers, score card, back to the hovering ready state. |
| breakout | arcade | #FF7A3D | 벽돌 깨기 / ブロック崩し / Brick Breaker | breakout.dart | Dark purple arena (#1A1B3C → #2B1C44 → #1C1430); 10-column rainbow brick rows (pink → orange → amber → yellow → green → cyan → blue → violet → purple) plus silver two-hit bricks; drag anywhere to move the glowing paddle, tap to launch; combo notes rise do mi sol do; clear → confetti + next layout; lose all balls → restart. |
| watersort | puzzle | #00A6FB | 물 정렬 / ウォーターソート / Water Sort | watersort.dart | Glass bottles (rounded bottoms) with 4 layers of coloured water (#F2434E, #FF8A1F, #FFD12E, #8BD43C, #1CC6C0, #3DA5F5, #9B4DE0, #FF6FB5 …); tap a bottle (it lifts), tap another to pour: tilt + stream + level rises with glug sounds; a full single-colour bottle gets a cork pop + sparkle; tiny solvable levels (3-4 colours, 2 empty bottles), next level by itself. Hint: the bottle to pick, then where to pour. |
| match3 | puzzle | #FF4F8B | 보석 맞추기 / ジェムマッチ / Gem Match | match3.dart | Dark purple board (#2A1838, checker #3A2552 / #32204A) of faceted gems (ruby, amber, topaz, emerald, sapphire, amethyst); swipe or tap-tap to swap; matches burst with sparkles, gems fall, cascades raise the note; 4 in a row = line gem, 5 = rainbow gem; no possible move → reshuffle; score keeps going. Hint: a swipe for a valid swap. |
| bubble | puzzle | #4FA8FF | 방울 쏘기 / バブル割り / Bubble Burst | bubble.dart | Blue gradient (#2F57B8 → #1C3478); hex grid of glossy bubbles (#FF4D6D, #FFC93C, #3DDC84, #3D8BFF, #B36BFF, #2ED3E6) at the top, launcher at the bottom with the next bubble; drag to aim with the dotted guide (one wall bounce), release to shoot; 3+ same colour pop, detached clusters drop for a bonus; ceiling creeps down; clear or overflow → new board. Hint: a drag aiming at a matching cluster. |
| flow | puzzle | #A368FF | 선 잇기 / 線つなぎ / Color Link | flow.dart | Dark board (#15122A, cells #221E3C) with colour dot pairs (#FF3B47, #2E7BFF, #22C55E, #FFD21F, #FF8A1F, #22D3EE …); drag from a dot to draw a thick rounded pipe through cells, crossing cuts the other line; all pairs linked and every cell filled → clear burst and a new generated 5×5 (then 6×6) puzzle. Hint: a drag along the first pair's path. |
| oddcolor | brain | #00C2C7 | 다른 색 찾기 / 違う色さがし / Odd Color | oddcolor.dart | Grid of rounded tiles of one colour on the app surface (light/dark), one tile slightly lighter/more saturated; tap it: ding, the grid grows (2×2 → … 6×6+) and the difference shrinks; wrong tap: buzz, the right tile blinks, time penalty; 30-45 s clock with +1 s per hit, result, restart. Hint: the odd tile (only before the first touch). |
| reflex | brain | #E5484D | 반응속도 / 反応速度 / Reaction Time | reflex.dart | Big rounded panel: red (#E5484D) "wait" → after 1.5-4 s green (#2FC85E) "now!" (no sound when it turns green, app rule); the tap time shows big in ms; tapping on red → amber (#FFB020) "too soon" and that try repeats; after 5 tries the average with the app's animal grade text and colour bar, then a new set by itself. |

Sets (`sets.js`, 12): every game appears 3 times, 9 different openers, kinds mixed in every set, no repeated trio.

```
whack watersort oddcolor | slice match3 reflex | darts flow tiles | tiles bubble whack
flappy oddcolor watersort | watersort breakout reflex | oddcolor flappy match3 | match3 darts reflex
breakout bubble slice | slice flow breakout | darts bubble flappy | whack flow tiles
```

The shell picks one set uniformly at random per load, never the same index as the previous load (`localStorage` key `mmg.pf.lastSet`, inside try/catch).
