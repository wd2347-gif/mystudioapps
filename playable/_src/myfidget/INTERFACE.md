# MyFidget playable: game contract

One game = one file `games/<id>.js` (plus an optional `games/<id>.css`).
`build.py` pastes every game file, then `sets.js`, **inside the shell's closure** at `/*@@GAMES@@*/`,
after all shell helpers are defined. All helpers below are therefore plain identifiers in scope:
no imports, no `window.` prefix.

```
python3 /Users/ymc/Desktop/claude/mystudioapps/playable/_src/build.py myfidget --only <id>,spinner,keycaps --out <scratch>/x.html
```

## 1. File shape (copy this)

```js
/* game: <id> : one line saying what it is */
(function () {
  // private constants / helpers live inside this IIFE (never at file top level:
  // all games share one scope, a top-level `function draw()` would clash with another game)
  GAMES['<id>'] = {
    name:   { ko: '...', ja: '...', en: '...' },   // EXACT app title (see section 8)
    tip:    { ko: '...', ja: '...', en: '...' },   // one short line, see section 8
    bg:     'linear-gradient(180deg,#TOP 0%,#BOTTOM 100%) #TOP', // CSS background of the whole screen (optional)
    tone:   'light',     // 'light' if bg is light (dark chrome text), 'dark' or omitted otherwise
    top:    '#TOP',      // optional: browser theme colour (status bar)
    accent: '#RRGGBB',   // optional: name chip + touch-hint colour (use the app catalog accent)
    make: function (env) { /* build state */ return { /* game object, section 3 */ }; }
  };
})();
```

* `bg`/`tone` are applied to the full screen (behind the header, the play area and the buttons) and
  cross-faded when the viewer switches games. Use the toy's own backdrop from the Dart source
  (`paintBackdrop(canvas, size, [top, bottom])` or `look.bg`): that is what makes it look like the app.
  Omit `bg` to get the shell default (dark plum radial gradient).
  `tone` must match the app's `bool get light` for that look.
* `make(env)` is called each time the game is shown (a fresh instance per switch). Keep it cheap
  (the app shows a fallback card if `ready` is not posted within 3 s of load): no big loops, no
  image decoding, no audio work. Build sprites in `layout()`.

`env` (same object for every game):

| field | meaning |
|---|---|
| `env.layer` | `<div>` above the canvas, same box as the play area, `pointer-events:none`, emptied on every switch. Only for DOM extras; prefer drawing on the canvas. |
| `env.lang` | `'ko'`, `'ja'`, `'en'`, `'zh-Hant'`, `'de'`, `'es'`, `'fr'`, `'pt'` or `'ar'` (same as `LANG`). Write text as `{ko, ja, en}` only: build.py adds the other six from `i18n.json` (keyed by the English text) |
| `env.T(obj)` | picks `obj[lang]` from `{ko,ja,en}` (falls back to `en`) |
| `env.idle()` | seconds since the viewer last touched the play area (or since this game appeared) |
| `env.touched()` | `true` once the viewer has touched this game |

## 2. Lifecycle

1. `make(env)` returns the game object.
2. `layout(w, h, box)` right away, and again on **every** resize/rotation (may be called many times).
   Re-place everything and rebuild sprites; **keep progress** (do not reset the round on relayout).
3. Every animation frame: `update(dt)` then `draw(c)`. `dt` is seconds, clamped to 0..0.05. The shell
   runs the only `requestAnimationFrame` loop and pauses it while the page is hidden.
4. Input any time between frames: `down(p)`, `move(p)`, `up(p)`.
5. `destroy()` when the viewer presses "other game". Stop sounds, drop big canvases.
   Loops made with `makeLoop()` are also stopped by the shell, FX particles and `env.layer` are cleared.

Do **not** use `setTimeout`/`setInterval`/own rAF: time everything from `update(dt)` with your own clock
(so it pauses with the page and dies with the instance). No `localStorage`, no network, no `alert`.

## 3. Game object

