/* 선 잇기 (flow): my_mini/lib/games/list/flow.dart 를 옮긴 것(어두운 판 #15122A · 칸 #221E3C, 점 색 · 굵은 둥근 선 · 이어지면 빛 테 ·
   지나간 칸 물들기 · 손가락 자리, 다른 선을 가로지르면 끊김, 다 채우면 대각선 반짝임 + 별 조각). 판은 앱과 같은 생성기
   (뱀 길을 '뒤로 물기'로 섞은 한붓 길을 토막 내어, 언제나 풀린다).
   플레이어블: 5x5 판이 바로 보이고 힌트가 첫 짝의 길을 따라 끈다. 깨면 '클리어!' + 색종이 → 새 판이 저절로(5x5 둘 뒤 6x6).
   단계 숫자 · 'n/m' 은 보이지 않는다(이은 선은 색 점으로). */
(function () {
  'use strict';

  var TX = {
    lines: { ko: '이은 선', ja: 'つないだ線', en: 'Flows' },
    fill: { ko: '채움', ja: '埋めた', en: 'Filled' },
    clear: { ko: '클리어!', ja: 'クリア！', en: 'Cleared!' },
    fillAll: { ko: '빈칸이 남았어요: 선으로 모두 채워요', ja: '空きマスがあります：線で全部埋めよう', en: 'Empty squares left: fill them all with lines' }
  };

  var TAU = Math.PI * 2;
  var PAL = ['#FF3B47', '#2E7BFF', '#22C55E', '#FFD21F', '#FF8A1F', '#22D3EE', '#E040FB', '#8B5CF6', '#FF7AB6', '#A3E635', '#EDEDED', '#14B8A6', '#B8732E', '#6366F1', '#C2185B', '#9CA3AF'];

  /* ---------- puzzle (FlowPuzzle.generate): a Hamiltonian path cut into pieces; piece ends are the dots ---------- */
  function adjacent(a, b, n) { return Math.abs((a / n | 0) - (b / n | 0)) + Math.abs(a % n - b % n) === 1; }
  function neighbors(i, n) {
    var r = i / n | 0, c = i % n, out = [];
    if (r > 0) out.push(i - n);
    if (c < n - 1) out.push(i + 1);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    return out;
  }
  function rev(p, a, b) { while (a < b) { var t = p[a]; p[a] = p[b]; p[b] = t; a++; b--; } }
  // backbite: hook one end onto a neighbour cell and flip the loop in front of it; still visits every cell once
  function backbite(p, n) {
    if (Math.random() < 0.5) rev(p, 0, p.length - 1);
    var opts = neighbors(p[0], n).filter(function (x) { return x !== p[1]; });
    if (!opts.length) return;
    rev(p, 0, p.indexOf(opts[Math.random() * opts.length | 0]) - 1);
  }
  function cut(p, n, maxLen) {
    var segs = [], i = 0;
    while (i < p.length) {
      var rem = p.length - i, opts = [];
      for (var len = 3; len <= Math.min(maxLen, rem); len++) if ((rem - len === 0 || rem - len >= 3) && !adjacent(p[i], p[i + len - 1], n)) opts.push(len);
      if (!opts.length) return null;
      var l = opts[Math.random() * opts.length | 0];
      segs.push(p.slice(i, i + l)); i += l;
    }
    return segs;
  }
  function generate(n) {
    for (;;) {
      var p = [];
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) p.push(r * n + (r % 2 ? n - 1 - c : c));
      for (var k = 0; k < n * n * 30; k++) backbite(p, n);
      var segs = cut(p, n, n + 2);
      if (segs && segs.length >= 3 && segs.length <= 16) return { n: n, paths: segs };
    }
  }

  /* ---------- drawing lines (FlowPlay) ---------- */
  function newPlay(pz) {
    var P = { pz: pz, n: pz.n, lines: pz.paths.map(function () { return []; }), endColor: [], active: -1, snap: null };
    for (var i = 0; i < pz.n * pz.n; i++) P.endColor.push(-1);
    pz.paths.forEach(function (path, c) { P.endColor[path[0]] = c; P.endColor[path[path.length - 1]] = c; });
    return P;
  }
  function otherEnd(P, c, end) { var p = P.pz.paths[c]; return p[0] === end ? p[p.length - 1] : p[0]; }
  function connected(P, c) { var l = P.lines[c]; return l.length >= 2 && l[l.length - 1] === otherEnd(P, c, l[0]); }
  function connectedCount(P) { var k = 0; for (var c = 0; c < P.lines.length; c++) if (connected(P, c)) k++; return k; }
  function filled(P) { var k = 0; P.lines.forEach(function (l) { k += l.length; }); return k; }
  function solved(P) { return connectedCount(P) === P.lines.length && filled(P) === P.n * P.n; }
  // other lines go back to how they were when this drag began, cut just before the first cell the active line now covers
  function restoreOthers(P) {
    if (P.active < 0 || !P.snap) return false;
    var mine = [], cutAny = false;
    P.lines[P.active].forEach(function (i) { mine[i] = 1; });
    for (var o = 0; o < P.lines.length; o++) {
      if (o === P.active) continue;
      var s = P.snap[o], before = P.lines[o].length, j = -1;
      for (var q = 0; q < s.length; q++) if (mine[s[q]]) { j = q; break; }
      P.lines[o] = j < 0 ? s.slice() : s.slice(0, j);
      if (P.lines[o].length < before) cutAny = true;
    }
    return cutAny;
  }
  function begin(P, cell) {
    var ec = P.endColor[cell];
    if (ec >= 0) {
      P.snap = P.lines.map(function (l) { return l.slice(); });
      P.lines[ec] = [cell]; P.active = ec; restoreOthers(P);
      return true;
    }
    for (var c = 0; c < P.lines.length; c++) {
      var i = P.lines[c].indexOf(cell);
      if (i >= 0) {
        P.snap = P.lines.map(function (l) { return l.slice(); });
        P.lines[c] = P.lines[c].slice(0, i + 1); P.active = c; restoreOthers(P);
        return true;
      }
    }
    return false;
  }
  // one cell further from the head: 'extend' | 'back' | 'cut' | 'connect' | 'blocked' | null
  function stepTo(P, cell) {
    var c = P.active;
    if (c < 0) return null;
    var line = P.lines[c], head = line[line.length - 1];
    if (cell === head || !adjacent(head, cell, P.n)) return null;
    var i = line.indexOf(cell);
    if (i >= 0) { line.length = i + 1; restoreOthers(P); return 'back'; }
    if (connected(P, c)) return 'blocked';
    var ec = P.endColor[cell];
    if (ec >= 0 && ec !== c) return 'blocked';
    line.push(cell);
    var cutAny = restoreOthers(P);
    return ec === c ? 'connect' : cutAny ? 'cut' : 'extend';
  }

  /* ---------- small app widgets ---------- */
  function chipBox(ctx, g, x, y, w, h) {
    ctx.rrect(g, x + 0.6, y + 0.6, w - 1.2, h - 1.2, 16); g.fillStyle = ctx.C.surface; g.fill();
    g.lineWidth = 1.2; g.strokeStyle = ctx.C.hair; g.stroke();
  }
  function iconTimeline(g, x, y, s, col) {
    g.save(); g.translate(x - s / 2, y - s / 2); g.scale(s / 24, s / 24); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2; g.lineJoin = 'round';
    var pts = [[3, 16], [9, 9], [14, 14], [21, 6]];
    g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
    pts.forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 2.3, 0, TAU); g.fill(); });
    g.restore();
  }
  function iconGrid(g, x, y, s, col) {
    g.save(); g.translate(x - s / 2, y - s / 2); g.scale(s / 24, s / 24); g.strokeStyle = col; g.lineWidth = 2;
    g.strokeRect(4, 4, 16, 16); g.beginPath(); g.moveTo(9.3, 4); g.lineTo(9.3, 20); g.moveTo(14.7, 4); g.lineTo(14.7, 20); g.moveTo(4, 9.3); g.lineTo(20, 9.3); g.moveTo(4, 14.7); g.lineTo(20, 14.7); g.stroke();
    g.restore();
  }
  function iconRestart(g, x, y, s, col) {
    g.save(); g.translate(x - s / 2, y - s / 2); g.scale(s / 24, s / 24); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.arc(12, 13, 7, -Math.PI * 0.62, Math.PI * 1.15); g.stroke();
    g.beginPath(); g.moveTo(7.6, 2.8); g.lineTo(7.4, 8.6); g.lineTo(12.6, 7.2); g.closePath(); g.fill();
    g.restore();
  }
  function star4(g, x, y, r) {
    g.beginPath(); g.moveTo(x, y - r * 1.6); g.lineTo(x + r * 0.45, y - r * 0.45); g.lineTo(x + r * 1.6, y); g.lineTo(x + r * 0.45, y + r * 0.45);
    g.lineTo(x, y + r * 1.6); g.lineTo(x - r * 0.45, y + r * 0.45); g.lineTo(x - r * 1.6, y); g.lineTo(x - r * 0.45, y - r * 0.45); g.closePath(); g.fill();
  }

  GAMES['flow'] = {
    name: { ko: '선 잇기', ja: '線つなぎ', en: 'Color Link' },
    tip: { ko: '같은 색끼리 선으로 잇고 칸을 다 채워요', ja: '同じ色を線でつないで、全部うめよう', en: 'Link matching colors and fill the board' },
    color: '#A368FF',
    kind: 'puzzle',
    make: function (ctx) {
      var level = 1, P = newPlay(generate(5));
      var bx = 0, by = 0, S = 300, pad = 7, cell = 57, chipX = 0, chipY = 0, chipW = 300, chipH = 48, reset = { x: 0, y: 0, r: 22 };
      var time = 0, pointer = null, finger = null, won = false, winT = -1, winStage = 0, nudged = false, blockGap = 0, introT = 0;
      var bursts = [], sparks = [], taps = [];

      function n() { return P.n; }
      function center(i) { return { x: bx + pad + (i % n() + 0.5) * cell, y: by + pad + ((i / n() | 0) + 0.5) * cell }; }
      function geom() { pad = S * 0.025; cell = (S - pad * 2) / n(); }
      function cellAt(p, clamp) {
        var col = Math.floor((p.x - bx - pad) / cell), row = Math.floor((p.y - by - pad) / cell), m = n();
        if (clamp) { col = ctx.clamp(col, 0, m - 1); row = ctx.clamp(row, 0, m - 1); }
        else if (col < 0 || row < 0 || col >= m || row >= m) return -1;
        return row * m + col;
      }
      function nextLevel() {
        level++;
        P = newPlay(generate(level <= 2 ? 5 : 6));
        geom();
        won = false; winT = -1; winStage = 0; nudged = false; pointer = null; finger = null; introT = 0;
        bursts.length = sparks.length = 0;
        ctx.sfx.whoosh();
      }
      function finishDrag() { pointer = null; P.active = -1; P.snap = null; finger = null; }
      function win() {
        if (won) return;
        won = true; winT = 0; finishDrag();
        ctx.sfx.sparkle(); ctx.haptic('success');
      }
      function feedback(ev, c) {
        if (ev === 'extend') { ctx.sfx.note((P.lines[c].length - 2) % 4, 0.32); ctx.haptic(6); }
        else if (ev === 'back') ctx.haptic(4);
        else if (ev === 'cut') { ctx.sfx.flip(); ctx.haptic('medium'); }
        else if (ev === 'connect') {
          ctx.sfx.ding(); ctx.sfx.note(3, 0.5); ctx.haptic('medium');
          var l = P.lines[c];
          bursts.push({ cell: l[0], c: PAL[c], t: 0 }, { cell: l[l.length - 1], c: PAL[c], t: 0 });
        } else if (ev === 'blocked' && blockGap <= 0) { blockGap = 0.25; ctx.haptic(5); }
      }

      // the hint: the first pair not yet drawn like the generated answer, from its head (or its dot) along the next straight run
      function same(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
      function prefix(a, b) { if (!a.length || a.length > b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
      function hintRun() {
        if (won) return null;
        for (var c = 0; c < P.lines.length; c++) {
          var sol = P.pz.paths[c], back = sol.slice().reverse(), line = P.lines[c], path, from;
          if (same(line, sol) || same(line, back)) continue;
          if (prefix(line, sol)) path = sol; else if (prefix(line, back)) path = back;
          if (path) from = line.length - 1; else { path = sol; from = 0; }
          var to = from + 1, d = path[to] - path[from];
          while (to + 1 < path.length && path[to + 1] - path[to] === d) to++;
          var A = center(path[from]), B = center(path[to]);
          return { x: A.x, y: A.y, dx: B.x - A.x, dy: B.y - A.y };
        }
        return null;
      }

      return {
        layout: function (w, h) {
          chipH = h < 430 ? 42 : 48;
          var gap = h < 430 ? 8 : 10;
          S = Math.floor(Math.max(150, Math.min(w - 32, 520, h - 12 - chipH - gap)));
          var top = Math.round((h - (chipH + gap + S)) / 2);
          chipW = Math.max(S, Math.min(w - 32, 300)); chipX = Math.round((w - chipW) / 2); chipY = top;
          bx = Math.round((w - S) / 2); by = top + chipH + gap;
          geom();
        },

        update: function (dt) {
          time += dt; blockGap -= dt; introT += dt;
          var i, p;
          for (i = bursts.length - 1; i >= 0; i--) { bursts[i].t += dt * 2.2; if (bursts[i].t >= 1) bursts.splice(i, 1); }
          for (i = sparks.length - 1; i >= 0; i--) { p = sparks[i]; p.vy += 3.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.8; if (p.life <= 0) sparks.splice(i, 1); }
          for (i = taps.length - 1; i >= 0; i--) { taps[i].t += dt * 3; if (taps[i].t >= 1) taps.splice(i, 1); }
          if (won) {
            winT += dt;
            if (winStage === 0 && winT >= 0.75) {
              winStage = 1;
              ctx.sfx.win();
              P.pz.paths.forEach(function (path, c) {
                [path[0], path[path.length - 1]].forEach(function (end) {
                  var x = (end % n() + 0.5) / n(), y = ((end / n() | 0) + 0.5) / n();
                  for (var q = 0; q < 6; q++) { var a = Math.random() * TAU, v = 0.2 + Math.random() * 0.5; sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.7, c: PAL[c], life: 1 }); }
                });
              });
              ctx.fx.burst(bx + S / 2, by + S * 0.4, 70, PAL.slice(0, 10), { speed: 650 });
            } else if (winT >= 2.6) nextLevel();
          }
        },

        draw: function (g) {
          var C = ctx.C, m = n(), i, k, c, o;
          // chips: flows as colour dots (no 'n/m'), filled %, and the app's restart button
          var bw = Math.min(46, chipH), unit = (chipW - bw - 16) / 2, cw2 = unit;
          chipBox(ctx, g, chipX, chipY, unit, chipH);
          var withIcon = unit > 120, tx = chipX + 12 + (withIcon ? 24 : 0);
          if (withIcon) iconTimeline(g, chipX + 21, chipY + chipH / 2, 18, ctx.color);
          ctx.text(g, ctx.t(TX.lines), tx, chipY + chipH * 0.33, { size: 11, weight: 700, color: C.soft, align: 'left', maxW: chipX + unit - 10 - tx });
          var dr = Math.min(5, (chipX + unit - 10 - tx) / (P.lines.length * 2.7)), dy = chipY + chipH * 0.66;
          for (c = 0; c < P.lines.length; c++) {
            var dx = tx + dr + c * dr * 2.7;
            g.beginPath(); g.arc(dx, dy, dr, 0, TAU);
            if (connected(P, c)) { g.fillStyle = PAL[c]; g.fill(); }
            else { g.lineWidth = 1.6; g.strokeStyle = ctx.rgba(PAL[c], 0.9); g.stroke(); }
          }
          var x2 = chipX + unit + 8;
          chipBox(ctx, g, x2, chipY, cw2, chipH);
          var tx2 = x2 + 12 + (withIcon ? 24 : 0);
          if (withIcon) iconGrid(g, x2 + 21, chipY + chipH / 2, 18, ctx.color);
          ctx.text(g, ctx.t(TX.fill), tx2, chipY + chipH * 0.33, { size: 11, weight: 700, color: C.soft, align: 'left', maxW: x2 + cw2 - 10 - tx2 });
          ctx.text(g, Math.floor(filled(P) * 100 / (m * m)) + '%', tx2, chipY + chipH * 0.66, { size: chipH < 46 ? 16 : 17, weight: 900, color: C.ink, align: 'left' });
          reset = { x: chipX + chipW - bw / 2, y: chipY + chipH / 2, r: bw / 2 };
          g.beginPath(); g.arc(reset.x, reset.y, reset.r - 1, 0, TAU); g.fillStyle = won ? 'transparent' : ctx.rgba(ctx.color, 0.12); g.fill();
          iconRestart(g, reset.x, reset.y, 24, won ? C.hair : C.ink);

          // board
          if (!ctx.dark) { g.save(); g.shadowColor = 'rgba(16,20,16,.18)'; g.shadowBlur = 22; g.shadowOffsetY = 8; ctx.rrect(g, bx, by, S, S, S * 0.05); g.fillStyle = '#15122A'; g.fill(); g.restore(); }
          ctx.rrect(g, bx, by, S, S, S * 0.05); g.fillStyle = '#15122A'; g.fill();
          var owner = [];
          P.lines.forEach(function (l, cc) { l.forEach(function (q) { owner[q] = cc; }); });
          var d = cell * 0.035;
          for (i = 0; i < m * m; i++) {
            o = owner[i];
            var base = o >= 0 ? ctx.mix('#221E3C', PAL[o], connected(P, o) ? 0.3 : 0.18) : '#221E3C';
            if (winT >= 0) { var dg = (i % m + (i / m | 0)) / (2 * m - 2), e = (winT * 1.4 - dg) * 5; base = ctx.mix(base, '#FFFFFF', Math.exp(-e * e) * 0.55); }
            ctx.rrect(g, bx + pad + (i % m) * cell + d, by + pad + (i / m | 0) * cell + d, cell - 2 * d, cell - 2 * d, cell * 0.14);
            g.fillStyle = base; g.fill();
          }
          // lines
          g.lineCap = 'round'; g.lineJoin = 'round';
          P.lines.forEach(function (l, cc) {
            if (l.length < 2) return;
            g.beginPath();
            l.forEach(function (q, j) { var pt = center(q); if (j) g.lineTo(pt.x, pt.y); else g.moveTo(pt.x, pt.y); });
            if (connected(P, cc)) { g.lineWidth = cell * 0.5; g.strokeStyle = ctx.rgba(PAL[cc], 0.22); g.stroke(); }
            g.lineWidth = cell * 0.32; g.strokeStyle = PAL[cc]; g.stroke();
          });
          // dots (they pop in on a new board)
          P.pz.paths.forEach(function (path, cc) {
            var con = connected(P, cc), pop = ctx.clamp(introT * 3.2 - cc * 0.25, 0, 1);
            [path[0], path[path.length - 1]].forEach(function (end) {
              var pt = center(end), r = cell * 0.34 * ctx.ease.outBack(pop);
              if (winT >= 0) r *= 1 + 0.12 * Math.sin(winT * 9 + cc);
              if (r <= 0.3) return;
              g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(pt.x, pt.y + cell * 0.03, r, 0, TAU); g.fill();
              g.fillStyle = PAL[cc]; g.beginPath(); g.arc(pt.x, pt.y, r, 0, TAU); g.fill();
              g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(pt.x - r * 0.3, pt.y - r * 0.3, r * 0.3, 0, TAU); g.fill();
              if (con) { g.lineWidth = cell * 0.05; g.strokeStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(pt.x, pt.y, r * 0.55, 0, TAU); g.stroke(); }
            });
          });
          bursts.forEach(function (b) {
            var pt = center(b.cell);
            g.lineWidth = Math.max(0.1, cell * 0.08 * (1 - b.t)); g.strokeStyle = ctx.rgba(b.c, ctx.clamp(1 - b.t, 0, 1).toFixed(3));
            g.beginPath(); g.arc(pt.x, pt.y, cell * (0.35 + b.t * 0.55), 0, TAU); g.stroke();
          });
          taps.forEach(function (t) {
            g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - t.t)).toFixed(3) + ')';
            g.beginPath(); g.arc(t.x, t.y, cell * (0.15 + t.t * 0.3), 0, TAU); g.stroke();
          });
          if (finger && P.active >= 0) {
            g.fillStyle = ctx.rgba(PAL[P.active], 0.28); g.beginPath(); g.arc(finger.x, finger.y, cell * 0.8, 0, TAU); g.fill();
          }
          sparks.forEach(function (sp) { g.fillStyle = ctx.rgba(sp.c, ctx.clamp(sp.life, 0, 1).toFixed(3)); star4(g, bx + sp.x * S, by + sp.y * S, cell * 0.09 * (0.5 + sp.life * 0.5)); });
          if (winStage >= 1) {
            var q = winT - 0.75, ts = Math.min(S * 0.13, 40), label = ctx.t(TX.clear);
            g.font = ctx.font(ts, 900);
            var rw = g.measureText(label).width + ts * 1.1, rh = ts * 1.6;
            g.save(); g.translate(bx + S / 2, by + S / 2); var os = ctx.ease.elasticOut(Math.min(1, q / 0.6)); g.scale(os, os); g.rotate(-0.05);
            g.globalAlpha = q > 1.5 ? ctx.clamp(1 - (q - 1.5) / 0.3, 0, 1) : 1;
            ctx.rrect(g, -rw / 2, -rh / 2 + 4, rw, rh, rh / 2); g.fillStyle = 'rgba(0,0,0,.33)'; g.fill();
            ctx.rrect(g, -rw / 2, -rh / 2, rw, rh, rh / 2); g.fillStyle = ctx.color; g.fill();
            ctx.text(g, label, 0, 1, { size: ts, weight: 900, color: '#FFFFFF', shadow: 'rgba(0,0,0,.4)', blur: 6, oy: 2 });
            g.restore();
          }
        },

        down: function (p) {
          if (won) { if (winT > 1) nextLevel(); return; }
          if (Math.hypot(p.x - reset.x, p.y - reset.y) <= reset.r + 6) {
            P.lines.forEach(function (l) { l.length = 0; }); finishDrag(); nudged = false;
            ctx.sfx.whoosh(); ctx.haptic('light');
            return;
          }
          if (pointer !== null) return;
          var c = cellAt(p, false);
          if (c < 0) return;
          if (!begin(P, c)) { taps.push({ x: p.x, y: p.y, t: 0 }); ctx.sfx.place(0.3); ctx.haptic(5); return; }
          pointer = p.id; finger = { x: p.x, y: p.y };
          ctx.sfx.click(); ctx.haptic('light');
        },
        move: function (p) {
          if (p.id !== pointer || P.active < 0) return;
          finger = { x: p.x, y: p.y };
          var target = cellAt(p, true), m = n();
          for (var guard = 0; guard < m * 2; guard++) {
            var c = P.active;
            if (c < 0) break;
            var head = P.lines[c][P.lines[c].length - 1];
            if (head === target) break;
            var dr = (target / m | 0) - (head / m | 0), dc = target % m - head % m;
            var ev = stepTo(P, Math.abs(dr) >= Math.abs(dc) ? head + Math.sign(dr) * m : head + Math.sign(dc));
            if (!ev) break;
            feedback(ev, c);
            if (solved(P)) { win(); return; }
            if (ev === 'blocked' || ev === 'connect') break;
          }
        },
        up: function (p) {
          if (p.id !== pointer) return;
          finishDrag();
          if (solved(P)) win();
          else if (!nudged && connectedCount(P) === P.lines.length && filled(P) < n() * n()) {
            // every pair linked but squares still empty: say it once
            nudged = true; ctx.sfx.buzz(); ctx.toast(ctx.t(TX.fillAll), 1.8);
          }
        },

        hint: function () { return hintRun(); },

        debug: function () {
          var h = hintRun();
          return { phase: won ? 'clear' : 'play', level: level, size: n(), colors: P.lines.length, connected: connectedCount(P), filled: filled(P),
            pct: Math.floor(filled(P) * 100 / (n() * n())), solved: solved(P), board: { x: bx, y: by, s: S },
            targets: h ? [{ x: Math.round(h.x), y: Math.round(h.y), dx: Math.round(h.dx), dy: Math.round(h.dy) }] : [] };
        },

        destroy: function () { bursts.length = sparks.length = taps.length = 0; }
      };
    }
  };
})();
