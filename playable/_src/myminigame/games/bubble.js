/* 방울 쏘기 (bubble): my_mini/lib/games/list/bubble.dart 를 옮긴 것(8x13 파란 판 · 별빛, 육각 배열 반들 방울 6색, 천장 · 위험선,
   발사대 + 다음 방울(누르면 바꾸기), 끌어서 조준(벽 한 번 튕기는 점선 + 붙을 자리), 셋 이상 터짐 · 떨어진 묶음 보너스, 몇 번 쏘면 천장이 내려옴).
   플레이어블: 첫 화면부터 1단계 판, 힌트가 같은 색 덩어리를 노리는 끌기를 보여 준다. 다 터뜨리면 '클리어!' 판 → 잠시 뒤 다음 판,
   선을 넘으면 잿빛 → 결과 카드 → 4초 뒤 새 판(누르면 바로). 단계 숫자는 보이지 않는다. */
(function () {
  'use strict';

  var TX = {
    score: { ko: '점수', ja: 'スコア', en: 'Score' },
    best: { ko: '최고 기록', ja: 'ベスト', en: 'Best' },
    bonus: { ko: '보너스 +{0}', ja: 'ボーナス +{0}', en: 'Bonus +{0}' },
    ceiling: { ko: '천장이 내려와요!', ja: '天井が下がる！', en: 'Ceiling drops!' },
    clear: { ko: '클리어!', ja: 'クリア！', en: 'Cleared!' },
    next: { ko: '다음 단계', ja: '次のレベル', en: 'Next level' },
    newBest: { ko: '새 최고 기록!', ja: 'ベスト更新！', en: 'New best!' },
    over: { ko: '게임 끝', ja: 'ゲームオーバー', en: 'Game over' },
    points: { ko: '{0}점', ja: '{0}点', en: '{0} points' },
    again: { ko: '다시 하기', ja: 'もう一回', en: 'Play again' }
  };

  var TAU = Math.PI * 2, COLS = 8, ROWS = 14, RH = 0.8660254037844386, UW = 8, UH = 13;
  var LX = 4, LY = 11.05, NX = 2.0, NY = 11.45, DEAD = 9.85, TOP = 0.3, SPEED = 24, HIT = 0.86, STEP = 0.15;
  var CL = ['#FF4D6D', '#FFC93C', '#3DDC84', '#3D8BFF', '#B36BFF', '#2ED3E6'];

  /* ---------- rules (BubbleGrid): even rows 8 cells, odd rows 7 (half a cell in); value = colour, -1 empty ---------- */
  function wid(r) { return r % 2 ? COLS - 1 : COLS; }
  function valid(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < wid(r); }
  function xOf(r, c) { return (r % 2 ? 1 : 0.5) + c; }
  function yOf(r) { return 0.5 + r * RH; }
  function nbrs(r, c) {
    var d = r % 2 ? 0 : -1, out = [];
    [[r, c - 1], [r, c + 1], [r - 1, c + d], [r - 1, c + d + 1], [r + 1, c + d], [r + 1, c + d + 1]].forEach(function (p) { if (valid(p[0], p[1])) out.push(p); });
    return out;
  }
  function group(G, r, c) {
    var col = G[r * COLS + c], seen = [], out = [[r, c]];
    if (col < 0) return [];
    seen[r * COLS + c] = 1;
    for (var h = 0; h < out.length; h++) nbrs(out[h][0], out[h][1]).forEach(function (n) { var i = n[0] * COLS + n[1]; if (!seen[i] && G[i] === col) { seen[i] = 1; out.push(n); } });
    return out;
  }
  // bubbles no longer hanging from the top row
  function floating(G) {
    var seen = [], q = [], out = [], c, r;
    for (c = 0; c < COLS; c++) if (G[c] >= 0) { seen[c] = 1; q.push([0, c]); }
    for (var h = 0; h < q.length; h++) nbrs(q[h][0], q[h][1]).forEach(function (n) { var i = n[0] * COLS + n[1]; if (!seen[i] && G[i] >= 0) { seen[i] = 1; q.push(n); } });
    for (r = 0; r < ROWS; r++) for (c = 0; c < wid(r); c++) if (G[r * COLS + c] >= 0 && !seen[r * COLS + c]) out.push([r, c]);
    return out;
  }
  // the empty cell a bubble at (x, y below the ceiling) sticks to: top row or touching another bubble, nearest first
  function snap(G, x, y) {
    var r0 = Math.round((y - 0.5) / RH), best = null, bd = Infinity, r, c, dx, dy, d, pass;
    for (pass = 0; pass < 2 && !best; pass++) {
      for (r = pass ? 0 : Math.max(0, r0 - 1); r <= (pass ? ROWS - 1 : Math.min(ROWS - 1, r0 + 1)); r++) for (c = 0; c < wid(r); c++) {
        if (G[r * COLS + c] >= 0) continue;
        if (!pass && r > 0 && !nbrs(r, c).some(function (n) { return G[n[0] * COLS + n[1]] >= 0; })) continue;
        dx = xOf(r, c) - x; dy = yOf(r) - y; d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = [r, c]; }
      }
    }
    return best;
  }
  function place(G, r, c, color) {
    G[r * COLS + c] = color;
    var g = group(G, r, c);
    if (g.length < 3) return { popped: [], fallen: [], fc: [] };
    g.forEach(function (p) { G[p[0] * COLS + p[1]] = -1; });
    var fl = floating(G), fc = fl.map(function (p) { return G[p[0] * COLS + p[1]]; });
    fl.forEach(function (p) { G[p[0] * COLS + p[1]] = -1; });
    return { popped: g, fallen: fl, fc: fc };
  }
  // level board: neighbours' colours are copied often, so clusters form
  function fillLevel(G, rows, colors) {
    for (var i = 0; i < G.length; i++) G[i] = -1;
    for (var r = 0; r < rows; r++) for (var c = 0; c < wid(r); c++) {
      var prev = nbrs(r, c).map(function (n) { return G[n[0] * COLS + n[1]]; }).filter(function (v) { return v >= 0; });
      G[r * COLS + c] = prev.length && Math.random() < 0.45 ? prev[Math.random() * prev.length | 0] : Math.random() * colors | 0;
    }
  }
  function fallBonus(n) { return n <= 0 ? 0 : 20 * n * (1 + (n >> 2)); }
  function spec(lv) { return { rows: Math.min(4 + lv, 7), colors: Math.min(3 + ((lv + 1) >> 1), 6), shots: lv <= 1 ? 8 : lv <= 3 ? 7 : lv <= 6 ? 6 : 5 }; }
  function lowestRow(G) { for (var r = ROWS - 1; r >= 0; r--) for (var c = 0; c < wid(r); c++) if (G[r * COLS + c] >= 0) return r; return -1; }
  function colorsLeft(G) { var s = []; G.forEach(function (v) { if (v >= 0 && s.indexOf(v) < 0) s.push(v); }); return s; }

  // glossy bubble (_ArenaPainter._bubble)
  function paintBubble(ctx, c, x, y, r, color) {
    c.fillStyle = ctx.mix(color, '#000000', 0.32); c.beginPath(); c.arc(x, y, r * 0.98, 0, TAU); c.fill();
    c.fillStyle = color; c.beginPath(); c.arc(x - r * 0.06, y - r * 0.07, r * 0.86, 0, TAU); c.fill();
    c.fillStyle = ctx.mix(color, '#FFFFFF', 0.3); c.beginPath(); c.arc(x - r * 0.22, y - r * 0.25, r * 0.45, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(x - r * 0.32, y - r * 0.4, r * 0.21, r * 0.12, 0, 0, TAU); c.fill();
  }

  /* ---------- the app's record chip, icons and result card ---------- */
  function iconBubbles(g, x, y, s, col) {
    g.save(); g.translate(x - s / 2, y - s / 2); g.scale(s / 24, s / 24); g.fillStyle = col;
    [[7.2, 14.4, 4.6], [16.6, 16.6, 3.2], [15, 7.4, 5]].forEach(function (b) { g.beginPath(); g.arc(b[0], b[1], b[2], 0, TAU); g.fill(); });
    g.restore();
  }
  function iconTrophy(ctx, g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.translate(-12, -12);
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(7, 3.5); g.lineTo(17, 3.5); g.lineTo(17, 9.5); g.quadraticCurveTo(17, 14.6, 12, 14.6); g.quadraticCurveTo(7, 14.6, 7, 9.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(7, 5.6); g.lineTo(4.4, 5.6); g.quadraticCurveTo(3.9, 10.6, 7.6, 11.2); g.moveTo(17, 5.6); g.lineTo(19.6, 5.6); g.quadraticCurveTo(20.1, 10.6, 16.4, 11.2); g.stroke();
    g.fillRect(11, 14, 2, 3.6); ctx.rrect(g, 7.4, 17.4, 9.2, 3, 1.2); g.fill();
    g.restore();
  }
  function chip(ctx, g, x, y, w, h, icon, label, value, big) {
    var C = ctx.C;
    ctx.rrect(g, x + 0.6, y + 0.6, w - 1.2, h - 1.2, 16); g.fillStyle = C.surface; g.fill();
    g.lineWidth = 1.2; g.strokeStyle = C.hair; g.stroke();
    var tx = x + 12 + 24, room = x + w - 12 - tx;
    icon(g, x + 21, y + h / 2, 18, ctx.color);
    ctx.text(g, label, tx, y + h * 0.33, { size: 11, weight: 700, color: C.soft, align: 'left', maxW: room });
    ctx.text(g, value, tx, y + h * 0.66, { size: (big ? 20 : 17) * (h < 46 ? 0.92 : 1), weight: 900, color: C.ink, align: 'left', maxW: room });
  }
  // a surface panel with a title, a line and a button in the game colour (ResultView / the level-clear Panel)
  function panel(ctx, g, cx, cy, maxW, t, title, sub, boxes, btn, arrow) {
    var e = ctx.ease.outBack(Math.min(1, t)), C = ctx.C, pad = 18, cw = Math.min(maxW - 24, 320), ch = boxes ? 250 : 170, x = cx - cw / 2, y0 = cy - ch / 2;
    g.save(); g.globalAlpha = Math.min(1, t); g.translate(cx, cy); g.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e); g.translate(-cx, -cy);
    g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
    ctx.rrect(g, x, y0, cw, ch, 24); g.fillStyle = C.surface; g.fill(); g.restore();
    g.lineWidth = 1; g.strokeStyle = C.hair; ctx.rrect(g, x + 0.5, y0 + 0.5, cw - 1, ch - 1, 24); g.stroke();
    var y = y0 + pad + 16;
    ctx.text(g, title, cx, y, { size: 26, weight: 900, color: C.ink, maxW: cw - pad * 2 }); y += 28;
    ctx.text(g, sub, cx, y, { size: 14, weight: 600, color: C.soft, maxW: cw - pad * 2 }); y += 18;
    if (boxes) {
      var bw = (cw - pad * 2 - 10) / 2, bh = 72;
      boxes.forEach(function (b, i) {
        var bx = x + pad + i * (bw + 10);
        ctx.rrect(g, bx, y, bw, bh, 16); g.fillStyle = b[2] ? ctx.rgba(ctx.color, 0.14) : C.surface; g.fill();
        g.lineWidth = 1.4; g.strokeStyle = b[2] ? ctx.color : C.hair; g.stroke();
        ctx.text(g, ctx.t(b[0]), bx + bw / 2, y + 20, { size: 13, weight: 700, color: C.soft, maxW: bw - 16 });
        ctx.text(g, b[1], bx + bw / 2, y + 48, { size: 27, weight: 900, color: C.ink, maxW: bw - 16 });
      });
      y += bh;
    }
    y += 16;
    var btnW = cw - pad * 2, btnH = 50, ink = ctx.inkOn(ctx.color);
    ctx.rrect(g, x + pad, y, btnW, btnH, 18); g.fillStyle = ctx.color; g.fill();
    g.font = ctx.font(17, 800); var lw = g.measureText(btn).width, ix = cx - (lw + 26) / 2, my = y + btnH / 2;
    g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
    if (arrow) { g.beginPath(); g.moveTo(ix + 1, my); g.lineTo(ix + 16, my); g.moveTo(ix + 10, my - 6); g.lineTo(ix + 16, my); g.lineTo(ix + 10, my + 6); g.stroke(); }
    else { g.beginPath(); g.moveTo(ix + 3, my - 8); g.lineTo(ix + 16, my); g.lineTo(ix + 3, my + 8); g.closePath(); g.fill(); }
    ctx.text(g, btn, ix + 26, my + 1, { size: 17, weight: 800, color: ink, align: 'left', maxW: btnW - 50 });
    g.restore();
    return { x: cx, y: my };
  }

  GAMES['bubble'] = {
    name: { ko: '방울 쏘기', ja: 'バブル割り', en: 'Bubble Burst' },
    tip: { ko: '끌어서 조준하고 놓으면 발사!', ja: 'ドラッグでねらって、はなすと発射！', en: 'Drag to aim, release to shoot!' },
    color: '#4FA8FF',
    kind: 'puzzle',
    make: function (ctx) {
      var G = new Array(COLS * ROWS);
      var ax = 0, ay = 0, aw = 280, ah = 455, k = 35, chipX = 0, chipY = 0, chipW = 280, chipH = 46, bg = null, spr = [];
      var level = 1, score = 0, phase = 'play', phaseT = 0, newBest = false, res = null, btn = null, clearBonus = 0;
      var drops = 0, ceilVis = TOP, per = 8, shotsLeft = 8, cur = 0, next = 1, shot = null, pending = null;
      var aiming = false, aimPath = [], ghost = null, shake = 0, dieT = -1, pointer = null, landGap = 0, time = 0, ver = 0, aimCache = null;
      var pops = [], falls = [], sparks = [], floats = [], stars = [];
      for (var si = 0; si < 26; si++) stars.push([Math.random(), Math.random(), 1 + Math.random() * 2, 0.03 + Math.random() * 0.04]);

      function ceilY() { return TOP + drops * RH; }
      function pickColor() { var l = colorsLeft(G); return l.length ? l[Math.random() * l.length | 0] : Math.random() * 4 | 0; }
      function startLevel(lv) {
        var sp = spec(lv);
        level = lv; fillLevel(G, sp.rows, sp.colors);
        drops = 0; ceilVis = TOP; per = shotsLeft = sp.shots; shot = null; pending = null; aiming = false; aimPath = []; ghost = null;
        shake = 0; dieT = -1; pointer = null; pops.length = falls.length = sparks.length = floats.length = 0;
        cur = pickColor(); next = pickColor(); phase = 'play'; phaseT = 0; btn = null; ver++;
      }
      function newRun() { score = 0; newBest = false; res = null; startLevel(1); ctx.sfx.whoosh(); }
      function addFloat(s, x, y, size, c) { floats.push({ s: s, x: x, y: y, size: size, c: c, t: 0 }); }

      // touching the ceiling or another bubble?
      function touches(x, y) {
        var ry = y - ceilY();
        if (ry <= 0.5) return true;
        var r0 = Math.round((ry - 0.5) / RH);
        for (var r = Math.max(0, r0 - 1); r <= Math.min(ROWS - 1, r0 + 1); r++) for (var c = 0; c < wid(r); c++) {
          if (G[r * COLS + c] < 0) continue;
          var dx = xOf(r, c) - x, dy = yOf(r) - ry;
          if (dx * dx + dy * dy < HIT * HIT) return true;
        }
        return false;
      }
      // one fixed-size step of a moving bubble (shared by the real shot, the aim guide and the hint, so they always agree)
      function adv(s) {
        s.x += s.vx * STEP; s.y += s.vy * STEP;
        if (s.x < 0.5) { s.x = 1 - s.x; s.vx = Math.abs(s.vx); return 1; }
        if (s.x > UW - 0.5) { s.x = 2 * (UW - 0.5) - s.x; s.vx = -Math.abs(s.vx); return 1; }
        return 0;
      }
      function simulate(dx, dy, maxB) {
        var s = { x: LX, y: LY, vx: dx, vy: dy }, path = [[LX, LY]], b = 0;
        for (var n = 0; n < 400; n++) {
          if (adv(s)) { b++; path.push([s.x, s.y]); if (b > maxB) return { path: path, cell: null, b: b }; }
          if (touches(s.x, s.y)) { path.push([s.x, s.y]); return { path: path, cell: snap(G, s.x, s.y - ceilY()), b: b }; }
        }
        return { path: path, cell: null, b: b };
      }
      function aimDir(ux, uy) {
        var a = Math.atan2(-(uy - LY), ux - LX);
        if (a < 0) a = a < -Math.PI / 2 ? Math.PI : 0;
        a = ctx.clamp(a, 0.17, Math.PI - 0.17);
        return [Math.cos(a), -Math.sin(a)];
      }
      function aim(ux, uy) {
        var d = aimDir(ux, uy), sim = simulate(d[0], d[1], 1);
        aimPath = sim.path; ghost = sim.cell ? [xOf(sim.cell[0], sim.cell[1]), ceilY() + yOf(sim.cell[0])] : null;
      }
      function fire(d) {
        shot = { x: LX, y: LY, vx: d[0], vy: d[1], color: cur, acc: 0 };
        ctx.sfx.whoosh(); ctx.haptic('light'); ver++;
      }

      function land() {
        var s = shot, cell = snap(G, s.x, s.y - ceilY());
        shot = null; ver++;
        if (!cell) { gameOver(); return; }
        var r = cell[0], c = cell[1], out = place(G, r, c, s.color), cy = ceilY() + yOf(r);
        if (!out.popped.length) { ctx.sfx.place(0.7); ctx.haptic('light'); }
        else {
          out.popped.forEach(function (p, i) { pops.push({ x: xOf(p[0], p[1]), y: ceilY() + yOf(p[0]), c: s.color, d: i * 0.05, i: i, t: 0, b: false }); });
          var pts = out.popped.length * 10, bonus = fallBonus(out.fallen.length);
          score += pts + bonus;
          addFloat('+' + pts, xOf(r, c), cy, 0.62, '#FFFFFF');
          if (out.fallen.length) {
            out.fallen.forEach(function (p, i) { falls.push({ x: xOf(p[0], p[1]), y: ceilY() + yOf(p[0]), vx: (Math.random() - 0.5) * 3, vy: -1.5, c: out.fc[i], landed: false }); });
            addFloat(ctx.f(TX.bonus, ctx.comma(bonus)), UW / 2, cy + 1.2, 0.75, '#FFE066');
            ctx.sfx.coin(); ctx.haptic('medium');
            shake = Math.min(1, 0.3 + out.fallen.length * 0.05);
          }
        }
        if (lowestRow(G) < 0) { clearLevel(); return; }
        if (--shotsLeft <= 0) {
          drops++; shotsLeft = per; shake = 1;
          ctx.sfx.stamp(); ctx.haptic('heavy');
          addFloat(ctx.t(TX.ceiling), UW / 2, DEAD - 1.4, 0.7, '#FF8FA3');
        } else if (shotsLeft === 1) ctx.sfx.tick(true);
        var low = lowestRow(G);
        if (low >= 0 && ceilY() + yOf(low) + 0.45 > DEAD) { gameOver(); return; }
        cur = colorsLeft(G).indexOf(next) >= 0 ? next : pickColor();
        next = pickColor();
        if (pending) { var d = pending; pending = null; fire(d); }
      }
      function clearLevel() {
        clearBonus = 500 + level * 250; score += clearBonus;
        phase = 'clear'; phaseT = 0; pending = null; aiming = false;
        ctx.best(score);
        ctx.sfx.win(); ctx.sfx.sparkle(); ctx.haptic('success');
        for (var i = 0; i < 40; i++) { var a = Math.random() * TAU, v = 3 + Math.random() * 5; sparks.push({ x: UW / 2, y: 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, c: CL[i % 6], life: 1 }); }
        ctx.fx.burst(ax + aw / 2, ay + ah * 0.35, 70, CL, { speed: 650 });
      }
      function gameOver() {
        if (phase === 'over') return;
        phase = 'over'; phaseT = 0; shot = null; pending = null; aiming = false; dieT = 0;
        ctx.sfx.lose(); ctx.haptic('heavy');
        var b = score > 0 ? ctx.best(score) : { best: ctx.getBest(), isNew: false };
        newBest = b.isNew && score > 0;
        res = { score: ctx.comma(score), best: b.best === null ? '-' : ctx.comma(b.best) };
      }

      // the hint: the aim (at most one wall bounce) that pops the most, taken from the middle of the angles that land on the same cell
      function bestAim() {
        if (aimCache && aimCache.v === ver) return aimCache.a;
        var list = [], n = 96, i, j, best = null;
        for (i = 0; i <= n; i++) {
          var a = 0.17 + (Math.PI - 0.34) * i / n, sim = simulate(Math.cos(a), -Math.sin(a), 1), s = -1e9;
          if (sim.cell) {
            var idx = sim.cell[0] * COLS + sim.cell[1], g, f = 0;
            G[idx] = cur; g = group(G, sim.cell[0], sim.cell[1]);
            if (g.length >= 3) {
              g.forEach(function (p) { G[p[0] * COLS + p[1]] = -1; });
              f = floating(G).length;
              g.forEach(function (p) { G[p[0] * COLS + p[1]] = cur; });
              s = 100 + g.length * 10 + f * 25;
            } else s = g.length * 10;
            G[idx] = -1;
            s -= sim.b * 3;
          }
          list.push({ a: a, key: sim.cell ? sim.cell[0] * COLS + sim.cell[1] : -1, s: s });
        }
        for (i = 0; i < list.length; i = j + 1) {
          for (j = i; j + 1 < list.length && list[j + 1].key === list[i].key; j++);
          if (list[i].key < 0) continue;
          var mid = list[(i + j) >> 1], sc = list[i].s + Math.min(j - i + 1, 6) * 0.5 - Math.abs(mid.a - Math.PI / 2);
          if (!best || sc > best.s) best = { s: sc, a: mid.a };
        }
        aimCache = { v: ver, a: best ? best.a : Math.PI / 2 };
        return aimCache.a;
      }
      function aimHint() {
        if (phase !== 'play' || shot || dieT >= 0) return null;
        var a = bestAim(), dx = Math.cos(a), dy = -Math.sin(a);
        // from just above the launcher (not on it or on the next bubble: those swap colours) a long way towards the target
        var tx = dx > 0.001 ? (UW - 0.5 - LX) / dx : dx < -0.001 ? (LX - 0.5) / -dx : 99, end = Math.min(5.6, tx, (LY - 0.6) / -dy), st = 1.2;
        while (st < end - 1.2 && Math.hypot(LX + dx * st - NX, LY + dy * st - NY) <= 1.05) st += 0.3;
        return { x: ax + (LX + dx * st) * k, y: ay + (LY + dy * st) * k, dx: dx * (end - st) * k, dy: dy * (end - st) * k };
      }

      startLevel(1);

      return {
        layout: function (w, h) {
          chipH = h < 430 ? 40 : 46;
          var gap = 8, avH = h - 12 - chipH - gap;
          aw = Math.floor(Math.max(120, Math.min(w - 32, 470, avH * UW / UH))); ah = Math.floor(aw * UH / UW); k = aw / UW;
          var top = Math.round((h - (chipH + gap + ah)) / 2);
          chipW = Math.max(aw, Math.min(w - 32, 300)); chipX = Math.round((w - chipW) / 2); chipY = top;
          ax = Math.round((w - aw) / 2); ay = top + chipH + gap;
          bg = ctx.layer(aw, ah, function (c) {
            var gr = c.createLinearGradient(0, 0, 0, ah);
            gr.addColorStop(0, ctx.dark ? '#14204A' : '#2F57B8'); gr.addColorStop(1, ctx.dark ? '#0B1230' : '#1C3478');
            c.fillStyle = gr; c.fillRect(0, 0, aw, ah);
          });
          spr = CL.map(function (col) { return ctx.layer(k, k, function (c) { paintBubble(ctx, c, k / 2, k / 2, k / 2, col); }); });
        },

        update: function (dt) {
          time += dt; phaseT += dt; landGap -= dt;
          ceilVis += (ceilY() - ceilVis) * (1 - Math.exp(-dt * 10));
          if (shake > 0) shake = Math.max(0, shake - dt * 2.5);
          if (shot) {
            shot.acc += SPEED * dt;
            while (shot && shot.acc >= STEP) {
              shot.acc -= STEP;
              if (adv(shot)) { ctx.sfx.click(); ctx.haptic(6); }
              if (touches(shot.x, shot.y)) land();
            }
          }
          var i, p;
          for (i = pops.length - 1; i >= 0; i--) {
            p = pops[i];
            if (p.d > 0) { p.d -= dt; continue; }
            if (!p.b) {
              p.b = true;
              ctx.sfx.pop(1 + (p.i % 3) * 0.12 + Math.min(p.i, 8) * 0.03); ctx.sfx.note(Math.min(p.i, 6), 0.35); ctx.haptic('light');
              for (var q = 0; q < 8; q++) { var a = q * Math.PI / 4 + Math.random() * 0.4, v = 2.5 + Math.random() * 2; sparks.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: CL[p.c], life: 1 }); }
            }
            p.t += dt * 5;
            if (p.t >= 1) pops.splice(i, 1);
          }
          for (i = falls.length - 1; i >= 0; i--) {
            p = falls[i]; p.vy += 30 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.x < 0.5 || p.x > UW - 0.5) p.vx = -p.vx;
            if (!p.landed && p.y > UH - 0.6) { p.landed = true; if (landGap <= 0) { landGap = 0.05; ctx.sfx.pop(0.7); ctx.haptic(5); } }
            if (p.y > UH + 1) falls.splice(i, 1);
          }
          for (i = sparks.length - 1; i >= 0; i--) { p = sparks[i]; p.vy += 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 2.2; if (p.life <= 0) sparks.splice(i, 1); }
          if (sparks.length > 200) sparks.splice(0, sparks.length - 200);
          for (i = floats.length - 1; i >= 0; i--) { floats[i].t += dt * 0.8; if (floats[i].t >= 1) floats.splice(i, 1); }
          if (dieT >= 0) dieT += dt;
          if (phase === 'over' && dieT >= 1.8) { phase = 'result'; phaseT = 0; ctx.sfx.stamp(); if (newBest) { ctx.sfx.win(); ctx.fx.burst(ax + aw / 2, ay + ah * 0.4, 80, CL, { speed: 700 }); } }
          else if (phase === 'clear' && phaseT > 2.8) { startLevel(level + 1); ctx.sfx.whoosh(); }
          else if (phase === 'result' && phaseT > 4.2) newRun();
        },

        draw: function (g) {
          var unit = (chipW - 8) / 2, best = ctx.getBest();
          chip(ctx, g, chipX, chipY, unit, chipH, iconBubbles, ctx.t(TX.score), ctx.comma(score), true);
          chip(ctx, g, chipX + unit + 8, chipY, unit, chipH, function (c, x, y, s, col) { iconTrophy(ctx, c, x, y, s, '#E0A526'); }, ctx.t(TX.best), ctx.comma(Math.max(best || 0, score)), false);

          var R = k * 0.6, i, x, y;
          g.save(); g.translate(ax, ay);
          if (!ctx.dark) { g.save(); g.shadowColor = 'rgba(16,20,16,.18)'; g.shadowBlur = 22; g.shadowOffsetY = 8; ctx.rrect(g, 0, 0, aw, ah, R); g.fillStyle = '#1C3478'; g.fill(); g.restore(); }
          ctx.rrect(g, 0, 0, aw, ah, R); g.clip();
          if (bg) g.drawImage(bg, 0, 0, aw, ah);
          stars.forEach(function (s, n) {
            var tw = 0.5 + 0.5 * Math.sin(time * s[2] + n);
            g.fillStyle = 'rgba(255,255,255,' + (0.06 + 0.1 * tw).toFixed(3) + ')'; g.beginPath(); g.arc(s[0] * aw, s[1] * ah, k * s[3], 0, TAU); g.fill();
          });
          g.save();
          if (shake > 0) g.translate(Math.sin(time * 70) * shake * k * 0.08, 0);
          g.scale(k, k);
          // ceiling
          var cv = ceilVis;
          g.fillStyle = '#8FA3C8'; g.fillRect(0, 0, UW, cv);
          g.fillStyle = '#6C80A8'; for (y = cv - 0.3; y > -1; y -= RH) g.fillRect(0, y, UW, 0.06);
          g.fillStyle = '#C9D6EE'; g.fillRect(0, cv - 0.08, UW, 0.08);
          g.fillStyle = '#55688F'; for (x = 0.5; x < UW; x += 1) { g.beginPath(); g.arc(x, cv - 0.18, 0.05, 0, TAU); g.fill(); }
          // dashed deadline, red and pulsing as the bubbles come near
          var low = lowestRow(G), lowY = low < 0 ? 0 : ceilY() + yOf(low) + 0.45, pulse = 0.5 + 0.5 * Math.sin(time * 8);
          var dg = ctx.clamp((lowY - (DEAD - 2)) / 2, 0, 1) * (0.6 + 0.4 * pulse);
          g.strokeStyle = 'rgba(255,' + Math.round(255 - 163 * dg) + ',' + Math.round(255 - 133 * dg) + ',' + (0.35 + 0.65 * dg).toFixed(3) + ')';
          g.lineWidth = 0.06; g.lineCap = 'round'; g.beginPath();
          for (x = 0.2; x < UW; x += 0.5) { g.moveTo(x, DEAD); g.lineTo(x + 0.25, DEAD); }
          g.stroke();
          // grid
          var quake = shotsLeft === 1 && dieT < 0;
          for (var r = 0; r < ROWS; r++) for (var c = 0; c < wid(r); c++) {
            var v = G[r * COLS + c];
            if (v < 0) continue;
            x = xOf(r, c); y = cv + yOf(r);
            if (quake) x += Math.sin(time * 40 + r * 1.7 + c) * 0.03;
            if (dieT >= 0) {
              var gray = ctx.clamp((dieT * 6 - (low - r)) / 2, 0, 1);
              if (gray > 0) { paintBubble(ctx, g, x, y, 0.5, ctx.mix(CL[v], '#6B7280', gray)); continue; }
            }
            g.drawImage(spr[v], x - 0.5, y - 0.5, 1, 1);
          }
          pops.forEach(function (p) {
            if (!p.b) { g.drawImage(spr[p.c], p.x - 0.5, p.y - 0.5, 1, 1); return; }
            var t = Math.min(1, p.t), s = (1 + t * 0.3) * (1 - t);
            if (s > 0.02) g.drawImage(spr[p.c], p.x - s / 2, p.y - s / 2, s, s);
            g.beginPath(); g.arc(p.x, p.y, 0.5 + t * 0.5, 0, TAU); g.lineWidth = Math.max(0.001, 0.08 * (1 - t)); g.strokeStyle = 'rgba(255,255,255,' + (1 - t).toFixed(3) + ')'; g.stroke();
          });
          falls.forEach(function (f) { g.drawImage(spr[f.c], f.x - 0.5, f.y - 0.5, 1, 1); });
          // aim guide: dots of the shooter colour marching along, fainter after the bounce, ring where it sticks
          if (aiming && aimPath.length >= 2) {
            var carried = 0.7 - (time * 1.4) % 0.5;
            g.fillStyle = CL[cur];
            for (i = 1; i < aimPath.length; i++) {
              var A = aimPath[i - 1], B = aimPath[i], seg = Math.hypot(B[0] - A[0], B[1] - A[1]), d = carried;
              g.globalAlpha = 0.9 * Math.max(0.1, 1 - (i - 1) * 0.35);
              while (d < seg) { g.beginPath(); g.arc(A[0] + (B[0] - A[0]) * d / seg, A[1] + (B[1] - A[1]) * d / seg, 0.09, 0, TAU); g.fill(); d += 0.5; }
              carried = d - seg;
            }
            g.globalAlpha = 1;
            if (ghost) { g.beginPath(); g.arc(ghost[0], ghost[1], 0.46, 0, TAU); g.lineWidth = 0.05; g.strokeStyle = 'rgba(255,255,255,' + (0.6 + 0.3 * pulse).toFixed(3) + ')'; g.stroke(); }
          }
          if (shot) g.drawImage(spr[shot.color], shot.x - 0.5, shot.y - 0.5, 1, 1);
          // launcher
          g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(LX, LY, 0.95, 0, TAU); g.fill();
          if (aiming && aimPath.length >= 2) {
            g.save(); g.translate(LX, LY); g.rotate(Math.atan2(aimPath[1][1] - LY, aimPath[1][0] - LX));
            g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(1.15, 0); g.lineTo(0.78, -0.2); g.lineTo(0.78, 0.2); g.closePath(); g.fill(); g.restore();
          }
          g.beginPath(); g.arc(LX, LY, 0.62, 0, TAU); g.lineWidth = 0.06; g.strokeStyle = 'rgba(255,255,255,.5)'; g.stroke();
          if (!shot && dieT < 0) g.drawImage(spr[cur], LX - 0.5, LY - 0.5, 1, 1);
          // next bubble (tap to swap) with two turning arrows
          g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(NX, NY, 0.6, 0, TAU); g.fill();
          g.drawImage(spr[next], NX - 0.36, NY - 0.36, 0.72, 0.72);
          g.strokeStyle = g.fillStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.05;
          for (var q = 0; q < 2; q++) {
            var a0 = time * 0.8 + q * Math.PI;
            g.beginPath(); g.arc(NX, NY, 0.56, a0, a0 + Math.PI * 0.6); g.stroke();
            g.beginPath(); g.arc(NX + Math.cos(a0 + Math.PI * 0.6) * 0.56, NY + Math.sin(a0 + Math.PI * 0.6) * 0.56, 0.05, 0, TAU); g.fill();
          }
          // shots left before the ceiling drops
          for (i = 0; i < per; i++) {
            g.fillStyle = i < shotsLeft ? (shotsLeft <= 2 ? '#FF8FA3' : 'rgba(255,255,255,.85)') : 'rgba(255,255,255,.18)';
            g.beginPath(); g.arc(5.3 + i * 0.32, 11.45, 0.1, 0, TAU); g.fill();
          }
          g.restore();
          sparks.forEach(function (p) { g.fillStyle = ctx.rgba(p.c, ctx.clamp(p.life, 0, 1).toFixed(3)); g.beginPath(); g.arc(p.x * k, p.y * k, k * 0.08 * (0.4 + 0.6 * p.life), 0, TAU); g.fill(); });
          floats.forEach(function (f) {
            var a = f.t < 0.7 ? 1 : ctx.clamp(1 - (f.t - 0.7) / 0.3, 0, 1), size = k * f.size;
            g.font = ctx.font(size, 900);
            var hw = g.measureText(f.s).width / 2;
            ctx.text(g, f.s, ctx.clamp(f.x * k, hw + 4, aw - hw - 4), f.y * k - f.t * k * 1.2, { size: size, weight: 900, color: f.c, shadow: 'rgba(11,18,48,.67)', blur: 6, oy: 2, alpha: a });
          });
          if (phase === 'clear' || phase === 'result') { g.fillStyle = 'rgba(0,0,0,' + (0.25 * Math.min(1, phaseT / 0.3)).toFixed(3) + ')'; g.fillRect(0, 0, aw, ah); }
          g.restore();
          var mw = Math.max(aw, Math.min(ctx.W - 32, 340));
          if (phase === 'clear') btn = panel(ctx, g, ax + aw / 2, ay + ah * 0.45, mw, phaseT / 0.35, ctx.t(TX.clear), ctx.f(TX.bonus, ctx.comma(clearBonus)), null, ctx.t(TX.next), true);
          else if (phase === 'result') btn = panel(ctx, g, ax + aw / 2, ay + ah * 0.45, mw, phaseT / 0.3, ctx.t(newBest ? TX.newBest : TX.over), ctx.f(TX.points, res.score),
            [[TX.score, res.score, newBest], [TX.best, res.best, false]], ctx.t(TX.again), false);
        },

        down: function (p) {
          var ux = (p.x - ax) / k, uy = (p.y - ay) / k;
          if (phase === 'clear') { if (phaseT > 0.5) { startLevel(level + 1); ctx.sfx.whoosh(); ctx.haptic('light'); } return; }
          if (phase === 'result') { if (phaseT > 0.45) { newRun(); ctx.haptic('light'); } return; }
          if (phase !== 'play' || pointer !== null) return;
          if (Math.hypot(ux - NX, uy - NY) < 0.8 || Math.hypot(ux - LX, uy - LY) < 0.75) {
            if (shot) return;
            var t = cur; cur = next; next = t; ver++;
            ctx.sfx.flip(); ctx.haptic('light');
            return;
          }
          pointer = p.id; aiming = true; aim(ux, uy);
          ctx.sfx.tone(980, 0.04, 'triangle', 0.07, 1300); ctx.haptic('light');
        },
        move: function (p) { if (p.id === pointer && aiming) aim((p.x - ax) / k, (p.y - ay) / k); },
        up: function (p) {
          if (p.id !== pointer) return;
          pointer = null;
          if (!aiming) return;
          aiming = false;
          if (phase !== 'play') return;
          var d = aimDir((p.x - ax) / k, (p.y - ay) / k);
          if (shot) pending = d; else fire(d);
        },

        hint: function () {
          if (phase === 'clear' || phase === 'result') return btn && phaseT > 0.5 ? { x: btn.x, y: btn.y } : null;
          return aimHint();
        },

        debug: function () {
          var h = aimHint(), n = 0;
          G.forEach(function (v) { if (v >= 0) n++; });
          return { phase: phase, score: score, level: level, shots: shotsLeft, drops: drops, bubbles: n, cur: cur, flying: !!shot, best: ctx.getBest(),
            arena: { x: ax, y: ay, w: aw, h: ah },
            targets: h ? [{ x: Math.round(h.x), y: Math.round(h.y), dx: Math.round(h.dx), dy: Math.round(h.dy) }] : btn && phase !== 'play' ? [{ x: Math.round(btn.x), y: Math.round(btn.y) }] : [] };
        },

        destroy: function () { bg = null; spr = []; pops.length = falls.length = sparks.length = floats.length = 0; }
      };
    }
  };
})();