| method | required | notes |
|---|---|---|
| `layout(w, h, box)` | yes | play area size in CSS px; `box = {x, y, w, h}` = centred content column (see section 4) |
| `down(p)` / `move(p)` / `up(p)` | yes | `p = {id, x, y, t}`: pointer id (one per finger, multi-touch), play-area CSS px, `t` = `now()` ms |
| `update(dt)` | yes | simulation, timers, auto-restart |
| `draw(c)` | yes | `c` = the 2D context, already scaled so 1 unit = 1 CSS px, already cleared (transparent) |
| `hint()` | yes | where to show the touch hint: `{x, y}` pulse, or `{x, y, dx, dy}` finger sliding by (dx, dy); `null` = none |
| `debug()` | yes | small JSON-safe object of state for tests (section 9) |
| `destroy()` | yes | free resources, stop `makeWhirr`/`makeLoop` sounds you made |

Input details:
* `move` arrives for every pointer move, also mouse hover without a button on desktop: ignore ids you are
  not tracking. `up` can arrive twice for the same id (pointerup, then lostpointercapture): make it idempotent.
* The shell unlocks audio on the first `pointerdown`, sets `touched`, captures the pointer and calls
  `preventDefault` (no scrolling, no zoom). The canvas covers the play area only (not the header or buttons).

Drawing details:
* The canvas is transparent and the screen background is the CSS `bg`. **Do not fill the whole canvas
  with an opaque colour** unless the toy truly is edge to edge (sky, water): on tablets the play area is a
  centred column narrower than the screen, so an opaque full fill shows a hard rectangle. If you must
  (fireworks sky, ice water), use the same colours as `bg` so the edges disappear.
* The shell draws after you: FX particles (`burst`, `ringFX`, `confetti`), then the touch hint.
* On switch the shell fades/scales your first 0.3 s in; nothing to do.
* Return the context state as you found it (balance `save`/`restore`, reset `globalAlpha`,
  `globalCompositeOperation`, `shadowBlur`).

## 4. Coordinates and sizing

* Origin = top-left of the play area; units = CSS px; `G.W`, `G.H` = play area size; `G.dpr` = capped
  devicePixelRatio (max 2, lower on huge screens) for offscreen sprites: `mkCanvas(w * G.dpr, h * G.dpr)`
  then `ctx.scale(G.dpr, G.dpr)`; draw it back with `drawImage(spr, x, y, w, h)` in CSS px.
* `G.box` = `{x, y:0, w, h}` with `w = min(W, max(280, 0.8 * H))`, horizontally centred. Put the toy
  (board, sheet, pan, card) inside it; background details may use the full width.
* `G.wide` = `true` when the play area is a centred column narrower than the screen (tablets, landscape);
  `G.sw` = screen width in CSS px. Both are set before `layout()` is called (and `layout()` is called again
  when they change). The canvas stops at the column edge, so sky-wide effects (tint, sparks) should fade out
  near `x = 0` and `x = W` when `G.wide`, and full-screen scenery (hills, stars) belongs in the `bg` CSS.
* Real play areas (measured):

| screen | play area |
|---|---|
| 320 x 568 (smallest phone) | 320 x 406 |
| 360 x 740 | 360 x 576 |
| 390 x 844 | 390 x 680 |
| 430 x 932 | 430 x 768 |
| tablet landscape 1024 x 768 | 630 x 604 (centred column) |
| tablet landscape 1366 x 1024 | 640 x 860 (centred column) |

  So aspect ranges from ~0.45 (tall phone) to ~1.05 (square-ish tablet). Size the main object from
  `Math.min(box.w * a, H * b)` with a pixel cap (for example 420 to 480 px wide), centre it, never stretch
  it non-uniformly. Leave ~12 px margins. Touch targets at least ~44 px.
* The top-right 64 x 64 px of the screen belongs to the app's close button: the shell keeps it clear
  (header padding); you never draw there because the canvas starts below the header.

## 5. Shell helpers (in scope)

Math / time
* `TAU`, `clamp(v, a, b)`, `lerp(a, b, k)`, `dist(x0, y0, x1, y1)`, `segDist(px, py, x0, y0, x1, y1)`
  (distance from point to segment, great for rub/swipe hit tests)
* `easeOutBack(t)`, `easeOutCubic(t)`, `easeInOut(t)`, `now()` (ms), `srand(seed)` returns a seeded `rand()` 0..1

