/* 보석 맞추기 (match3): my_mini/lib/games/list/match3.dart 를 옮긴 것(8x8 보라 판, 깎은 보석 여섯, 밀기 / 차례로 누르기, 연쇄 음,
   넷 = 줄 지우기 보석, 다섯 = 무지개 보석, 움직일 수 없으면 섞기, 위 기록 칸). 플레이어블: 앱 기본 '30번 움직이기',
   다 쓰면 '끝!' → 결과 카드 → 4초 뒤 새 판(카드를 누르면 바로). */
(function () {
  'use strict';

  var TX = {
    score: { ko: '점수', ja: 'スコア', en: 'Score' },
    moves: { ko: '남은 움직임', ja: '残り手数', en: 'Moves left' },
    best: { ko: '최고 기록', ja: 'ベスト', en: 'Best' },
    combo: { ko: '콤보 x{0}!', ja: 'コンボ x{0}!', en: 'Combo x{0}!' },
    shuffle: { ko: '섞어요!', ja: 'シャッフル！', en: 'Shuffle!' },
    finish: { ko: '끝!', ja: 'しゅうりょう！', en: 'Finish!' },
    newBest: { ko: '새 최고 기록!', ja: 'ベスト更新！', en: 'New best!' },
    over: { ko: '게임 끝', ja: 'ゲームオーバー', en: 'Game over' },
    points: { ko: '{0}점', ja: '{0}点', en: '{0} points' },
    again: { ko: '다시 하기', ja: 'もう一回', en: 'Play again' }
  };

  var TAU = Math.PI * 2, N = 8, COLORS = 6, MOVES = 30;
  var NORMAL = 0, ROW = 1, COL = 2, BOMB = 3;
  var IDLE = 0, SWAP = 1, UNSWAP = 2, CLEAR = 3, FALL = 4, SHUF = 5, END = 6;
  // base, light, dark (루비 · 호박 · 토파즈 · 에메랄드 · 사파이어 · 자수정)
  var GC = [['#FF3B5C', '#FFA3B4', '#A8102F'], ['#FF9A1F', '#FFD69A', '#B8590A'], ['#FFDD33', '#FFF6B8', '#C29A00'],
    ['#22D47B', '#A6F7CC', '#0B7F45'], ['#3D8BFF', '#B0D0FF', '#1748A8'], ['#B45CFF', '#E4C2FF', '#6420AD']];

  /* ---------- rules (Match3Board) ---------- */
  function newBoard() { return { cells: [], nid: 1 }; }
  function mk(B, color, kind) { return { id: B.nid++, color: color, kind: kind || NORMAL }; }
  function colorAt(B, i) { var g = B.cells[i]; return !g || g.kind === BOMB ? -1 : g.color; }
  function isLine(g) { return g.kind === ROW || g.kind === COL; }
  function adjacent(a, b) { return Math.abs((a / N | 0) - (b / N | 0)) + Math.abs(a % N - b % N) === 1; }
  function fillFresh(B) {
    do {
      for (var i = 0; i < N * N; i++) {
        var r = i / N | 0, c = i % N, ban = [], ok = [];
        if (c >= 2 && colorAt(B, i - 1) === colorAt(B, i - 2)) ban[colorAt(B, i - 1)] = 1;
        if (r >= 2 && colorAt(B, i - N) === colorAt(B, i - 2 * N)) ban[colorAt(B, i - N)] = 1;
        for (var k = 0; k < COLORS; k++) if (!ban[k]) ok.push(k);
        B.cells[i] = mk(B, ok[Math.random() * ok.length | 0]);
      }
    } while (!hasMove(B));
  }
  function idx(hor, a, k) { return hor ? a * N + k : k * N + a; }
  function runs(B) {
    var out = [];
    for (var hv = 0; hv < 2; hv++) {
      var hor = hv === 0;
      for (var a = 0; a < N; a++) {
        var b = 0;
        while (b < N) {
          var col = colorAt(B, idx(hor, a, b)), e = b + 1;
          while (col >= 0 && e < N && colorAt(B, idx(hor, a, e)) === col) e++;
          if (col >= 0 && e - b >= 3) { var cs = []; for (var k = b; k < e; k++) cs.push(idx(hor, a, k)); out.push({ cells: cs, h: hor }); }
          b = e;
        }
      }
    }
    return out;
  }
  function hasMatch(B) { return runs(B).length > 0; }
  // longest same-colour line through i (horizontal or vertical)
  function lineLen(B, i) {
    var col = colorAt(B, i);
    if (col < 0) return 0;
    var r = i / N | 0, c = i % N, h = 1, v = 1, k;
    for (k = c - 1; k >= 0 && colorAt(B, r * N + k) === col; k--) h++;
    for (k = c + 1; k < N && colorAt(B, r * N + k) === col; k++) h++;
    for (k = r - 1; k >= 0 && colorAt(B, k * N + c) === col; k--) v++;
    for (k = r + 1; k < N && colorAt(B, k * N + c) === col; k++) v++;
    return Math.max(h, v);
  }
  function swap(B, a, b) { var t = B.cells[a]; B.cells[a] = B.cells[b]; B.cells[b] = t; }
  function swapWorks(B, a, b) {
    var ga = B.cells[a], gb = B.cells[b];
    if (!ga || !gb) return false;
    if (ga.kind === BOMB || gb.kind === BOMB) return true;
    if (isLine(ga) && isLine(gb)) return true;
    swap(B, a, b);
    var ok = lineLen(B, a) >= 3 || lineLen(B, b) >= 3;
    swap(B, a, b);
    return ok;
  }
  // every swap that pops something (first = stop at the first one)
  function moves(B, first) {
    var out = [];
    for (var i = 0; i < N * N; i++) for (var d = 1; d <= N; d += N - 1) {
      var j = i + d;
      if ((d === 1 ? i % N < N - 1 : j < N * N) && swapWorks(B, i, j)) { out.push([i, j]); if (first) return out; }
    }
    return out;
  }
  function hasMove(B) { return moves(B, true).length > 0; }
  function trySwap(B, a, b) {
    if (!adjacent(a, b)) return null;
    var ga = B.cells[a], gb = B.cells[b];
    if (!ga || !gb) return null;
    swap(B, a, b);
    if (ga.kind === BOMB || gb.kind === BOMB) {
      if (ga.kind === BOMB && gb.kind === BOMB) { var all = []; for (var i = 0; i < N * N; i++) all.push(i); return resolve(B, all, [], null); }
      return resolve(B, [ga.kind === BOMB ? b : a], [], ga.kind === BOMB ? gb.color : ga.color);
    }
    if (isLine(ga) && isLine(gb)) return resolve(B, [a, b], [], null);
    if (!hasMatch(B)) { swap(B, a, b); return null; }
    return resolve(B, [], [a, b], null);
  }
  function resolve(B, forced, swapCells, bombColor) {
    // runs that share cells form one group (L / T shapes)
    var groups = [];
    runs(B).forEach(function (run) {
      var hit = groups.filter(function (g) { return run.cells.some(function (c) { return g.set[c]; }); });
      if (!hit.length) { var s = []; run.cells.forEach(function (c) { s[c] = 1; }); groups.push({ set: s, runs: [run] }); return; }
      var first = hit[0];
      run.cells.forEach(function (c) { first.set[c] = 1; }); first.runs.push(run);
      for (var h = 1; h < hit.length; h++) {
        for (var c = 0; c < N * N; c++) if (hit[h].set[c]) first.set[c] = 1;
        first.runs = first.runs.concat(hit[h].runs); groups.splice(groups.indexOf(hit[h]), 1);
      }
    });
    var create = [];
    groups.forEach(function (g) {
      var longest = g.runs[0];
      g.runs.forEach(function (r) { if (r.cells.length > longest.cells.length) longest = r; });
      var len = longest.cells.length;
      var cross = g.runs.some(function (r) { return r.h; }) && g.runs.some(function (r) { return !r.h; });
      var kind = len >= 5 ? BOMB : (len === 4 || cross) ? (longest.h ? ROW : COL) : NORMAL;
      if (kind === NORMAL) return;
      var pos = -1;
      swapCells.forEach(function (c) { if (pos < 0 && g.set[c]) pos = c; });
      if (pos < 0) pos = longest.cells[longest.cells.length >> 1];
      create.push({ cell: pos, gem: mk(B, kind === BOMB ? -1 : colorAt(B, pos), kind) });
    });
    var inClear = [], queue = [];
    function add(i) { if (!inClear[i]) { inClear[i] = true; queue.push(i); } }
    forced.forEach(add);
    groups.forEach(function (g) { for (var c = 0; c < N * N; c++) if (g.set[c]) add(c); });
    var used = [], blasts = [], bombs = [];
    for (var h = 0; h < queue.length; h++) {
      var i = queue[h], gm = B.cells[i], r = i / N | 0, c = i % N, k;
      if (!gm || gm.kind === NORMAL || used[i]) continue;
      used[i] = true;
      if (gm.kind === ROW) { blasts.push({ cell: i, kind: ROW }); for (k = 0; k < N; k++) add(r * N + k); }
      else if (gm.kind === COL) { blasts.push({ cell: i, kind: COL }); for (k = 0; k < N; k++) add(k * N + c); }
      else {
        var color = bombColor !== null ? bombColor : commonColor(B, inClear);
        bombColor = null;
        bombs.push({ cell: i, color: color });
        for (k = 0; k < N * N; k++) if (colorAt(B, k) === color) add(k);
      }
    }
    var cleared = [];
    for (var j = 0; j < N * N; j++) if (inClear[j]) { if (B.cells[j]) cleared.push({ cell: j, gem: B.cells[j] }); B.cells[j] = null; }
    create.forEach(function (x) { B.cells[x.cell] = x.gem; });
    return { cleared: cleared, created: create, blasts: blasts, bombs: bombs,
      points: cleared.length * 10 + create.length * 20 + blasts.length * 30 + bombs.length * 60 };
  }
  function commonColor(B, skip) {
    var count = [0, 0, 0, 0, 0, 0], best = 0;
    for (var i = 0; i < N * N; i++) { var c = colorAt(B, i); if (c >= 0 && !skip[i]) count[c]++; }
    for (var k = 1; k < COLORS; k++) if (count[k] > count[best]) best = k;
    return best;
  }
  function collapse(B) {
    var drops = [];
    for (var c = 0; c < N; c++) {
      var w = N - 1, r;
      for (r = N - 1; r >= 0; r--) {
        var g = B.cells[r * N + c];
        if (!g) continue;
        if (r !== w) { B.cells[w * N + c] = g; B.cells[r * N + c] = null; drops.push({ gem: g, from: r, to: w }); }
        w--;
      }
      var missing = w + 1;
      for (r = w; r >= 0; r--) { var ng = mk(B, Math.random() * COLORS | 0); B.cells[r * N + c] = ng; drops.push({ gem: ng, from: r - missing, to: r }); }
    }
    return drops;
  }
  function reshuffle(B) {
    var gems = B.cells.filter(function (g) { return !!g; });
    for (var a = 0; a < 300; a++) {
      for (var i = gems.length - 1; i > 0; i--) { var j = Math.random() * (i + 1) | 0, x = gems[i]; gems[i] = gems[j]; gems[j] = x; }
      for (var k = 0; k < N * N; k++) B.cells[k] = k < gems.length ? gems[k] : mk(B, Math.random() * COLORS | 0);
      if (!hasMatch(B) && hasMove(B)) return;
    }
    fillFresh(B);
  }

  /* ---------- gem models (unit size, centre 0,0), lit from the top-left like _GemModel ---------- */
  function ring(n, r, start) { var p = []; for (var i = 0; i < n; i++) p.push([Math.cos(start + i * TAU / n) * r, Math.sin(start + i * TAU / n) * r]); return p; }
  var OUT = [ring(10, 0.47, -Math.PI / 2), ring(6, 0.48, 0), [[0, -0.5], [0.4, 0], [0, 0.5], [-0.4, 0]],
    [[-0.28, -0.42], [0.28, -0.42], [0.42, -0.28], [0.42, 0.28], [0.28, 0.42], [-0.28, 0.42], [-0.42, 0.28], [-0.42, -0.28]],
    [[-0.42, -0.4], [0.42, -0.4], [0.44, 0.06], [0, 0.48], [-0.44, 0.06]], [[0, -0.46], [0.5, 0.4], [-0.5, 0.4]]];
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
  function paintGem(ctx, c, k, white) {
    var col = GC[k], outer = OUT[k], cy = k === 5 ? 0.1 : 0;
    var inner = outer.map(function (p) { return [p[0] * 0.52, cy + (p[1] - cy) * 0.52]; });
    c.lineJoin = 'round';
    c.save(); c.translate(0, white ? 0.06 : 0.05); poly(c, outer); c.fillStyle = white ? 'rgba(0,0,0,.16)' : 'rgba(0,0,0,.28)'; c.fill(); c.restore();
    for (var i = 0; i < outer.length; i++) {
      var j = (i + 1) % outer.length, mx = (outer[i][0] + outer[j][0]) / 2, my = (outer[i][1] + outer[j][1]) / 2 - cy;
      var len = Math.hypot(mx, my) || 1, k2 = (mx * -0.6 + my * -0.8) / len;
      poly(c, [outer[i], outer[j], inner[j], inner[i]]);
      c.fillStyle = k2 >= 0 ? ctx.mix(col[0], col[1], k2 * 0.85) : ctx.mix(col[0], col[2], -k2 * 0.8); c.fill();
      c.strokeStyle = c.fillStyle; c.lineWidth = 0.006; c.stroke(); // hide hairline seams between facets
    }
    poly(c, inner); c.fillStyle = ctx.mix(col[0], col[1], 0.3); c.fill();
    c.beginPath(); c.ellipse(k === 5 ? -0.07 : -0.12, k === 5 ? 0.02 : -0.17, 0.1, 0.05, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
    poly(c, outer); c.lineWidth = white ? 0.05 : 0.035; c.strokeStyle = white ? '#FFFFFF' : col[2]; c.stroke();
  }
  function paintRainbow(c, time) {
    var pulse = 0.5 + 0.5 * Math.sin(time * 5);
    c.beginPath(); c.arc(0, 0, 0.54, 0, TAU); c.fillStyle = 'rgba(255,255,255,' + (0.18 + 0.15 * pulse).toFixed(3) + ')'; c.fill();
    c.beginPath(); c.arc(0, 0, 0.44, 0, TAU); c.fillStyle = '#2B1F45'; c.fill();
    for (var k = 0; k < 6; k++) {
      var a = time * 1.6 + k * Math.PI / 3;
      c.beginPath(); c.arc(Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0.1, 0, TAU); c.fillStyle = GC[k][0]; c.fill();
    }
    c.beginPath(); c.arc(0, 0, 0.1, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
    c.beginPath(); c.ellipse(-0.12, -0.17, 0.1, 0.05, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill();
  }

  /* ---------- small app widgets: record chip, icons, result card ---------- */
  function iconGem(g, x, y, s, col) {
    g.save(); g.translate(x - s / 2, y - s / 2); g.scale(s / 24, s / 24); g.fillStyle = col; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(7, 4.5); g.lineTo(17, 4.5); g.lineTo(21.5, 9.6); g.lineTo(12, 20.5); g.lineTo(2.5, 9.6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(2.8, 9.6); g.lineTo(21.2, 9.6); g.moveTo(9, 9.6); g.lineTo(12, 19.5); g.lineTo(15, 9.6); g.stroke();
    g.restore();
  }
  function iconSwap(g, x, y, s, col) {
    g.save(); g.translate(x - s / 2, y - s / 2); g.scale(s / 24, s / 24); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(4, 8); g.lineTo(16, 8); g.moveTo(20, 16); g.lineTo(8, 16); g.stroke();
    g.beginPath(); g.moveTo(15, 4); g.lineTo(20.5, 8); g.lineTo(15, 12); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(9, 12); g.lineTo(3.5, 16); g.lineTo(9, 20); g.closePath(); g.fill();
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
  // the app's _Chip: surface card, game-colour icon (only when the label really fits beside it), small label over a bold value
  function chip(ctx, g, x, y, w, h, icon, label, value, big, warn) {
    var C = ctx.C, col = ctx.color;
    ctx.rrect(g, x + 0.6, y + 0.6, w - 1.2, h - 1.2, 16); g.fillStyle = C.surface; g.fill();
    g.lineWidth = 1.2; g.strokeStyle = warn ? col : C.hair; g.stroke();
    g.font = ctx.font(11, 700);
    var withIcon = 50.4 + g.measureText(label).width <= w, px = withIcon ? 12 : 8, tx = x + px + (withIcon ? 24 : 0), room = x + w - px - tx;
    if (withIcon) icon(g, x + px + 9, y + h / 2, 18, col);
    ctx.text(g, label, tx, y + h * 0.33, { size: 11, weight: 700, color: C.soft, align: 'left', maxW: room });
    ctx.text(g, value, tx, y + h * 0.66, { size: (big ? 20 : 17) * (h < 46 ? 0.92 : 1), weight: 900, color: warn ? col : C.ink, align: 'left', maxW: room });
  }
  // result card (same look as the other games of this page, from the app's ResultView)
  function card(ctx, g, cx, cy, maxW, t, title, sub, score, best, isNew) {
    var e = ctx.ease.outBack(Math.min(1, t)), C = ctx.C, a = Math.min(1, t);
    var cw = Math.min(maxW - 24, 320), pad = 18, ch = 250, x = cx - cw / 2, y0 = cy - ch / 2;
    g.save(); g.globalAlpha = a; g.translate(cx, cy); g.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e); g.translate(-cx, -cy);
    g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
    ctx.rrect(g, x, y0, cw, ch, 24); g.fillStyle = C.surface; g.fill(); g.restore();
    g.lineWidth = 1; g.strokeStyle = C.hair; ctx.rrect(g, x + 0.5, y0 + 0.5, cw - 1, ch - 1, 24); g.stroke();
    var y = y0 + pad + 16;
    ctx.text(g, title, cx, y, { size: 26, weight: 900, color: C.ink, maxW: cw - pad * 2 }); y += 28;
    ctx.text(g, sub, cx, y, { size: 14, weight: 600, color: C.soft, maxW: cw - pad * 2 }); y += 18;
    var bw = (cw - pad * 2 - 10) / 2, bh = 72;
    [[TX.score, score, isNew], [TX.best, best, false]].forEach(function (b, i) {
      var bx = x + pad + i * (bw + 10);
      ctx.rrect(g, bx, y, bw, bh, 16); g.fillStyle = b[2] ? ctx.rgba(ctx.color, 0.14) : C.surface; g.fill();
      g.lineWidth = 1.4; g.strokeStyle = b[2] ? ctx.color : C.hair; g.stroke();
      ctx.text(g, ctx.t(b[0]), bx + bw / 2, y + 20, { size: 13, weight: 700, color: C.soft, maxW: bw - 16 });
      ctx.text(g, b[1], bx + bw / 2, y + 48, { size: 27, weight: 900, color: C.ink, maxW: bw - 16 });
    });
    y += bh + 16;
    var btnW = cw - pad * 2, btnH = 50, ink = ctx.inkOn(ctx.color), label = ctx.t(TX.again);
    ctx.rrect(g, x + pad, y, btnW, btnH, 18); g.fillStyle = ctx.color; g.fill();
    g.font = ctx.font(17, 800); var lw = g.measureText(label).width, ix = cx - (lw + 26) / 2;
    g.fillStyle = ink; g.beginPath(); g.moveTo(ix + 3, y + btnH / 2 - 8); g.lineTo(ix + 16, y + btnH / 2); g.lineTo(ix + 3, y + btnH / 2 + 8); g.closePath(); g.fill();
    ctx.text(g, label, ix + 26, y + btnH / 2 + 1, { size: 17, weight: 800, color: ink, align: 'left', maxW: btnW - 50 });
    g.restore();
    return { x: cx, y: y + btnH / 2 };
  }

  GAMES['match3'] = {
    name: { ko: '보석 맞추기', ja: 'ジェムマッチ', en: 'Gem Match' },
    tip: { ko: '바꿔서 셋을 맞추면 펑!', ja: '入れ替えて3つそろえるとポン！', en: 'Swap gems to make three in a row' },
    color: '#FF4F8B',
    kind: 'puzzle',
    make: function (ctx) {
      var B = newBoard();
      fillFresh(B);
      var bx = 0, by = 0, S = 300, pad = 6, cell = 36, chipY = 0, chipH = 48, chipX = 0, chipW = 300, boardBg = null, spr = [], sprS = 1;
      var phase = 'play', phaseT = 0, score = 0, movesLeft = MOVES, combo = 0, bestCombo = 0, newBest = false, res = null, again = null;
      var anim = IDLE, t = 0, dur = 0.2, swapA = -1, swapB = -1, step = null, drops = {}, selected = -1, wig = null, idle = 0, shuffled = false, endT = 0;
      var time = 0, shake = 0, pointer = null, dragFrom = null, hintMove = null;
      var shards = [], beams = [], floats = [];

      function at(col, row) { return { x: bx + pad + (col + 0.5) * cell, y: by + pad + (row + 0.5) * cell }; }
      function cellAt(p) {
        var col = Math.floor((p.x - bx - pad) / cell), row = Math.floor((p.y - by - pad) / cell);
        return col < 0 || row < 0 || col >= N || row >= N ? -1 : row * N + col;
      }
      function go(a, d) { anim = a; t = 0; dur = d; }
      function canPlay() { return phase === 'play' && anim === IDLE && movesLeft > 0; }
      function addFloat(str, x, y, size, color) { floats.push({ s: str, x: x, y: y, size: size, c: color, t: 0 }); }

      function restart() {
        B = newBoard(); fillFresh(B);
        phase = 'play'; phaseT = 0; score = 0; movesLeft = MOVES; combo = 0; bestCombo = 0; newBest = false; res = null; again = null;
        go(IDLE, 0.2); swapA = swapB = selected = -1; step = null; drops = {}; wig = null; idle = 0; endT = 0; pointer = null; dragFrom = null; hintMove = null;
        shards.length = beams.length = floats.length = 0;
        ctx.sfx.whoosh();
      }
      function startSwap(a, b) {
        swapA = a; swapB = b; hintMove = null; wig = null;
        go(SWAP, 0.15);
        ctx.sfx.whoosh(); ctx.haptic('light');
      }
      function beginClear(st) {
        step = st; bestCombo = Math.max(bestCombo, combo);
        var gained = st.points * combo, cx = 0, cy = 0;
        score += gained;
        st.cleared.forEach(function (c) {
          var x = (c.cell % N + 0.5) / N, y = ((c.cell / N | 0) + 0.5) / N;
          cx += x; cy += y;
          var color = c.gem.kind === BOMB ? '#FFFFFF' : GC[c.gem.color][0];
          if (shards.length < 200) for (var k = 0; k < 5; k++) {
            var a = Math.random() * TAU, v = 0.12 + Math.random() * 0.3;
            shards.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.25, c: color, spin: (Math.random() - 0.5) * 16, rot: 0, life: 1 });
          }
        });
        if (st.cleared.length) { cx /= st.cleared.length; cy /= st.cleared.length; }
        st.blasts.forEach(function (bl) {
          var g = st.cleared.filter(function (c) { return c.cell === bl.cell; })[0];
          beams.push({ cell: bl.cell, kind: bl.kind, c: g && g.gem.color >= 0 ? GC[g.gem.color][0] : '#FFFFFF', t: 0 });
        });
        st.bombs.forEach(function (bo) { beams.push({ cell: bo.cell, kind: BOMB, c: GC[bo.color][0], t: 0 }); });
        addFloat('+' + ctx.comma(gained), cx, cy, 0.075, '#FFFFFF');
        if (combo >= 2) addFloat(ctx.f(TX.combo, combo), 0.5, 0.32, 0.08 + Math.min(combo, 6) * 0.008, '#FFE066');
        // the note climbs with every link of the chain (app: Sfx.note variant = combo - 1)
        ctx.sfx.note(Math.min(combo - 1, 6), 0.75);
        ctx.sfx.pop(1 + Math.min(combo - 1, 4) * 0.12);
        ctx.haptic(combo >= 3 ? 'medium' : 'light');
        if (combo >= 5 || st.created.length) ctx.sfx.sparkle();
        if (st.bombs.length) { ctx.sfx.boom(); ctx.haptic('heavy'); shake = 1; }
        else if (st.blasts.length) { ctx.sfx.swish(); ctx.haptic('medium'); shake = Math.max(shake, 0.6); }
        else if (combo >= 3) shake = Math.max(shake, 0.35);
        go(CLEAR, 0.24);
      }
      function settle() {
        combo = 0; swapA = swapB = -1;
        if (movesLeft <= 0) { finish(); return; }
        if (!hasMove(B)) {
          shuffled = false;
          addFloat(ctx.t(TX.shuffle), 0.5, 0.5, 0.11, '#FFFFFF');
          ctx.sfx.whoosh();
          go(SHUF, 0.8);
        } else go(IDLE, 0.2);
        hintMove = null;
      }
      function finish() {
        phase = 'end'; selected = -1; wig = null; hintMove = null;
        addFloat(ctx.t(TX.finish), 0.5, 0.45, 0.14, '#FFFFFF');
        var b = score > 0 ? ctx.best(score) : { best: ctx.getBest(), isNew: false };
        newBest = b.isNew;
        res = { score: score, best: b.best === null ? '-' : ctx.comma(b.best) };
        ctx.sfx.stamp(); ctx.haptic('heavy');
        if (newBest) ctx.sfx.win(); else ctx.sfx.ding();
        endT = 0; go(END, 1);
      }
      function animDone() {
        if (anim === SWAP) {
          var st = trySwap(B, swapA, swapB);
          if (!st) { ctx.sfx.buzz(); ctx.haptic('light'); go(UNSWAP, 0.2); }
          else { movesLeft--; combo = 1; beginClear(st); }
        } else if (anim === UNSWAP) { swapA = swapB = -1; go(IDLE, 0.2); }
        else if (anim === CLEAR) {
          var ds = collapse(B), far = 0;
          drops = {};
          ds.forEach(function (d) { drops[d.gem.id] = d; far = Math.max(far, d.to - d.from); });
          step = null;
          go(FALL, Math.min(0.16 + far * 0.045, 0.5));
        } else if (anim === FALL) {
          drops = {};
          ctx.sfx.place(0.35);
          var next = hasMatch(B) ? resolve(B, [], [], null) : null;
          if (next) { combo++; beginClear(next); } else settle();
        } else if (anim === SHUF) go(IDLE, 0.2);
      }
      // the swap the hint shows: the longest line, lower rows first (more cascades), specials count most
      function bestMove() {
        var ms = moves(B), best = null, bs = -1;
        ms.forEach(function (m) {
          var a = m[0], b = m[1], ga = B.cells[a], gb = B.cells[b], s;
          if (ga.kind === BOMB || gb.kind === BOMB) s = 70;
          else if (isLine(ga) && isLine(gb)) s = 65;
          else { swap(B, a, b); s = Math.max(lineLen(B, a), lineLen(B, b)) * 10; swap(B, a, b); if (isLine(ga) || isLine(gb)) s += 8; }
          s += (b / N | 0) * 0.6;
          if (s > bs) { bs = s; best = m; }
        });
        return best;
      }
      function hintSwipe() {
        if (!canPlay()) return null;
        if (!hintMove) hintMove = bestMove();
        if (!hintMove) return null;
        var a = hintMove[0], b = hintMove[1], A = at(a % N, a / N | 0), Bp = at(b % N, b / N | 0);
        return { x: A.x, y: A.y, dx: Bp.x - A.x, dy: Bp.y - A.y };
      }

      function drawGem(g, x, y, size, gem, rot) {
        if (size <= 0.5) return;
        g.save(); g.translate(x, y);
        if (rot) g.rotate(rot);
        if (gem.kind === BOMB) { g.scale(size, size); paintRainbow(g, time); g.restore(); return; }
        var d = size * sprS;
        g.drawImage(spr[gem.color], -d / 2, -d / 2, d, d);
        if (isLine(gem)) {
          var glow = 0.75 + 0.25 * Math.sin(time * 6), rim = GC[gem.color][2];
          g.scale(size, size);
          [-0.13, 0.13].forEach(function (o) {
            var w = gem.kind === ROW ? 0.78 : 0.075, h = gem.kind === ROW ? 0.075 : 0.78, cx = gem.kind === ROW ? 0 : o, cy = gem.kind === ROW ? o : 0;
            ctx.rrect(g, cx - w / 2 - 0.025, cy - h / 2 - 0.025, w + 0.05, h + 0.05, 0.06); g.fillStyle = ctx.rgba(rim, 0.7); g.fill();
            ctx.rrect(g, cx - w / 2, cy - h / 2, w, h, 0.037); g.fillStyle = 'rgba(255,255,255,' + (0.95 * glow).toFixed(3) + ')'; g.fill();
          });
          g.beginPath(); g.arc(0, 0, 0.52, 0, TAU); g.lineWidth = 0.05; g.strokeStyle = 'rgba(255,255,255,' + (0.5 * glow).toFixed(3) + ')'; g.stroke();
        }
        g.restore();
      }

      function layout(w, h) {
        chipH = h < 430 ? 42 : 48;
        var gap = h < 430 ? 8 : 10;
        S = Math.floor(Math.min(w - 32, 540, h - 12 - chipH - gap));
        S = Math.max(150, S);
        var top = Math.round((h - (chipH + gap + S)) / 2);
        chipW = Math.max(S, Math.min(w - 32, 300)); chipX = Math.round((w - chipW) / 2); chipY = top;
        bx = Math.round((w - S) / 2); by = top + chipH + gap;
        pad = S * 0.02; cell = (S - pad * 2) / N;
        boardBg = ctx.layer(S, S, function (c) {
          ctx.rrect(c, 0, 0, S, S, S * 0.045); c.fillStyle = '#2A1838'; c.fill();
          for (var i = 0; i < N * N; i++) {
            var r = i / N | 0, cc = i % N, d = cell * 0.03;
            ctx.rrect(c, pad + cc * cell + d, pad + r * cell + d, cell - 2 * d, cell - 2 * d, cell * 0.18);
            c.fillStyle = (r + cc) % 2 === 0 ? '#3A2552' : '#32204A'; c.fill();
          }
        });
        // one sprite per gem colour, drawn a bit larger than a cell so the pop / select scale stays crisp
        var big = cell * 1.3, gs = cell * 0.86 * 1.3;
        sprS = 1 / 0.86;
        spr = [];
        for (var k = 0; k < COLORS; k++) spr.push(ctx.layer(big, big, function (c) { c.translate(big / 2, big / 2); c.scale(gs, gs); paintGem(ctx, c, k, false); }));
      }

      return {
        layout: layout,

        update: function (dt) {
          time += dt; phaseT += dt;
          if (shake > 0) shake = Math.max(0, shake - dt * 3);
          if (anim !== IDLE) {
            t += dt / dur;
            if (anim === SHUF && !shuffled && t >= 0.5) { shuffled = true; reshuffle(B); }
            if (anim === END) { endT += dt; if (endT >= 1.6 && phase === 'end') { phase = 'result'; phaseT = 0; if (newBest) { ctx.sfx.sparkle(); ctx.fx.burst(bx + S / 2, by + S * 0.4, 80, GC.map(function (c) { return c[0]; }), { speed: 700 }); } } }
            else if (t >= 1) { t = 1; animDone(); }
          } else if (phase === 'play') {
            idle += dt;
            if (idle > 5 && !wig) { var m = moves(B); if (m.length) wig = m[Math.random() * m.length | 0]; }
          }
          var i, p;
          for (i = shards.length - 1; i >= 0; i--) {
            p = shards[i]; p.vy += 2.4 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; p.life -= dt * 1.4;
            if (p.life <= 0) shards.splice(i, 1);
          }
          for (i = beams.length - 1; i >= 0; i--) { beams[i].t += dt * 2.6; if (beams[i].t >= 1) beams.splice(i, 1); }
          for (i = floats.length - 1; i >= 0; i--) { floats[i].t += dt * 0.9; if (floats[i].t >= 1) floats.splice(i, 1); }
          if (phase === 'result' && phaseT > 4.2) restart();
        },

        draw: function (g) {
          var C = ctx.C, best = ctx.getBest();
          // record chips (flex 4 : 3 : 3 like the app)
          var unit = (chipW - 16) / 10;
          chip(ctx, g, chipX, chipY, unit * 4, chipH, iconGem, ctx.t(TX.score), ctx.comma(score), true, false);
          chip(ctx, g, chipX + unit * 4 + 8, chipY, unit * 3, chipH, iconSwap, ctx.t(TX.moves), String(movesLeft), false, movesLeft <= 5);
          chip(ctx, g, chipX + unit * 7 + 16, chipY, unit * 3, chipH, function (c, x, y, s, col) { iconTrophy(ctx, c, x, y, s, col); },
            ctx.t(TX.best), ctx.comma(Math.max(best || 0, score)), false, false);

          g.save();
          if (shake > 0) { var sk = shake * cell * 0.08; g.translate(Math.sin(time * 83) * sk, Math.cos(time * 71) * sk); }
          if (!ctx.dark) {
            g.save(); g.shadowColor = 'rgba(16,20,16,.18)'; g.shadowBlur = 22; g.shadowOffsetY = 8;
            ctx.rrect(g, bx, by, S, S, S * 0.045); g.fillStyle = '#2A1838'; g.fill(); g.restore();
          }
          if (boardBg) g.drawImage(boardBg, bx, by, S, S);
          if (selected >= 0) {
            var o = at(selected % N, selected / N | 0);
            ctx.rrect(g, o.x - cell * 0.49, o.y - cell * 0.49, cell * 0.98, cell * 0.98, cell * 0.2);
            g.fillStyle = 'rgba(255,255,255,.22)'; g.fill(); g.lineWidth = cell * 0.05; g.strokeStyle = 'rgba(255,255,255,.85)'; g.stroke();
          }
          g.save();
          ctx.rrect(g, bx, by, S, S, S * 0.045); g.clip();
          var tt = ctx.clamp(t, 0, 1), created = [];
          if (anim === CLEAR && step) step.created.forEach(function (c) { created[c.cell] = 1; });
          for (var i = 0; i < N * N; i++) {
            var gm = B.cells[i];
            if (!gm) continue;
            var col = i % N, row = i / N | 0, sc = 1, rot = 0;
            if ((anim === SWAP || anim === UNSWAP) && (i === swapA || i === swapB)) {
              var other = i === swapA ? swapB : swapA;
              var e = anim === SWAP ? ctx.ease.inOutCubic(tt) : 1 - ctx.clamp(ctx.ease.outBack(tt), 0, 1.2);
              col += (other % N - col) * e; row += ((other / N | 0) - row) * e;
              sc = 1 + 0.08 * Math.sin(Math.PI * tt);
            } else if (anim === FALL) {
              var d = drops[gm.id];
              if (d) row = d.from + (d.to - d.from) * ctx.ease.inQuad(tt);
            } else if (anim === CLEAR && created[i]) sc = 0.4 + 0.6 * ctx.ease.outBack(tt);
            else if (anim === SHUF) { sc = ctx.clamp(Math.cos(tt * TAU) * 0.5 + 0.5, 0.05, 1); rot = tt * TAU; }
            if (i === selected) sc *= 1.08 + 0.04 * Math.sin(time * 8);
            if (wig && (i === wig[0] || i === wig[1])) rot += Math.sin(time * 14) * 0.18 * (Math.sin(time * 3) > 0 ? 1 : 0);
            var P = at(col, row);
            drawGem(g, P.x, P.y, cell * 0.86 * sc, gm, rot);
          }
          // popping gems: flash white and shrink
          if (anim === CLEAR && step) {
            var kq = ctx.ease.inQuad(tt);
            step.cleared.forEach(function (c) {
              var o = at(c.cell % N, c.cell / N | 0), s2 = (1 - kq) * (1 + 0.25 * Math.sin(Math.PI * Math.min(tt * 2, 1)));
              if (s2 <= 0.02) return;
              drawGem(g, o.x, o.y, cell * 0.86 * s2, c.gem, 0);
              g.beginPath(); g.arc(o.x, o.y, cell * 0.4 * s2, 0, TAU); g.fillStyle = 'rgba(255,255,255,' + ctx.clamp(0.7 * (1 - tt), 0, 1).toFixed(3) + ')'; g.fill();
            });
          }
          g.restore();
          // line / rainbow beams
          beams.forEach(function (bm) {
            var o = at(bm.cell % N, bm.cell / N | 0), a = ctx.clamp(1 - bm.t, 0, 1);
            if (bm.kind === BOMB) {
              for (var k = 0; k < 3; k++) {
                g.beginPath(); g.arc(o.x, o.y, Math.max(0.1, S * (0.1 + bm.t * 0.9) * (1 - k * 0.15)), 0, TAU);
                g.lineWidth = Math.max(0.1, cell * 0.18 * a); g.strokeStyle = ctx.rgba(GC[(k * 2) % 6][0], a.toFixed(3)); g.stroke();
              }
              return;
            }
            var w = cell * 0.8 * (1 - bm.t * 0.7), row = bm.kind === ROW;
            var rx = row ? bx : o.x - w / 2, ry = row ? o.y - w / 2 : by, rw = row ? S : w, rh = row ? w : S;
            ctx.rrect(g, rx, ry, rw, rh, w / 2); g.fillStyle = ctx.rgba(bm.c, (a * 0.55).toFixed(3)); g.fill();
            ctx.rrect(g, rx + w * 0.3, ry + w * 0.3, rw - w * 0.6, rh - w * 0.6, w / 2); g.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; g.fill();
          });
          // shards
          shards.forEach(function (p) {
            var s = cell * 0.09 * (0.4 + 0.6 * p.life);
            g.save(); g.translate(bx + p.x * S, by + p.y * S); g.rotate(p.rot); g.scale(s, s);
            g.beginPath(); g.moveTo(0, -1); g.lineTo(0.6, 0); g.lineTo(0, 1); g.lineTo(-0.6, 0); g.closePath();
            g.fillStyle = ctx.rgba(p.c, ctx.clamp(p.life, 0, 1).toFixed(3)); g.fill(); g.restore();
          });
          if (anim === END) { ctx.rrect(g, bx, by, S, S, S * 0.045); g.fillStyle = 'rgba(42,24,56,' + (0.35 * tt).toFixed(3) + ')'; g.fill(); }
          // score / combo pops (white with a dark purple shadow, like the app)
          floats.forEach(function (f) {
            var a = f.t < 0.7 ? 1 : ctx.clamp(1 - (f.t - 0.7) / 0.3, 0, 1), pop = f.t < 0.15 ? 0.6 + 0.4 * ctx.ease.outBack(f.t / 0.15) : 1;
            var size = S * f.size;
            g.font = ctx.font(size, 900);
            var hw = g.measureText(f.s).width / 2, x = ctx.clamp(bx + f.x * S, bx + hw + 4, bx + S - hw - 4), y = by + f.y * S - f.t * cell * 0.9;
            g.save(); g.translate(x, y); g.scale(pop, pop);
            ctx.text(g, f.s, 0, 0, { size: size, weight: 900, color: f.c, shadow: 'rgba(42,24,56,.8)', blur: 6, oy: 2, alpha: a });
            g.restore();
          });
          g.restore();
          if (phase === 'result') {
            var q = Math.min(1, phaseT / 0.3);
            g.fillStyle = 'rgba(0,0,0,' + (0.3 * q).toFixed(3) + ')'; g.fillRect(0, 0, ctx.W, ctx.H);
            again = card(ctx, g, bx + S / 2, by + S / 2, Math.max(S, Math.min(ctx.W - 32, 340)), phaseT / 0.3, ctx.t(newBest ? TX.newBest : TX.over),
              ctx.f(TX.points, ctx.comma(res.score)), ctx.comma(res.score), res.best, newBest);
          }
        },

        down: function (p) {
          if (phase === 'result') { if (phaseT > 0.45) restart(); return; }
          if (!canPlay() || pointer !== null) return;
          var c = cellAt(p);
          if (c < 0) return;
          idle = 0; wig = null;
          if (selected >= 0 && adjacent(selected, c)) { var a = selected; selected = -1; startSwap(a, c); return; }
          if (selected === c) { selected = -1; ctx.haptic('light'); ctx.sfx.place(0.3); return; }
          selected = c; pointer = p.id; dragFrom = { x: p.x, y: p.y };
          ctx.sfx.click(); ctx.haptic('light');
        },
        move: function (p) {
          if (p.id !== pointer || !dragFrom || selected < 0) return;
          var dx = p.x - dragFrom.x, dy = p.y - dragFrom.y;
          if (Math.hypot(dx, dy) < cell * 0.33) return;
          var a = selected, r = a / N | 0, c = a % N, to = -1;
          if (Math.abs(dx) > Math.abs(dy)) { var nc = c + (dx > 0 ? 1 : -1); if (nc >= 0 && nc < N) to = r * N + nc; }
          else { var nr = r + (dy > 0 ? 1 : -1); if (nr >= 0 && nr < N) to = nr * N + c; }
          dragFrom = null;
          if (to < 0 || !canPlay()) return;
          selected = -1;
          startSwap(a, to);
        },
        up: function (p) { if (p.id === pointer) { pointer = null; dragFrom = null; } },

        hint: function () {
          if (phase === 'result') return again && phaseT > 0.45 ? { x: again.x, y: again.y } : null;
          return hintSwipe();
        },

        debug: function () {
          var h = hintSwipe();
          return { phase: phase, score: score, moves: movesLeft, combo: combo, bestCombo: bestCombo, best: ctx.getBest(), anim: anim,
            board: { x: bx, y: by, s: S, cell: Math.round(cell * 10) / 10 },
            targets: h ? [{ x: Math.round(h.x), y: Math.round(h.y), dx: Math.round(h.dx), dy: Math.round(h.dy) }] : again && phase === 'result' ? [{ x: Math.round(again.x), y: Math.round(again.y) }] : [] };
        },

        destroy: function () { boardBg = null; spr = []; shards.length = beams.length = floats.length = 0; }
      };
    }
  };
})();
