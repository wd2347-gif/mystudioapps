/* 물 정렬(watersort): my_mini watersort.dart 를 옮김(병 그림 · 기울여 붓기 · 물줄기 · 마개 · 해법 찾기). 아주 작은 판(3~4색 + 빈 병 둘)은 늘 풀리고, 다 풀면 다음 판이 저절로, 막히면 잠깐 뒤 처음부터. 힌트는 해법의 첫 수. */
(function () {
  'use strict';

  var TX = {
    hint: { ko: '병을 눌러 고르고, 부을 병을 눌러요', ja: 'びんを選んで、注ぐ先をタップ', en: 'Tap a bottle, then tap where to pour' },
    colors: { ko: '{0}색', ja: '{0}色', en: '{0} colors' },
    clear: { ko: '클리어!', ja: 'クリア！', en: 'Cleared!' },
    reset: { ko: '처음부터', ja: '最初から', en: 'Restart' }
  };

  var TAU = Math.PI * 2, CAP = 4, RATIO = 3.3, POUR = 0.86;
  function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  // 물 색 열둘(앱 _water): 빨강 · 주황 · 노랑 · 연두 · 초록 · 청록 · 하늘 · 파랑 · 보라 · 분홍 · 갈색 · 회색
  var WATER = ['#F2434E', '#FF8A1F', '#FFD12E', '#8BD43C', '#1E9E57', '#1CC6C0', '#3DA5F5', '#3F51D8', '#9B4DE0', '#FF6FB5', '#9A6233', '#8E99A6'];
  // hue groups: a tiny board takes at most one colour from each, so no two waters look alike
  var GROUPS = [[0, 9], [1, 2], [3], [5, 6, 7], [8]];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function easeOut(x) { return 1 - (1 - x) * (1 - x); }
  function easeIn(x) { return x * x; }

  /* ---------- rules (WaterSortBoard / WaterSortLogic) ---------- */
  function topRun(b) { if (!b.length) return 0; var c = b[b.length - 1], k = 0; for (var i = b.length - 1; i >= 0 && b[i] === c; i--) k++; return k; }
  function canPour(bs, f, t) {
    if (f === t || f < 0 || t < 0 || f >= bs.length || t >= bs.length) return false;
    var a = bs[f], b = bs[t];
    if (!a.length || b.length >= CAP) return false;
    return !b.length || b[b.length - 1] === a[a.length - 1];
  }
  function pour(bs, f, t) {
    if (!canPour(bs, f, t)) return 0;
    var a = bs[f], b = bs[t], c = a[a.length - 1], amt = Math.min(topRun(a), CAP - b.length);
    a.length -= amt; for (var k = 0; k < amt; k++) b.push(c);
    return amt;
  }
  function complete(b) { if (b.length !== CAP) return false; for (var i = 1; i < CAP; i++) if (b[i] !== b[0]) return false; return true; }
  function solved(bs) { for (var i = 0; i < bs.length; i++) if (bs[i].length && !complete(bs[i])) return false; return true; }
  function copy(bs) { return bs.map(function (b) { return b.slice(); }); }
  // depth-first search with a seen-set, the app's move order (same colour first, then one empty bottle, then partial pours)
  function solve(start, maxNodes) {
    var b = copy(start), seen = {}, path = [], nodes = 0;
    function key() { return b.map(function (x) { return x.join(''); }).sort().join('|'); }
    function dfs() {
      if (solved(b)) return true;
      if (++nodes > maxNodes) return false;
      var k = key(); if (seen[k]) return false; seen[k] = 1;
      var firstEmpty = -1, moves = [], f, t, i;
      for (i = 0; i < b.length; i++) if (!b[i].length) { firstEmpty = i; break; }
      for (f = 0; f < b.length; f++) {
        var a = b[f]; if (!a.length) continue;
        var run = topRun(a); if (run === a.length && a.length === CAP) continue;
        for (t = 0; t < b.length; t++) {
          if (t === f) continue;
          var c = b[t];
          if (!c.length) { if (t !== firstEmpty || run === a.length) continue; moves.push([1, f, t]); }
          else if (c.length < CAP && c[c.length - 1] === a[a.length - 1]) moves.push([run <= CAP - c.length ? 0 : 2, f, t]);
        }
      }
      moves.sort(function (x, y) { return x[0] - y[0]; });
      for (i = 0; i < moves.length; i++) {
        f = moves[i][1]; t = moves[i][2];
        var src = b[f], dst = b[t], col = src[src.length - 1], amt = Math.min(topRun(src), CAP - dst.length);
        src.length -= amt; for (var q = 0; q < amt; q++) dst.push(col);
        path.push([f, t]);
        if (dfs()) return true;
        path.pop(); dst.length -= amt; for (q = 0; q < amt; q++) src.push(col);
        if (nodes > maxNodes) return false;
      }
      return false;
    }
    return dfs() ? path : null;
  }
  function generate(colors) {
    for (var tryNo = 0; tryNo < 240; tryNo++) {
      var units = [], i, k;
      for (i = 0; i < colors; i++) for (k = 0; k < CAP; k++) units.push(i);
      for (i = units.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = units[i]; units[i] = units[j]; units[j] = x; }
      var bs = [];
      for (i = 0; i < colors; i++) bs.push(units.slice(i * CAP, (i + 1) * CAP));
      bs.push([]); bs.push([]);
      var pairs = 0, uniform = false;
      for (i = 0; i < colors; i++) { if (complete(bs[i])) uniform = true; for (k = 1; k < CAP; k++) if (bs[i][k] === bs[i][k - 1]) pairs++; }
      if (tryNo < 40 && (uniform || pairs > Math.max(1, Math.floor(colors / 2)))) continue;
      if (!uniform && solve(bs, 20000)) return bs;
    }
    return [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []];
  }

  /* ---------- tilted water (the app's polygon clip) ---------- */
  function segs(units, remove, addColor, add) {
    var out = [], i;
    for (i = 0; i < units.length; i++) { var c = units[i]; if (out.length && out[out.length - 1][0] === c) out[out.length - 1][1] += 1; else out.push([c, 1]); }
    var r = remove || 0;
    while (r > 1e-6 && out.length) { var last = out[out.length - 1]; if (last[1] <= r) { out.pop(); r -= last[1]; } else { last[1] -= r; r = 0; } }
    if (add > 1e-6) { if (out.length && out[out.length - 1][0] === addColor) out[out.length - 1][1] += add; else out.push([addColor, add]); }
    return out;
  }
  function clipPoly(poly, gx, gy, d, keepDeep) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length], va = a[0] * gx + a[1] * gy, vb = b[0] * gx + b[1] * gy;
      var ia = keepDeep ? va >= d : va <= d, ib = keepDeep ? vb >= d : vb <= d;
      if (ia) out.push(a);
      if (ia !== ib) { var t = (d - va) / (vb - va); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  function area(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
  function depthFor(rect, gx, gy, ar) {
    var lo = Infinity, hi = -Infinity, i;
    for (i = 0; i < rect.length; i++) { var v = rect[i][0] * gx + rect[i][1] * gy; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (ar <= 0) return hi;
    if (ar >= area(rect)) return lo;
    var a = lo, b = hi;
    for (i = 0; i < 22; i++) { var mid = (a + b) / 2; if (area(clipPoly(rect, gx, gy, mid, true)) > ar) a = mid; else b = mid; }
    return (a + b) / 2;
  }

  /* ---------- small icons (Material rounded, 24 grid) ---------- */
  function icon(g, kind, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.translate(-12, -12);
    g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 2.4;
    if (kind === 'drop') { g.beginPath(); g.moveTo(12, 3); g.bezierCurveTo(9, 7.5, 5.5, 11, 5.5, 14.5); g.arc(12, 14.5, 6.5, Math.PI, 0, true); g.bezierCurveTo(18.5, 11, 15, 7.5, 12, 3); g.closePath(); g.fill(); }
    else if (kind === 'palette') {
      dot(g, 12, 12, 9);
      g.globalCompositeOperation = 'destination-out';
      [[7.5, 11], [10, 7.2], [14.5, 7.2], [17, 11]].forEach(function (q) { dot(g, q[0], q[1], 1.6); });
      dot(g, 14.5, 16.5, 2.4);
    } else if (kind === 'undo') {
      g.beginPath(); g.moveTo(9, 6.5); g.lineTo(5, 10.5); g.lineTo(9, 14.5); g.stroke();
      g.beginPath(); g.moveTo(5.5, 10.5); g.lineTo(14, 10.5); g.arc(14, 15, 4.5, -Math.PI / 2, Math.PI / 2); g.lineTo(9, 19.5); g.stroke();
    } else if (kind === 'reset') {
      g.beginPath(); g.arc(12, 12.5, 7, -Math.PI * 0.22, Math.PI * 1.42); g.stroke();
      g.beginPath(); g.moveTo(20.2, 3.4); g.lineTo(20.2, 10.6); g.lineTo(13, 10.6); g.closePath(); g.fill();
    }
    g.restore();
  }

  GAMES['watersort'] = {
    name: { ko: '물 정렬', ja: 'ウォーターソート', en: 'Water Sort' },
    tip: { ko: '물을 부어 병마다 한 색으로', ja: '水を注いで、びんごとに1色に', en: 'Pour until each bottle holds one color' },
    color: '#00A6FB',
    kind: 'puzzle',
    make: function (ctx) {
      var cx0 = 0, cy0 = 0, cw = 300, ch = 480, kk = 1, R = 26, card = null, board = { x: 0, y: 0, w: 100, h: 100 }, lay = null;
      var level = 0, cols = [], bottles = [], initial = [], undo = [], pours = 0, phase = 'play', phaseT = 0, time = 0;
      var sel = -1, selT = 1, drop = -1, dropT = 1, P = null, shakeI = -1, shakeT = 1, sparkI = -1, sparkT = 1, winT = -1, popT = 9;
      var plan = null, planKey = '', tgtKey = '', tgt = -1, btn = { undo: null, reset: null };

      function newLevel() {
        level++;
        var n = level === 1 ? 3 : 4;
        cols = ctx.shuffle(GROUPS.slice()).slice(0, n).map(ctx.pick);
        bottles = generate(n); initial = copy(bottles); undo = []; pours = 0;
        sel = -1; drop = -1; P = null; shakeI = -1; sparkI = -1; winT = -1; popT = 0; phase = 'play'; phaseT = 0;
        relayoutBoard();
      }
      function relayoutBoard() {
        var n = bottles.length, sw = board.w, sh = board.h, bestW = 0, bestRows = 1;
        for (var rows = 1; rows <= 3; rows++) {
          var per = Math.ceil(n / rows), ww = Math.min(sw / (per * 1.5 + 0.4), sh / rows / (RATIO + 1.25));
          if (ww > bestW + 0.5) { bestW = ww; bestRows = rows; }
        }
        var b = clamp(bestW, 10, 62 * Math.max(1, kk)), h = b * RATIO, gap = b * 0.5, rowH = h + b * 1.25, top0 = (sh - rowH * bestRows) / 2 + b, k = 0, slots = [];
        for (var r = 0; r < bestRows; r++) {
          var count = Math.ceil((n - k) / (bestRows - r)), rowW = count * b + (count - 1) * gap, x0 = (sw - rowW) / 2;
          for (var i = 0; i < count; i++) slots.push({ x: board.x + x0 + i * (b + gap), y: board.y + top0 + r * rowH, w: b, h: h });
          k += count;
        }
        lay = { bw: b, bh: h, gap: gap, slots: slots, lift: b * 0.5 };
      }
      function hit(px, py) {
        for (var i = 0; i < lay.slots.length; i++) {
          var s = lay.slots[i];
          if (px >= s.x - lay.gap / 2 && px <= s.x + s.w + lay.gap / 2 && py >= s.y - lay.bw * 0.9 && py <= s.y + s.h + lay.bw * 0.25) return i;
        }
        return -1;
      }
      function tapPoint(i) { var s = lay.slots[i]; return { x: s.x + s.w / 2, y: s.y + s.h * 0.42 - (i === sel ? lay.lift : 0) }; }

      // the next move of a solution from the current state (cached per state)
      function nextMove() {
        var key = bottles.map(function (b) { return b.join(''); }).join('|');
        if (key !== planKey) { planKey = key; plan = solved(bottles) ? [] : solve(bottles, 20000); }
        return plan && plan.length ? plan[0] : null;
      }
      function goodTarget(f) {
        var key = planKey + ':' + f;
        if (key === tgtKey) return tgt;
        tgtKey = key; tgt = -1;
        for (var t = 0; t < bottles.length; t++) {
          if (!canPour(bottles, f, t)) continue;
          var b = copy(bottles); pour(b, f, t);
          if (solve(b, 6000)) return (tgt = t);
        }
        return -1;
      }

      /* ---------- touch ---------- */
      function select(i) { ctx.sfx.click(); ctx.haptic('light'); if (drop === i) drop = -1; sel = i; selT = 0; }
      function deselect() { ctx.sfx.place(0.3); ctx.haptic('light'); drop = sel; dropT = 0; sel = -1; }
      function tryPour(f, t) {
        if (!canPour(bottles, f, t)) {
          ctx.sfx.buzz(); ctx.haptic('error'); shakeI = f; shakeT = 0;
          return;
        }
        undo.push(copy(bottles)); if (undo.length > 200) undo.shift();
        var src = bottles[f].slice(), dst = bottles[t].slice(), color = src[src.length - 1], amt = pour(bottles, f, t);
        P = { from: f, to: t, color: color, amount: amt, src: src, dst: dst, t: 0, glugs: 0, landed: false };
        pours++; sel = -1; drop = -1;
        ctx.sfx.whoosh(); ctx.haptic('light');
      }
      function land() {
        if (!P || P.landed) return;
        P.landed = true;
        var t = P.to;
        if (complete(bottles[t])) {
          sparkI = t; sparkT = 0;
          ctx.sfx.cork(); ctx.sfx.ding(); ctx.haptic('medium');
          ctx.later(function () { ctx.sfx.sparkle(); }, 140);
          var s = lay.slots[t];
          ctx.fx.stars(s.x + s.w / 2, s.y - lay.bw * 0.2, 8, ['#FFC53D', '#FFFFFF', WATER[cols[bottles[t][0]]]], { speed: 200 * kk, size: 6 * kk });
        }
        if (solved(bottles)) win();
        else if (!nextMove()) { phase = 'stuck'; phaseT = 0; }
      }
      function finishPour() { if (!P) return; if (P.glugs < P.amount) P.glugs = P.amount; land(); P = null; }
      function win() {
        phase = 'won'; phaseT = 0;
        ctx.later(function () {
          winT = 0; ctx.sfx.win(); ctx.haptic('success');
          ctx.fx.burst(cx0 + cw / 2, cy0 + ch * 0.5, 80, cols.map(function (c) { return WATER[c]; }).concat(['#FFFFFF', '#FFC53D']), { speed: 720 });
        }, 260);
        ctx.later(function () { ctx.sfx.sparkle(); }, 700);
      }
      function restartLevel(sound) {
        finishPourSilently();
        bottles = copy(initial); undo = []; pours = 0; sel = -1; drop = -1; shakeI = -1; sparkI = -1; phase = 'play'; phaseT = 0; popT = 0;
        if (sound) { ctx.sfx.whoosh(); ctx.haptic('light'); }
      }
      function finishPourSilently() { if (P) { P.landed = true; P = null; } }
      function doUndo() {
        if (!undo.length || phase === 'won') { ctx.sfx.place(0.25); return; }
        finishPourSilently();
        bottles = undo.pop(); pours = Math.max(0, pours - 1); sel = -1; drop = -1; sparkI = -1; phase = 'play';
        ctx.sfx.whoosh(); ctx.haptic('light');
      }
      function inBtn(b, x, y) { return b && x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 6 && y <= b.y + b.h + 6; }

      /* ---------- drawing ---------- */
      function bottleShape(g, w, h) { ctx.rrect(g, 0, 0, w, h, [w * 0.12, w * 0.12, w * 0.5, w * 0.5]); }
      // one bottle at the origin; tilt = rotation (for the water surface), segs = [[colour, units] …] bottom to top
      function drawBottle(g, sg, tilt, cork, glow) {
        var w = lay.bw, h = lay.bh, wall = w * 0.08, dark = ctx.dark;
        var iL = wall, iT = wall * 1.2, iR = w - wall, iB = h - wall, iw = iR - iL, uh = (iB - iT) * 0.86 / CAP;
        bottleShape(g, w, h); g.fillStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(127,167,201,.12)'; g.fill();
        if (sg.length) {
          g.save();
          ctx.rrect(g, iL, iT, iw, iB - iT, [w * 0.06, w * 0.06, w * 0.5 - wall, w * 0.5 - wall]); g.clip();
          var cum = 0, i;
          if (tilt === 0) {
            for (i = 0; i < sg.length; i++) {
              var y1 = iB - cum * uh; cum += sg[i][1];
              g.fillStyle = WATER[cols[sg[i][0]] % WATER.length]; g.fillRect(iL, iB - cum * uh, iw, y1 - (iB - cum * uh) + 0.6);
            }
            g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(iL, iB - cum * uh, iw, Math.max(1, uh * 0.08));
          } else {
            var gx = Math.sin(tilt), gy = Math.cos(tilt), rect = [[iL, iT], [iR, iT], [iR, iB], [iL, iB]], unit = uh * iw, prev = Infinity;
            for (i = 0; i < sg.length; i++) {
              cum += sg[i][1] * unit;
              var d = depthFor(rect, gx, gy, cum), poly = clipPoly(rect, gx, gy, d, true);
              if (isFinite(prev)) poly = clipPoly(poly, gx, gy, prev, false);
              if (poly.length >= 3) {
                g.beginPath(); g.moveTo(poly[0][0], poly[0][1]);
                for (var q = 1; q < poly.length; q++) g.lineTo(poly[q][0], poly[q][1]);
                g.closePath(); g.fillStyle = WATER[cols[sg[i][0]] % WATER.length]; g.fill();
              }
              prev = d;
            }
          }
          g.restore();
        }
        ctx.rrect(g, w * 0.2, h * 0.1, w * 0.12, h * 0.62, w * 0.06); g.fillStyle = dark ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.42)'; g.fill();
        var line = dark ? 'rgba(255,255,255,.55)' : '#8DA4BA';
        bottleShape(g, w, h); g.strokeStyle = line; g.lineWidth = Math.max(1.4, w * 0.05); g.stroke();
        ctx.rrect(g, -w * 0.08, -w * 0.05, w * 1.16, w * 0.14, w * 0.07); g.fillStyle = line; g.fill();
        if (cork > 0) {
          var cwk = w * 0.64, chk = w * 0.42, dy = (1 - cork) * -w * 0.6, rx = (w - cwk) / 2, ry = -chk * 0.75 + dy;
          ctx.rrect(g, rx, ry, cwk, chk, w * 0.1); g.fillStyle = '#C08A55'; g.fill();
          ctx.rrect(g, rx, ry, cwk, chk * 0.4, w * 0.1); g.fillStyle = '#D9A671'; g.fill();
        }
        if (glow > 0) { bottleShape(g, w, h); g.fillStyle = 'rgba(255,255,255,' + (0.5 * glow).toFixed(3) + ')'; g.fill(); }
      }
      function sparkle(g, x, y, t0) {
        var t = easeOut(t0), w = lay.bw, a = 1 - t;
        g.strokeStyle = 'rgba(255,197,61,' + a.toFixed(3) + ')';
        g.lineWidth = 3 * (1 - t) + 0.5; g.beginPath(); g.arc(x, y, w * (0.4 + 1.1 * t), 0, TAU); g.stroke();
        g.lineWidth = Math.max(1.5, w * 0.06); g.lineCap = 'round'; g.beginPath();
        for (var i = 0; i < 10; i++) {
          var an = i * Math.PI / 5 + 0.3, vx = Math.cos(an), vy = Math.sin(an);
          g.moveTo(x + vx * w * (0.5 + 0.6 * t), y + vy * w * (0.5 + 0.6 * t)); g.lineTo(x + vx * w * (0.7 + t), y + vy * w * (0.7 + t));
        }
        g.stroke();
      }
      function drawPouring(g, prog) {
        var src = lay.slots[P.from], dst = lay.slots[P.to], w = lay.bw, h = lay.bh, wall = w * 0.08, uh = (h - wall - wall * 1.2) * 0.86 / CAP;
        var dc = dst.x + dst.w / 2, side = src.x + src.w / 2 >= dc ? 1 : -1;
        // the app's rule, but tilt the other way when the bottle would stick out of the card and the other side has more room
        var roomL = dc - cx0, roomR = cx0 + cw - dc;
        if (side < 0 ? roomL < h * 0.95 && roomR > roomL : roomR < h * 0.95 && roomL > roomR) side = -side;
        var corner = side > 0 ? 0 : w;
        var restX = src.x + corner, restY = src.y - lay.lift, homeX = src.x + corner, homeY = src.y;
        var pX = dst.x + dst.w / 2 + side * w * 0.14, pY = dst.y - w * 0.32;
        var before = P.src.length / CAP, after = (P.src.length - P.amount) / CAP;
        var th0 = (58 + 44 * (1 - before)) * Math.PI / 180, th1 = (62 + 44 * (1 - after)) * Math.PI / 180, t = P.t, vx, vy, ang, k;
        if (t < 0.25) { k = easeInOut(t / 0.25); vx = restX + (pX - restX) * k; vy = restY + (pY - restY) * k; ang = th0 * k; }
        else if (t < 0.75) { vx = pX; vy = pY; ang = th0 + (th1 - th0) * (t - 0.25) / 0.5; }
        else { k = easeInOut((t - 0.75) / 0.25); vx = pX + (homeX - pX) * k; vy = pY + (homeY - pY) * k; ang = th1 * (1 - k); }
        var rot = -side * ang;
        if (t > 0.24 && t < 0.78) {
          var ramp = Math.min(clamp((t - 0.24) / 0.05, 0, 1), clamp((0.78 - t) / 0.06, 0, 1));
          var lvl = P.dst.length + P.amount * prog, surface = dst.y + h - wall - lvl * uh, x = dst.x + dst.w / 2 + Math.sin(t * 60) * w * 0.015;
          var color = WATER[cols[P.color] % WATER.length], sw = w * 0.14 * ramp;
          g.strokeStyle = color; g.lineWidth = Math.max(0.1, sw); g.lineCap = 'round';
          g.beginPath(); g.moveTo(vx, vy); g.quadraticCurveTo(x, vy + w * 0.05, x, vy + w * 0.4); g.lineTo(x, surface); g.stroke();
          g.fillStyle = color; dot(g, x, surface, Math.max(0.1, sw * (0.9 + 0.3 * Math.sin(t * 50))));
        }
        g.save(); g.translate(vx, vy); g.rotate(rot); g.translate(-corner, 0);
        drawBottle(g, segs(P.src, P.amount * prog), rot, 0, 0);
        g.restore();
      }
      function pill(g, x, y, h, ic, label, col) {
        var fs = 13 * kk, isz = 15 * kk, pad = 10 * kk;
        g.font = ctx.font(fs, 800);
        var w = pad * 2 + isz + 4 * kk + g.measureText(label).width;
        ctx.rrect(g, x, y, w, h, h / 2); g.fillStyle = ctx.rgba(col || ctx.C.soft, 0.12); g.fill();
        icon(g, ic, x + pad + isz / 2, y + h / 2, isz, col || ctx.C.soft);
        ctx.text(g, label, x + pad + isz + 4 * kk, y + h / 2 + 0.5, { size: fs, weight: 800, color: col || ctx.C.ink, align: 'left' });
        return w;
      }
      function pillW(g, label) { g.font = ctx.font(13 * kk, 800); return 20 * kk + 15 * kk + 4 * kk + g.measureText(label).width; }
      function tool(g, b, ic, on) {
        ctx.rrect(g, b.x, b.y, b.w, b.h, 12 * kk); g.fillStyle = ctx.C.surface; g.fill();
        g.lineWidth = 1.2; g.strokeStyle = ctx.C.hair; g.stroke();
        icon(g, ic, b.x + b.w / 2, b.y + b.h / 2, 20 * kk, on ? ctx.C.ink : ctx.C.hair);
      }
      function topRow(g) {
        var pad = 12 * kk, y = cy0 + pad, h = 30 * kk, x = cx0 + pad, tw = 44 * kk, th = 30 * kk, gap = 6 * kk;
        btn.reset = { x: cx0 + cw - pad - tw, y: y + (h - th) / 2, w: tw, h: th };
        btn.undo = { x: btn.reset.x - gap - tw, y: btn.reset.y, w: tw, h: th };
        var room = btn.undo.x - gap - x, l1 = String(pours), l2 = ctx.f(TX.colors, cols.length);
        x += pill(g, x, y, h, 'drop', l1, null) + gap;
        if (x + pillW(g, l2) <= cx0 + pad + room) pill(g, x, y, h, 'palette', l2, null);
        tool(g, btn.undo, 'undo', undo.length > 0 && phase !== 'won');
        tool(g, btn.reset, 'reset', (pours > 0) && phase !== 'won');
      }

      return {
        layout: function () {
          var avW = Math.max(160, ctx.W - 32), avH = Math.max(160, ctx.H - 12);
          var r = ctx.fit(clamp(avW / avH, 0.56, 0.82), { maxW: 560 });
          cx0 = r.x; cy0 = r.y; cw = r.w; ch = r.h;
          kk = clamp(cw / 330, 0.74, 1.25); R = Math.round(26 * Math.min(1, kk + 0.1));
          var pad = 12 * kk, top = pad + 30 * kk + 6 * kk, bottom = pad + 18 * kk + 4 * kk;
          board = { x: cx0 + pad * 0.5, y: cy0 + top, w: cw - pad, h: ch - top - bottom };
          var CC = ctx.C, dark = ctx.dark;
          card = ctx.layer(cw + 60, ch + 60, function (c) {
            c.translate(30, 30);
            if (!dark) { c.save(); c.shadowColor = 'rgba(16,20,16,.13)'; c.shadowBlur = 22; c.shadowOffsetY = 8; ctx.rrect(c, 0, 0, cw, ch, R); c.fillStyle = CC.surface; c.fill(); c.restore(); }
            ctx.rrect(c, 0, 0, cw, ch, R); c.fillStyle = CC.surface; c.fill();
            var gr = c.createLinearGradient(0, ch * 0.55, 0, ch);
            gr.addColorStop(0, ctx.rgba('#00A6FB', 0)); gr.addColorStop(1, ctx.rgba('#00A6FB', dark ? 0.08 : 0.06));
            c.fillStyle = gr; ctx.rrect(c, 0, 0, cw, ch, R); c.fill();
            c.lineWidth = 1; c.strokeStyle = CC.hair; ctx.rrect(c, 0.5, 0.5, cw - 1, ch - 1, R); c.stroke();
          });
          if (!bottles.length) newLevel(); else relayoutBoard();
        },

        update: function (dt) {
          time += dt; phaseT += dt;
          if (selT < 1) selT = Math.min(1, selT + dt / 0.16);
          if (dropT < 1) dropT = Math.min(1, dropT + dt / 0.16);
          if (shakeT < 1) shakeT = Math.min(1, shakeT + dt / 0.38);
          if (sparkT < 1) sparkT = Math.min(1, sparkT + dt / 0.8);
          if (popT < 2) popT += dt;
          if (winT >= 0) winT += dt / 1.6;
          if (P) {
            P.t = Math.min(1, P.t + dt / POUR);
            if (P.t >= 0.25 && P.amount > 0) {
              var p = clamp((P.t - 0.25) / 0.5, 0, 1);
              while (P.glugs < P.amount && p >= P.glugs / P.amount) {
                var lvl = P.dst.length + P.glugs;
                ctx.sfx.glug(0.85 + lvl * 0.14); ctx.haptic(6 + lvl * 2);
                P.glugs++;
              }
            }
            if (!P.landed && P.t >= 0.75) land();
            if (P && P.t >= 1) P = null;
          }
          if (phase === 'won' && phaseT > 2.4) { newLevel(); ctx.sfx.whoosh(); }
          else if (phase === 'stuck' && phaseT > 1.4) restartLevel(true);
        },

        draw: function (g) {
          g.drawImage(card, cx0 - 30, cy0 - 30, cw + 60, ch + 60);
          g.save(); ctx.rrect(g, cx0, cy0, cw, ch, R); g.clip();
          topRow(g);
          var pouring = !!P, prog = P ? clamp((P.t - 0.25) / 0.5, 0, 1) : 1, w = lay.bw, h = lay.bh;
          for (var i = 0; i < bottles.length && i < lay.slots.length; i++) {
            if (pouring && i === P.from) continue;
            var s = lay.slots[i], ox = s.x, oy = s.y;
            if (i === sel) oy -= lay.lift * easeOut(selT);
            if (i === drop && dropT < 1) oy -= lay.lift * (1 - easeIn(dropT));
            if (i === shakeI && shakeT < 1) ox += Math.sin(shakeT * Math.PI * 6) * w * 0.16 * (1 - shakeT);
            var receiving = pouring && i === P.to;
            var sg = receiving ? segs(P.dst, 0, P.color, P.amount * prog) : segs(bottles[i], 0, 0, 0);
            var done = (!receiving || P.t >= 0.75) && complete(bottles[i]);
            var cork = done ? (i === sparkI ? ctx.ease.outBack(clamp(sparkT / 0.35, 0, 1)) : 1) : 0;
            var glow = 0;
            if (winT >= 0 && winT < 1) { var kq = clamp((winT - i * 0.05) / 0.4, 0, 1); glow = Math.sin(kq * Math.PI); }
            var sc = popT < 2 ? ctx.ease.outBack(clamp((popT - i * 0.06) / 0.35, 0, 1)) : 1;
            if (sc <= 0.001) continue;
            g.save(); g.translate(ox, oy);
            if (sc !== 1) { g.translate(w / 2, h); g.scale(sc, sc); g.translate(-w / 2, -h); }
            drawBottle(g, sg, 0, cork, glow);
            g.restore();
            if (i === sparkI && sparkT < 1) sparkle(g, ox + w / 2, oy + h * 0.35, sparkT);
          }
          // bottom line: the app's hint text, or the stuck notice
          var label = phase === 'stuck' ? ctx.t(TX.reset) : ctx.t(TX.hint);
          ctx.text(g, label, cx0 + cw / 2, cy0 + ch - 12 * kk - 9 * kk, { size: 13.5 * kk, weight: phase === 'stuck' ? 800 : 600, color: phase === 'stuck' ? ctx.color : ctx.C.soft, maxW: cw - 24 * kk, min: 9 });
          if (phase === 'won' && phaseT > 0.26) {
            var t = phaseT - 0.26, ts = clamp(cw * 0.11, 22, 46), lab = ctx.t(TX.clear);
            g.font = ctx.font(ts, 900);
            var rw = g.measureText(lab).width + ts * 1.1, rh = ts * 1.6, es = ctx.ease.elasticOut(Math.min(1, t / 0.6)), cy = board.y + board.h * 0.5;
            g.save(); g.translate(cx0 + cw / 2, cy); g.scale(es, es); g.rotate(-0.05);
            ctx.rrect(g, -rw / 2, -rh / 2 + 4, rw, rh, rh / 2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
            ctx.rrect(g, -rw / 2, -rh / 2, rw, rh, rh / 2); g.fillStyle = ctx.color; g.fill();
            ctx.text(g, lab, 0, 1, { size: ts, weight: 900, color: '#FFFFFF', shadow: 'rgba(0,0,0,.35)', blur: 6, oy: 2 });
            g.restore();
          }
          g.restore();
          if (pouring) drawPouring(g, prog); // the tilted bottle may reach past the card edge, like in the app
        },

        down: function (p) {
          if (inBtn(btn.undo, p.x, p.y)) { doUndo(); return; }
          if (inBtn(btn.reset, p.x, p.y)) { if (pours > 0 && phase !== 'won') restartLevel(true); else ctx.sfx.place(0.25); return; }
          if (phase === 'won') { if (phaseT > 0.8) { newLevel(); ctx.sfx.whoosh(); } return; }
          if (P) finishPour();
          if (phase === 'won') return;
          var i = hit(p.x, p.y);
          if (i < 0 || i >= bottles.length) { if (sel >= 0) deselect(); else { ctx.sfx.place(0.2); ctx.haptic(6); } return; }
          if (sel < 0) {
            if (!bottles[i].length) { ctx.sfx.place(0.25); ctx.haptic('light'); shakeI = i; shakeT = 0.5; return; }
            select(i);
          } else if (sel === i) deselect();
          else tryPour(sel, i);
        },

        // the bottle to pick, then where to pour (first move of a solution)
        hint: function () {
          if (phase !== 'play' || P) return null;
          if (sel >= 0) {
            var m = nextMove(), t = m && m[0] === sel ? m[1] : goodTarget(sel);
            return tapPoint(t >= 0 ? t : sel);
          }
          var mv = nextMove();
          return mv ? tapPoint(mv[0]) : null;
        },

        debug: function () {
          var mv = phase === 'play' ? nextMove() : null, targets = [];
          if (mv) {
            if (sel < 0) targets = [tapPoint(mv[0]), tapPoint(mv[1])];
            else if (sel === mv[0]) targets = [tapPoint(mv[1])];
            else targets = [tapPoint(sel)];
          }
          return {
            phase: phase, level: level, pours: pours, sel: sel, pouring: !!P, colors: cols.length,
            bottles: bottles.map(function (b) { return b.join(''); }), solved: solved(bottles), bw: Math.round(lay.bw), bh: Math.round(lay.bh),
            card: { x: cx0, y: cy0, w: cw, h: ch }, slots: lay.slots.map(function (q, i) { var t = tapPoint(i); return { x: Math.round(t.x), y: Math.round(t.y) }; }),
            targets: targets.map(function (q) { return { x: Math.round(q.x), y: Math.round(q.y) }; })
          };
        },

        destroy: function () { card = null; P = null; }
      };
    }
  };
})();
