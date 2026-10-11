/* 날아라 새(flappy): my_mini flappy.dart 를 옮김(세계 90x160 · 중력 · 틈 · 사탕 기둥 · 노란 새 그림이 앱과 같음). 둥실 준비 → 첫 터치로 출발 → 부딪히면 깃털 · 점수 카드 → 저절로 다시 준비. */
(function () {
  'use strict';

  var TX = {
    tap: { ko: '톡 눌러 날갯짓!', ja: 'タップで羽ばたこう！', en: 'Tap to flap!' },
    newBest: { ko: '새 기록!', ja: 'ベスト更新！', en: 'New best!' },
    over: { ko: '게임 끝', ja: 'ゲームオーバー', en: 'Game over' },
    passed: { ko: '기둥 {0}개를 지났어요', ja: '{0}本の柱をくぐりました', en: 'You flew through {0} gaps' },
    passedOne: { ko: '기둥 1개를 지났어요', ja: '1本の柱をくぐりました', en: 'You flew through 1 gap' },
    zero: { ko: '아까워요! 첫 기둥을 넘어 봐요', ja: '惜しい！最初の柱をこえてみよう', en: 'So close! Try to clear the first gap' },
    score: { ko: '점수', ja: 'スコア', en: 'Score' },
    best: { ko: '최고 기록', ja: 'ベスト', en: 'Best' },
    again: { ko: '다시 하기', ja: 'もう一回', en: 'Play again' }
  };

  var TAU = Math.PI * 2;
  function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  // FlappyWorld 상수(세계 단위)
  var WW = 90, WH = 160, GY = 142, BX = 28, BR = 4.6, PW = 15, CH = 7, CO = 1.6;
  var GRAV = 380, FLAP = -118, MAXF = 170, SPACING = 54, SY = 72;
  var CANDY = ['#FF6FA8', '#3FD6A2', '#FFC93C', '#A77BFF', '#FF8A4C']; // 딸기 · 민트 · 레몬 · 포도 · 귤
  var FAR = [[8, 22, 1], [52, 14, 0.8], [88, 34, 1.2], [128, 20, 0.9]];
  var NEAR = [[20, 52, 1.3], [82, 44, 1], [140, 60, 1.5]];
  var STARS = [[6, 8], [18, 30], [27, 12], [40, 40], [47, 6], [58, 26], [66, 48], [75, 10], [84, 36], [12, 58], [34, 70], [80, 66], [52, 60], [88, 18], [3, 44], [62, 4]];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function gapFor(n) { return n < 3 ? 52 : Math.max(35, 52 - (n - 3) * 0.55); }
  function speedFor(s) { return 42 + Math.min(s, 40) * 0.4; }
  function driftFor(n) { return n < 3 ? 12 : Math.min(46, 12 + (n - 3) * 1.6); }
  function hitRect(cx, cy, r, L, T, R, B) {
    var dx = cx - clamp(cx, L, R), dy = cy - clamp(cy, T, B);
    return dx * dx + dy * dy < r * r;
  }

  /* ---------- rules (FlappyWorld) ---------- */
  function newWorld() {
    return { y: SY, vy: 0, time: 0, scroll: 0, score: 0, spawned: 0, started: false, alive: true, grounded: false, pipes: [], ev: [], toNext: 0, lastGap: 80 };
  }
  function wReset(w) {
    w.started = false; w.alive = true; w.grounded = false; w.y = SY; w.vy = 0; w.time = 0; w.score = 0; w.spawned = 0;
    w.pipes.length = 0; w.ev.length = 0;
  }
  function wStart(w) { wReset(w); w.started = true; w.toNext = 34; w.lastGap = 80; }
  function wFlap(w) { if (!w.alive) return; if (!w.started) wStart(w); w.vy = FLAP; }
  function spawnPipe(w, x) {
    var gap = gapFor(w.spawned), lo = 18 + gap / 2, hi = GY - 16 - gap / 2, d = driftFor(w.spawned);
    var gy = clamp(w.lastGap + (Math.random() * 2 - 1) * d, lo, hi);
    w.lastGap = gy;
    w.pipes.push({ x: x, gapY: gy, gap: gap, color: w.spawned % 5, scored: false });
    w.spawned++;
  }
  function hitsPipe(w, p) {
    if (p.x - CO > BX + BR || p.x + PW + CO < BX - BR) return false;
    var t = p.gapY - p.gap / 2, b = p.gapY + p.gap / 2, r = BR * 0.86, y = w.y;
    return hitRect(BX, y, r, p.x, -80, p.x + PW, t - CH) || hitRect(BX, y, r, p.x - CO, t - CH, p.x + PW + CO, t) ||
      hitRect(BX, y, r, p.x - CO, b, p.x + PW + CO, b + CH) || hitRect(BX, y, r, p.x, b + CH, p.x + PW, GY + 10);
  }
  function die(w, ground) {
    w.alive = false; w.ev.push('hit');
    if (ground) { w.y = GY - BR; w.vy = 0; w.grounded = true; w.ev.push('ground'); } else w.vy = -50;
  }
  function wStep(w, dt) {
    dt = Math.min(dt, 1 / 30);
    if (!w.started) { w.time += dt; w.scroll += 42 * dt; w.y = SY + Math.sin(w.time * 4.5) * 3; return; }
    if (!w.alive) {
      if (w.grounded) return;
      w.vy = Math.min(w.vy + GRAV * 1.3 * dt, MAXF * 1.4); w.y += w.vy * dt;
      if (w.y + BR >= GY) { w.y = GY - BR; w.vy = 0; w.grounded = true; w.ev.push('ground'); }
      return;
    }
    w.time += dt;
    w.vy = Math.min(w.vy + GRAV * dt, MAXF); w.y += w.vy * dt;
    if (w.y - BR < 0) { w.y = BR; if (w.vy < 0) w.vy = 0; }
    var dx = speedFor(w.score) * dt, i, p;
    w.scroll += dx;
    for (i = w.pipes.length - 1; i >= 0; i--) { p = w.pipes[i]; p.x -= dx; if (p.x + PW + CO < -4) w.pipes.splice(i, 1); }
    w.toNext -= dx;
    while (w.toNext <= 0) { spawnPipe(w, WW + 4 + w.toNext); w.toNext += SPACING; }
    for (i = 0; i < w.pipes.length; i++) { p = w.pipes[i]; if (!p.scored && p.x + PW < BX) { p.scored = true; w.score++; w.ev.push('score'); } }
    if (w.y + BR * 0.9 >= GY) { die(w, true); return; }
    for (i = 0; i < w.pipes.length; i++) if (hitsPipe(w, w.pipes[i])) { die(w, false); return; }
  }

  /* ---------- sprites (world units painted at the arena scale) ---------- */
  function stripes(c, x0, y0, x1, y1, period, color) {
    c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip(); c.fillStyle = color; c.beginPath();
    for (var k = Math.floor((x0 + y0) / period) - 1; k * period < x1 + y1 + period; k++) {
      var a = k * period + period / 2, b = (k + 1) * period;
      c.moveTo(a - y0, y0); c.lineTo(b - y0, y0); c.lineTo(b - y1, y1); c.lineTo(a - y1, y1); c.closePath();
    }
    c.fill(); c.restore();
  }
  function cloudShape(c, x, y, k) {
    dot(c, x, y, 5 * k);
    dot(c, x + 5.5 * k, y - 2.5 * k, 6.5 * k);
    dot(c, x + 12 * k, y, 5 * k);
    var L = x - 3 * k, T = y - k, w = 18 * k, h = 6 * k, r = 3 * k;
    c.beginPath(); c.moveTo(L + r, T); c.arcTo(L + w, T, L + w, T + h, r); c.arcTo(L + w, T + h, L, T + h, r); c.arcTo(L, T + h, L, T, r); c.arcTo(L, T, L + w, T, r); c.fill();
  }
  function star4(g, x, y, r) {
    g.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * 0.42 : r; if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  function trophy(ctx, g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.translate(-12, -12);
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(7, 3.5); g.lineTo(17, 3.5); g.lineTo(17, 9.5); g.quadraticCurveTo(17, 14.6, 12, 14.6); g.quadraticCurveTo(7, 14.6, 7, 9.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(7, 5.6); g.lineTo(4.4, 5.6); g.quadraticCurveTo(3.9, 10.6, 7.6, 11.2); g.moveTo(17, 5.6); g.lineTo(19.6, 5.6); g.quadraticCurveTo(20.1, 10.6, 16.4, 11.2); g.stroke();
    g.fillRect(11, 14, 2, 3.6); ctx.rrect(g, 7.4, 17.4, 9.2, 3, 1.2); g.fill();
    g.restore();
  }
  // touch_app icon: a pointing hand with a tap arc
  function touchIcon(ctx, g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.translate(-12, -12);
    g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
    g.lineWidth = 1.8; g.beginPath(); g.arc(10, 6.4, 4.4, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    ctx.rrect(g, 8.4, 4.6, 3.4, 11, 1.7); g.fill();
    ctx.rrect(g, 8.4, 11, 11, 10, [2, 3, 5, 4]); g.fill();
    g.restore();
  }

  GAMES['flappy'] = {
    name: { ko: '날아라 새', ja: 'パタパタバード', en: 'Flap Flap' },
    tip: { ko: '톡톡 눌러 날갯짓, 기둥 사이를 지나가요', ja: 'タップで羽ばたいて、すき間を抜けよう', en: 'Tap to flap through the gaps' },
    color: '#3E9BFF',
    kind: 'arcade',
    make: function (ctx) {
      var ax = 0, ay = 0, aw = 180, ah = 320, s = 2, R = 24, kk = 1, night = ctx.dark;
      var sky = null, ground = null, cloud = null, shafts = [], capsT = [], capsB = [], body = null;
      var GROUND_SPAN = 84, CLOUD_K = 1.5;
      var w = newWorld(), phase = 'ready', phaseT = 0, deadT = 0, lost = false, res = null, again = null;
      var V = { wing: 0, boost: 0, angle: 0, shake: 0, flash: 0, pop: 0, bits: [] };

      function bit(x, y, vx, vy, life, size, color, kind) { if (V.bits.length < 90) V.bits.push({ x: x, y: y, vx: vx, vy: vy, age: 0, life: life, size: size, c: color, kind: kind }); }
      function onFlap() {
        V.boost = 0.26;
        for (var i = 0; i < 3; i++) bit(BX - 4, w.y + 2, -18 - Math.random() * 14, 6 + Math.random() * 14, 0.38, 1.1 + Math.random(), '#FFFFFF', 0);
      }
      function onScore(big) {
        V.pop = 1;
        var n = big ? 16 : 6;
        for (var i = 0; i < n; i++) {
          var a = Math.random() * TAU, sp = (big ? 30 : 18) + Math.random() * 22;
          bit(BX + 3, w.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.3, 1.2 + Math.random() * (big ? 1.6 : 0.8), i % 2 ? '#FFFFFF' : '#FFE066', 1);
        }
      }
      function onHit() {
        V.shake = 1; V.flash = 1;
        for (var i = 0; i < 12; i++) {
          var a = Math.random() * TAU, sp = 16 + Math.random() * 30;
          bit(BX, w.y, Math.cos(a) * sp, Math.sin(a) * sp - 10, 0.9 + Math.random() * 0.4, 1.3 + Math.random() * 0.8, i % 3 === 0 ? '#FFF4CC' : '#FFC928', 2);
        }
      }
      function viewStep(dt) {
        V.wing += dt * (V.boost > 0 ? 30 : (w.alive ? 10 : 0));
        V.boost = Math.max(0, V.boost - dt);
        var target = !w.started ? Math.sin(w.time * 4.5 + 1.2) * 0.1 : !w.alive ? 1.45 : w.vy < 0 ? -0.42 : clamp(w.vy / MAXF * 1.7 - 0.35, -0.42, 1.35);
        var rate = w.vy < 0 || !w.alive ? 16 : 5;
        V.angle += (target - V.angle) * Math.min(1, dt * rate);
        V.shake = Math.max(0, V.shake - dt * 2.6); V.flash = Math.max(0, V.flash - dt * 4.5); V.pop = Math.max(0, V.pop - dt * 4);
        for (var i = V.bits.length - 1; i >= 0; i--) {
          var b = V.bits[i];
          b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.kind === 2) { b.vy += 60 * dt; b.vx *= 1 - dt * 1.5; } else { b.vx *= 1 - dt * 3; b.vy *= 1 - dt * 3; }
          if (b.age >= b.life) V.bits.splice(i, 1);
        }
      }

      function flapFx() { ctx.sfx.swish(); ctx.haptic('light'); }
      function startPlay() {
        wStart(w); wFlap(w); onFlap(); flapFx();
        phase = 'play'; phaseT = 0; res = null;
      }
      function toReady() { wReset(w); V.bits.length = 0; V.angle = 0; V.shake = 0; V.flash = 0; V.pop = 0; phase = 'ready'; phaseT = 0; res = null; again = null; }
      function onDeath() {
        var sc = w.score, before = ctx.getBest() || 0, b = sc > 0 ? ctx.best(sc) : { best: before, isNew: false };
        res = { score: sc, best: Math.max(before, sc), isNew: sc > 0 && b.isNew };
        phase = 'dead'; phaseT = 0; deadT = 0; lost = false;
      }
      function showResult() {
        phase = 'result'; phaseT = 0;
        ctx.sfx.stamp(); ctx.haptic('heavy');
        if (res.isNew) {
          ctx.sfx.win(); ctx.sfx.sparkle(); ctx.haptic('success');
          ctx.fx.burst(ctx.W / 2, ctx.H * 0.45, 70, ctx.PAL, { speed: 700 });
        }
      }
      function events() {
        for (var i = 0; i < w.ev.length; i++) {
          var e = w.ev[i];
          if (e === 'score') {
            var sc = w.score, big = sc % 10 === 0;
            ctx.sfx.note((sc - 1) % 4, 0.8);
            if (big) ctx.sfx.sparkle();
            ctx.haptic(big ? 'medium' : 'light');
            onScore(big);
          } else if (e === 'hit') {
            ctx.sfx.boom(); ctx.haptic('heavy'); onHit(); onDeath();
          } else if (e === 'ground') {
            ctx.sfx.place(0.6); V.shake = Math.max(V.shake, 0.45);
          }
        }
        w.ev.length = 0;
      }

      function build() {
        var gs = s;
        sky = ctx.layer(aw, GY * s + 1, function (c) {
          c.scale(gs, gs);
          var gr = c.createLinearGradient(0, 0, 0, GY);
          var cols = night ? ['#131C45', '#2A3A7A', '#6A5FA6'] : ['#3FA9FF', '#86D0FF', '#DDF4FF'];
          gr.addColorStop(0, cols[0]); gr.addColorStop(0.55, cols[1]); gr.addColorStop(1, cols[2]);
          c.fillStyle = gr; c.fillRect(0, 0, WW, GY + 1);
          c.translate(70, 24);
          var rg = c.createRadialGradient(0, 0, 0, 0, 0, night ? 18 : 20); rg.addColorStop(0, 'rgba(255,255,255,.533)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = rg; dot(c, 0, 0, night ? 18 : 20);
          if (night) {
            c.fillStyle = '#FFF6D6'; dot(c, 0, 0, 7);
            c.fillStyle = 'rgba(128,96,32,.133)'; dot(c, -2.2, -1.5, 1.4); dot(c, 2, 2.4, 1);
          } else {
            c.fillStyle = '#FFF3B0'; dot(c, 0, 0, 8.5);
            c.fillStyle = '#FFE066'; dot(c, 0, 0, 7);
          }
        });
        // ground strip: dirt, striped grass, edge, pebbles (repeats every 84 units)
        ground = ctx.layer((WW + GROUND_SPAN) * s, (WH - GY) * s, function (c) {
          c.scale(gs, gs);
          var L = WW + GROUND_SPAN, H = WH - GY;
          c.fillStyle = night ? '#A88C5C' : '#F2D18C'; c.fillRect(0, 0, L, H);
          c.fillStyle = night ? '#4F9C47' : '#7CD650'; c.fillRect(0, 0, L, 5);
          stripes(c, 0, 0, L, 5, 12, 'rgba(0,68,0,.133)');
          c.fillStyle = night ? '#3A7A36' : '#55AE37'; c.fillRect(0, 5, L, 1.2);
          c.fillStyle = 'rgba(255,255,255,.533)'; c.fillRect(0, 0, L, 0.7);
          c.fillStyle = night ? '#8F7548' : '#DDB66A';
          for (var x = 0; x < L; x += 14) {
            dot(c, x + 3, 10, 1.1);
            dot(c, x + 10, 14.5, 0.8);
            dot(c, x + 6.5, 17, 0.9);
          }
        });
        cloud = ctx.layer(22 * CLOUD_K * s, 14 * CLOUD_K * s, function (c) { c.scale(gs, gs); c.fillStyle = '#FFFFFF'; cloudShape(c, 5 * CLOUD_K, 9 * CLOUD_K, CLOUD_K); });
        // candy pipes: shaft (world y -2..GY+2) and the two caps, one set per colour
        shafts = []; capsT = []; capsB = [];
        CANDY.forEach(function (col) {
          var dark = ctx.shade(col, -0.2), light = ctx.shade(col, 0.1);
          shafts.push(ctx.layer((PW + 1) * s, (GY + 4) * s, function (c) {
            c.scale(gs, gs); c.translate(0.5, 2);
            c.fillStyle = col; c.fillRect(0, -2, PW, GY + 4);
            stripes(c, 0, -2, PW, GY + 2, 10, 'rgba(255,255,255,.4)');
            c.fillStyle = 'rgba(255,255,255,.333)'; c.fillRect(PW * 0.14, -2, PW * 0.16, GY + 4);
            c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(PW * 0.8, -2, PW * 0.2, GY + 4);
            c.strokeStyle = dark; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -2); c.lineTo(0, GY + 2); c.moveTo(PW, -2); c.lineTo(PW, GY + 2); c.stroke();
          }));
          [true, false].forEach(function (top) {
            (top ? capsT : capsB).push(ctx.layer((PW + CO * 2 + 1) * s, (CH + 2) * s, function (c) {
              c.scale(gs, gs); c.translate(0.5, 0.5);
              var cw = PW + CO * 2;
              c.fillStyle = 'rgba(0,0,0,.133)'; ctx.rrect(c, 0, 0.9, cw, CH, 1.8); c.fill();
              c.fillStyle = light; ctx.rrect(c, 0, 0, cw, CH, 1.8); c.fill();
              c.save(); ctx.rrect(c, 0, 0, cw, CH, 1.8); c.clip();
              stripes(c, -CO, 0, cw, CH, 10, 'rgba(255,255,255,.4)');
              c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(cw * 0.12, 0, cw * 0.15, CH);
              c.fillStyle = 'rgba(0,0,0,.133)'; c.fillRect(0, top ? CH - 1.4 : 0, cw, 1.4);
              c.restore();
              c.strokeStyle = dark; c.lineWidth = 0.65; ctx.rrect(c, 0, 0, cw, CH, 1.8); c.stroke();
            }));
          });
        });
      }

      function sprite(g, img, sx, sy, sw, sh, dx, dy, dw, dh, cssW, cssH) {
        var rx = img.width / cssW, ry = img.height / cssH;
        if (sw <= 0 || sh <= 0) return;
        g.drawImage(img, sx * rx, sy * ry, sw * rx, sh * ry, dx, dy, dw, dh);
      }

      // world drawing; g is scaled to world units here
      function drawPipe(g, p) {
        var top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2, img = shafts[p.color], sw = PW + 1, sh = GY + 4;
        var y0 = -2, y1 = top - CH + 0.5;
        if (y1 > y0) sprite(g, img, 0, (y0 + 2) * s, sw * s, (y1 - y0) * s, p.x - 0.5, y0, sw, y1 - y0, sw * s, sh * s);
        y0 = bot + CH - 0.5; y1 = GY + 1;
        if (y1 > y0) sprite(g, img, 0, (y0 + 2) * s, sw * s, (y1 - y0) * s, p.x - 0.5, y0, sw, y1 - y0, sw * s, sh * s);
        var cw = PW + CO * 2 + 1;
        g.drawImage(capsT[p.color], p.x - CO - 0.5, top - CH - 0.5, cw, CH + 2);
        g.drawImage(capsB[p.color], p.x - CO - 0.5, bot - 0.5, cw, CH + 2);
      }
      function drawClouds(g, list, speed, alpha, size) {
        var span = WW + 60;
        g.globalAlpha = alpha;
        for (var i = 0; i < list.length; i++) {
          var q = list[i], k = q[2] * size, x = ((q[0] - w.scroll * speed) % span + span) % span - 30;
          g.drawImage(cloud, x - 5 * k, q[1] - 9 * k, 22 * k, 14 * k);
        }
        g.globalAlpha = 1;
      }
      function drawHills(g) {
        var far = night ? '#2E4775' : '#AEE6D2', near = night ? '#285A5A' : '#83D18A', bush = night ? '#22504D' : '#6CC273';
        for (var l = 0; l < 2; l++) {
          var off = w.scroll * (l === 0 ? 0.15 : 0.38), base = l === 0 ? 112 : 124, amp = l === 0 ? 9 : 6;
          g.beginPath(); g.moveTo(0, GY);
          for (var x = 0; x <= WW + 0.1; x += 3) { var u = x + off; g.lineTo(x, base - amp * (0.6 * Math.sin(u * 0.045 + l) + 0.4 * Math.sin(u * 0.11 + 2 * l))); }
          g.lineTo(WW, GY); g.closePath(); g.fillStyle = l === 0 ? far : near; g.fill();
        }
        var o = (w.scroll * 0.6) % 36;
        g.fillStyle = bush; g.beginPath();
        for (var bx = -o - 6; bx < WW + 10; bx += 36) {
          g.moveTo(bx + 5, GY - 1); g.arc(bx, GY - 1, 5, 0, TAU);
          g.moveTo(bx + 12.5, GY - 2.5); g.arc(bx + 6, GY - 2.5, 6.5, 0, TAU);
          g.moveTo(bx + 17.5, GY - 0.5); g.arc(bx + 13, GY - 0.5, 4.5, 0, TAU);
        }
        g.fill();
      }
      function drawBits(g, behind) {
        for (var i = 0; i < V.bits.length; i++) {
          var b = V.bits[i];
          if ((b.kind === 0) !== behind) continue;
          var k = 1 - b.age / b.life;
          g.globalAlpha = clamp(k * 1.4, 0, 1) * (b.kind === 0 ? 0.8 : 1); g.fillStyle = b.c;
          if (b.kind === 0) { dot(g, b.x, b.y, b.size * (1.4 - 0.6 * k)); }
          else if (b.kind === 1) star4(g, b.x, b.y, b.size * (0.6 + 0.6 * k));
          else { g.save(); g.translate(b.x, b.y); g.rotate(b.age * 7 + b.size); g.beginPath(); g.ellipse(0, 0, b.size * 1.1, b.size * 0.5, 0, 0, TAU); g.fill(); g.restore(); }
        }
        g.globalAlpha = 1;
      }
      function drawBird(g) {
        var alive = w.alive, r = 5.3, line = '#D9820A';
        g.save(); g.translate(BX, w.y); g.rotate(V.angle);
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-r * 0.6, -0.8); g.lineTo(-r - 2.6, -2.8); g.lineTo(-r - 1.6, 0.1); g.lineTo(-r - 2.7, 2.4); g.lineTo(-r * 0.6, 1.2); g.closePath();
        g.fillStyle = '#FFA91F'; g.fill(); g.lineWidth = 0.45; g.strokeStyle = line; g.stroke();
        g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = body; g.fill(); g.lineWidth = 0.55; g.stroke();
        g.beginPath(); g.ellipse(0.9, 2.4, 3.2, 2, 0, 0, TAU); g.fillStyle = '#FFF5D1'; g.fill();
        g.beginPath(); g.arc(3, 1.5, 1.05, 0, TAU); g.fillStyle = 'rgba(255,127,165,.6)'; g.fill();
        g.beginPath(); g.arc(2.3, -1.7, 2.1, 0, TAU); g.fillStyle = '#FFFFFF'; g.fill(); g.lineWidth = 0.35; g.stroke();
        if (alive) {
          g.beginPath(); g.arc(2.95, -1.55, 1.1, 0, TAU); g.fillStyle = '#2A2A33'; g.fill();
          g.beginPath(); g.arc(3.3, -2, 0.42, 0, TAU); g.fillStyle = '#FFFFFF'; g.fill();
        } else {
          g.strokeStyle = '#2A2A33'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(1.4, -2.6); g.lineTo(3.2, -0.8); g.moveTo(3.2, -2.6); g.lineTo(1.4, -0.8); g.stroke();
        }
        var open = alive ? V.boost * 2.2 : 0.6;
        g.beginPath(); g.moveTo(4.2, 0.5 + open * 0.2); g.lineTo(6.9, 0.7 + open * 0.5); g.quadraticCurveTo(5.8, 2 + open * 0.4, 4, 1.6); g.closePath(); g.fillStyle = '#FF6F2B'; g.fill();
        g.beginPath(); g.moveTo(4, -1); g.quadraticCurveTo(7.9, -0.6, 7.6, 0.35); g.lineTo(4.2, 0.4); g.closePath(); g.fillStyle = '#FF8F3A'; g.fill();
        g.strokeStyle = '#D9620A'; g.lineWidth = 0.35; g.stroke();
        g.translate(-1.2, 0.8); g.rotate(Math.sin(V.wing) * 0.8 - 0.1);
        g.beginPath(); g.ellipse(-1.9, 0, 2.7, 1.7, 0, 0, TAU); g.fillStyle = '#FFF0B0'; g.fill(); g.strokeStyle = line; g.lineWidth = 0.45; g.stroke();
        g.beginPath(); g.moveTo(-3.6, 0.2); g.lineTo(-1.2, 0.4); g.strokeStyle = 'rgba(217,130,10,.4)'; g.lineWidth = 0.35; g.stroke();
        g.restore();
      }

      function bestPill(g) {
        var best = ctx.getBest(), label = ctx.t(TX.best) + ' ' + ctx.comma(best || 0), fs = 13 * kk, h = 26 * kk, pad = 10 * kk, iw = 16 * kk;
        g.font = ctx.font(fs, 800);
        var tw = Math.min(g.measureText(label).width, aw * 0.6), pw = pad * 2 + iw + 5 * kk + tw, x = 10 * kk, y = 10 * kk;
        ctx.rrect(g, x, y, pw, h, h / 2); g.fillStyle = 'rgba(0,0,0,.2)'; g.fill();
        trophy(ctx, g, x + pad + iw / 2, y + h / 2, iw, '#FFE066');
        ctx.text(g, label, x + pad + iw + 5 * kk, y + h / 2 + 0.5, { size: fs, weight: 800, color: '#FFFFFF', align: 'left', maxW: aw * 0.6 });
      }
      function readyUi(g) {
        var cy = ah * 0.66, bounce = (Math.sin(w.time * 7) + 1) / 2, cr = 32 * kk, top = cy - (64 + 14 + 42) * kk / 2;
        if (ctx.touched()) {
          var ccy = top + cr - 8 * kk * bounce;
          g.save(); g.shadowColor = 'rgba(0,0,0,.2)'; g.shadowBlur = 12; g.shadowOffsetY = 5;
          g.beginPath(); g.arc(aw / 2, ccy, cr, 0, TAU); g.fillStyle = 'rgba(255,255,255,.92)'; g.fill(); g.restore();
          touchIcon(ctx, g, aw / 2, ccy, 36 * kk, '#3E9BFF');
        }
        var label = ctx.t(TX.tap), fs = 22 * kk, ph = 42 * kk, py = top + (64 + 14) * kk;
        fs = ctx.fitFont(g, label, aw - 32 - 36 * kk, fs, 900, 12);
        g.font = ctx.font(fs, 900);
        var pw = Math.min(aw - 32, g.measureText(label).width + 36 * kk);
        ctx.rrect(g, aw / 2 - pw / 2, py, pw, ph, ph / 2); g.fillStyle = 'rgba(29,63,115,.3)'; g.fill();
        ctx.text(g, label, aw / 2, py + ph / 2 + 1, { size: fs, weight: 900, color: '#FFFFFF', shadow: 'rgba(29,63,115,.67)', blur: 0, oy: 2 });
      }
      function hintPoint() { var top = ah * 0.66 - (64 + 14 + 42) * kk / 2; return { x: ax + aw / 2, y: ay + top + 32 * kk }; }

      // score card over the whole play area (the app shows ResultView over the game)
      function resultCard(g) {
        var W = ctx.W, H = ctx.H, t = Math.min(1, phaseT / 0.3), e = ctx.ease.outBack(t), C = ctx.C;
        g.fillStyle = 'rgba(0,0,0,' + (0.3 * t).toFixed(3) + ')'; ctx.rrect(g, ax, ay, aw, ah, R); g.fill();
        var cw = Math.min(W - 24, 320), pad = 18, ch = 238, cx = (W - cw) / 2, cy = (H - ch) / 2;
        g.save(); g.globalAlpha = t; g.translate(W / 2, H / 2); g.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e); g.translate(-W / 2, -H / 2);
        g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
        ctx.rrect(g, cx, cy, cw, ch, 24); g.fillStyle = C.surface; g.fill(); g.restore();
        g.lineWidth = 1; g.strokeStyle = C.hair; ctx.rrect(g, cx + 0.5, cy + 0.5, cw - 1, ch - 1, 24); g.stroke();
        var y = cy + pad + 16, sub = res.score === 0 ? ctx.t(TX.zero) : res.score === 1 ? ctx.t(TX.passedOne) : ctx.f(TX.passed, res.score);
        ctx.text(g, ctx.t(res.isNew ? TX.newBest : TX.over), W / 2, y, { size: 26, weight: 900, color: C.ink, maxW: cw - pad * 2 });
        y += 28;
        ctx.text(g, sub, W / 2, y, { size: 14, weight: 600, color: C.soft, maxW: cw - pad * 2, min: 9 });
        y += 18;
        var bw = (cw - pad * 2 - 10) / 2, bh = 72;
        [[TX.score, ctx.comma(res.score), false], [TX.best, ctx.comma(res.best), res.isNew]].forEach(function (b, i) {
          var bx = cx + pad + i * (bw + 10);
          ctx.rrect(g, bx, y, bw, bh, 16);
          g.fillStyle = b[2] ? 'rgba(255,176,32,.16)' : C.surface; g.fill();
          g.lineWidth = b[2] ? 2 : 1.2; g.strokeStyle = b[2] ? '#FFB020' : C.hair; g.stroke();
          ctx.text(g, ctx.t(b[0]), bx + bw / 2, y + 20, { size: 12, weight: 700, color: C.soft, maxW: bw - 16 });
          ctx.text(g, b[1], bx + bw / 2, y + 48, { size: 26, weight: 900, color: C.ink, maxW: bw - 16 });
        });
        y += bh + 16;
        var btnW = cw - pad * 2, btnH = 50, bx2 = cx + pad;
        ctx.rrect(g, bx2, y, btnW, btnH, 18); g.fillStyle = ctx.color; g.fill();
        var ink = ctx.inkOn(ctx.color), label = ctx.t(TX.again);
        g.font = ctx.font(17, 800); var lw = Math.min(g.measureText(label).width, btnW - 50), ix = W / 2 - (lw + 26) / 2;
        g.fillStyle = ink; g.beginPath(); g.moveTo(ix + 3, y + btnH / 2 - 8); g.lineTo(ix + 16, y + btnH / 2); g.lineTo(ix + 3, y + btnH / 2 + 8); g.closePath(); g.fill();
        ctx.text(g, label, ix + 26, y + btnH / 2 + 1, { size: 17, weight: 800, color: ink, align: 'left', maxW: btnW - 50 });
        again = { x: W / 2, y: y + btnH / 2 };
        g.restore();
      }

      function flap() {
        if (phase === 'ready') { startPlay(); return; }
        if (phase === 'play') { wFlap(w); onFlap(); flapFx(); }
      }

      return {
        layout: function () {
          var r = ctx.fit(9 / 16, { maxW: 520 });
          ax = r.x; ay = r.y; aw = r.w; ah = r.h; s = aw / WW;
          kk = ctx.clamp(aw / 300, 0.72, 1.25); R = Math.round(24 * Math.min(1, kk + 0.15));
          night = ctx.dark;
          body = null;
          build();
        },

        update: function (dt) {
          phaseT += dt;
          if (phase !== 'result') {
            var n = dt > 1 / 50 ? 2 : 1;
            for (var i = 0; i < n; i++) wStep(w, dt / n);
            viewStep(dt);
            if (w.ev.length) events();
          }
          if (phase === 'dead') {
            deadT += dt;
            if (!lost && (w.grounded || deadT > 0.5)) { lost = true; ctx.sfx.lose(); }
            if (w.grounded && deadT > 1.15) showResult();
          } else if (phase === 'result' && phaseT > 3.4) { toReady(); ctx.sfx.whoosh(); }
        },

        draw: function (g) {
          if (!body) {
            body = g.createRadialGradient(-1.89, -2.43, 0, -1.89, -2.43, 10.26);
            body.addColorStop(0, '#FFF09A'); body.addColorStop(0.6, '#FFCB2E'); body.addColorStop(1, '#FFA91F');
          }
          g.save(); g.translate(ax, ay);
          if (!ctx.dark) {
            g.save(); g.shadowColor = 'rgba(16,20,16,.16)'; g.shadowBlur = 22; g.shadowOffsetY = 8;
            ctx.rrect(g, 0, 0, aw, ah, R); g.fillStyle = '#86D0FF'; g.fill(); g.restore();
          }
          ctx.rrect(g, 0, 0, aw, ah, R); g.clip();
          g.save();
          if (V.shake > 0) { var sk = V.shake * V.shake * 2.6 * s; g.translate((Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk); }
          g.drawImage(sky, 0, 0, aw, GY * s + 1);
          g.scale(s, s);
          if (night) {
            g.fillStyle = '#FFFFFF';
            for (var i = 0; i < STARS.length; i++) {
              var tw = 0.5 + 0.5 * Math.sin(w.time * 2 + i * 1.7);
              g.globalAlpha = 0.4 + 0.5 * tw; dot(g, STARS[i][0], STARS[i][1], 0.35 + 0.35 * tw);
            }
            g.globalAlpha = 1;
          }
          drawClouds(g, FAR, 0.12, night ? 0.25 : 0.55, 0.8);
          drawHills(g);
          drawClouds(g, NEAR, 0.3, night ? 0.3 : 0.9, 1);
          for (var p = 0; p < w.pipes.length; p++) drawPipe(g, w.pipes[p]);
          g.drawImage(ground, -(w.scroll % GROUND_SPAN), GY, WW + GROUND_SPAN, WH - GY);
          drawBits(g, true);
          drawBird(g);
          drawBits(g, false);
          g.restore();
          if (w.started) {
            var pop = 1 + 0.35 * ctx.ease.outQuad(V.pop);
            g.save(); g.translate(aw / 2, ah * 0.12); g.scale(pop, pop);
            ctx.text(g, String(w.score), 0, 0, { size: s * 15, weight: 800, color: '#FFFFFF', stroke: '#23426E', lw: s * 15 * 0.16 });
            g.restore();
          }
          if (V.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + (V.flash * 0.75).toFixed(3) + ')'; g.fillRect(0, 0, aw, ah); }
          if (phase !== 'result') bestPill(g);
          if (phase === 'ready') readyUi(g);
          g.restore();
          if (phase === 'result') resultCard(g);
        },

        down: function (p) {
          if (phase === 'dead') return;
          if (phase === 'result') { if (phaseT > 0.45) { toReady(); startPlay(); } return; }
          flap();
        },
        key: function (e) { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') this.down({ id: 0, x: ax + aw / 2, y: ay + ah / 2 }); },

        hint: function () {
          if (phase === 'ready') return hintPoint();
          return phase === 'result' && again && phaseT > 0.45 ? { x: again.x, y: again.y } : null;
        },

        debug: function () {
          var next = null;
          for (var i = 0; i < w.pipes.length; i++) { var q = w.pipes[i]; if (q.x + PW + CO >= BX - BR) { next = q; break; } }
          var tgt = phase === 'result' && again ? again : { x: ax + aw / 2, y: ay + ah * 0.5 };
          return {
            phase: phase, score: w.score, best: ctx.getBest(), started: w.started, alive: w.alive,
            bird: { x: Math.round(ax + BX * s), y: Math.round(ay + w.y * s), vy: Math.round(w.vy) },
            gap: next ? { x: Math.round(ax + next.x * s), top: Math.round(ay + (next.gapY - next.gap / 2) * s), bottom: Math.round(ay + (next.gapY + next.gap / 2) * s), mid: Math.round(ay + next.gapY * s) } : null,
            arena: { x: ax, y: ay, w: aw, h: ah }, scale: +s.toFixed(3),
            targets: [{ x: Math.round(tgt.x), y: Math.round(tgt.y) }]
          };
        },

        destroy: function () { sky = ground = cloud = null; shafts = capsT = capsB = []; V.bits.length = 0; }
      };
    }
  };
})();
