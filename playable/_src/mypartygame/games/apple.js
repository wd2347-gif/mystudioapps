/* 사과 게임 (apple): apple.dart solo round on a smaller board (about 6 x 8 on phones, cells 40 to 62 px). Red apples with white numbers on
   the light green board; drag a box: blue under 10, green at exactly 10, red over, with the live sum bubble; letting go on 10 picks those
   apples (they fly up with gold sparkles). Boards come from AppleBoard.generate (neighbouring pairs and triples that make 10).
   The clock (60 s) starts on the first drag; time up or no move left shows the count, then a fresh board comes by itself. */
(function () {
  'use strict';
  var T = {
    ko: { a1: '사과 {0}개', an: '사과 {0}개', timeUp: '시간 끝!', allPicked: '더 딸 사과가 없어요!' },
    ja: { a1: 'りんご{0}個', an: 'りんご{0}個', timeUp: 'タイムアップ！', allPicked: 'もう取れるりんごがない！' },
    en: { a1: '{0} apple', an: '{0} apples', timeUp: 'Time’s up!', allPicked: 'No more apples to pick!' }
  };
  var ROUND = 60, RED = '#F0484E', DEEP = '#C92F3A', BLUE = '#3E9BFF', GREEN = '#2FC85E', OVER = '#E5484D';
  var TAU = Math.PI * 2;
  var MINI = '<svg viewBox="-20 -22 40 40" aria-hidden="true"><defs><radialGradient id="pfAppleG" gradientUnits="userSpaceOnUse" cx="-5.6" cy="-7.2" r="32">' +
    '<stop offset="0" stop-color="#F0484E"/><stop offset="1" stop-color="#C92F3A"/></radialGradient></defs>' +
    '<g fill="url(#pfAppleG)"><ellipse cx="-5.1" cy=".8" rx="10.9" ry="14.4"/><ellipse cx="5.1" cy=".8" rx="10.9" ry="14.4"/></g>' +
    '<ellipse cx="-6.7" cy="-5.6" rx="2.6" ry="3.8" fill="#FFFFFF" fill-opacity=".45"/>' +
    '<path d="M0-11.5L1.3-16.3" stroke="#6B4A2B" stroke-width="2.3" stroke-linecap="round"/>' +
    '<path d="M1.6-14.4Q8-20 11.5-15.2Q6.4-12 1.6-14.4Z" fill="#3BB75E"/></svg>';

  // AppleBoard.generate: lay neighbouring pairs (a, 10 - a) and some triples first, the rest any number
  function generate(rows, cols) {
    var n = rows * cols, v = new Array(n), order = [], i, j;
    for (i = 0; i < n; i++) { v[i] = 0; order.push(i); }
    for (i = n - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); var tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    function free(k) {
      var r = Math.floor(k / cols), c = k % cols, out = [];
      if (c + 1 < cols && v[k + 1] === 0) out.push(k + 1);
      if (c > 0 && v[k - 1] === 0) out.push(k - 1);
      if (r + 1 < rows && v[k + cols] === 0) out.push(k + cols);
      if (r > 0 && v[k - cols] === 0) out.push(k - cols);
      return out;
    }
    for (var o = 0; o < n; o++) {
      i = order[o];
      if (v[i] !== 0) continue;
      var roll = Math.random(), ns = free(i);
      if (roll < 0.55 && ns.length) {
        j = ns[Math.floor(Math.random() * ns.length)];
        var a = 1 + Math.floor(Math.random() * 9);
        v[i] = a; v[j] = 10 - a;
        continue;
      }
      if (roll < 0.72 && ns.length) {
        j = ns[Math.floor(Math.random() * ns.length)];
        v[i] = -1; v[j] = -1;
        var more = free(i).concat(free(j));
        v[i] = 0; v[j] = 0;
        if (more.length) {
          var k = more[Math.floor(Math.random() * more.length)];
          var x = 1 + Math.floor(Math.random() * 7), y = 1 + Math.floor(Math.random() * (8 - x));
          v[i] = x; v[j] = y; v[k] = 10 - x - y;
          continue;
        }
      }
      v[i] = 1 + Math.floor(Math.random() * 9);
    }
    return v;
  }
  // rectangles whose live apples add up to exactly 10 (first one with `first`, else the count up to stopAt)
  function moves(v, rows, cols, stopAt, first) {
    var w = cols + 1, pre = new Int32Array((rows + 1) * w), r0, r1, c0, c1, n = 0;
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      pre[(r + 1) * w + c + 1] = v[r * cols + c] + pre[r * w + c + 1] + pre[(r + 1) * w + c] - pre[r * w + c];
    }
    for (r0 = 0; r0 < rows; r0++) for (r1 = r0; r1 < rows; r1++) for (c0 = 0; c0 < cols; c0++) for (c1 = c0; c1 < cols; c1++) {
      var s = pre[(r1 + 1) * w + c1 + 1] - pre[r0 * w + c1 + 1] - pre[(r1 + 1) * w + c0] + pre[r0 * w + c0];
      if (s === 10) { if (first) return [r0, c0, r1, c1]; if (++n >= stopAt) return n; }
      else if (s > 10) break;
    }
    return first ? null : n;
  }
  function apple(g, x, y, r) {
    var gr = g.createRadialGradient(x - r * 0.35, y - r * 0.45, 0, x - r * 0.35, y - r * 0.45, r * 2);
    gr.addColorStop(0, RED); gr.addColorStop(1, DEEP);
    g.fillStyle = gr; g.beginPath();
    g.ellipse(x - r * 0.32, y + r * 0.05, r * 0.68, r * 0.9, 0, 0, TAU);
    g.moveTo(x + r * 1.0, y + r * 0.05);
    g.ellipse(x + r * 0.32, y + r * 0.05, r * 0.68, r * 0.9, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(x - r * 0.42, y - r * 0.35, r * 0.16, r * 0.24, 0, 0, TAU); g.fill();
    g.strokeStyle = '#6B4A2B'; g.lineWidth = r * 0.14; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y - r * 0.72); g.lineTo(x + r * 0.08, y - r * 1.02); g.stroke();
    g.fillStyle = '#3BB75E'; g.beginPath(); g.moveTo(x + r * 0.1, y - r * 0.9);
    g.quadraticCurveTo(x + r * 0.5, y - r * 1.25, x + r * 0.72, y - r * 0.95);
    g.quadraticCurveTo(x + r * 0.4, y - r * 0.75, x + r * 0.1, y - r * 0.9); g.fill();
  }
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  GAMES['apple'] = {
    name: { ko: '사과 게임', ja: 'りんご10', en: 'Apple 10' },
    tip: { ko: '합이 10이 되게 묶어서 사과를 따요', ja: '合計10になるりんごを囲もう', en: 'Box apples that add up to 10' },
    cat: 'solo', who: '1', accent: '#E5484D',
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx, root = ctx.el, FONT = ctx.FONT, dpr = ctx.dpr;
      root.innerHTML =
        '<div class="top"><div class="sp">' + MINI + '<b>0</b></div><div class="tb"><i></i></div><div class="sec">' + ROUND + '</div></div>' +
        '<div class="bw"><div class="bd"><div class="end"><div class="pn"><div class="e1"></div><div class="e2">' + MINI + '<b></b></div></div></div></div></div>';
      var bwEl = root.querySelector('.bw'), bd = root.querySelector('.bd'), endEl = root.querySelector('.end');
      var scoreEl = root.querySelector('.sp b'), barEl = root.querySelector('.tb i'), secEl = root.querySelector('.sec');
      var e1 = root.querySelector('.e1'), e2 = root.querySelector('.e2 b');
      var c = ctx.canvas(bd), cv = c.cv, g = c.g;
      bd.insertBefore(cv, endEl);

      var rows = 0, cols = 0, cell = 40, MT = 40, MB = 20, MX = 20, bw = 0, bh = 0, vals = null, sprites = [];
      var phase = 'idle', score = 0, t0 = 0, lastSec = ROUND, endAt = 0, picks = 0, fails = 0, boards = 0, firstPair = null;
      var ptr = null, A = null, B = null, sel = [], mask = null, selSum = 0, bx = 0, by = 0;
      var pops = [], shakeSet = [], shakeAt = -1e9, now = 0, dirty = true;

      function pickGrid(aw, ah) {
        var tc = Math.max(42, Math.min(60, Math.min(aw, ah) / 6.4));
        return [Math.max(5, Math.min(10, Math.floor(ah / tc))), Math.max(5, Math.min(8, Math.round(aw / tc)))];
      }
      function makeSprites() {
        var r = cell * 0.4, side = Math.ceil(r * 2.7 * dpr), fs = Math.round(cell * 0.42);
        sprites = [];
        for (var d = 0; d <= 9; d++) {
          var sc = document.createElement('canvas'); sc.width = sc.height = side;
          var sg = sc.getContext('2d'); sg.setTransform(dpr, 0, 0, dpr, 0, 0);
          apple(sg, r * 1.35, r * 1.4, r);
          if (d) {
            sg.font = '800 ' + fs + 'px ' + FONT; sg.textAlign = 'center'; sg.textBaseline = 'middle';
            sg.shadowColor = 'rgba(0,0,0,.33)'; sg.shadowOffsetY = 1; sg.shadowBlur = 1;
            sg.fillStyle = '#FFFFFF'; sg.fillText(String(d), r * 1.35, r * 1.4 + r * 0.1);
          }
          sprites.push(sc);
        }
      }
      function newBoard(first) {
        boards++;
        var v = null, tries = 0;
        do { v = generate(rows, cols); tries++; } while (moves(v, rows, cols, 6, false) < 6 && tries < 8);
        if (first) {
          // a sure pair in the middle row for the drag hint
          var r = Math.floor(rows / 2), cc = Math.max(0, Math.floor(cols / 2) - 1), a = 1 + ctx.rnd(9);
          if (a === 5) a = 3;
          v[r * cols + cc] = a; v[r * cols + cc + 1] = 10 - a;
          firstPair = [r, cc];
        }
        vals = v; mask = new Uint8Array(rows * cols);
        phase = 'idle'; score = 0; lastSec = ROUND; pops = []; shakeSet = []; sel = []; selSum = 0; A = B = null;
        scoreEl.textContent = '0'; secEl.textContent = String(ROUND); secEl.classList.remove('danger');
        barEl.style.transform = 'scaleX(1)'; barEl.classList.remove('low');
        endEl.classList.remove('on');
        dirty = true; ctx.wake();
      }
      function live() { var n = 0; for (var i = 0; i < vals.length; i++) if (vals[i] > 0) n++; return n; }

      function startClock() { phase = 'play'; t0 = performance.now(); lastSec = ROUND; }
      function clockTick() {
        if (phase !== 'play') return;
        var left = Math.max(0, ROUND - (performance.now() - t0) / 1000), sec = Math.ceil(left);
        barEl.style.transform = 'scaleX(' + (left / ROUND).toFixed(4) + ')';
        barEl.classList.toggle('low', left / ROUND < 0.2);
        if (sec !== lastSec) {
          lastSec = sec; secEl.textContent = String(sec);
          var danger = sec <= 10 && sec > 0;
          secEl.classList.toggle('danger', danger);
          if (danger) { S.tick(sec <= 3); secEl.classList.remove('pf-pop'); void secEl.offsetWidth; secEl.classList.add('pf-pop'); }
        }
        if (left <= 0) endRound(false);
      }
      ctx.every(clockTick, 200);

      function endRound(cleared) {
        if (phase === 'end') return;
        phase = 'end'; endAt = performance.now(); ptr = null; A = B = null; sel = []; selSum = 0; mask.fill(0);
        e1.textContent = cleared ? t.allPicked : t.timeUp;
        e2.textContent = ctx.fmt(score === 1 ? t.a1 : t.an, score);
        endEl.classList.add('on');
        S.stamp(); ctx.buzz(20);
        var big = score >= 20;
        ctx.later(function () { if (big) S.win(); else S.ding(); }, 320);
        if (big) ctx.burstAt(endEl, 70);
        if (cleared) { barEl.style.transform = 'scaleX(1)'; }
        var my = boards;
        ctx.later(function () { if (phase === 'end' && my === boards) newBoard(false); }, 2800);
        dirty = true; ctx.wake();
      }

      function cellsIn(ax, ay, bx2, by2) {
        var inf = cell * 0.12, l = Math.min(ax, bx2) - inf, r = Math.max(ax, bx2) + inf, tp = Math.min(ay, by2) - inf, bt = Math.max(ay, by2) + inf;
        var c0 = Math.max(0, Math.min(cols - 1, Math.ceil(l / cell - 0.5))), c1 = Math.max(-1, Math.min(cols - 1, Math.floor(r / cell - 0.5)));
        var r0 = Math.max(0, Math.min(rows - 1, Math.ceil(tp / cell - 0.5))), r1 = Math.max(-1, Math.min(rows - 1, Math.floor(bt / cell - 0.5)));
        var out = [];
        for (var row = r0; row <= r1; row++) for (var col = c0; col <= c1; col++) { var i = row * cols + col; if (vals[i] > 0) out.push(i); }
        return out;
      }
      function setSel(list) {
        var grew = list.length > sel.length, same = list.length === sel.length;
        if (same) for (var i = 0; i < list.length; i++) if (!mask[list[i]]) { same = false; break; }
        if (same) return;
        mask.fill(0); var s = 0;
        for (i = 0; i < list.length; i++) { mask[list[i]] = 1; s += vals[list[i]]; }
        if (s === 10 && selSum !== 10) { S.tone(1318.5, 0.28, 'sine', 0.2); S.tone(2637, 0.1, 'sine', 0.05); ctx.buzz(14); }
        else if (grew) S.peg();
        sel = list; selSum = s;
      }
      function local(e) { return { x: e.clientX - bx, y: e.clientY - by }; }

      ctx.on(cv, 'pointerdown', function (e) {
        if (phase === 'end') { if (performance.now() - endAt > 700) { S.click(); ctx.buzz(10); newBoard(false); } return; }
        if (ptr !== null) return;
        ptr = e.pointerId;
        try { cv.setPointerCapture(ptr); } catch (er) {}
        var b = bd.getBoundingClientRect(); bx = b.left; by = b.top;
        if (phase === 'idle') startClock();
        A = local(e); B = { x: A.x, y: A.y };
        sel = []; selSum = 0; mask.fill(0);
        setSel(cellsIn(A.x, A.y, B.x, B.y));
        S.peg(); ctx.buzz(6);
        dirty = true; ctx.wake();
      });
      ctx.on(cv, 'pointermove', function (e) {
        if (e.pointerId !== ptr || !A) return;
        var p = local(e);
        B = { x: Math.max(0, Math.min(bw, p.x)), y: Math.max(0, Math.min(bh, p.y)) };
        setSel(cellsIn(A.x, A.y, B.x, B.y));
        dirty = true; ctx.wake();
      });
      function release(e) {
        if (e.pointerId !== ptr) return;
        ptr = null;
        if (!A) return;
        var list = sel, got = 0;
        if (phase === 'play' && list.length && selSum === 10) {
          for (var i = 0; i < list.length; i++) { pops.push({ i: list[i], v: vals[list[i]], at: now }); vals[list[i]] = 0; }
          got = list.length; score += got; picks++;
          scoreEl.textContent = String(score);
          scoreEl.classList.remove('pf-pop'); void scoreEl.offsetWidth; scoreEl.classList.add('pf-pop');
          S.pop(0.35 + 0.1 * Math.min(got, 5)); S.tone(1568, 0.22, 'sine', 0.12, null, 0.05);
          if (got >= 4) S.tone(2093, 0.2, 'sine', 0.08, 2637, 0.12);
          ctx.buzz(Math.min(60, 18 + got * 6));
          var r0 = Math.min(A.y, B.y), c0 = Math.min(A.x, B.x), r1 = Math.max(A.y, B.y), c1 = Math.max(A.x, B.x);
          ctx.burst(bd.offsetLeft + (c0 + c1) / 2, bd.offsetTop + (r0 + r1) / 2, 10 + got * 6,
            { speed: 380, size: 0.7, round: true, colors: ['#FFC53D', '#FFD43B', RED, '#3BB75E'] });
          if (moves(vals, rows, cols, 1, false) === 0) ctx.later(function () { endRound(true); }, 500);
        } else if (list.length > 1) {
          fails++; shakeSet = list; shakeAt = now;
          S.bump(); ctx.buzz([18, 30, 18]);
        }
        A = B = null; sel = []; selSum = 0; mask.fill(0);
        dirty = true; ctx.wake();
      }
      ctx.on(cv, 'pointerup', release);
      ctx.on(cv, 'pointercancel', release);

      function draw() {
        var dark = ctx.dark, r = cell * 0.4, ok = selSum === 10, i;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, bw + 2 * MX, bh + MT + MB);
        g.translate(MX, MT);
        rr(g, 0, 0, bw, bh, cell * 0.5); g.fillStyle = dark ? '#1B2619' : '#E8F5E4'; g.fill();
        var dcol = ok ? GREEN : (selSum > 10 ? OVER : BLUE), dl = 0, dt = 0, dw = 0, dh = 0;
        if (A && B) {
          dl = Math.min(A.x, B.x); dt = Math.min(A.y, B.y); dw = Math.abs(B.x - A.x); dh = Math.abs(B.y - A.y);
          rr(g, dl, dt, dw, dh, cell * 0.22); g.fillStyle = ctx.rgba(dcol, dark ? 0.22 : 0.16); g.fill();
        }
        var st = (now - shakeAt) / 320, shaking = st >= 0 && st < 1, side = sprites.length ? sprites[0].width / dpr : 0;
        for (i = 0; i < rows * cols; i++) {
          var v = vals[i];
          if (v <= 0) continue;
          var x = (i % cols + 0.5) * cell, y = (Math.floor(i / cols) + 0.5) * cell + cell * 0.04;
          if (shaking && shakeSet.indexOf(i) >= 0) x += Math.sin(st * Math.PI * 6) * cell * 0.1 * (1 - st);
          var picked = mask[i] === 1, k = 1;
          if (picked) {
            g.fillStyle = ok ? 'rgba(255,212,59,.95)' : 'rgba(255,212,59,.55)';
            g.beginPath(); g.arc(x, y, r * 1.2, 0, TAU); g.fill();
            if (ok) { g.lineWidth = Math.max(1.5, cell * 0.05); g.strokeStyle = GREEN; g.stroke(); }
            k = 1.08;
          }
          g.drawImage(sprites[v], x - r * 1.35 * k, y - r * 1.4 * k, side * k, side * k);
        }
        // picked apples grow, fly up and fade, with short gold sparkle lines
        for (i = 0; i < pops.length; i++) {
          var p = pops[i], tt = Math.max(0, Math.min(1, (now - p.at) / 600)), a = 1 - tt;
          var px = (p.i % cols + 0.5) * cell, py0 = (Math.floor(p.i / cols) + 0.5) * cell, py = py0 - cell * 0.9 * (1 - (1 - tt) * (1 - tt));
          var ks = 1 + 0.4 * tt;
          g.globalAlpha = a;
          g.drawImage(sprites[0], px - r * 1.35 * ks, py - r * 1.4 * ks, side * ks, side * ks);
          g.strokeStyle = '#FFC53D'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath();
          for (var q = 0; q < 6; q++) {
            var ang = q * Math.PI / 3 + p.i, d0 = r * (0.8 + 1.2 * tt), d1 = r * (1.1 + 1.6 * tt);
            g.moveTo(px + Math.cos(ang) * d0, py0 + Math.sin(ang) * d0); g.lineTo(px + Math.cos(ang) * d1, py0 + Math.sin(ang) * d1);
          }
          g.stroke(); g.globalAlpha = 1;
        }
        if (A && B) {
          rr(g, dl, dt, dw, dh, cell * 0.22); g.lineWidth = Math.max(2.5, cell * 0.06); g.strokeStyle = dcol; g.stroke();
          if (sel.length) {
            // sum bubble at the top-right corner of the box
            var u = Math.max(1, Math.min(1.4, cell / 46)), pw = 48 * u * (ok ? 1.18 : 1), ph = 28 * u * (ok ? 1.18 : 1);
            var cx = Math.max(pw / 2, Math.min(bw - pw / 2, dl + dw)), cy = Math.max(-ph / 2, dt - ph / 2 - 4);
            rr(g, cx - pw / 2, cy - ph / 2 + 3, pw, ph, ph / 2); g.fillStyle = 'rgba(0,0,0,.16)'; g.fill();
            rr(g, cx - pw / 2, cy - ph / 2, pw, ph, ph / 2); g.fillStyle = dcol; g.fill();
            g.lineWidth = 2; g.strokeStyle = '#FFFFFF'; g.stroke();
            g.fillStyle = '#FFFFFF'; g.font = '900 ' + Math.round(16 * u * (ok ? 1.18 : 1)) + 'px ' + FONT;
            g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(selSum), cx, cy + 1);
          }
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
      }

      function resize() {
        // header and board are one block, centred in the game box
        var hd = root.querySelector('.top'), aw = Math.max(120, bwEl.clientWidth);
        var ah = Math.max(120, root.clientHeight - hd.offsetHeight - 2 - 10 - 8 - 4);
        var grid = pickGrid(aw, ah);
        if (!vals || (phase === 'idle' && (grid[0] !== rows || grid[1] !== cols))) {
          var first = !vals; rows = grid[0]; cols = grid[1]; newBoard(first);
        }
        cell = Math.floor(Math.min(aw / cols, ah / rows, 62));
        bw = cell * cols; bh = cell * rows;
        bd.style.width = bw + 'px'; bd.style.height = bh + 'px'; bwEl.style.height = bh + 'px';
        root.style.setProperty('--bw', bw + 'px');
        endEl.style.borderRadius = Math.round(cell * 0.5) + 'px';
        // the canvas reaches past the board (flying apples, sum bubble, sparkles) but stays inside the game box,
        // so it never covers the title or the bottom buttons
        var top = bd.offsetTop;
        MT = Math.max(0, Math.min(Math.round(cell * 1.1), top));
        MB = Math.max(0, Math.min(Math.round(cell * 0.6), root.clientHeight - top - bh));
        MX = Math.max(0, Math.floor(Math.min(cell * 0.6, (root.clientWidth - bw) / 2)));
        c.fit(bw + 2 * MX, bh + MT + MB); cv.style.left = -MX + 'px'; cv.style.top = -MT + 'px';
        makeSprites(); draw(); dirty = false;
      }

      resize();
      // drag hint across the sure pair (top-left of the first apple to bottom-right of the second)
      ctx.hint(function () {
        var b = bd.getBoundingClientRect(), rt = root.getBoundingClientRect(), fp = firstPair || [0, 0];
        return { x: b.left - rt.left + (fp[1] + 0.2) * cell, y: b.top - rt.top + (fp[0] + 0.2) * cell };
      }, { kind: 'drag', dx: cell * 1.65, dy: cell * 0.6 });

      return {
        resize: resize,
        frame: function (dt) {
          now += dt * 1000;
          for (var i = pops.length - 1; i >= 0; i--) if (now - pops[i].at > 650) pops.splice(i, 1);
          var anim = pops.length > 0 || (now - shakeAt) / 320 < 1.05;
          if (dirty || anim) { draw(); dirty = false; }
          return anim;
        },
        redraw: function () { dirty = true; draw(); },
        destroy: function () { ptr = null; boards++; },
        debug: function () {
          return {
            phase: phase, score: score, left: lastSec, grid: [rows, cols], cell: cell, apples: vals ? live() : 0,
            moves: vals ? moves(vals, rows, cols, 50, false) : 0, picks: picks, fails: fails, boards: boards, sum: selSum,
            move: vals ? moves(vals, rows, cols, 1, true) : null
          };
        }
      };
    }
  };
})();