Drawing
* `mkCanvas(w, h)` offscreen canvas (device px), `rrect(c, x, y, w, h, r)` rounded-rect path (call `fill`/`stroke`)
* `hex('#RRGGBB')` returns `[r, g, b]`; `mix('#RRGGBB', [r, g, b], k)` returns `'rgb(...)'`; `rgba('#RRGGBB', a)`;
  `WHITE = [255,255,255]`, `BLACK = [40,14,20]` (warm black, for `mix`)
* Colour tokens: `C.coral #FF7A6B, C.red #E8434D, C.pink #FF9DB5, C.gold #FFD36E, C.mint #5ED6A8,
  C.sky #7EC8FF, C.lilac #B59CFF, C.cream #FFF4EF, C.ink #2B1A20, C.green #2FC85E`;
  `RAINBOW` = app rainbow `['#FF6B6B','#FFA24C','#FFD54A','#66D18A','#55A8F2','#A67CF2']`; `CONF` = confetti colours
* `G` = `{W, H, dpr, box, wide, sw}` (read only)
* Canvas shadows: `shadowBlur`, `shadowOffsetX/Y` ignore the transform. In a sprite drawn with
  `ctx.scale(G.dpr, G.dpr)`, multiply them by `G.dpr` or the shadow is too small on retina screens.
* Partial redraws of an offscreen layer under a clip: snap the clip rectangle to whole device pixels
  (`Math.floor(x * dpr) / dpr`, `Math.ceil(...)`), or faint seam lines show where regions meet.

Feedback (fire sound + haptic + visual in the **same** frame as the action)
* `haptic(force, ms)`: `navigator.vibrate(ms || 10)`; throttled to 1 per 45 ms unless `force` is true.
  Use `haptic(false)` for rapid repeats (rubbing), `haptic(true)` for distinct presses. Silent on iOS.
* `Sfx.*` (all silently skip until the first touch unlocked audio; `v` = volume 0..1, default 1):
  * `pop(v)` bubble pop, `tick(v)` tiny mechanical tick, `click(v)` crisp switch click, `key(i, rel)` keycap
    press/release voice `i` (0..9)
  * `pluck(freqHz, v, bright)` metal tine (kalimba), `bell(freqHz, v)` glass ping (plinko pegs, chimes)
  * `crack(v)` ice crack, `crunch(v)` soap/crisp slice step, `squish(v)` jelly/slime squish, `thud(v)` soft landing, `flop(v)` silicone slap (pop-it board landing)
  * `launch(v)` firework whistle, `boom(size 0..1, v)` firework burst, `crackle(n, v)` sparkly tail
  * `whoosh(v, up)` air sweep, `fwip()` refill swoosh, `chime()` reward arpeggio, `sparkle(v)` small reveal arpeggio, `ui()` blip
  * Pentatonic note helper for music toys: `440 * Math.pow(2, semitones / 12)`.
* Continuous sounds: `var lp = makeLoop({type:'bandpass', freq:1200, q:0.8, gain:0.35, tone:0, toneType:'triangle', toneMix:0.3, smooth:0.05})`
  then `lp.set(level 0..1, rate)` every frame (internally throttled; `rate` multiplies filter and tone
  frequency), `lp.stop()` in `destroy()`. Good for spray (powerwash), scratching, sizzling, rubbing.
* Raw synthesis if you need your own sound: `var a = A(); if (!a) return; var t = a.currentTime + 0.003;`
  then `tn(a, t, type, f0, f1, dur, peak, att)` (oscillator with glide), `nz(a, t, dur, filterType, freq, q, peak)`
  (filtered noise hit), `nzSweep(a, t, dur, f0, f1, q, peak)`. Keep peaks around 0.2 to 0.6 (there is a compressor).
  Never create more than a handful of nodes per frame; throttle repeats (for example one sound per 40 ms).
