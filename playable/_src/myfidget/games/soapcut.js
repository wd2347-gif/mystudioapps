/* game: soapcut : side view of a layered soap bar on a wooden board; drag the knife down from the top to
 * slice (crunchy steps), release early and it finishes the cut by itself; the slice tips over to the right
 * and lands with a thud and crumbs. A used-up bar is replaced by the next one sliding in
 * (lavender, strawberry milk, mint cubes). Ported from my_fidget/lib/toys/soapcut_toy.dart. */
(function () {
  var LOOKS = [
    { bands: [[0, '#FFFFFF'], [0.1, '#E4D4FF'], [0.38, '#B79AF0'], [0.62, '#F6F0FF'], [0.68, '#CBB4FA']], dots: '#7A5CC8', cubes: false, wavy: 0.25 },
    { bands: [[0, '#FFF6EE'], [0.18, '#FFC2D4'], [0.45, '#FFF3E6'], [0.58, '#FF9FBC'], [0.82, '#FFE4EC']], dots: '#E0507A', cubes: false, wavy: 1 },
    { bands: [[0, '#D6FFF1'], [0.5, '#A6F0D8']], dots: '#3FB58C', cubes: true, wavy: 0.25 }
  ];
  var BLACK0 = [0, 0, 0];
  function cs(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a == null ? 1 : a) + ')'; }
  function lc(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  /* precomputed colours per look: top face, side faces */
  for (var li = 0; li < LOOKS.length; li += 1) {
    var lk = LOOKS[li];
    lk.top = cs(lc(hex(lk.bands[0][1]), WHITE, 0.4));
    lk.side = lk.bands.map(function (b) { return cs(lc(hex(b[1]), BLACK0, 0.1)); });
  }

  function SoapCut(env) {
    var W = 0, H = 0, box = null, s = 1, bw = 200, bh = 100, home = 0, t = 0, b = 0, ddx = 0, ddy = 0;
    var faces = [], boardSpr = null, boardX = 0, boardW = 0, boardH = 0, shSpr = null, shM = 0;
    var look = 0, L = 0, R = 0.9, slideFrom = 0, slideT0 = -10, pendingNew = -1;
    var kId = null, fx = 0, fy = 0, lastY = 0, lastT = 0, vy = 0;
    var cut = null, cutY = 0, finishing = false, grain = 0, speed = 0, cutLevel = 0, lastCrunch = -1;
    var slices = [], bits = [], cheers = [], cheerT0 = -10, cheerX = 0, cheerY = 0, cheerTaps = 2;
    var kx = -1, ky = -1, clock = 0, slicesCut = 0, barsDone = 0;
    var loop = makeLoop({ type: 'bandpass', freq: 2700, q: 1.1, gain: 0.26, smooth: 0.03 });

    function shift() { var k = clamp((clock - slideT0) / 0.55, 0, 1), e = 1 - Math.pow(1 - k, 3); return slideFrom * (1 - e); }
    function X(f) { return home + shift() + f * bw; }
    function minF() { return L + Math.max(16 * s / bw, 0.06); }
    function maxF() { return R - Math.max(10 * s / bw, 0.06); }
    function suggest() { return Math.max(minF(), R - 0.11); }
    function bandAt(lkI, v) { var bs = LOOKS[lkI].bands, c = bs[0][1]; for (var i = 0; i < bs.length; i += 1) if (v >= bs[i][0]) c = bs[i][1]; return c; }

    /* ---------- pictures ---------- */
    function paintFace(lkI) {
      var lk = LOOKS[lkI], d = G.dpr, cv = mkCanvas(bw * d, bh * d), c = cv.getContext('2d'), rnd = srand(lkI * 13 + 3), i, x, y;
      c.scale(d, d);
      for (i = 0; i < lk.bands.length; i += 1) {
        var y0 = lk.bands[i][0] * bh;
        c.beginPath(); c.moveTo(0, bh);
        for (x = 0; x <= bw + 6; x += 6) {
          var wob = (Math.sin(x * 0.045 + i * 1.7) * 4 + Math.sin(x * 0.013 + i) * 6) * lk.wavy * s;
          c.lineTo(x, i === 0 ? -2 : y0 + wob);
        }
        c.lineTo(bw + 6, bh); c.closePath();
        c.fillStyle = lk.bands[i][1]; c.fill();
      }
      if (lk.cubes) {
        var cell = bh / 4;
        for (y = 0; y < bh - 1; y += cell) for (x = 0; x < bw; x += cell) {
          c.fillStyle = (rnd() < 0.5 ? 'rgba(255,255,255,' : 'rgba(46,143,110,') + (0.04 + rnd() * 0.05).toFixed(3) + ')';
          c.fillRect(x, y, cell, cell);
        }
        c.strokeStyle = 'rgba(46,143,110,0.2)'; c.lineWidth = 1.4 * s;
        c.beginPath();
        for (y = cell; y < bh - 2; y += cell) { c.moveTo(0, y); c.lineTo(bw, y); }
        for (x = cell; x < bw; x += cell) { c.moveTo(x, 0); c.lineTo(x, bh); }
        c.stroke();
      } else {
        var dc = hex(lk.dots);
        for (i = 0; i < 90; i += 1) {
          c.fillStyle = cs(dc, 0.25 + 0.35 * rnd());
          c.beginPath();
          c.ellipse(rnd() * bw, bh * (0.15 + 0.8 * rnd()), (0.8 + rnd() * 1.2) * s, (0.6 + rnd() * 0.7) * s, 0, 0, TAU);
          c.fill();
        }
      }
      var g = c.createLinearGradient(0, 0, 0, bh);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.08)');
      c.fillStyle = g; c.fillRect(0, 0, bw, bh);
      return cv;
    }
    function paintBoard() {
      var d = G.dpr, m = 22, top = 6 * s, cv = mkCanvas((boardW + m * 2) * d, (boardH + top + m * 2) * d), c = cv.getContext('2d');
      c.scale(d, d); c.translate(m, m);
      var hgt = boardH + top;
      c.save(); c.shadowColor = 'rgba(90,60,120,0.28)'; c.shadowBlur = 18 * d; c.shadowOffsetY = 8 * d;
      rrect(c, 0, 0, boardW, hgt, 10 * s); c.fillStyle = '#D7B58A'; c.fill(); c.restore();
      c.save(); rrect(c, 0, 0, boardW, hgt, 10 * s); c.clip();
      var g = c.createLinearGradient(0, top, 0, hgt);
      g.addColorStop(0, '#E9CDA6'); g.addColorStop(1, '#D7B58A');
      c.fillStyle = g; c.fillRect(0, top, boardW, hgt - top);
      c.strokeStyle = 'rgba(0,0,0,0.09)'; c.lineWidth = 1;
      var gn = Math.max(5, Math.round((hgt - top) / (16 * s)));
      for (var i = 0; i < gn; i += 1) {
        var y = top + (hgt - top) * (i + 0.5) / gn;
        c.beginPath(); c.moveTo(0, y + Math.sin(i * 1.3) * 3);
        c.bezierCurveTo(boardW * 0.35, y - 3 + Math.sin(i) * 2, boardW * 0.65, y + 3, boardW, y - Math.sin(i * 0.7) * 3);
        c.stroke();
      }
      c.fillStyle = '#F3DDBD'; c.fillRect(0, 0, boardW, top);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(0, 0, boardW, 1.2);
      c.fillStyle = 'rgba(120,80,40,0.18)'; c.fillRect(0, top, boardW, 1.5 * s);
      c.restore();
      boardSpr = cv; boardSpr.m = m;
    }
    function paintShadow() {
      /* soft shadow under the bar, drawn as a 3-slice so it fits any remaining width */
      var d = G.dpr; shM = 12 * s;
      var w = shM * 4 + 2, h = shM * 2 + 14 * s, cv = mkCanvas(w * d, h * d), c = cv.getContext('2d');
      c.scale(d, d);
      c.shadowColor = 'rgba(60,30,90,0.22)'; c.shadowBlur = 8 * s * d; c.shadowOffsetX = -1000 * d;
      c.fillStyle = '#000'; c.fillRect(shM + 1000, shM, w - shM * 2, 14 * s);
      shSpr = cv;
    }
    function layout(w, h, bx) {
      var fL = L, fR = R, fCut = cut, depthF = cut !== null ? (cutY - t) / Math.max(1, bh) : 0;
      W = w; H = h; box = bx;
      s = clamp(Math.min(bx.w, h) / 390, 0.8, 2);
      bw = Math.round(Math.min(bx.w * 0.6, 420));
      /* headroom for the raised knife: blade 1.25 bh + its depth rise 0.49 bh + handle and hover ~35 s */
      bh = Math.round(Math.min(h * 0.21, bw * 0.5, (h * 0.78 - 35 * s - 6) / 2.74));
      home = bx.x + bx.w * 0.08;
      b = Math.round(Math.max(h * 0.6, 2.74 * bh + 35 * s + 6)); t = b - bh;
      ddx = bw * 0.1; ddy = -bh * 0.35;
      boardX = bx.x + 6; boardW = bx.w - 12; boardH = clamp(h - b - 28, 36, h * 0.4);
      faces = [paintFace(0), paintFace(1), paintFace(2)];
      paintBoard(); paintShadow();
      L = fL; R = fR; cut = fCut;
      if (cut !== null) cutY = t + depthF * bh;
      slices = []; bits = [];
      kx = -1;
    }

    /* ---------- feedback ---------- */
    function crumbs(x, y, n, lkI) {
      for (var i = 0; i < n; i += 1) {
        bits.push({ x: x + (Math.random() - 0.5) * 6 * s, y: y, vx: (Math.random() - 0.3) * 120 * s, vy: (-40 - Math.random() * 120) * s, sz: (1.5 + Math.random() * 2.2) * s, col: bandAt(lkI, Math.random()), t0: clock, cube: false });
      }
      if (bits.length > 200) bits.splice(0, bits.length - 200);
    }
    function shatter(sl) {
      var cell = bh / 4, w = (sl.r - sl.l) * bw, x0 = home + sl.shift + sl.r * bw;
      var cols = 4, rows = Math.max(1, Math.round(w / cell));
      for (var i = 0; i < cols; i += 1) for (var j = 0; j < rows; j += 1) {
        bits.push({ x: x0 + (i + 0.5) * cell, y: b - (j + 0.5) * cell, vx: (Math.random() - 0.2) * 160 * s, vy: (-30 - Math.random() * 160) * s, sz: cell * 0.5, col: bandAt(sl.look, 1 - (i + 0.5) / cols), t0: clock, cube: true });
      }
      Sfx.crunch(1); Sfx.thud(0.45); haptic(true, 16);
    }
    function cheer() {
      cheerT0 = clock; cheerTaps = 0;
      cheerX = X((L + R) / 2); cheerY = t;
      var bs = LOOKS[look].bands;
      for (var i = 0; i < 26; i += 1) {
        var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = (160 + Math.random() * 260) * s;
        var col = lc(hex(bs[(Math.random() * bs.length) | 0][1]), WHITE, 0.35);
        cheers.push({ x: cheerX + (Math.random() - 0.5) * bw * 0.8, y: cheerY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sz: (4 + Math.random() * 9) * s, fill: cs(col, 0.25), t0: clock + Math.random() * 0.25, star: i % 3 === 0 });
      }
    }

    /* ---------- cutting ---------- */
    function startCut(x) {
      var f = (x - home - shift()) / bw, lo = minF(), hi = maxF();
      f = hi < lo ? (L + R) / 2 : clamp(f, lo, hi);
      cut = f; cutY = t; grain = 0;
      Sfx.crunch(0.6); haptic(true, 10);
      crumbs(X(f), t, 2, look);
    }
    function advance(y, v) {
      var depth = Math.min(y, b);
      if (depth <= cutY) return;
      var step = depth - cutY, n = 0;
      cutY = depth;
      speed = Math.max(speed, clamp(Math.abs(v) / 900, 0, 1));
      cutLevel = Math.max(cutLevel, 0.25 + 0.6 * speed);
      grain += step;
      while (grain > 7 * s) { grain -= 7 * s; n += 1; }
      if (n) {
        if (clock - lastCrunch > 0.03) { lastCrunch = clock; Sfx.crunch(0.45 + 0.4 * speed); }
        haptic(false, 7);
        crumbs(X(cut), cutY, Math.min(n, 3), look);
      }
      if (cutY >= b - 0.5) complete();
    }
    function complete() {
      if (cut === null) return;
      slices.push({ l: cut, r: R, shift: shift(), look: look, angle: 0, w: 0, landed: false, after: 0, gone: false });
      R = cut; cut = null; finishing = false; slicesCut += 1;
      haptic(true, 12);
      crumbs(X(R), b, LOOKS[look].cubes ? 3 : 5, look);
      if (R - L < 0.13) {
        /* used up: the last stub tips over too, then the next bar slides in */
        pendingNew = clock + 1.0; barsDone += 1;
        cheer();
        slices.push({ l: L, r: R, shift: shift(), look: look, angle: 0, w: 2, landed: false, after: 0, gone: false });
        R = L;
        celebrate(cheerX, cheerY, LOOKS[look].bands.map(function (q) { return q[1]; }).concat(['#FFFFFF']));
      }
    }
    function newBar() {
      look = (look + 1) % LOOKS.length;
      slideFrom = -(home + bw + ddx + 40 * s); slideT0 = clock;
      L = 0; R = 1; cut = null; finishing = false;
      Sfx.fwip(); haptic(false, 8);
    }
    function onSoap(x, y) { return y > t - 8 * s && y < b + 6 * s && x > X(L) - 12 * s && x < X(R) + ddx + 40 * s; }

    /* ---------- input ---------- */
    function down(p) {
      if (kId !== null || finishing) return;
      kId = p.id; fx = p.x; fy = p.y; lastY = p.y; lastT = p.t; vy = 0;
      if (kx < 0) { kx = fx; ky = fy; }
      if (pendingNew < 0 && onSoap(p.x, p.y)) { startCut(p.x); advance(p.y, 0); }
      else haptic(false, 6);
    }
    function move(p) {
      if (p.id !== kId) return;
      var py = fy, dtm = Math.max(8, p.t - lastT);
      vy = (p.y - lastY) / dtm * 1000; lastY = p.y; lastT = p.t;
      fx = p.x; fy = p.y;
      if (finishing) return;
      if (cut === null) {
        if (pendingNew < 0 && py <= t && p.y > t && onSoap(p.x, t + 1)) startCut(p.x);
        else return;
      }
      advance(p.y, vy);
    }
    function up(p) {
      if (p.id !== kId) return;
      kId = null;
      if (cut !== null) finishing = true;
    }

    /* ---------- frame ---------- */
    function update(dt) {
      clock += dt;
      if (finishing && cut !== null) advance(cutY + 420 * s * dt, 420 * s);
      /* knife: on the cut, on the finger, or hovering over the next slice */
      var tx, ty, k;
      if (cut !== null) { tx = X(cut); ty = cutY; k = 1; }
      else if (kId !== null) { tx = fx; ty = fy; k = 1 - Math.exp(-dt * 30); }
      else { tx = X(suggest()); ty = t - 14 * s + Math.sin(clock * 2.4) * 4 * s; k = 1 - Math.exp(-dt * 9); }
      if (kx < 0) { kx = tx; ky = ty; } else { kx += (tx - kx) * k; ky += (ty - ky) * k; }
      var i;
      for (i = slices.length - 1; i >= 0; i -= 1) {
        var sl = slices[i];
        if (sl.landed) { sl.after += dt; if (sl.after > 1.6 || sl.gone) slices.splice(i, 1); continue; }
        sl.w += (9 + 14 * Math.sin(sl.angle + 0.25)) * dt;
        sl.angle += sl.w * dt;
        if (sl.angle >= Math.PI / 2) {
          sl.angle = Math.PI / 2; sl.landed = true;
          if (LOOKS[sl.look].cubes) { shatter(sl); sl.gone = true; }
          else {
            Sfx.thud(0.85); haptic(true, 18);
            crumbs(home + sl.shift + sl.r * bw + bh * 0.5, b, 6, sl.look);
          }
        }
      }
      var gr = 900 * s;
      for (i = bits.length - 1; i >= 0; i -= 1) {
        var q = bits[i];
        if (clock - q.t0 > (q.cube ? 2.2 : 1.2)) { bits.splice(i, 1); continue; }
        q.vy += gr * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.y > b - q.sz * 0.5 && q.vy > 0) {
          q.y = b - q.sz * 0.5; q.vx *= 0.6; q.vy = -q.vy * 0.3;
          if (q.cube && Math.abs(q.vy) > 40 * s && Math.random() < 0.3) haptic(false, 5);
        }
      }
      if (pendingNew > 0 && clock > pendingNew) { pendingNew = -1; newBar(); }
      for (i = cheers.length - 1; i >= 0; i -= 1) {
        var ch = cheers[i];
        if (clock - ch.t0 > 1.6) { cheers.splice(i, 1); continue; }
        if (clock < ch.t0) continue;
        var dk = Math.exp(-dt * 1.6);
        ch.vx *= dk; ch.vy = ch.vy * dk - 40 * s * dt;
        ch.x += ch.vx * dt; ch.y += ch.vy * dt;
      }
      if (cheerTaps < 2 && clock - cheerT0 > 0.14 * (cheerTaps + 1)) { cheerTaps += 1; haptic(true, 8); }
      loop.set(cutLevel > 0.05 ? cutLevel : 0, 0.9 + 0.3 * speed);
      cutLevel *= Math.exp(-dt * 10);
      speed *= Math.exp(-dt * 8);
    }

    function sidePaint(c, r, lkI) {
      var lk = LOOKS[lkI], bs = lk.bands;
      for (var i = 0; i < bs.length; i += 1) {
        var y0 = t + bs[i][0] * bh, y1 = i + 1 < bs.length ? t + bs[i + 1][0] * bh : b;
        c.fillStyle = lk.side[i];
        c.beginPath(); c.moveTo(r, y0); c.lineTo(r + ddx, y0 + ddy); c.lineTo(r + ddx, y1 + ddy); c.lineTo(r, y1); c.closePath(); c.fill();
      }
    }
    function quad(c, A, B, col) {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(B[0] + ddx, B[1] + ddy); c.lineTo(A[0] + ddx, A[1] + ddy); c.closePath(); c.fill();
    }
    function bandQuads(c, A, B, lk) {
      var bs = lk.bands;
      for (var i = 0; i < bs.length; i += 1) {
        var f0 = bs[i][0], f1 = i + 1 < bs.length ? bs[i + 1][0] : 1;
        quad(c, [A[0] + (B[0] - A[0]) * f0, A[1] + (B[1] - A[1]) * f0], [A[0] + (B[0] - A[0]) * f1, A[1] + (B[1] - A[1]) * f1], lk.side[i]);
      }
    }
    /* a soap block seen from the front with its depth going up-right: front face [l, r] x [t, b], turned by
     * ang about (px, b) and moved right by slide. Only the side faces that face the depth direction show. */
    function block(c, l, r, fl, fr, lkI, ang, px, slide, fresh) {
      if (r - l < 0.5) return;
      var lk = LOOKS[lkI], face = faces[lkI], fw = face.width, ca = Math.cos(ang), sa = Math.sin(ang);
      function P(x, y) { var dx = x - px, dy = y - b; return [px + dx * ca - dy * sa + slide, b + dx * sa + dy * ca]; }
      var TL = P(l, t), TR = P(r, t), BR = P(r, b), BL = P(l, b);
      if (sa * ddx - ca * ddy > 0) quad(c, TL, TR, lk.top);
      if (ca * ddx + sa * ddy > 0) bandQuads(c, TR, BR, lk);
      if (-ca * ddx - sa * ddy > 0) bandQuads(c, TL, BL, lk);
      c.save();
      if (ang || slide) { c.translate(px + slide, b); c.rotate(ang); c.translate(-px, -b); }
      var sx = clamp(fl * fw, 0, fw - 1), sw = Math.max(1, Math.min(fw - sx, (fr - fl) * fw));
      c.drawImage(face, sx, 0, sw, face.height, l, t, r - l, bh);
      if (fresh) { c.fillStyle = 'rgba(255,255,255,0.33)'; c.fillRect(l, t, 2 * s, bh); }
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1.5 * s;
      c.beginPath(); c.moveTo(l, t); c.lineTo(r, t); c.stroke();
      c.restore();
    }
    function knife(c, x, y, inside) {
      var h = bh * 1.25, top = y - h;
      function at(z, yy) { return [x + ddx * z, yy + ddy * z]; }
      function quad(z0, z1, ya, yb) {
        var a = at(z0, ya), bb = at(z1, ya), cc = at(z1, yb), e = at(z0, yb);
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bb[0], bb[1]); c.lineTo(cc[0], cc[1]); c.lineTo(e[0], e[1]); c.closePath();
      }
      var g0 = at(-0.3, y), g1 = at(1.3, y), g = c.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
      g.addColorStop(0, '#F6F8FA'); g.addColorStop(0.5, '#C9D0D8'); g.addColorStop(1, '#98A1AC');
      c.save(); c.translate(6 * s, 4 * s); quad(-0.3, 1.3, top, inside ? t : y); c.fillStyle = 'rgba(60,30,90,0.1)'; c.fill(); c.restore();
      quad(-0.3, 1.3, top, inside ? t : y); c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(80,90,110,0.35)'; c.lineWidth = 1; c.stroke();
      if (inside) { quad(-0.3, 0, t, y); c.fillStyle = g; c.fill(); }
      else {
        c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.5 * s;
        c.beginPath(); c.moveTo(g0[0], g0[1]); c.lineTo(g1[0], g1[1]); c.stroke();
      }
      var h0 = at(-0.4, top - 8 * s), h1 = at(1.4, top - 8 * s);
      c.lineCap = 'round';
      c.strokeStyle = '#8A5A3B'; c.lineWidth = 18 * s;
      c.beginPath(); c.moveTo(h0[0], h0[1]); c.lineTo(h1[0], h1[1]); c.stroke();
      var k0 = at(-0.4, top - 12 * s), k1 = at(1.4, top - 12 * s);
      c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 4 * s;
      c.beginPath(); c.moveTo(k0[0], k0[1]); c.lineTo(k1[0], k1[1]); c.stroke();
      c.lineCap = 'butt';
    }
    function sparkle4(c, x, y, r) {
      c.beginPath(); c.moveTo(x, y - r);
      c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
      c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r);
      c.closePath(); c.fill();
    }
    function draw(c) {
      if (!boardSpr) return;
      var d = G.dpr, m = boardSpr.m, top = 6 * s, i;
      c.drawImage(boardSpr, boardX - m, b - top - m, boardSpr.width / d, boardSpr.height / d);
      var sh = shift(), l = X(L), r = X(R);
      /* shadow under the bar */
      if (r - l > 1) {
        var x0 = l + 4 - shM, x1 = r + ddx + 8 + shM, sw = shSpr.width / d, shh = shSpr.height / d, y0 = b - 4 - shM, cap = shM * 2;
        if (x1 - x0 > cap * 2) {
          c.drawImage(shSpr, 0, 0, cap * d, shSpr.height, x0, y0, cap, shh);
          c.drawImage(shSpr, cap * d, 0, 2 * d, shSpr.height, x0 + cap, y0, x1 - x0 - cap * 2, shh);
          c.drawImage(shSpr, (sw - cap) * d, 0, cap * d, shSpr.height, x1 - cap, y0, cap, shh);
        }
      }
      /* falling slices (pivot: bottom right corner) */
      for (i = 0; i < slices.length; i += 1) {
        var sl = slices[i], fade = clamp(1 - (sl.after - 1.0) / 0.6, 0, 1);
        if (fade <= 0 || sl.gone) continue;
        var px = home + sl.shift + sl.r * bw;
        c.globalAlpha = fade;
        block(c, home + sl.shift + sl.l * bw, px, sl.l, sl.r, sl.look, sl.angle, px, sl.after * 14 * s, true);
        c.globalAlpha = 1;
      }
      block(c, l, r, L, R, look, 0, r, 0, false);
      /* a new bar gets one gleam */
      var gl = clock - slideT0 - 0.35;
      if (gl > 0 && gl < 0.7 && barsDone > 0) {
        var gx = l + (r - l + bh) * (gl / 0.7) - bh;
        c.save(); c.beginPath(); c.rect(l, t, r - l, bh); c.clip();
        c.fillStyle = 'rgba(255,255,255,0.4)';
        c.beginPath(); c.moveTo(gx, b); c.lineTo(gx + bh * 0.6, t); c.lineTo(gx + bh * 0.6 + 26 * s, t); c.lineTo(gx + 26 * s, b); c.closePath(); c.fill();
        c.restore();
      }
      /* reward: warm glow, soap bubbles and sparkles */
      var ck = clock - cheerT0;
      if (ck >= 0 && ck < 0.7) {
        var gg = c.createRadialGradient(cheerX, cheerY, 0, cheerX, cheerY, bw * 0.9);
        gg.addColorStop(0, 'rgba(255,255,240,' + (0.55 * (1 - ck / 0.7)).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gg; c.beginPath(); c.arc(cheerX, cheerY, bw * (0.5 + 0.4 * ck), 0, TAU); c.fill();
      }
      for (i = 0; i < cheers.length; i += 1) {
        var ch = cheers[i], age = clock - ch.t0;
        if (age < 0) continue;
        var life = clamp(1 - age / 1.6, 0, 1);
        c.globalAlpha = life;
        if (ch.star) { c.fillStyle = 'rgba(255,255,255,0.95)'; sparkle4(c, ch.x, ch.y, ch.sz * (0.6 + 0.4 * Math.abs(Math.sin(age * 14)))); }
        else {
          c.fillStyle = ch.fill; c.beginPath(); c.arc(ch.x, ch.y, ch.sz, 0, TAU); c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.4 * s; c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(ch.x - ch.sz * 0.35, ch.y - ch.sz * 0.35, ch.sz * 0.22, 0, TAU); c.fill();
        }
      }
      c.globalAlpha = 1;
      /* the cut being made */
      if (cut !== null) {
        c.strokeStyle = 'rgba(0,0,0,0.33)'; c.lineWidth = 2 * s;
        c.beginPath(); c.moveTo(X(cut), t); c.lineTo(X(cut), cutY); c.stroke();
      }
      /* crumbs and cubes */
      for (i = 0; i < bits.length; i += 1) {
        var q = bits[i], la = clamp(1 - (clock - q.t0 - (q.cube ? 1.6 : 0.8)) / 0.5, 0, 1);
        if (la <= 0) continue;
        c.globalAlpha = la; c.fillStyle = q.col;
        if (q.cube) {
          var z = q.sz;
          c.fillRect(q.x - z, q.y - z, z * 2, z * 2);
          c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(q.x - z, q.y - z, z * 2, z * 0.5);
          c.strokeStyle = 'rgba(46,143,110,0.35)'; c.lineWidth = 1; c.strokeRect(q.x - z, q.y - z, z * 2, z * 2);
        } else { c.beginPath(); c.arc(q.x, q.y, q.sz, 0, TAU); c.fill(); }
      }
      c.globalAlpha = 1;
      if (kx >= 0) knife(c, kx, ky, cut !== null && ky > t);
    }

    return {
      layout: layout,
      down: down, move: move, up: up,
      update: update,
      draw: draw,
      hint: function () {
        if (cut !== null || pendingNew > 0 || clock - slideT0 < 0.6) return null;
        return { x: X(suggest()), y: t - 30 * s, dx: 0, dy: bh + 24 * s };
      },
      debug: function () { return { slices: slicesCut, bars: barsDone, left: Math.round((R - L) * 100) / 100, cutting: cut !== null, look: look }; },
      destroy: function () { loop.stop(); faces = []; boardSpr = null; shSpr = null; slices = []; bits = []; cheers = []; }
    };
  }

  GAMES['soapcut'] = {
    name: { ko: '비누 썰기', ja: '石けんカット', en: 'Soap Cutting' },
    tip: { ko: '칼을 쓱 내려 썰어 보세요', ja: 'ナイフを下ろして切ってみて', en: 'Slide the knife down to cut' },
    bg: 'linear-gradient(180deg,#F4EEFB 0%,#E6DDF5 100%) #F4EEFB',
    tone: 'light',
    top: '#F4EEFB',
    accent: '#B79AF0',
    make: SoapCut
  };
})();
