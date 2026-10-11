/* 과일 자르기 (slice): my_mini/lib/games/list/slice.dart 를 옮긴 것(나무판 바탕 · 얼굴 있는 과일 다섯 · 폭탄 · 빛나는 칼 자국 · 즙 · 콤보 규칙이 앱과 같다).
   플레이어블: 처음 닿기 전엔 구경 판(과일이 하나씩 가운데로 떠오르고, 놓쳐도 괜찮다. 힌트는 그 자리를 긋는다)
   → 첫 터치로 판 시작 → 폭탄 '펑!' 또는 셋 놓치면 '게임 끝' → 결과 카드(새 기록이면 색종이) → 4초 뒤 다시 구경 판(카드를 누르면 바로 새 판). */
(function () {
  'use strict';

  var TX = {
    combo: { ko: '{0} 콤보! +{0}', ja: '{0}コンボ！+{0}', en: '{0} combo! +{0}' },
    boom: { ko: '펑!', ja: 'ドカン！', en: 'Boom!' },
    over: { ko: '게임 끝', ja: 'ゲームオーバー', en: 'Game over' },
    missed: { ko: '3개를 놓쳤어요', ja: '3個逃しました', en: 'Missed 3 fruits' },
    summary: { ko: '과일 {0}개 · 최고 콤보 {1}', ja: '果物{0}個・最大コンボ{1}', en: 'Fruits: {0} · Best combo: {1}' },
    newBest: { ko: '새 기록!', ja: '新記録！', en: 'New best!' },
    score: { ko: '점수', ja: 'スコア', en: 'Score' },
    best: { ko: '최고 기록', ja: 'ベスト', en: 'Best' },
    again: { ko: '다시 하기', ja: 'もう一回', en: 'Play again' }
  };

  var TAU = Math.PI * 2, PI = Math.PI;
  var ASPECT = 0.6, G = 2.2, HH = 1 / ASPECT, MAX_MISS = 3;
  var FRUITS = ['watermelon', 'orange', 'apple', 'banana', 'strawberry'];
  var RAD = { watermelon: 0.118, orange: 0.088, apple: 0.085, banana: 0.092, strawberry: 0.074, bomb: 0.082 };
  var JUICE = { watermelon: '#FF4057', orange: '#FF9F1C', apple: '#FFE08A', banana: '#FFF0A8', strawberry: '#FF2E63', bomb: '#2B2B36' };
  var HALF = {
    watermelon: ['#2FA84F', '#E8F5D0', '#FF4D5E'], orange: ['#FF9A1F', '#FFE6B8', '#FFB347'], apple: ['#E8394B', '#FFF6E0', '#FFF1D6'],
    banana: ['#FFD43B', '#FFF6D5', '#FFF6D5'], strawberry: ['#FF3B5C', '#FF8FA3', '#FFD1DA']
  };
  var PLANKS = ['#B57B45', '#A86F3C', '#BC844D', '#A2693A', '#B37944'];
  // the demo throw peaks here (unit = arena width): the hint swipe goes right through it
  var DEMO_APEX = HH * 0.6, HINT_A = [0.18, 0.74], HINT_B = [0.82, 0.6];

  /* ---------- rules (SliceRules / SliceScore) ---------- */
  function gap(t) { return Math.max(0.85, 1.7 - t * 0.02); }
  function bombChance(t) { return t < 6 ? 0 : Math.min(0.32, 0.1 + (t - 6) * 0.004); }
  function maxSize(t) { return Math.min(6, 2 + Math.floor(t / 9)); }
  function launch(delay, kind, x0, apex, xa, spin) {
    var r = RAD[kind], y0 = HH + r, rise = y0 - (HH - apex), vy = -Math.sqrt(2 * G * rise), tp = -vy / G;
    return { delay: delay, kind: kind, x: x0, y: y0, vx: (xa - x0) / tp, vy: vy, spin: spin };
  }
  function wave(t, demo) {
    var n = demo ? 1 : t < 2.5 ? 1 : 1 + Math.floor(Math.random() * maxSize(t));
    var chain = !demo && n >= 3 && Math.random() < 0.4, ltr = Math.random() < 0.5, bombs = demo ? 0 : n <= 3 ? 1 : 2, fruits = 0, out = [];
    for (var i = 0; i < n; i++) {
      var kind = FRUITS[Math.floor(Math.random() * 5)], x0, xa, apex = HH * (0.5 + 0.35 * Math.random());
      if (!(i === n - 1 && fruits === 0) && bombs > 0 && Math.random() < bombChance(t)) { kind = 'bomb'; bombs--; } else fruits++;
      if (demo) { x0 = 0.28 + 0.44 * Math.random(); xa = 0.5 + (Math.random() - 0.5) * 0.1; apex = DEMO_APEX; }
      else if (chain) { var f = i / (n - 1); x0 = 0.15 + 0.7 * (ltr ? f : 1 - f); xa = Math.min(0.8, Math.max(0.2, x0 + (Math.random() - 0.5) * 0.2)); }
      else { x0 = 0.12 + 0.76 * Math.random(); xa = 0.22 + 0.56 * Math.random(); }
      out.push(launch(chain ? i * 0.2 : Math.random() * 0.12, kind, x0, apex, xa, (Math.random() < 0.5 ? 1 : -1) * (1.5 + 2.5 * Math.random())));
    }
    return out;
  }
  function segHits(ax, ay, bx, by, cx, cy, r) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = 0;
    if (l2 > 0) t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / l2));
    var qx = ax + dx * t - cx, qy = ay + dy * t - cy;
    return qx * qx + qy * qy <= r * r;
  }

  /* ---------- fruit painters (slice.dart _drawWhole / _drawHalf / _face / _shine) ---------- */
  function oval(g, x, y, w, h) { g.beginPath(); g.ellipse(x, y, w / 2, h / 2, 0, 0, TAU); }
  function circ(g, x, y, r, col) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = col; g.fill(); }
  function face(g, r, y) {
    var s = r;
    [-1, 1].forEach(function (side) {
      circ(g, side * s * 0.28, y - s * 0.02, s * 0.085, '#2A1A12');
      circ(g, side * s * 0.28 - s * 0.025, y - s * 0.05, s * 0.03, '#FFFFFF');
      oval(g, side * s * 0.47, y + s * 0.17, s * 0.2, s * 0.11); g.fillStyle = 'rgba(255,127,160,.53)'; g.fill();
    });
    g.beginPath(); g.ellipse(0, y + s * 0.13, s * 0.1, s * 0.07, 0, 0.2, PI - 0.2);
    g.lineWidth = s * 0.05; g.lineCap = 'round'; g.strokeStyle = '#2A1A12'; g.stroke();
  }
  function shine(g, r) {
    g.beginPath(); g.arc(0, 0, r * 0.72, PI * 1.08, PI * 1.44);
    g.lineWidth = r * 0.12; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.45)'; g.stroke();
  }
  function stem(g, x1, y1, x2, y2, w) {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineWidth = w; g.lineCap = 'round'; g.strokeStyle = '#6B4226'; g.stroke();
  }
  function leaf(g, r, x0, y0, cx, cy, x1, y1, bx, by) {
    g.beginPath(); g.moveTo(r * x0, r * y0); g.quadraticCurveTo(r * cx, r * cy, r * x1, r * y1); g.quadraticCurveTo(r * bx, r * by, r * x0, r * y0);
    g.closePath(); g.fillStyle = '#3FBF5A'; g.fill();
  }
  function drawWhole(g, k, r) {
    if (k === 'watermelon') {
      circ(g, 0, 0, r, '#35B24F');
      g.save(); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
      g.lineWidth = r * 0.16; g.strokeStyle = '#1F7A36';
      for (var i = -3; i <= 3; i++) {
        var x = i * r * 0.34; g.beginPath(); g.moveTo(x, -r);
        for (var q = 0; q < 6; q++) { var y0 = -r + q * r / 3; g.quadraticCurveTo(x + (q % 2 ? -r * 0.09 : r * 0.09), y0 + r / 6, x, y0 + r / 3); }
        g.stroke();
      }
      g.restore();
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.lineWidth = r * 0.06; g.strokeStyle = '#1C6B30'; g.stroke();
      shine(g, r); face(g, r * 0.8, r * 0.05);
    } else if (k === 'orange') {
      circ(g, 0, 0, r, '#FF9A1F');
      for (var j = 0; j < 9; j++) { var a = j * 2.4, d = r * (0.3 + 0.55 * ((j * 37) % 10) / 10); circ(g, Math.cos(a) * d, Math.sin(a) * d, r * 0.035, 'rgba(179,90,0,.2)'); }
      shine(g, r); stem(g, 0, -r * 0.92, r * 0.05, -r * 1.12, r * 0.1);
      leaf(g, r, 0.05, -1.05, 0.45, -1.4, 0.75, -1.05, 0.4, -0.85); face(g, r * 0.85, r * 0.05);
    } else if (k === 'apple') {
      circ(g, -r * 0.3, -r * 0.05, r * 0.78, '#E8394B'); circ(g, r * 0.3, -r * 0.05, r * 0.78, '#E8394B'); circ(g, 0, r * 0.15, r * 0.8, '#E8394B');
      shine(g, r * 0.95); stem(g, 0, -r * 0.6, r * 0.08, -r * 1.05, r * 0.12);
      leaf(g, r, 0.08, -0.92, 0.5, -1.3, 0.8, -0.92, 0.45, -0.7); face(g, r * 0.85, r * 0.12);
    } else if (k === 'banana') {
      g.beginPath(); g.moveTo(-r, -r * 0.3); g.quadraticCurveTo(0, r * 1.45, r, -r * 0.3); g.quadraticCurveTo(0, r * 0.12, -r, -r * 0.3); g.closePath();
      g.fillStyle = '#FFD43B'; g.fill();
      g.beginPath(); g.moveTo(-r * 0.8, -r * 0.12); g.quadraticCurveTo(0, r * 0.75, r * 0.8, -r * 0.12); g.lineWidth = r * 0.05; g.strokeStyle = '#E0A800'; g.stroke();
      circ(g, -r, -r * 0.3, r * 0.08, '#6B4A2A');
      g.fillStyle = '#8A6A2E'; g.beginPath(); g.roundRect ? g.roundRect(r * 0.95, -r * 0.54, r * 0.14, r * 0.28, r * 0.05) : g.rect(r * 0.95, -r * 0.54, r * 0.14, r * 0.28); g.fill();
      face(g, r * 0.62, r * 0.22);
    } else if (k === 'strawberry') {
      g.beginPath(); g.moveTo(0, r * 0.95);
      g.bezierCurveTo(-r * 0.9, r * 0.55, -r * 1.05, -r * 0.35, -r * 0.55, -r * 0.7); g.quadraticCurveTo(0, -r * 0.95, r * 0.55, -r * 0.7);
      g.bezierCurveTo(r * 1.05, -r * 0.35, r * 0.9, r * 0.55, 0, r * 0.95); g.closePath(); g.fillStyle = '#FF3B5C'; g.fill();
      [[-0.5, -0.2], [0.5, -0.2], [-0.3, 0.45], [0.3, 0.45], [0, 0.7], [-0.62, 0.15], [0.62, 0.15]].forEach(function (s) { oval(g, s[0] * r, s[1] * r, r * 0.08, r * 0.12); g.fillStyle = '#FFE066'; g.fill(); });
      g.fillStyle = '#2FA84F';
      for (var m = 0; m < 5; m++) {
        var an = PI / 2 + (m - 2) * 0.72, dx = Math.cos(an), dy = Math.sin(an), sx = -dy * r * 0.11, sy = dx * r * 0.11, cy0 = -r * 0.72;
        g.beginPath(); g.moveTo(sx, cy0 + sy); g.lineTo(dx * r * 0.42, cy0 + dy * r * 0.42); g.lineTo(-sx, cy0 - sy); g.closePath(); g.fill();
      }
      circ(g, 0, -r * 0.78, r * 0.12, '#2FA84F'); shine(g, r * 0.8); face(g, r * 0.75, r * 0.05);
    }
  }
  function drawBomb(g, r, t) {
    var p = 0.5 + 0.5 * Math.sin(t * 12);
    g.beginPath(); g.arc(0, 0, r * (1.12 + 0.08 * p), 0, TAU); g.lineWidth = r * 0.08; g.strokeStyle = 'rgba(255,59,78,' + (0.35 + 0.35 * p).toFixed(3) + ')'; g.stroke();
    circ(g, 0, 0, r, '#2B2B36'); circ(g, -r * 0.35, -r * 0.35, r * 0.22, 'rgba(255,255,255,.25)');
    g.fillStyle = '#7A7F8C'; g.fillRect(r * 0.14, -r * 1.06, r * 0.42, r * 0.28);
    g.beginPath(); g.moveTo(r * 0.42, -r * 1.02); g.quadraticCurveTo(r * 0.7, -r * 1.45, r * 0.95, -r * 1.25);
    g.lineWidth = r * 0.09; g.lineCap = 'round'; g.strokeStyle = '#C9A27A'; g.stroke();
    circ(g, r * 0.95, -r * 1.25, r * (0.22 + 0.1 * p), 'rgba(255,176,32,.53)'); circ(g, r * 0.95, -r * 1.25, r * (0.1 + 0.05 * p), '#FFF3B0');
    g.lineWidth = r * 0.1; g.strokeStyle = '#FF4D5E';
    [-1, 1].forEach(function (s) {
      circ(g, s * r * 0.32, r * 0.1, r * 0.16, '#FFFFFF'); circ(g, s * r * 0.29, r * 0.14, r * 0.07, '#1B1B26');
      g.beginPath(); g.moveTo(s * r * 0.52, -r * 0.14); g.lineTo(s * r * 0.14, -r * 0.02); g.stroke();
    });
  }
  function drawHalf(g, k, r) {
    var c = HALF[k], rr = k === 'banana' ? r * 0.6 : r;
    [1, 0.9, 0.8].forEach(function (f, i) { g.beginPath(); g.moveTo(-rr * f, 0); g.arc(0, 0, rr * f, PI, TAU); g.closePath(); g.fillStyle = c[i]; g.fill(); });
    var i;
    if (k === 'watermelon') for (i = 0; i < 5; i++) { var a = PI + (i + 0.5) * PI / 5; oval(g, Math.cos(a) * rr * 0.5, Math.sin(a) * rr * 0.5, rr * 0.07, rr * 0.12); g.fillStyle = '#2A1A12'; g.fill(); }
    else if (k === 'orange') {
      g.beginPath(); for (i = 1; i < 5; i++) { var b = PI + i * PI / 5; g.moveTo(0, 0); g.lineTo(Math.cos(b) * rr * 0.78, Math.sin(b) * rr * 0.78); }
      g.lineWidth = rr * 0.04; g.strokeStyle = 'rgba(255,255,255,.8)'; g.stroke();
    } else if (k === 'apple') { oval(g, -rr * 0.14, -rr * 0.2, rr * 0.1, rr * 0.18); g.fillStyle = '#6B4226'; g.fill(); oval(g, rr * 0.14, -rr * 0.2, rr * 0.1, rr * 0.18); g.fill(); }
    else if (k === 'banana') for (i = -1; i <= 1; i++) circ(g, i * 0.18 * rr, -rr * 0.22, rr * 0.05, '#B88A3A');
    else { oval(g, 0, -rr * 0.25, rr * 0.35, rr * 0.4); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); }
  }

  function iconTrophy(ctx, g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.translate(-12, -12);
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(7, 3.5); g.lineTo(17, 3.5); g.lineTo(17, 9.5); g.quadraticCurveTo(17, 14.6, 12, 14.6); g.quadraticCurveTo(7, 14.6, 7, 9.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(7, 5.6); g.lineTo(4.4, 5.6); g.quadraticCurveTo(3.9, 10.6, 7.6, 11.2); g.moveTo(17, 5.6); g.lineTo(19.6, 5.6); g.quadraticCurveTo(20.1, 10.6, 16.4, 11.2); g.stroke();
    g.fillRect(11, 14, 2, 3.6); ctx.rrect(g, 7.4, 17.4, 9.2, 3, 1.2); g.fill();
    g.restore();
  }

  GAMES['slice'] = {
    name: { ko: '과일 자르기', ja: 'フルーツカット', en: 'Fruit Slice' },
    tip: { ko: '쓱 그어 자르고, 폭탄은 피해요!', ja: 'スッと切って、爆弾はよけて！', en: 'Swipe to slice, dodge the bombs!' },
    color: '#E5484D',
    kind: 'arcade',
    make: function (ctx) {
      var ax = 0, ay = 0, aw = 300, ah = 500, k = 1, R = 26, bg = null, spr = {}, halfSpr = {};
      var phase = 'ready', phaseT = 0, clock = 0, playT = 0, waveIn = 0.4, queue = [], queueT = 0;
      var score = 0, sliced = 0, misses = 0, bestCombo = 0, bombed = false, res = null, again = null, missAt = [9, 9, 9];
      var fruits = [], halves = [], drops = [], splats = [], swipes = {}, missMarks = [];
      var shakeT = 0, flashT = 0, missFlash = 0, fuseT = 0, banner = '';

      function U(p) { return { x: (p.x - ax) / aw, y: (p.y - ay) / aw }; }

      function sprites() {
        spr = {}; halfSpr = {};
        FRUITS.forEach(function (kd) {
          var r = RAD[kd] * aw, s = Math.ceil(r * 3.3);
          spr[kd] = ctx.layer(s, s, function (c) { c.translate(s / 2, s / 2); drawWhole(c, kd, r); });
          halfSpr[kd] = ctx.layer(s, s, function (c) { c.translate(s / 2, s / 2); drawHalf(c, kd, r); });
        });
      }
      function blit(g, img, x, y, r, rot) {
        var s = r * 3.3;
        if (rot) { g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(img, -s / 2, -s / 2, s, s); g.restore(); }
        else g.drawImage(img, x - s / 2, y - s / 2, s, s);
      }

      function reset() {
        phase = 'ready'; phaseT = 0; playT = 0; waveIn = 0.4; queue = []; score = 0; sliced = 0; misses = 0; bestCombo = 0; bombed = false;
        res = null; again = null; missAt = [9, 9, 9]; missMarks.length = 0; fruits.length = 0; swipes = {};
      }
      function startRound() {
        phase = 'play'; phaseT = 0; playT = 0; waveIn = 0.7; queue = []; score = 0; sliced = 0; misses = 0; bestCombo = 0; bombed = false;
        ctx.sfx.whoosh();
      }
      function end(bomb) {
        if (phase !== 'play') return;
        for (var id in swipes) finishSwipe(swipes[id]);
        phase = 'over'; phaseT = 0; banner = ctx.t(bomb ? TX.boom : TX.over);
        var b = score > 0 ? ctx.best(score) : { best: ctx.getBest(), isNew: false };
        res = { score: score, sliced: sliced, combo: bestCombo, best: b.best, isNew: b.isNew, bomb: bomb };
        ctx.later(function () { if (phase === 'over') ctx.sfx.lose(); }, bomb ? 650 : 300);
      }
      function toResult() {
        phase = 'result'; phaseT = 0; ctx.sfx.stamp();
        if (res.isNew) { ctx.sfx.win(); ctx.sfx.sparkle(); ctx.haptic('success'); ctx.fx.burst(ax + aw / 2, ay + ah * 0.42, 90, ctx.PAL, { speed: 720 }); }
      }

      function missed(f) {
        misses++; missAt[misses - 1] = 0;
        missMarks.push({ x: Math.min(0.92, Math.max(0.08, f.x)), t: clock });
        missFlash = 0.5; ctx.sfx.buzz(); ctx.haptic('light');
        if (misses >= MAX_MISS) end(false);
      }
      function finishSwipe(s) {
        var n = s.count; s.count = 0;
        if (n <= 0 || phase !== 'play') return;
        bestCombo = Math.max(bestCombo, n);
        if (n >= 3) {
          score += n;
          ctx.fx.text(ax + Math.min(0.75, Math.max(0.25, s.lastX)) * aw, ay + (s.lastY - 0.08) * aw, ctx.f(TX.combo, n), { color: '#FFE066', size: 0.07 * aw, rise: 0.12 * aw, life: 1.1 });
          ctx.sfx.coin(); ctx.sfx.sparkle(); ctx.haptic('medium');
        }
      }
      function cut(f, dx, dy, s) {
        var ang = Math.atan2(dy, dx), nx = -dy, ny = dx;
        [1, -1].forEach(function (sd) {
          halves.push({ kind: f.kind, r: f.r, x: f.x + sd * nx * f.r * 0.15, y: f.y + sd * ny * f.r * 0.15,
            vx: f.vx * 0.6 + sd * nx * 0.32, vy: f.vy * 0.6 + sd * ny * 0.32 - 0.15, rot: ang + (sd < 0 ? PI : 0), spin: f.spin * 0.6 + sd * 2.5 });
        });
        var col = JUICE[f.kind];
        for (var i = 0; i < 14; i++) {
          var sp = (Math.random() - 0.5) * 2.4, b = Math.random() < 0.5 ? 1 : -1, bx = dx * b, by = dy * b;
          var ex = bx * Math.cos(sp) - by * Math.sin(sp), ey = bx * Math.sin(sp) + by * Math.cos(sp), v = 0.3 + 0.8 * Math.random();
          drops.push({ k: 0, x: f.x, y: f.y, vx: ex * v, vy: ey * v - 0.2, c: col, s: 0.008 + 0.012 * Math.random(), life: 0.5 + 0.3 * Math.random(), t: 0 });
        }
        splat(f.x, f.y, col, f.r * 1.4);
        sliced++; score++;
        if (clock - s.lastSlice > 0.28) s.count = 0;
        s.count++; s.lastSlice = clock; s.lastX = f.x; s.lastY = f.y;
        ctx.sfx.slice(); ctx.sfx.pop(1 + 0.18 * Math.min(2, s.count - 1)); ctx.haptic(s.count >= 3 ? 'medium' : 'light');
      }
      function splat(x, y, col, size) {
        var b = [];
        for (var i = 0; i < 6; i++) { var a = Math.random() * TAU, d = size * (0.5 + 0.6 * Math.random()); b.push([Math.cos(a) * d, Math.sin(a) * d, size * (0.12 + 0.18 * Math.random())]); }
        splats.push({ x: x, y: y, c: col, s: size, b: b, t: 0 });
        if (splats.length > 14) splats.shift();
      }
      function explode(f) {
        bombed = true; ctx.sfx.boom(); ctx.haptic('heavy'); shakeT = 0.6; flashT = 0.55;
        var i, a, v;
        for (i = 0; i < 34; i++) { a = Math.random() * TAU; v = 0.3 + 1.2 * Math.random(); drops.push({ k: 1, x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: i % 2 ? '#FF5C2E' : '#FFB020', s: 0.02 + 0.025 * Math.random(), life: 0.5 + 0.3 * Math.random(), t: 0 }); }
        for (i = 0; i < 12; i++) { a = Math.random() * TAU; v = 0.1 + 0.3 * Math.random(); drops.push({ k: 2, x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: '#5A5560', s: 0.04 + 0.03 * Math.random(), life: 1.2, t: 0 }); }
        for (i = 0; i < 10; i++) { a = Math.random() * TAU; v = 0.6 + 0.8 * Math.random(); drops.push({ k: 3, x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: '#2B2B36', s: 0.012, life: 1, t: 0 }); }
        splat(f.x, f.y, '#2B2B36', 0.18);
        end(true);
      }

      function spawn(dt, demo) {
        waveIn -= dt;
        if (waveIn <= 0 && !queue.length) {
          queue = wave(demo ? 0 : playT, demo); queueT = 0; waveIn = demo ? 1.3 : gap(playT);
          if (!demo) ctx.sfx.noise(0.2, 0.1, 500, 2600, 'bandpass', 0.05);
        }
        if (queue.length) {
          queueT += dt;
          for (var i = queue.length - 1; i >= 0; i--) {
            var l = queue[i];
            if (l.delay > queueT) continue;
            fruits.push({ kind: l.kind, r: RAD[l.kind], x: l.x, y: l.y, vx: l.vx, vy: l.vy, spin: l.spin, rot: 0, t: 0, demo: demo });
            queue.splice(i, 1);
          }
        }
      }
      function physics(dt) {
        var i, f;
        for (i = fruits.length - 1; i >= 0; i--) {
          f = fruits[i]; f.t += dt; f.vy += G * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
          if (f.vy > 0 && f.y - f.r >= HH) { fruits.splice(i, 1); if (f.kind !== 'bomb' && phase === 'play' && !f.demo) missed(f); }
        }
        for (i = halves.length - 1; i >= 0; i--) {
          f = halves[i]; f.vy += G * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
          if (f.y - f.r > HH) halves.splice(i, 1);
        }
        var d1 = Math.pow(0.05, dt), d2 = Math.pow(0.2, dt);
        for (i = drops.length - 1; i >= 0; i--) {
          f = drops[i]; f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt;
          if (f.k === 0 || f.k === 3) f.vy += G * 0.9 * dt;
          else if (f.k === 1) { f.vx *= d1; f.vy *= d1; }
          else { f.vx *= d2; f.vy = f.vy * d2 - 0.05 * dt; }
          if (f.t > f.life) drops.splice(i, 1);
        }
        for (i = splats.length - 1; i >= 0; i--) if ((splats[i].t += dt) > 2.6) splats.splice(i, 1);
        for (i = missMarks.length - 1; i >= 0; i--) if (clock - missMarks[i].t > 1) missMarks.splice(i, 1);
        for (var id in swipes) {
          var s = swipes[id];
          while (s.pts.length && clock - s.pts[0].t > 0.16) s.pts.shift();
          if (!s.down && !s.pts.length) delete swipes[id];
          else if (s.count > 0 && clock - s.lastSlice > 0.28) finishSwipe(s);
        }
      }

      function hud(g) {
        var best = ctx.getBest(), x = 12 * k, y = 10 * k, ms = 26 * k;
        if (spr.watermelon) blit(g, spr.watermelon, x + ms / 2, y + ms * 0.55, ms * 0.36, 0);
        ctx.text(g, String(score), x + ms + 6 * k, y + ms / 2 + 2 * k, { size: 34 * k, weight: 900, color: '#FFE9A8', align: 'left', shadow: 'rgba(0,0,0,.67)', blur: 6, oy: 2 });
        iconTrophy(ctx, g, x + 8 * k, y + ms + 16 * k, 15 * k, '#FFD34D');
        ctx.text(g, best === null ? '-' : String(Math.round(best)), x + 18 * k, y + ms + 16 * k, { size: 13 * k, weight: 800, color: 'rgba(255,255,255,.93)', align: 'left', shadow: 'rgba(0,0,0,.6)', blur: 4, oy: 0 });
        g.save(); g.lineCap = 'round'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 4;
        for (var i = 0; i < MAX_MISS; i++) {
          var on = i < misses, t = missAt[i], sc = on ? 0.9 + 0.25 * ctx.ease.elasticOut(Math.min(1, t / 0.25)) : 0.9;
          var cx = aw - 12 * k - (MAX_MISS - 1 - i) * 34 * k - 15 * k, cy = y + 15 * k, d = 6.6 * k * sc;
          g.strokeStyle = on ? '#FF3B4E' : 'rgba(255,255,255,.4)'; g.lineWidth = 3.4 * k * sc;
          g.beginPath(); g.moveTo(cx - d, cy - d); g.lineTo(cx + d, cy + d); g.moveTo(cx - d, cy + d); g.lineTo(cx + d, cy - d); g.stroke();
        }
        g.restore();
      }

      function resultCard(g) {
        var t = Math.min(1, phaseT / 0.3), e = ctx.ease.outBack(t), C = ctx.C, col = ctx.color;
        g.fillStyle = 'rgba(0,0,0,' + (0.3 * t).toFixed(3) + ')'; g.fillRect(0, 0, aw, ah);
        var cw = Math.min(aw - 24, 320), pad = 18, ch = 250, cx = (aw - cw) / 2, cy = (ah - ch) / 2;
        g.save(); g.globalAlpha = t; g.translate(aw / 2, ah / 2); g.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e); g.translate(-aw / 2, -ah / 2);
        g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
        ctx.rrect(g, cx, cy, cw, ch, 24); g.fillStyle = C.surface; g.fill(); g.restore();
        g.lineWidth = 1; g.strokeStyle = C.hair; ctx.rrect(g, cx + 0.5, cy + 0.5, cw - 1, ch - 1, 24); g.stroke();
        var y = cy + pad + 16;
        ctx.text(g, ctx.t(res.isNew ? TX.newBest : res.bomb ? TX.boom : TX.missed), aw / 2, y, { size: 26, weight: 900, color: C.ink, maxW: cw - pad * 2 });
        y += 28;
        ctx.text(g, ctx.f(TX.summary, res.sliced, res.combo), aw / 2, y, { size: 14, weight: 600, color: C.soft, maxW: cw - pad * 2 });
        y += 18;
        var bw = (cw - pad * 2 - 10) / 2, bh = 72;
        [[TX.score, String(res.score), res.isNew], [TX.best, res.best === null ? '-' : String(Math.round(res.best)), false]].forEach(function (b, i) {
          var bx = cx + pad + i * (bw + 10);
          ctx.rrect(g, bx, y, bw, bh, 16); g.fillStyle = b[2] ? ctx.rgba(col, 0.12) : C.surface; g.fill();
          g.lineWidth = 1.4; g.strokeStyle = b[2] ? col : C.hair; g.stroke();
          ctx.text(g, ctx.t(b[0]), bx + bw / 2, y + 20, { size: 13, weight: 700, color: C.soft, maxW: bw - 16 });
          ctx.text(g, b[1], bx + bw / 2, y + 48, { size: 27, weight: 900, color: C.ink, maxW: bw - 16 });
        });
        y += bh + 16;
        var btnW = cw - pad * 2, btnH = 50;
        ctx.rrect(g, cx + pad, y, btnW, btnH, 18); g.fillStyle = col; g.fill();
        var ink = ctx.inkOn(col), label = ctx.t(TX.again);
        g.font = ctx.font(17, 800); var lw = g.measureText(label).width, ix = aw / 2 - (lw + 26) / 2;
        g.fillStyle = ink; g.beginPath(); g.moveTo(ix + 3, y + btnH / 2 - 8); g.lineTo(ix + 16, y + btnH / 2); g.lineTo(ix + 3, y + btnH / 2 + 8); g.closePath(); g.fill();
        ctx.text(g, label, ix + 26, y + btnH / 2 + 1, { size: 17, weight: 800, color: ink, align: 'left', maxW: btnW - 50 });
        again = { x: ax + aw / 2, y: ay + y + btnH / 2 };
        g.restore();
      }

      function hintFruit() {
        var best = null, bs = 1e9;
        for (var i = 0; i < fruits.length; i++) {
          var f = fruits[i];
          if (f.kind === 'bomb' || f.y > HH - f.r * 0.5) continue;
          var sc = Math.abs(f.vy) + (f.vy > 0 ? 0.6 : 0);
          if (sc < bs) { bs = sc; best = f; }
        }
        return best;
      }

      // the very first frame already shows a demo fruit on its way up
      waveIn = 0;
      for (var w0 = 0; w0 < 14; w0++) { spawn(0.05, true); physics(0.05); }

      return {
        layout: function () {
          var r = ctx.fit(ASPECT, { maxW: 520 });
          ax = r.x; ay = r.y; aw = r.w; ah = r.h;
          k = ctx.clamp(aw / 340, 0.75, 1.3); R = Math.round(26 * Math.min(1, k + 0.1));
          bg = ctx.layer(aw, ah, function (c, w, h) {
            var pw = w / 5, i, q;
            for (i = 0; i < 5; i++) { c.fillStyle = PLANKS[i]; c.fillRect(i * pw, 0, pw + 1, h); }
            c.strokeStyle = 'rgba(64,36,16,.33)'; c.lineWidth = w * 0.006; c.beginPath();
            for (i = 1; i < 5; i++) { c.moveTo(i * pw, 0); c.lineTo(i * pw, h); }
            c.stroke();
            c.lineWidth = w * 0.004;
            for (i = 0; i < 5; i++) {
              c.strokeStyle = 'rgba(255,255,255,.13)'; c.beginPath();
              for (q = 0; q < 3; q++) {
                var x = i * pw + pw * (0.25 + 0.25 * q), y0 = h * (((i * 7 + q * 3) % 10) / 10);
                c.moveTo(x, y0); c.bezierCurveTo(x + pw * 0.12, y0 + h * 0.12, x - pw * 0.12, y0 + h * 0.25, x, y0 + h * 0.38);
              }
              c.stroke();
              c.strokeStyle = 'rgba(64,36,16,.2)'; oval(c, i * pw + pw * 0.5, h * (((i * 13) % 10) / 10 * 0.8 + 0.1), pw * 0.18, pw * 0.3); c.stroke();
            }
            var gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.85);
            gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.38)');
            c.fillStyle = gr; c.fillRect(0, 0, w, h);
          });
          sprites();
        },

        update: function (dt) {
          clock += dt; phaseT += dt;
          if (phase === 'ready') spawn(dt, true);
          else if (phase === 'play') {
            playT += dt; spawn(dt, false);
            var bomb = false;
            for (var i = 0; i < fruits.length; i++) if (fruits[i].kind === 'bomb') bomb = true;
            if (bomb && (fuseT -= dt) <= 0) { fuseT = 0.14; ctx.sfx.noise(0.1, 0.05, 2600, 6000, 'bandpass'); }
          } else if (phase === 'over') { if (phaseT > 1.6) toResult(); }
          else if (phase === 'result' && phaseT > 4.2) reset();
          physics(dt);
          for (var m = 0; m < 3; m++) missAt[m] += dt;
          if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
          if (flashT > 0) flashT = Math.max(0, flashT - dt);
          if (missFlash > 0) missFlash = Math.max(0, missFlash - dt);
        },

        draw: function (g) {
          var w = aw, h = ah, i, f;
          g.save(); g.translate(ax, ay);
          if (!ctx.dark) {
            g.save(); g.shadowColor = 'rgba(16,20,16,.16)'; g.shadowBlur = 22; g.shadowOffsetY = 8;
            ctx.rrect(g, 0, 0, w, h, R); g.fillStyle = '#A86F3C'; g.fill(); g.restore();
          }
          ctx.rrect(g, 0, 0, w, h, R); g.clip();
          g.save();
          if (shakeT > 0) { g.fillStyle = '#6E4627'; g.fillRect(0, 0, w, h); var sk = shakeT / 0.6; g.translate(Math.sin(shakeT * 85) * w * 0.03 * sk, Math.cos(shakeT * 70) * w * 0.022 * sk); }
          if (bg) g.drawImage(bg, 0, 0, w, h);
          for (i = 0; i < splats.length; i++) {
            var sp = splats[i], cx = sp.x * w, cy = sp.y * w;
            g.globalAlpha = Math.max(0, 1 - sp.t / 2.6) * 0.45; g.fillStyle = sp.c;
            g.beginPath(); g.arc(cx, cy, sp.s * w * 0.6, 0, TAU);
            for (var q = 0; q < 6; q++) { var b = sp.b[q]; g.moveTo(cx + b[0] * w + b[2] * w, cy + b[1] * w); g.arc(cx + b[0] * w, cy + b[1] * w, b[2] * w, 0, TAU); }
            g.fill();
          }
          g.globalAlpha = 1;
          for (i = 0; i < halves.length; i++) { f = halves[i]; blit(g, halfSpr[f.kind], f.x * w, f.y * w, f.r * w, f.rot); }
          g.fillStyle = 'rgba(0,0,0,.133)';
          for (i = 0; i < fruits.length; i++) { f = fruits[i]; oval(g, (f.x + f.r * 0.15) * w, (f.y + f.r * 0.95) * w, f.r * w * 1.5, f.r * w * 0.35); g.fill(); }
          for (i = 0; i < fruits.length; i++) {
            f = fruits[i];
            if (f.kind === 'bomb') { g.save(); g.translate(f.x * w, f.y * w); g.rotate(f.rot * 0.3); drawBomb(g, f.r * w, f.t); g.restore(); }
            else blit(g, spr[f.kind], f.x * w, f.y * w, f.r * w, f.rot);
          }
          for (i = 0; i < drops.length; i++) {
            var d = drops[i], kq = d.t / d.life, a = Math.max(0, 1 - kq), ox = d.x * w, oy = d.y * w;
            g.globalAlpha = d.k === 2 ? 0.55 * a : a;
            if (d.k === 3) { g.fillStyle = d.c; g.fillRect(ox - d.s * w * 0.8, oy - d.s * w * 0.5, d.s * w * 1.6, d.s * w); continue; }
            g.fillStyle = d.k === 1 ? ctx.mix('#FFF3B0', d.c, Math.min(1, kq * 2)) : d.c;
            g.beginPath(); g.arc(ox, oy, Math.max(0.1, d.s * w * (d.k === 1 ? 1 - kq * 0.6 : d.k === 2 ? 1 + kq * 1.5 : 1)), 0, TAU); g.fill();
          }
          g.globalAlpha = 1;
          g.lineCap = 'round';
          for (i = 0; i < missMarks.length; i++) {
            var mt = clock - missMarks[i].t, mx = missMarks[i].x * w, my = h - w * 0.07, md = w * 0.035 * (mt < 0.15 ? 0.6 + 0.4 * mt / 0.15 : 1);
            g.strokeStyle = 'rgba(255,59,78,' + Math.max(0, 1 - mt).toFixed(3) + ')'; g.lineWidth = w * 0.018;
            g.beginPath(); g.moveTo(mx - md, my - md); g.lineTo(mx + md, my + md); g.moveTo(mx - md, my + md); g.lineTo(mx + md, my - md); g.stroke();
          }
          // blade trail: soft cyan glow + white core, thinning with age (slice.dart)
          for (var id in swipes) {
            var pts = swipes[id].pts;
            for (i = 1; i < pts.length; i++) {
              var kk = 1 - Math.min(1, Math.max(0, (clock - pts[i].t) / 0.16)), x1 = pts[i - 1].x * w, y1 = pts[i - 1].y * w, x2 = pts[i].x * w, y2 = pts[i].y * w;
              if (kk <= 0) continue;
              g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
              g.strokeStyle = 'rgba(159,232,255,' + (0.22 * kk).toFixed(3) + ')'; g.lineWidth = w * 0.07 * kk; g.stroke();
              g.strokeStyle = 'rgba(159,232,255,' + (0.5 * kk).toFixed(3) + ')'; g.lineWidth = w * 0.035 * kk; g.stroke();
              g.strokeStyle = 'rgba(255,255,255,' + (0.95 * kk).toFixed(3) + ')'; g.lineWidth = Math.max(0.5, w * 0.014 * kk); g.stroke();
            }
          }
          if (phase === 'over') {
            g.save(); g.translate(w / 2, h * 0.45); var bs = 0.5 + 0.5 * ctx.ease.elasticOut(Math.min(1, phaseT / 0.6)); g.scale(bs, bs);
            ctx.text(g, banner, 0, 0, { size: w * 0.13, weight: 900, color: res && res.bomb ? '#FFB020' : '#FFFFFF', shadow: 'rgba(0,0,0,.67)', blur: 12, oy: 4, maxW: w * 1.6 });
            g.restore();
          }
          g.restore();
          if (flashT > 0) { g.fillStyle = 'rgba(255,255,255,' + (Math.min(1, flashT / 0.55) * 0.9).toFixed(3) + ')'; g.fillRect(0, 0, w, h); }
          if (missFlash > 0) {
            var mg = g.createLinearGradient(0, h, 0, h * 0.8);
            mg.addColorStop(0, 'rgba(255,59,78,' + (0.5 * missFlash / 0.5).toFixed(3) + ')'); mg.addColorStop(1, 'rgba(255,59,78,0)');
            g.fillStyle = mg; g.fillRect(0, h * 0.8, w, h * 0.2);
          }
          if (phase === 'result') resultCard(g); else hud(g);
          g.restore();
        },

        down: function (p) {
          var u = U(p);
          if (u.x < -0.03 || u.x > 1.03 || u.y < -0.03 || u.y > HH + 0.03) return;
          if (phase === 'over') return;
          if (phase === 'result') { if (phaseT < 0.45) return; reset(); }
          if (phase === 'ready') startRound();
          swipes[p.id] = { pts: [{ x: u.x, y: u.y, t: clock }], down: true, count: 0, lastSlice: -9, lastX: u.x, lastY: u.y };
        },
        move: function (p) {
          var s = swipes[p.id];
          if (!s || !s.down || phase !== 'play') return;
          var b = U(p), a = s.pts.length ? s.pts[s.pts.length - 1] : b;
          s.pts.push({ x: b.x, y: b.y, t: clock });
          var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.004) return;
          if (len > 0.05) ctx.sfx.swish();
          dx /= len; dy /= len;
          for (var i = fruits.length - 1; i >= 0; i--) {
            var f = fruits[i];
            if (!segHits(a.x, a.y, b.x, b.y, f.x, f.y, f.r * 1.08)) continue;
            fruits.splice(i, 1);
            if (f.kind === 'bomb') { explode(f); return; }
            cut(f, dx, dy, s);
          }
        },
        up: function (p) {
          var s = swipes[p.id];
          if (!s) return;
          s.down = false; finishSwipe(s);
        },

        // ready: a swipe across the spot where the demo fruit peaks; play: through the fruit closest to its peak; result: the replay button
        hint: function () {
          if (phase === 'result') return again && phaseT > 0.45 ? { x: again.x, y: again.y } : null;
          if (phase === 'over') return null;
          var f = phase === 'play' ? hintFruit() : null;
          if (f) { var fx = f.x + f.vx * 0.12, fy = f.y + f.vy * 0.12 + G * 0.0072; return { x: ax + (fx - 0.24) * aw, y: ay + (fy + 0.05) * aw, dx: 0.48 * aw, dy: -0.1 * aw }; }
          return { x: ax + HINT_A[0] * aw, y: ay + HINT_A[1] * aw, dx: (HINT_B[0] - HINT_A[0]) * aw, dy: (HINT_B[1] - HINT_A[1]) * aw };
        },

        debug: function () {
          var h = this.hint();
          return { phase: phase, score: score, sliced: sliced, misses: misses, bestCombo: bestCombo, best: ctx.getBest(),
            arena: { x: ax, y: ay, w: aw, h: ah },
            fruits: fruits.map(function (f) { return { kind: f.kind, x: Math.round(ax + f.x * aw), y: Math.round(ay + f.y * aw), vx: Math.round(f.vx * aw), vy: Math.round(f.vy * aw), r: Math.round(f.r * aw) }; }),
            targets: h ? [{ x: Math.round(h.x), y: Math.round(h.y), dx: Math.round(h.dx || 0), dy: Math.round(h.dy || 0) }] : [] };
        },

        destroy: function () { bg = null; spr = {}; halfSpr = {}; fruits.length = halves.length = drops.length = splats.length = 0; swipes = {}; }
      };
    }
  };
})();