* FX layer (drawn above your game, cleared on switch):
  `burst(x, y, colours[], n, speed, size, gravity)` sparks; `ringFX(x, y, r0, r1, cssColour, seconds)` expanding ring;
  `confetti(G.W, G.H, n)`; `toast(text)` centred pill (only ever `toast(L.slogan)`);
  `celebrate(x, y, colours, opts)` = confetti + chime + strong haptic + slogan toast + burst/ring at (x, y): use it
  once when a round is completed. `celebrate()` with no x/y skips the burst and ring (for a game that draws its
  own reward particles); `opts = {sound: false}` skips the chime (music toys that play their own reward notes). Custom particles: push `{k:0, x, y, vx, vy, g, life:0, max, sz, c}` to `FX`, then `trimFX()`.
* The app's own goal reward (`celebration.dart`): `var ch = makeCheer();` then `ch.burst(x, y, size, colours, n)`
  (light rings, sparkle stars, confetti from that point), `ch.update(dt)` and `ch.draw(c)` every frame,
  `ch.active()`, `ch.clear()`. Pair it with `celebrate()` (no x/y) for the chime, toast and haptic.
* `setBg(css, true)` cross-fades the full-screen background to a new look mid-game (for example a toy that
  moves to its next colour variant after a round). Keep the same `tone`.
* Text: `L.slogan` (localised slogan), `LANG`, `T({ko,ja,en})`. Avoid drawing text on the canvas; if you
  must, use the page font: `'800 16px ' + getComputedStyle(document.body).fontFamily`.

## 6. Touch hint

Return the point the viewer should touch first from `hint()` (in play-area px; it is read every frame, so
it may follow a moving object). The shell shows a pulsing ring there until the first touch, and again after
10 s without touches. For swipe/rub/drag toys return `{x, y, dx, dy}`: a finger dot slides from (x, y) to
(x+dx, y+dy) with a trail (for example the zipper pull `dy:+160`, the knife `dy:+120`, a rub stroke `dx:+200`).
Pick a spot that gives an immediate, visible result.

## 7. Feel, rounds, never dead-end

