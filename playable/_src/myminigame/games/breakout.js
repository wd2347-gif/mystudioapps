/* 벽돌 깨기(breakout): my_mini breakout.dart 를 옮김(세계 360x640 · 앱의 벽돌 배치 · 은색 두 번 벽돌 · 콤보 음 · 아이템). 끌어서 받침, 톡 눌러 발사, 클리어 → 다음 배치, 목숨 끝 → 결과 카드 → 저절로 새 판. */
(function () {
  'use strict';

  var TX = {
    tapLaunch: { ko: '톡 눌러 발사!', ja: 'タップで発射！', en: 'Tap to launch!' },
    clear: { ko: '클리어!', ja: 'クリア！', en: 'Cleared!' },
    over: { ko: '게임 끝', ja: 'ゲームオーバー', en: 'Game over' },
    newBest: { ko: '새 기록!', ja: '新記録！', en: 'New record!' },
    summary: { ko: '점수 {0} · 최고 콤보 {1}', ja: 'スコア {0}・最大コンボ {1}', en: 'Score {0} · Best combo {1}' },
    score: { ko: '점수', ja: 'スコア', en: 'Score' },
    best: { ko: '최고 기록', ja: 'ベスト', en: 'Best' },
    again: { ko: '다시 하기', ja: 'もう一回', en: 'Play again' },
    multi: { ko: '공 여러 개!', ja: 'マルチボール！', en: 'Multi-ball!' },
    wide: { ko: '넓은 받침!', ja: 'ワイドパドル！', en: 'Wide paddle!' },
    slow: { ko: '느린 공!', ja: 'スローボール！', en: 'Slow ball!' }
  };

  var TAU = Math.PI * 2;
  function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  var W = 360, H = 640, PY = H * 0.85, PH = 12, BASE_W = 76, WIDE_W = 120, BALL_R = 6.5, COLS = 10;
  var TOP = 66, BH = 19, GAP = 4, SIDE = 10, MAX_BALLS = 8, DROP_R = 11, DROP_SPEED = 135, WIDE_T = 12, SLOW_T = 9;
  var BW = (W - SIDE * 2 - GAP * (COLS - 1)) / COLS, REST_Y = PY - PH / 2 - BALL_R;
  var ROWS = ['#FF5C7A', '#FF7A3D', '#FFB020', '#FFD43B', '#2FC85E', '#00C2C7', '#3E9BFF', '#6C5CE7', '#A368FF'];
  var HARD = '#B9C4D0', HARD2 = '#8E99A6';
  var ITEM = { multi: '#A368FF', wide: '#00C2C7', slow: '#2FC85E' };
  var HAND = [
    ['..........', '.11111111.', '.11111111.', '.11111111.', '.11111111.'],
    ['....11....', '...1111...', '..111111..', '.11111111.', '1111111111', '2222222222'],
    ['....22....', '...1111...', '..111111..', '.11122111.', '..111111..', '...1111...', '....22....'],
    ['..1....1..', '...1..1...', '..222222..', '.22.22.22.', '2222222222', '2.222222.2', '2.2....2.2', '..11..11..'],
    ['2222222222', '2........2', '2.111111.2', '2.1.22.1.2', '2.111111.2', '2........2', '2222222222'],
    ['1........1', '11......11', '111....111', '2222..2222', '111....111', '11......11', '1........1']
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // the app's six hand-made layouts; after the sixth the playable cycles the rainbow ones (2..6) again, each round a little faster
  function layoutFor(stage) { return HAND[stage <= HAND.length ? stage - 1 : 1 + (stage - 2) % (HAND.length - 1)]; }
  function parse(rows) {
    var out = [];
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < COLS && x < rows[y].length; x++) {
      var ch = rows[y][x];
      if (ch !== '1' && ch !== '2') continue;
      out.push({ x: SIDE + x * (BW + GAP), y: TOP + y * (BH + GAP), hp: ch === '2' ? 2 : 1, max: ch === '2' ? 2 : 1, ci: ch === '2' ? -1 : y % ROWS.length, flash: 0 });
    }
    return out;
  }
  function normalize(vx, vy, sp) {
    var len = Math.hypot(vx, vy);
    if (len < 1e-6) return [0, -sp];
    var x = vx / len, y = vy / len;
    if (Math.abs(y) < 0.28) { y = y > 0 ? 0.28 : -0.28; x = (x < 0 ? -1 : 1) * Math.sqrt(1 - y * y); }
    return [x * sp, y * sp];
  }

  /* ---------- rules (BreakoutWorld) ---------- */
  function newWorld() {
    var w = { stage: 1, score: 0, lives: 3, combo: 0, bestCombo: 0, broken: 0, state: 'aim', px: W / 2, pw: BASE_W, wide: 0, slow: 0, bricks: [], balls: [], drops: [], time: 0 };
    // the playable opens on one of the app's rainbow layouts (pyramid or diamond); stage numbers are never shown
    loadStage(w, 2 + Math.floor(Math.random() * 2));
    return w;
  }
  function loadStage(w, s) { w.stage = s; w.bricks = parse(layoutFor(s)); w.broken = 0; w.combo = 0; w.drops.length = 0; w.wide = 0; w.slow = 0; resetBall(w); w.state = 'aim'; }
  function resetBall(w) { w.balls.length = 0; w.balls.push({ x: w.px, y: REST_Y, vx: 0, vy: 0, stuck: true, trail: [] }); }
  function speed(w) { return (Math.min(300 + (w.stage - 1) * 10, 460) + Math.min(w.broken * 0.8, 50)) * (w.slow > 0 ? 0.66 : 1); }
  function bricksLeft(w) { var n = 0; for (var i = 0; i < w.bricks.length; i++) if (w.bricks[i].hp > 0) n++; return n; }
  function movePaddle(w, dx) {
    w.px = clamp(w.px + dx, w.pw / 2, W - w.pw / 2);
    for (var i = 0; i < w.balls.length; i++) if (w.balls[i].stuck) w.balls[i].x = w.px;
  }
  function launch(w) {
    if (w.state !== 'aim') return false;
    var a = (Math.random() - 0.5) * 0.6, sp = speed(w);
    w.balls.forEach(function (b) { if (b.stuck) { b.stuck = false; b.vx = Math.sin(a) * sp; b.vy = -Math.cos(a) * sp; } });
    w.state = 'play';
    return true;
  }
  function touching(w, x, y) {
    var best = null, bd = BALL_R * BALL_R;
    for (var i = 0; i < w.bricks.length; i++) {
      var k = w.bricks[i];
      if (k.hp <= 0 || x < k.x - BALL_R || x > k.x + BW + BALL_R || y < k.y - BALL_R || y > k.y + BH + BALL_R) continue;
      var dx = x - clamp(x, k.x, k.x + BW), dy = y - clamp(y, k.y, k.y + BH), d = dx * dx + dy * dy;
      if (d < bd) { best = k; bd = d; }
    }
    return best;
  }
  function damage(w, k, ev) {
    k.hp--; k.flash = 1;
    var hard = k.max > 1, cx = k.x + BW / 2, cy = k.y + BH / 2;
    if (k.hp > 0) { w.score += 5; ev.push({ t: 'brickHit', x: cx, y: cy, k: k }); return; }
    w.broken++; w.combo++; w.bestCombo = Math.max(w.bestCombo, w.combo);
    var pts = 10 * Math.min(w.combo, 8) * (hard ? 2 : 1);
    w.score += pts;
    ev.push({ t: 'brickBreak', x: cx, y: cy, k: k, points: pts, combo: w.combo, hard: hard });
    if (w.drops.length < 3 && Math.random() < 0.14) { var q = Math.random(); w.drops.push({ x: cx, y: cy, kind: q < 0.4 ? 'multi' : q < 0.75 ? 'wide' : 'slow', age: 0 }); }
    if (bricksLeft(w) === 0) {
      var bonus = 100 * w.stage + w.lives * 50;
      w.score += bonus; w.state = 'cleared'; w.drops.length = 0;
      ev.push({ t: 'stageClear', points: bonus });
    }
  }
  function moveBall(w, b, dt, ev) {
    var sp = speed(w), v = normalize(b.vx, b.vy, sp), vx = v[0], vy = v[1], x = b.x, y = b.y;
    var n = Math.max(1, Math.ceil(sp * dt / (BALL_R * 0.7))), sdt = dt / n;
    for (var i = 0; i < n; i++) {
      x += vx * sdt; y += vy * sdt;
      if (x < BALL_R) { x = BALL_R; vx = Math.abs(vx); ev.push({ t: 'wall' }); }
      else if (x > W - BALL_R) { x = W - BALL_R; vx = -Math.abs(vx); ev.push({ t: 'wall' }); }
      if (y < BALL_R) { y = BALL_R; vy = Math.abs(vy); ev.push({ t: 'wall' }); }
      if (vy > 0) {
        var L = w.px - w.pw / 2, R = w.px + w.pw / 2, T = PY - PH / 2;
        if (y + BALL_R >= T && y <= PY && x >= L - BALL_R && x <= R + BALL_R) {
          var off = clamp((x - w.px) / (w.pw / 2), -1, 1), a = off * 1.08;
          vx = Math.sin(a) * sp; vy = -Math.cos(a) * sp; y = T - BALL_R; w.combo = 0;
          ev.push({ t: 'paddle', x: x, y: y, value: off });
        }
      }
      var k = touching(w, x, y);
      if (k) {
        var oL = x + BALL_R - k.x, oR = k.x + BW - (x - BALL_R), oT = y + BALL_R - k.y, oB = k.y + BH - (y - BALL_R);
        if (Math.min(oL, oR) < Math.min(oT, oB)) { if (oL < oR) { vx = -Math.abs(vx); x -= oL; } else { vx = Math.abs(vx); x += oR; } }
        else { if (oT < oB) { vy = -Math.abs(vy); y -= oT; } else { vy = Math.abs(vy); y += oB; } }
        v = normalize(vx, vy, sp); vx = v[0]; vy = v[1];
        damage(w, k, ev);
        if (w.state === 'cleared') break;
      }
    }
    b.x = x; b.y = y; b.vx = vx; b.vy = vy;
  }
  function applyItem(w, kind) {
    if (kind === 'wide') w.wide = WIDE_T;
    else if (kind === 'slow') w.slow = SLOW_T;
    else {
      if (w.state === 'aim') launch(w);
      var src = w.balls.filter(function (b) { return !b.stuck; });
      for (var i = 0; i < src.length; i++) for (var j = 0; j < 2; j++) {
        if (w.balls.length >= MAX_BALLS) return;
        var b = src[i], a = j ? 0.45 : -0.45, c = Math.cos(a), s = Math.sin(a);
        w.balls.push({ x: b.x, y: b.y, vx: b.vx * c - b.vy * s, vy: b.vx * s + b.vy * c, stuck: false, trail: [] });
      }
    }
  }
  function wStep(w, dt) {
    var ev = [], i;
    w.time += dt;
    for (i = 0; i < w.bricks.length; i++) if (w.bricks[i].flash > 0) w.bricks[i].flash = Math.max(0, w.bricks[i].flash - dt * 5);
    if (w.state === 'over' || w.state === 'cleared') return ev;
    if (w.wide > 0) w.wide = Math.max(0, w.wide - dt);
    if (w.slow > 0) w.slow = Math.max(0, w.slow - dt);
    w.pw += ((w.wide > 0 ? WIDE_W : BASE_W) - w.pw) * Math.min(1, dt * 10);
    w.px = clamp(w.px, w.pw / 2, W - w.pw / 2);
    for (i = 0; i < w.balls.length; i++) {
      var b = w.balls[i];
      if (b.stuck) { b.x = w.px; b.y = REST_Y; b.trail.length = 0; continue; }
      moveBall(w, b, dt, ev);
      b.trail.push(b.x, b.y); if (b.trail.length > 20) b.trail.splice(0, 2);
      if (w.state === 'cleared') return ev;
    }
    var before = w.balls.length;
    w.balls = w.balls.filter(function (q) { return q.y <= H + BALL_R * 3; });
    if (w.balls.length < before && w.balls.length) ev.push({ t: 'ballLost' });
    for (i = w.drops.length - 1; i >= 0; i--) {
      var d = w.drops[i];
      d.age += dt; d.y += DROP_SPEED * dt;
      if (d.y > H + DROP_R) { w.drops.splice(i, 1); continue; }
      var L = w.px - w.pw / 2 - 2, R = w.px + w.pw / 2 + 2, T = PY - PH / 2 - 2, B = PY + PH / 2 + 2;
      if (Math.hypot(d.x - clamp(d.x, L, R), d.y - clamp(d.y, T, B)) < DROP_R) { w.drops.splice(i, 1); applyItem(w, d.kind); ev.push({ t: 'item', x: d.x, y: d.y, kind: d.kind }); }
    }
    if (w.state === 'play' && !w.balls.length) {
      w.lives--; w.combo = 0; w.drops.length = 0; w.wide = 0; w.slow = 0;
      if (w.lives <= 0) { w.lives = 0; w.state = 'over'; ev.push({ t: 'gameOver' }); }
      else { resetBall(w); w.state = 'aim'; ev.push({ t: 'lifeLost' }); }
    }
    return ev;
  }

  /* ---------- drawing helpers ---------- */
  function heart(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.beginPath();
    g.moveTo(12, 20.3); g.bezierCurveTo(5.5, 15.2, 2.5, 12.2, 2.5, 8.4); g.bezierCurveTo(2.5, 5.4, 4.9, 3.2, 7.7, 3.2);
    g.bezierCurveTo(9.4, 3.2, 11, 4, 12, 5.4); g.bezierCurveTo(13, 4, 14.6, 3.2, 16.3, 3.2); g.bezierCurveTo(19.1, 3.2, 21.5, 5.4, 21.5, 8.4);
    g.bezierCurveTo(21.5, 12.2, 18.5, 15.2, 12, 20.3); g.closePath(); g.restore();
  }
  function trophy(ctx, g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.translate(-12, -12);
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(7, 3.5); g.lineTo(17, 3.5); g.lineTo(17, 9.5); g.quadraticCurveTo(17, 14.6, 12, 14.6); g.quadraticCurveTo(7, 14.6, 7, 9.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(7, 5.6); g.lineTo(4.4, 5.6); g.quadraticCurveTo(3.9, 10.6, 7.6, 11.2); g.moveTo(17, 5.6); g.lineTo(19.6, 5.6); g.quadraticCurveTo(20.1, 10.6, 16.4, 11.2); g.stroke();
    g.fillRect(11, 14, 2, 3.6); ctx.rrect(g, 7.4, 17.4, 9.2, 3, 1.2); g.fill();
    g.restore();
  }

  GAMES['breakout'] = {
    name: { ko: '벽돌 깨기', ja: 'ブロック崩し', en: 'Brick Breaker' },
    tip: { ko: '공을 튕겨 벽돌을 모두 깨요', ja: 'ボールを打ち返してブロックを全部崩そう', en: 'Bounce the ball and smash every brick' },
    color: '#FF7A3D',
    kind: 'arcade',
    make: function (ctx) {
      var ax = 0, ay = 0, aw = 202, ah = 360, k = 0.56, kk = 1, R = 18, bg = null, glowA = null, glowB = null, ballGlow = null, ballGlowS = null;
      var bricks = {}, w = newWorld(), phase = 'play', phaseT = 0, time = 0, res = null, again = null;
      var touches = {}, primary = null, hintC = null, hintAt = -9, overAt = -1, clearAt = -1, gate = {};
      var vis = { shards: [], floats: [], rings: [], shake: 0, flash: 0, flashColor: '#FFFFFF' };

      function ok(key, gap) { if (gate[key] !== undefined && time - gate[key] < gap) return false; gate[key] = time; return true; }
      function burst(k, color, n, power) {
        for (var i = 0; i < n; i++) {
          var px = k.x + Math.random() * BW, py = k.y + Math.random() * BH, dx = px - (k.x + BW / 2), dy = py - (k.y + BH / 2);
          vis.shards.push({ x: px, y: py, vx: dx * 7 + (Math.random() - 0.5) * 220 * power, vy: -60 - Math.random() * 220 * power + dy * 6,
            c: i % 4 === 0 ? '#FFFFFF' : color, s: 2.5 + Math.random() * 4, life: 0.55 + Math.random() * 0.45, vr: (Math.random() - 0.5) * 18, age: 0, rot: 0 });
        }
        if (vis.shards.length > 200) vis.shards.splice(0, vis.shards.length - 200);
      }
      function confetti() {
        for (var i = 0; i < 70; i++) vis.shards.push({ x: W * 0.5 + (Math.random() - 0.5) * 60, y: 40, vx: (Math.random() - 0.5) * 520, vy: -120 - Math.random() * 420,
          c: ROWS[i % ROWS.length], s: 3 + Math.random() * 4, life: 1.2 + Math.random() * 0.6, vr: (Math.random() - 0.5) * 14, age: 0, rot: 0 });
        if (vis.shards.length > 220) vis.shards.splice(0, vis.shards.length - 220);
      }
      function float(text, x, y, color, size, life) { vis.floats.push({ text: text, x: x, y: y, c: color, size: size, life: life || 0.9, age: 0 }); }
      function ring(x, y, color, r1, life) { vis.rings.push({ x: x, y: y, c: color, r1: r1, life: life || 0.35, age: 0 }); }

      function restart() {
        w = newWorld(); phase = 'play'; phaseT = 0; res = null; again = null; overAt = -1; clearAt = -1;
        vis.shards.length = vis.floats.length = vis.rings.length = 0; vis.shake = 0; vis.flash = 0; hintAt = -9;
      }
      function finish() {
        phase = 'result'; phaseT = 0;
        var sc = w.score, before = ctx.getBest() || 0, b = sc > 0 ? ctx.best(sc) : { best: before, isNew: false };
        res = { score: sc, combo: w.bestCombo, best: Math.max(before, sc), isNew: sc > 0 && b.isNew };
        ctx.sfx.stamp(); ctx.haptic('heavy');
        if (res.isNew) { ctx.later(function () { ctx.sfx.win(); ctx.sfx.sparkle(); }, 300); ctx.fx.burst(ctx.W / 2, ctx.H * 0.45, 70, ctx.PAL, { speed: 700 }); }
      }
      function doLaunch() {
        if (launch(w)) { ctx.sfx.whoosh(); ctx.haptic('light'); ring(w.px, REST_Y, '#FFB07A', 26, 0.35); hintAt = -9; }
      }

      function onEvent(e) {
        var sz = Math.max(13, 10 / k);
        switch (e.t) {
          case 'wall': if (ok('wall', 0.07)) ctx.sfx.tick(true); break;
          case 'paddle':
            if (ok('paddle', 0.05)) { ctx.sfx.hit(Math.abs(e.value) > 0.6 ? 2 : 1); ctx.haptic('light'); }
            ring(e.x, e.y, '#FFB07A', 22); break;
          case 'brickHit':
            if (ok('hard', 0.05)) { ctx.sfx.hit(3); ctx.haptic('medium'); }
            burst(e.k, '#E4EAF0', 5, 0.6); vis.shake = Math.max(vis.shake, 1.5); break;
          case 'brickBreak':
            if (ok('note', 0.045)) ctx.sfx.note(Math.min(e.combo - 1, 3), 0.75);
            if (ok('pop', 0.05)) ctx.sfx.pop(e.combo >= 6 ? 1.35 : e.combo >= 3 ? 1.15 : 1);
            if (e.combo >= 5 && ok('sparkle', 0.45)) ctx.sfx.sparkle();
            ctx.haptic(e.combo >= 5 ? 'medium' : 'light');
            var col = e.hard ? HARD : ROWS[e.k.ci];
            burst(e.k, col, e.hard ? 18 : 12, e.hard ? 1.3 : 1);
            ring(e.x, e.y, col, 26, 0.3);
            float('+' + e.points, e.x, e.y, '#FFFFFF', sz, 0.8);
            if (e.combo >= 3) float('x' + e.combo, e.x, e.y - 18, '#FFD43B', Math.max(15 + Math.min(e.combo, 12) * 1.2, 12 / k), 1);
            vis.shake = Math.max(vis.shake, e.hard ? 3.5 : 1.6); break;
          case 'item':
            ctx.sfx.coin(); ctx.sfx.sparkle(); ctx.haptic('medium');
            float(ctx.t(TX[e.kind]), e.x, e.y - 24, ITEM[e.kind], Math.max(17, 13 / k), 1.2);
            ring(e.x, e.y, ITEM[e.kind], 46, 0.45); break;
          case 'ballLost': ctx.sfx.whoosh(); break;
          case 'lifeLost': ctx.sfx.buzz(); ctx.haptic('error'); vis.shake = 9; vis.flash = 0.5; vis.flashColor = '#FF3B4E'; hintAt = -9; break;
          case 'gameOver':
            ctx.sfx.boom(); ctx.haptic('heavy'); ctx.later(function () { ctx.sfx.lose(); }, 450);
            vis.shake = 14; vis.flash = 0.7; vis.flashColor = '#FF3B4E'; overAt = time; break;
          case 'stageClear':
            ctx.sfx.win(); ctx.sfx.sparkle(); ctx.haptic('success'); confetti();
            vis.flash = 0.35; vis.flashColor = '#FFFFFF';
            float('+' + ctx.comma(e.points), W / 2, H * 0.62, '#FFD43B', Math.max(26, 18 / k), 1.6);
            clearAt = time; break;
        }
      }

      function build() {
        var s = k;
        bg = ctx.layer(aw, ah, function (c, cw, ch) {
          var gr = c.createLinearGradient(0, 0, 0, ch);
          gr.addColorStop(0, '#1A1B3C'); gr.addColorStop(0.5, '#2B1C44'); gr.addColorStop(1, '#1C1430');
          c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
          c.fillStyle = 'rgba(255,59,78,.133)'; c.fillRect(0, ch - 3 * s, cw, 3 * s);
        });
        function glow(col) {
          return ctx.layer(380 * s, 380 * s, function (c) {
            c.scale(s, s); var gr = c.createRadialGradient(190, 190, 0, 190, 190, 190);
            gr.addColorStop(0, ctx.rgba(col, 0.16)); gr.addColorStop(1, ctx.rgba(col, 0));
            c.fillStyle = gr; c.fillRect(0, 0, 380, 380);
          });
        }
        glowA = glow('#FF7A3D'); glowB = glow('#6C5CE7');
        function bglow(col) {
          return ctx.layer(40 * s, 40 * s, function (c) {
            c.scale(s, s); var gr = c.createRadialGradient(20, 20, 0, 20, 20, 20);
            gr.addColorStop(0, ctx.rgba(col, 0.7)); gr.addColorStop(0.45, ctx.rgba(col, 0.45)); gr.addColorStop(1, ctx.rgba(col, 0));
            c.fillStyle = gr; c.fillRect(0, 0, 40, 40);
          });
        }
        ballGlow = bglow('#FFB07A'); ballGlowS = bglow('#2FC85E');
        // brick sprites: shadow, body, shine strip (+ rivets / crack for silver)
        bricks = {};
        function brick(key, base, hard, cracked) {
          bricks[key] = ctx.layer((BW + 2) * s, (BH + 5) * s, function (c) {
            c.scale(s, s); c.translate(1, 1);
            c.fillStyle = ctx.mix(base, '#000000', 0.45); ctx.rrect(c, 0, 2.2, BW, BH, 4); c.fill();
            c.fillStyle = base; ctx.rrect(c, 0, 0, BW, BH, 4); c.fill();
            c.fillStyle = 'rgba(255,255,255,' + (hard ? 0.55 : 0.38) + ')'; ctx.rrect(c, 2.5, 2, BW - 5, 4, 2); c.fill();
            if (hard) {
              c.fillStyle = '#5E6873';
              dot(c, 4.5, BH - 4.5, 1.5); dot(c, BW - 4.5, BH - 4.5, 1.5);
              if (cracked) {
                c.strokeStyle = '#3E4650'; c.lineWidth = 1.2; c.beginPath();
                c.moveTo(BW * 0.3, 0); c.lineTo(BW * 0.45, BH / 2); c.lineTo(BW * 0.38, BH); c.moveTo(BW * 0.45, BH / 2); c.lineTo(BW * 0.7, BH / 2 + 3); c.stroke();
              }
            }
          });
        }
        ROWS.forEach(function (c, i) { brick(i, c, false, false); });
        brick('h2', HARD, true, false); brick('h1', HARD2, true, true);
      }

      function hud(g) {
        var bandH = TOP * k, cy = bandH * 0.46, fs = 23 * kk, best = Math.max(ctx.getBest() || 0, w.score);
        ctx.text(g, ctx.comma(w.score), aw / 2, cy, { size: fs, weight: 900, color: '#FFFFFF', shadow: 'rgba(0,0,0,.4)', blur: 4, oy: 1 });
        // best (trophy) on the left, lives (hearts) on the right, like the app's HUD row
        var ph = 24 * kk, bTxt = ctx.comma(best), bf = 13 * kk;
        g.font = ctx.font(bf, 800); var pw = 10 * kk * 2 + 16 * kk + 4 * kk + g.measureText(bTxt).width, px = 10 * kk;
        ctx.rrect(g, px, cy - ph / 2, pw, ph, ph / 2); g.fillStyle = 'rgba(255,122,61,.22)'; g.fill();
        trophy(ctx, g, px + 10 * kk + 8 * kk, cy, 16 * kk, '#FFD43B');
        ctx.text(g, bTxt, px + 10 * kk + 20 * kk, cy + 0.5, { size: bf, weight: 800, color: '#FFFFFF', align: 'left' });
        var hs = 19 * kk;
        for (var i = 0; i < 3; i++) {
          heart(g, aw - 10 * kk - (3 - i) * (hs + 2 * kk), cy - hs / 2, hs);
          if (i < w.lives) { g.fillStyle = '#FF5C7A'; g.fill(); } else { g.lineWidth = 1.6 * kk; g.strokeStyle = 'rgba(255,255,255,.3)'; g.stroke(); }
        }
      }
      function bigText(g, str, y, color, size, sc) {
        g.save(); g.translate(aw / 2, y); g.scale(sc, sc);
        ctx.text(g, str, 0, 0, { size: size, weight: 900, color: color, shadow: 'rgba(0,0,0,.67)', blur: 10, oy: 2, maxW: aw - 24 });
        g.restore();
      }
      function resultCard(g) {
        var CW = ctx.W, CHh = ctx.H, t = Math.min(1, phaseT / 0.3), e = ctx.ease.outBack(t), C = ctx.C;
        g.fillStyle = 'rgba(0,0,0,' + (0.3 * t).toFixed(3) + ')'; ctx.rrect(g, ax, ay, aw, ah, R); g.fill();
        var cw = Math.min(CW - 24, 320), pad = 18, ch = 238, cx = (CW - cw) / 2, cy = (CHh - ch) / 2;
        g.save(); g.globalAlpha = t; g.translate(CW / 2, CHh / 2); g.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e); g.translate(-CW / 2, -CHh / 2);
        g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
        ctx.rrect(g, cx, cy, cw, ch, 24); g.fillStyle = C.surface; g.fill(); g.restore();
        g.lineWidth = 1; g.strokeStyle = C.hair; ctx.rrect(g, cx + 0.5, cy + 0.5, cw - 1, ch - 1, 24); g.stroke();
        var y = cy + pad + 16;
        ctx.text(g, ctx.t(res.isNew ? TX.newBest : TX.over), CW / 2, y, { size: 26, weight: 900, color: C.ink, maxW: cw - pad * 2 });
        y += 28;
        ctx.text(g, ctx.f(TX.summary, ctx.comma(res.score), res.combo), CW / 2, y, { size: 14, weight: 600, color: C.soft, maxW: cw - pad * 2, min: 9 });
        y += 18;
        var bw = (cw - pad * 2 - 10) / 2, bh = 72;
        [[TX.score, ctx.comma(res.score), res.isNew], [TX.best, ctx.comma(res.best), false]].forEach(function (b, i) {
          var bx = cx + pad + i * (bw + 10);
          ctx.rrect(g, bx, y, bw, bh, 16);
          g.fillStyle = b[2] ? ctx.rgba(ctx.color, 0.14) : C.surface; g.fill();
          g.lineWidth = b[2] ? 2 : 1.2; g.strokeStyle = b[2] ? ctx.color : C.hair; g.stroke();
          ctx.text(g, ctx.t(b[0]), bx + bw / 2, y + 20, { size: 12, weight: 700, color: C.soft, maxW: bw - 16 });
          ctx.text(g, b[1], bx + bw / 2, y + 48, { size: 24, weight: 900, color: C.ink, maxW: bw - 16 });
        });
        y += bh + 16;
        var btnW = cw - pad * 2, btnH = 50, bx2 = cx + pad;
        ctx.rrect(g, bx2, y, btnW, btnH, 18); g.fillStyle = ctx.color; g.fill();
        var ink = ctx.inkOn(ctx.color), label = ctx.t(TX.again);
        g.font = ctx.font(17, 800); var lw = Math.min(g.measureText(label).width, btnW - 50), ix = CW / 2 - (lw + 26) / 2;
        g.fillStyle = ink; g.beginPath(); g.moveTo(ix + 3, y + btnH / 2 - 8); g.lineTo(ix + 16, y + btnH / 2); g.lineTo(ix + 3, y + btnH / 2 + 8); g.closePath(); g.fill();
        ctx.text(g, label, ix + 26, y + btnH / 2 + 1, { size: 17, weight: 800, color: ink, align: 'left', maxW: btnW - 50 });
        again = { x: CW / 2, y: y + btnH / 2 };
        g.restore();
      }

      // where the ball will come down (straight-line guess with wall bounces), for the drag hint
      function landingX() {
        var b = null, i;
        for (i = 0; i < w.balls.length; i++) if (!w.balls[i].stuck && w.balls[i].vy > 0 && (!b || w.balls[i].y > b.y)) b = w.balls[i];
        if (!b) return w.px;
        var x = b.x + b.vx / b.vy * (PY - b.y), span = W - 2 * BALL_R;
        x -= BALL_R; x = ((x % (2 * span)) + 2 * span) % (2 * span); if (x > span) x = 2 * span - x;
        return x + BALL_R;
      }

      return {
        layout: function () {
          var r = ctx.fit(9 / 16, { maxW: 520 });
          ax = r.x; ay = r.y; aw = r.w; ah = r.h; k = aw / W;
          kk = ctx.clamp(aw / 330, 0.62, 1.3); R = Math.round(18 * Math.min(1.3, Math.max(0.8, kk)));
          build();
        },

        update: function (dt) {
          time += dt; phaseT += dt;
          if (phase === 'play') {
            var evs = wStep(w, dt);
            for (var i = 0; i < evs.length; i++) onEvent(evs[i]);
            if (w.state === 'over' && overAt >= 0 && time - overAt > 1.5) finish();
            else if (w.state === 'cleared' && clearAt >= 0 && time - clearAt > 1.9) {
              clearAt = -1; loadStage(w, w.stage + 1); ctx.sfx.whoosh(); hintAt = -9;
            }
          } else if (phase === 'result' && phaseT > 3.4) { restart(); ctx.sfx.whoosh(); }
          var j, s;
          for (j = vis.shards.length - 1; j >= 0; j--) { s = vis.shards[j]; s.age += dt; s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; if (s.age >= s.life) vis.shards.splice(j, 1); }
          for (j = vis.floats.length - 1; j >= 0; j--) { s = vis.floats[j]; s.age += dt; s.y -= 34 * dt; if (s.age >= s.life) vis.floats.splice(j, 1); }
          for (j = vis.rings.length - 1; j >= 0; j--) { s = vis.rings[j]; s.age += dt; if (s.age >= s.life) vis.rings.splice(j, 1); }
          vis.shake *= Math.exp(-dt * 9); if (vis.shake < 0.05) vis.shake = 0;
          vis.flash = Math.max(0, vis.flash - dt * 2.4);
        },

        draw: function (g) {
          var i, b, t = time;
          g.save(); g.translate(ax, ay);
          if (!ctx.dark) {
            g.save(); g.shadowColor = 'rgba(16,20,16,.18)'; g.shadowBlur = 22; g.shadowOffsetY = 8;
            ctx.rrect(g, 0, 0, aw, ah, R); g.fillStyle = '#2B1C44'; g.fill(); g.restore();
          }
          ctx.rrect(g, 0, 0, aw, ah, R); g.clip();
          g.drawImage(bg, 0, 0, aw, ah);
          g.save();
          if (vis.shake > 0) g.translate(Math.sin(t * 91) * vis.shake * k, Math.cos(t * 117) * vis.shake * k);
          g.scale(k, k);
          for (i = 0; i < 2; i++) {
            var gx = W * (0.3 + 0.4 * i) + Math.sin(t * 0.3 + i * 2) * 60, gy = H * (0.35 + 0.3 * i) + Math.cos(t * 0.23 + i) * 50, gr = 170 + 20 * Math.sin(t * 0.5 + i);
            g.drawImage(i ? glowB : glowA, gx - gr, gy - gr, gr * 2, gr * 2);
          }
          // bricks (cached sprites) + the shine band + hit flash
          var band = (t % 3.2) / 3.2 * (W + 360) - 180;
          for (i = 0; i < w.bricks.length; i++) {
            var q = w.bricks[i];
            if (q.hp <= 0) continue;
            g.drawImage(bricks[q.max > 1 ? (q.hp > 1 ? 'h2' : 'h1') : q.ci], q.x - 1, q.y - 1, BW + 2, BH + 5);
            var sh = 1 - Math.abs((q.x + BW / 2 + (q.y + BH / 2) * 0.6) - band) / 34, fl = q.flash > 0 ? 0.75 * q.flash : 0;
            if (sh > 0 || fl > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(1, Math.max(0, 0.28 * sh) + fl).toFixed(3) + ')'; ctx.rrect(g, q.x, q.y, BW, BH, 4); g.fill(); }
          }
          // falling items
          for (i = 0; i < w.drops.length; i++) {
            var d = w.drops[i], dc = ITEM[d.kind], pu = 1 + 0.08 * Math.sin(d.age * 10), dw = 30 * pu, dh = 18 * pu;
            g.fillStyle = ctx.rgba(dc, 0.3); ctx.rrect(g, d.x - dw / 2 - 4, d.y - dh / 2 - 4, dw + 8, dh + 8, 13); g.fill();
            g.fillStyle = dc; ctx.rrect(g, d.x - dw / 2, d.y - dh / 2, dw, dh, 9); g.fill();
            g.fillStyle = 'rgba(255,255,255,.35)'; ctx.rrect(g, d.x - dw / 2 + 4, d.y - dh / 2 + 2.5, dw - 8, 4, 2); g.fill();
            g.fillStyle = '#FFFFFF'; g.strokeStyle = '#FFFFFF'; g.lineCap = 'round';
            if (d.kind === 'multi') { for (var m = -1; m <= 1; m++) { dot(g, d.x + m * 7, d.y, 2.6); } }
            else if (d.kind === 'wide') {
              g.lineWidth = 2; g.beginPath(); g.moveTo(d.x - 8, d.y); g.lineTo(d.x + 8, d.y);
              g.moveTo(d.x - 4.5, d.y - 3.5); g.lineTo(d.x - 8, d.y); g.lineTo(d.x - 4.5, d.y + 3.5); g.moveTo(d.x + 4.5, d.y - 3.5); g.lineTo(d.x + 8, d.y); g.lineTo(d.x + 4.5, d.y + 3.5); g.stroke();
            } else { g.lineWidth = 1.8; g.beginPath(); g.arc(d.x, d.y, 5.5, 0, TAU); g.moveTo(d.x, d.y - 3.5); g.lineTo(d.x, d.y); g.lineTo(d.x + 2.8, d.y + 1); g.stroke(); }
          }
          // paddle (glow, base, body, shine, item timers)
          var pc = w.wide > 0 ? '#00C2C7' : '#FF7A3D', pl = w.px - w.pw / 2, pt = PY - PH / 2;
          g.save(); g.shadowColor = ctx.rgba(pc, 0.6); g.shadowBlur = 16 * k * (ctx.dpr || 1);
          g.fillStyle = ctx.rgba(pc, 0.55); ctx.rrect(g, pl - 2, pt - 2, w.pw + 4, PH + 4, PH / 2 + 2); g.fill(); g.restore();
          g.fillStyle = ctx.mix(pc, '#000000', 0.3); ctx.rrect(g, pl, pt + 2, w.pw, PH, PH / 2); g.fill();
          g.fillStyle = pc; ctx.rrect(g, pl, pt, w.pw, PH, PH / 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,.5)'; ctx.rrect(g, pl + 6, pt + 2, w.pw - 12, 3.5, 2); g.fill();
          var by = pt + PH + 6;
          if (w.wide > 0) { g.fillStyle = 'rgba(0,194,199,.85)'; var ww = w.pw * w.wide / WIDE_T; ctx.rrect(g, w.px - ww / 2, by - 1.5, ww, 3, 2); g.fill(); by += 6; }
          if (w.slow > 0) { g.fillStyle = 'rgba(47,200,94,.85)'; var sw = w.pw * w.slow / SLOW_T; ctx.rrect(g, w.px - sw / 2, by - 1.5, sw, 3, 2); g.fill(); }
          // balls with a fading trail and a soft glow
          var slow = w.slow > 0, core = slow ? '#CFFFE0' : '#FFFFFF', glowCol = slow ? '#2FC85E' : '#FFB07A';
          for (i = 0; i < w.balls.length; i++) {
            b = w.balls[i];
            var n = b.trail.length / 2;
            g.fillStyle = glowCol;
            for (var j = 0; j < n; j++) { var f = (j + 1) / (n + 1); g.globalAlpha = 0.32 * f; dot(g, b.trail[j * 2], b.trail[j * 2 + 1], BALL_R * (0.35 + 0.6 * f)); }
            g.globalAlpha = 1;
            g.drawImage(slow ? ballGlowS : ballGlow, b.x - 20, b.y - 20, 40, 40);
            g.fillStyle = core; dot(g, b.x, b.y, BALL_R);
            g.fillStyle = '#FFFFFF'; dot(g, b.x - 1.8, b.y - 1.8, 1.8);
          }
          // rings, shards, floating points
          for (i = 0; i < vis.rings.length; i++) {
            var r = vis.rings[i], rf = r.age / r.life;
            g.globalAlpha = (1 - rf) * 0.9; g.strokeStyle = r.c; g.lineWidth = 3 * (1 - rf) + 0.5;
            g.beginPath(); g.arc(r.x, r.y, 6 + r.r1 * ctx.ease.outQuad(rf), 0, TAU); g.stroke();
          }
          for (i = 0; i < vis.shards.length; i++) {
            var s = vis.shards[i], sf = s.age / s.life;
            g.globalAlpha = clamp(1 - sf * sf, 0, 1); g.fillStyle = s.c;
            g.save(); g.translate(s.x, s.y); g.rotate(s.rot); g.fillRect(-s.s / 2, -s.s * 0.35, s.s, s.s * 0.7); g.restore();
          }
          g.globalAlpha = 1;
          for (i = 0; i < vis.floats.length; i++) {
            var fl2 = vis.floats[i], a = fl2.age / fl2.life, al = a < 0.7 ? 1 : 1 - (a - 0.7) / 0.3, pop = a < 0.15 ? 0.6 + a / 0.15 * 0.5 : a < 0.25 ? 1.1 - (a - 0.15) : 1;
            g.save(); g.translate(fl2.x, fl2.y); g.scale(pop, pop);
            ctx.text(g, fl2.text, 0, 0, { size: fl2.size, weight: 900, color: fl2.c, shadow: 'rgba(0,0,0,.53)', blur: 4 * k, oy: 1.5, alpha: al });
            g.restore();
          }
          g.restore();
          if (vis.flash > 0) { g.fillStyle = ctx.rgba(vis.flashColor, (vis.flash * 0.5).toFixed(3)); g.fillRect(0, 0, aw, ah); }
          if (phase === 'play') {
            hud(g);
            if (w.state === 'over') bigText(g, ctx.t(TX.over), ah * 0.45, '#FF7A8A', 30 * kk, ctx.ease.outBack(Math.min(1, (time - overAt) / 0.25)));
            else if (w.state === 'cleared') bigText(g, ctx.t(TX.clear), ah * 0.55, '#FFD43B', 30 * kk, ctx.ease.outBack(Math.min(1, (time - clearAt) / 0.25)));
            else if (w.state === 'aim') bigText(g, ctx.t(TX.tapLaunch), ah * 0.66, '#FFD0B5', 17 * kk, 1 + 0.08 * Math.sin(time * Math.PI / 0.85));
          }
          g.restore();
          if (phase === 'result') resultCard(g);
        },

        down: function (p) {
          if (phase === 'result') { if (phaseT > 0.45) { restart(); ctx.sfx.whoosh(); ctx.haptic('light'); } return; }
          touches[p.id] = { x: p.x, y: p.y };
          if (primary === null) primary = p.id;
          if (w.state === 'aim') doLaunch();
          else if (w.state === 'play') { ctx.haptic(6); ring(w.px, PY, w.wide > 0 ? '#00C2C7' : '#FF7A3D', 30, 0.3); }
        },
        move: function (p) {
          var t = touches[p.id];
          if (!t) return;
          var dx = p.x - t.x; t.x = p.x; t.y = p.y;
          if (p.id === primary && phase === 'play') movePaddle(w, dx / k * 1.2);
        },
        up: function (p) { delete touches[p.id]; if (p.id === primary) primary = null; },
        key: function (e) {
          if (e.key === 'ArrowLeft') movePaddle(w, -24); else if (e.key === 'ArrowRight') movePaddle(w, 24);
          else if (e.key === ' ' || e.key === 'Enter') { if (phase === 'result') restart(); else doLaunch(); }
        },

        // aim: tap the ball; play: drag the paddle under the ball (refreshed every 1.5 s so it stays still); result: the replay button
        hint: function () {
          if (phase === 'result') return again && phaseT > 0.45 ? { x: again.x, y: again.y } : null;
          if (w.state === 'aim') return { x: ax + w.px * k, y: ay + (REST_Y - 26) * k };
          if (w.state !== 'play') return null;
          for (var id in touches) return null; // a finger is already steering
          if (!hintC || time - hintAt > 1.5) {
            var dx = (landingX() - w.px) * k / 1.2;
            if (Math.abs(dx) < 24) dx = w.px > W / 2 ? -60 : 60;
            hintC = { x: ax + w.px * k, y: ay + (PY + 34) * k, dx: dx, dy: 0 }; hintAt = time;
          }
          return hintC;
        },

        debug: function () {
          var ball = w.balls[0], targets;
          if (phase === 'result') targets = again ? [{ x: Math.round(again.x), y: Math.round(again.y) }] : [];
          else if (w.state === 'aim') targets = [{ x: Math.round(ax + w.px * k), y: Math.round(ay + REST_Y * k) }];
          else targets = [{ x: Math.round(ax + w.px * k), y: Math.round(ay + (PY + 34) * k), dx: Math.round((landingX() - w.px) * k / 1.2), dy: 0 }];
          return {
            phase: phase, state: w.state, score: w.score, lives: w.lives, combo: w.combo, bestCombo: w.bestCombo, left: bricksLeft(w), cleared: w.stage - 1,
            best: ctx.getBest(), balls: w.balls.length,
            ball: ball ? { x: Math.round(ax + ball.x * k), y: Math.round(ay + ball.y * k), vy: Math.round(ball.vy) } : null,
            paddle: { x: Math.round(ax + w.px * k), y: Math.round(ay + PY * k), w: Math.round(w.pw * k) }, gain: +(k / 1.2).toFixed(4),
            arena: { x: ax, y: ay, w: aw, h: ah }, targets: targets
          };
        },

        destroy: function () { bg = glowA = glowB = ballGlow = ballGlowS = null; bricks = {}; vis.shards.length = vis.floats.length = vis.rings.length = 0; }
      };
    }
  };
})();