* Readable in 1 to 2 s: the toy fills most of the play area, the first touch gives a big reaction (sound +
  haptic + motion + particles in the same frame). Start in an inviting state (a few things already done,
  like the app's own first screen: a pre-scratched line, a half-cooked egg, a spinning spinner).
* When a round ends (all popped, all washed, all cracked...): `celebrate(...)`, then after about 1 to 1.5 s
  restart or refill **by yourself** with a short animation (`Sfx.fwip()`), so the viewer can keep playing
  forever. Never require a reset button, never stop responding, never show a "game over".
* Nothing may show how many games or rounds there are: no counters, no "1/3", no progress like "3 left",
  no "NEW". A % bar is fine only if the app shows it; prefer none.
* Keep the toy alive when idle (gentle wobble, twinkle, a slow spin) so it does not look frozen in a screenshot.

## 8. Text rules

* `name`: exactly the app title from `/Users/ymc/Desktop/claude/my_fidget/lib/l10n/app_strings.dart`
  (`ToyText` first argument in `_Ko`, `_Ja`, `_En`; ids match `catalog.dart`).
* `tip`: one short natural line per language, ideally <= 15 Korean chars, <= 16 Japanese chars,
  <= 28 English chars (it must fit next to the name at 320 px; it is ellipsised otherwise). Base it on the
  app's hint text but shorter. No counts, no "NEW", no exclamation spam.
* Never use the long dash or a double hyphen in visible text; use ":" (Japanese "："). Hyphens are fine.
  `build.py` refuses the long dash anywhere in the page.

## 9. debug() and testing

`debug()` returns a small plain object that proves input worked and rounds restart, for example
`{ left: 12, total: 30, rounds: 1 }`, `{ washed: 0.42, rounds: 0 }`, `{ notes: 5, lastNote: 3 }`. It must
never throw and must be cheap (called from tests only).

Test page (only your game plus two finished ones, as one set):

```
python3 /Users/ymc/Desktop/claude/mystudioapps/playable/_src/build.py myfidget --only <id>,spinner,keycaps \
  --out /private/tmp/claude-501/-Users-ymc-Desktop-claude/bf7a249d-3bcb-42ef-8181-67aaeffe411f/scratchpad/playable_sets/myfidget/<id>/test.html
```

Headless check (node 22+, headless Chrome with its own profile, hard timeout, kills Chrome itself):

```
H=/private/tmp/claude-501/-Users-ymc-Desktop-claude/bf7a249d-3bcb-42ef-8181-67aaeffe411f/scratchpad/playable_sets/myfidget/pf_cdp.mjs
W=360 H=740 LANG2=ko PRE=<id> node $H test.html shots flow     # screenshots, tap+drag at the hint, state(), message order
W=1024 H=768 LANG2=en PRE=<id> node $H test.html shots flow    # tablet landscape
W=320 H=568 LANG2=ja PRE=<id> node $H test.html shots flow     # smallest phone, text fit
W=360 H=740 PRE=<id> STEP=18 node $H test.html shots sweep     # rub the whole area: round must end and restart
HOLD=1 ... flow                                                 # also long-press (hold toys)
```

Test hooks (page loaded with `?test=1`): `__pf.set()` (1-based set), `__pf.ids()`, `__pf.game()` (1-based
position), `__pf.state()` (your `debug()`), `__pf.hint()` (client coords), `__pf.area()`, `__pf.errors()`.
URL options: `?lang=ko|ja|en`, `?set=N` (force set N), `?game=K` (start at position K), `?host=app`.

Acceptance for a game: no console errors at 320x568, 360x740, 1024x768 and 1366x1024; it looks like the app
toy; the hint tap/drag changes `state()`; a sweep or repeated play completes a round which restarts by
itself; 60 fps (keep per-frame work small: pre-rendered sprites, no `getImageData`/`shadowBlur` per frame,
offscreen masks sized to the toy not the screen, particles capped); file ideally 8 to 20 KB of readable JS;
no external resources (no images, fonts, CDNs; small `data:` URIs only if unavoidable).

## 10. Per-game CSS

`games/<id>.css` is pasted into the page `<style>`. While your game is shown, `<body>` has the class
`g-<id>`, so scope every rule: `body.g-<id> #layer .bubble { ... }`. Use it only for DOM you put in
`env.layer` (or a tiny tweak of the shell chrome for your game). No `@import`, no `url()`.

## 11. Minimal example (tested)

```js
/* game: example : rub or tap the candy dots; all gone: celebrate, then it refills by itself */
(function () {
  var COLS = ['#FF6B6B', '#FFA24C', '#FFD54A', '#66D18A', '#55A8F2', '#A67CF2'];

  GAMES['example'] = {
    name: { ko: '예시', ja: 'サンプル', en: 'Example' },
    tip: { ko: '문질러서 톡톡 터뜨려 보세요', ja: 'こすってポンポンはじいてみて', en: 'Rub to pop them all' },
    bg: 'linear-gradient(180deg,#FFF6EC 0%,#F6E7F2 100%) #FFF6EC',
    tone: 'light',
    top: '#FFF6EC',
    accent: '#FF8A80',
    make: function (env) {
      var W = 0, H = 0, R = 20, dots = [], left = 0, doneAt = -1, clock = 0, ptr = {};
      var rub = makeLoop({ type: 'bandpass', freq: 900, q: 0.7, gain: 0.25 }), rubLevel = 0;
      var spr = [], half = 0, rounds = 0;

      function sprites() { /* one pre-rendered sprite per colour at the shell dpr */
        var d = G.dpr; half = R + 4; spr = [];
        for (var i = 0; i < COLS.length; i += 1) {
          var cv = mkCanvas(half * 2 * d), c = cv.getContext('2d');
          c.scale(d, d);
          var g = c.createRadialGradient(half - R * 0.35, half - R * 0.4, R * 0.1, half, half, R);
          g.addColorStop(0, mix(COLS[i], WHITE, 0.6)); g.addColorStop(1, COLS[i]);
          c.fillStyle = g; c.beginPath(); c.arc(half, half, R, 0, TAU); c.fill();
          spr.push(cv);
        }
      }
      function layout(w, h, box) {
        W = w; H = h;
        var bw = Math.min(box.w - 32, 420), cols = 5, gap = bw / cols, rows = clamp(Math.floor((h - 60) / gap), 3, 7);
        R = gap * 0.38;
        var x0 = (w - bw) / 2 + gap / 2, y0 = (h - rows * gap) / 2 + gap / 2, old = dots;
        dots = []; left = 0;
        for (var r = 0; r < rows; r += 1) for (var c = 0; c < cols; c += 1) {
          var o = old[dots.length], gone = o ? o.gone : false;   /* keep progress across relayout */
          dots.push({ x: x0 + c * gap, y: y0 + r * gap, k: (r + c) % COLS.length, gone: gone, s: 1 });
          if (!gone) left += 1;
        }
        sprites();
      }
      function hit(x, y) {
        for (var i = 0; i < dots.length; i += 1) {
          var d = dots[i];
          if (d.gone || d.s < 0.9 || dist(x, y, d.x, d.y) > R * 1.1) continue;
          d.gone = true; left -= 1;
          Sfx.pop(); haptic(false);                                   /* same frame: sound, haptic, sparks */
          burst(d.x, d.y, [COLS[d.k], '#FFFFFF'], 7, R * 5, R * 0.12);
        }
      }
      return {
        layout: layout,
        down: function (p) { ptr[p.id] = { x: p.x, y: p.y }; hit(p.x, p.y); },
        move: function (p) {
          var q = ptr[p.id]; if (!q) return;                          /* ignore untracked pointers */
          rubLevel = Math.min(1, rubLevel + dist(q.x, q.y, p.x, p.y) / 60);
          hit(p.x, p.y); q.x = p.x; q.y = p.y;
        },
        up: function (p) { delete ptr[p.id]; },                       /* idempotent */
        update: function (dt) {
          clock += dt;
          rubLevel *= Math.exp(-8 * dt); rub.set(rubLevel, 1 + rubLevel * 0.5);
          for (var i = 0; i < dots.length; i += 1) if (!dots[i].gone && dots[i].s < 1) dots[i].s = Math.min(1, dots[i].s + dt * 3);
          if (left <= 0 && doneAt < 0) { doneAt = clock; celebrate(W / 2, H / 2, COLS); }
          if (doneAt >= 0 && clock - doneAt > 1.3) {                   /* never dead-end: refill by itself */
            for (var j = 0; j < dots.length; j += 1) { dots[j].gone = false; dots[j].s = 0; }
            left = dots.length; doneAt = -1; rounds += 1; Sfx.fwip();
          }
        },
        draw: function (c) {
          for (var i = 0; i < dots.length; i += 1) {
            var d = dots[i]; if (d.gone) continue;
            var s = easeOutBack(d.s);
            if (s > 0.02) c.drawImage(spr[d.k], d.x - half * s, d.y - half * s, half * 2 * s, half * 2 * s);
          }
        },
        hint: function () { var a = dots[0], b = dots[4]; return a && !a.gone ? { x: a.x, y: a.y, dx: b.x - a.x, dy: 0 } : null; },
        debug: function () { return { left: left, total: dots.length, rounds: rounds }; },
        destroy: function () { rub.stop(); ptr = {}; spr = []; }
      };
    }
  };
})();
```

The finished ports `games/bubble_wrap.js`, `games/spinner.js`, `games/keycaps.js` are fuller references
(sprites cached per dpr, rub hit testing with `segDist`, multi-touch, round reward and refill, whirr loop).

## 12. Shell behaviour (for reference, do not re-implement)

* Picks one set from `SETS` per load: uniform random, never the previous load's set (kept in
  `localStorage['xp_play_myfidget_last_set']`, all access in try/catch), `?set=N` forces, `?game=K` starts at K.
  Sets that reference a missing game are skipped.
* Posts to `window.XPromo.postMessage`: `ready` once after the first game has been drawn, `switch:2` and
  `switch:3` when "other game" moves on, `install` from the install button or from "other game" on the last
  game. Without the bridge, install opens the App Store / Play / web URL by user agent.
* Bottom bar: "other game" (다른 놀이 / 別のあそび / Another toy) and install. No position dots, no counters.
* Phones use the full width; tablets and landscape get a centred column `min(screenW, max(9/16 * screenH,
  min(0.82 * screenH, 640)))` wide over the full-screen `bg`.
