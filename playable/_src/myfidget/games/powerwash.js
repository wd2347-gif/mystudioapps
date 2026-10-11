/* game: powerwash : a dirty wooden deck; drag to spray a water jet that strips grey-green dust in one pass
 * and thins thick moss until it flakes off. Mostly clean: shine sweep and a ding, then new grime fades in.
 * Ported from my_fidget/lib/toys/powerwash_toy.dart (look 0, wood deck). Dirt lives on a coarse grid
 * (one value per vertex, like the app); the grid is written into tiny mask canvases that are scaled up
 * (bilinear = the app's vertex-colour blend) and used to cut the dust / moss pictures. Only the region the
 * jet touched is re-composited each frame. */
(function () {
  var DUST = '#7E7A63', THICK = '#465F2E', MIST = '#EAF6FF', GAPC = '#2E1E10';
  var DUST_MAX = 0.95, SOFT = 0.12, RATE_THICK = 2.4, PASS_THICK = 0.24, GOAL = 0.8, M = 26;

  function sstep(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }
  function hash(x, y, sd) {
    var h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(sd, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h & 0xFFFF) / 0xFFFF;
  }
  function vnoise(x, y, sd) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi, sd), b = hash(xi + 1, yi, sd), c = hash(xi, yi + 1, sd), d = hash(xi + 1, yi + 1, sd);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, sd, oct) {
    var sum = 0, amp = 0.5, f = 1, norm = 0;
    for (var i = 0; i < oct; i += 1) {
      sum += amp * vnoise(x * f + i * 5.3, y * f - i * 3.1, sd + i * 17);
      norm += amp; amp *= 0.5; f *= 2.03;
    }
    return sum / norm;
  }
  function hsv(h, s, v) {
    var c = v * s, hp = (h % 360) / 60, x = c * (1 - Math.abs(hp % 2 - 1)), r = 0, g = 0, b = 0, m = v - c;
    if (hp < 1) { r = c; g = x; } else if (hp < 2) { r = x; g = c; } else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; } else if (hp < 5) { r = x; b = c; } else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  function lc(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function cs(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a == null ? 1 : a) + ')'; }
  /* radial sprite in one colour; stops = [[pos, alpha], ...] (the app's Sprites.glow / Sprites.dot) */
  function radial(px, rgb, stops) {
    var cv = mkCanvas(px, px), c = cv.getContext('2d'), g = c.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    for (var i = 0; i < stops.length; i += 1) g.addColorStop(stops[i][0], cs(rgb, stops[i][1]));
    c.fillStyle = g; c.fillRect(0, 0, px, px);
    return cv;
  }
  var GLOW = [[0, 1], [0.12, 0.55], [0.32, 0.19], [0.6, 0.05], [1, 0]];
  var DOT = [[0, 1], [0.45, 1], [0.7, 0.4], [1, 0]];
  /* small particle pool (mist, flakes) */
  function pool(cap) {
    return { cap: cap, n: 0, x: new Float32Array(cap), y: new Float32Array(cap), vx: new Float32Array(cap), vy: new Float32Array(cap), life: new Float32Array(cap), age: new Float32Array(cap), sz: new Float32Array(cap) };
  }
  function padd(P, x, y, vx, vy, life, sz) {
    var i = P.n;
    if (P.n >= P.cap) i = (Math.random() * P.cap) | 0; else P.n += 1;
    P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy; P.life[i] = life; P.age[i] = 0; P.sz[i] = sz;
  }
  function pstep(P, dt, drag) {
    var k = Math.exp(-dt * drag), i = 0;
    while (i < P.n) {
      P.age[i] += dt;
      if (P.age[i] >= P.life[i]) {
        var j = P.n - 1;
        P.x[i] = P.x[j]; P.y[i] = P.y[j]; P.vx[i] = P.vx[j]; P.vy[i] = P.vy[j]; P.life[i] = P.life[j]; P.age[i] = P.age[j]; P.sz[i] = P.sz[j];
        P.n -= 1; continue;
      }
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.vx[i] *= k; P.vy[i] *= k;
      i += 1;
    }
  }

  function PowerWash(env) {
    var W = 0, H = 0, D = { x: 0, y: 0, w: 0, h: 0 }, s = 1, RAD = 14, q = 1, dprNow = 0;
    var cell = 4, nx = 0, ny = 0, N = 0, reach = 30;
    var dust = null, thick = null, dust0 = null, thick0 = null, th = null, wet = null;
    var nD0 = null, nT0 = null, nTh = null, prepRow = -1, prepSeed = 0;
    var mD = null, mT = null, mW = null, iD = null, iT = null, iW = null, cD = null, cT = null, cW = null;
    var clean = null, dustImg = null, thickImg = null, dustL = null, thickL = null, dLc = null, tLc = null;
    var glowM = null, dotM = null, dotT = null, glowW = null;
    var rowH = 54, rowOff = 0, seed = 1, stripeY = 0, hintY = -1, hintAt = -9;
    var noz = {}, nn = 0, removal = 0, chips = 0, lastChip = -1, lastHap = -1, lastTick = -1, runoff = 0;
    var dirt0 = 1, progress = 0, done = false, doneAt = -100, cleared = false, rounds = 0, layerA = 1, fadeAt = -100, roundAt = -100;
    var dirty = null, sumDue = false, wetMax = 0, clock = 0, nextGlint = 1.2;
    var mist = pool(260), flakes = pool(120), rivs = [], glints = [], events = [];
    var hiss = makeLoop({ type: 'bandpass', freq: 2300, q: 0.55, gain: 0.42, smooth: 0.04 });
    var body = makeLoop({ type: 'lowpass', freq: 520, q: 0.6, gain: 0.24, smooth: 0.05 });

    /* ---------- dirt grid ---------- */
    function distToGrid(v, gap, off) { var m = ((v - off) % gap + gap) % gap; return Math.min(m, gap - m); }
    function initRows(sd, oD, oT, oTh, j0, j1) {
      var sx = 1 / s, k3 = sd * 31;
      for (var j = j0; j < j1 && j < ny; j += 1) {
        for (var i = 0; i < nx; i += 1) {
          var k = j * nx + i, x = i * cell * sx, y = j * cell * sx;
          oD[k] = 0.86 + 0.14 * fbm(x / 70, y / 70, k3 + 3, 3);
          oTh[k] = 0.1 + 0.5 * fbm(x / 15, y / 15, k3 + 9, 3);
          var big = fbm(x / 120, y / 120, k3 + 1, 4), fine = fbm(x / 34, y / 34, k3 + 5, 3);
          var moss = sstep(0.55, 0.66, big * 0.8 + fine * 0.2);
          var gap = distToGrid(j * cell, rowH, rowOff);
          var seam = (1 - sstep(2 * s, 9 * s, gap)) * sstep(0.36, 0.5, fine);
          var t = Math.max(moss, seam * 0.85);
          oT[k] = t <= 0.01 ? 0 : t * (0.75 + 0.25 * fine);
        }
      }
    }
    function dustA(d) { return sstep(0, 0.85, d) * DUST_MAX; }
    function thickA(t, h) { return t <= 0 ? 0 : sstep(h - SOFT, h + SOFT, t) * (0.84 + 0.16 * Math.min(1, t)); }
    function visibleSum() {
      var sum = 0;
      for (var k = 0; k < N; k += 1) {
        var a = dustA(dust[k]) / DUST_MAX, b = thick[k] > 0 ? thickA(thick[k], th[k]) : 0;
        sum += a > b ? a : b;
      }
      return sum;
    }
    function markDirty(i0, i1, j0, j1) {
      if (!dirty) { dirty = { i0: i0, i1: i1, j0: j0, j1: j1 }; return; }
      if (i0 < dirty.i0) dirty.i0 = i0; if (i1 > dirty.i1) dirty.i1 = i1;
      if (j0 < dirty.j0) dirty.j0 = j0; if (j1 > dirty.j1) dirty.j1 = j1;
    }
    /* wash around the segment a -> b (deck px) the jet swept this frame; returns how much came off */
    function spray(ax, ay, bx, by, dt, quiet) {
      if (!dust) return 0;
      var r = reach, rc = r * 0.8, rm = r * 1.55;
      var i0 = clamp(Math.floor((Math.min(ax, bx) - rm) / cell), 0, nx - 1), i1 = clamp(Math.ceil((Math.max(ax, bx) + rm) / cell), 0, nx - 1);
      var j0 = clamp(Math.floor((Math.min(ay, by) - rm) / cell), 0, ny - 1), j1 = clamp(Math.ceil((Math.max(ay, by) + rm) / cell), 0, ny - 1);
      var abx = bx - ax, aby = by - ay, len2 = abx * abx + aby * aby;
      var pass = clamp(Math.sqrt(len2) / (2 * rc), 0, 1), bite = RATE_THICK * dt + PASS_THICK * pass;
      var removed = 0, ch = 0, rm2 = rm * rm;
      for (var j = j0; j <= j1; j += 1) {
        for (var i = i0; i <= i1; i += 1) {
          var px = i * cell, py = j * cell;
          var u = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
          u = u < 0 ? 0 : (u > 1 ? 1 : u);
          var dx = px - (ax + abx * u), dy = py - (ay + aby * u), d2 = dx * dx + dy * dy;
          if (d2 >= rm2) continue;
          var d = Math.sqrt(d2), k = j * nx + i;
          var wv = 1 - sstep(r * 0.9, rm, d);
          if (wv > wet[k]) wet[k] = wv;
          if (d < r) {
            var f = 1 - sstep(rc, r, d);
            var dOld = dust[k], dNew = Math.min(dOld, 1 - f);
            if (dNew < dOld) { dust[k] = dNew; removed += dOld - dNew; }
            var tOld = thick[k];
            if (tOld > 0) {
              var tNew = Math.max(0, tOld - f * bite);
              thick[k] = tNew; removed += (tOld - tNew) * 3;
              if (tOld >= th[k] && tNew < th[k]) { ch += 1; if (!quiet && ch <= 4) flake(px, py, (ax + bx) / 2, (ay + by) / 2); }
            }
          } else if (dust[k] > 0) {
            dust[k] = Math.max(0, dust[k] - (1 - sstep(r, rm, d)) * 0.7 * dt);
          }
        }
      }
      chips += ch;
      markDirty(i0, i1, j0, j1);
      if (removed > 0) sumDue = true;
      return removed;
    }

    /* ---------- masks and layers ---------- */
    function maskCanvas() {
      var cv = mkCanvas(nx, ny), c = cv.getContext('2d'), im = c.createImageData(nx, ny);
      return { cv: cv, c: c, im: im };
    }
    function writeMasks(i0, i1, j0, j1) {
      var dd = iD.data, td = iT.data;
      for (var j = j0; j <= j1; j += 1) {
        for (var i = i0; i <= i1; i += 1) {
          var k = j * nx + i, p = k * 4;
          dd[p] = 255; dd[p + 1] = 255; dd[p + 2] = 255; dd[p + 3] = Math.round(dustA(dust[k]) * 255);
          td[p] = 255; td[p + 1] = 255; td[p + 2] = 255; td[p + 3] = thick[k] > 0 ? Math.round(thickA(thick[k], th[k]) * 255) : 0;
        }
      }
      cD.putImageData(iD, 0, 0, i0, j0, i1 - i0 + 1, j1 - j0 + 1);
      cT.putImageData(iT, 0, 0, i0, j0, i1 - i0 + 1, j1 - j0 + 1);
    }
    function refresh(Lc, mask, img, rx, ry, rw, rh) {
      /* clip and clear on whole device pixels: a fractional clip leaves faint seam lines */
      var x0 = Math.floor(rx * q), y0 = Math.floor(ry * q), x1 = Math.ceil((rx + rw) * q), y1 = Math.ceil((ry + rh) * q);
      Lc.save();
      Lc.setTransform(1, 0, 0, 1, 0, 0);
      Lc.beginPath(); Lc.rect(x0, y0, x1 - x0, y1 - y0); Lc.clip();
      Lc.clearRect(x0, y0, x1 - x0, y1 - y0);
      Lc.setTransform(q, 0, 0, q, 0, 0);
      Lc.drawImage(mask, 0, 0, nx, ny, -cell / 2, -cell / 2, nx * cell, ny * cell);
      Lc.globalCompositeOperation = 'source-in';
      Lc.drawImage(img, 0, 0, img.width, img.height, 0, 0, D.w, D.h);
      Lc.restore();
    }
    function flush(all) {
      if (all) dirty = { i0: 0, i1: nx - 1, j0: 0, j1: ny - 1 };
      if (!dirty || !dLc) return;
      var b = dirty; dirty = null;
      writeMasks(b.i0, b.i1, b.j0, b.j1);
      var rx = Math.max(0, (b.i0 - 1.5) * cell), ry = Math.max(0, (b.j0 - 1.5) * cell);
      var rw = Math.min(D.w, (b.i1 + 1.5) * cell) - rx, rh = Math.min(D.h, (b.j1 + 1.5) * cell) - ry;
      if (rw <= 0 || rh <= 0) return;
      refresh(dLc, mD.cv, dustImg, rx, ry, rw, rh);
      refresh(tLc, mT.cv, thickImg, rx, ry, rw, rh);
    }
    function updateWet(dt) {
      if (wetMax <= 0 && !nn) return;
      var mx = 0, dec = dt * 0.38, wd = iW.data;
      for (var k = 0; k < N; k += 1) {
        var w = wet[k];
        if (w > 0) { w = Math.max(0, w - dec); wet[k] = w; if (w > mx) mx = w; }
        wd[k * 4 + 3] = Math.round(w * 0.28 * 255);
      }
      wetMax = mx;
      cW.putImageData(iW, 0, 0);
    }

    /* ---------- pictures ---------- */
    function paintDeck(c, rnd) {
      var ph = 54 * s, gap = 3.4 * s;
      rowH = ph; rowOff = -rnd() * ph;
      c.fillStyle = GAPC; c.fillRect(0, 0, D.w, D.h);
      c.lineCap = 'round';
      for (var y = rowOff; y < D.h; y += ph) {
        var x = -rnd() * 220 * s;
        while (x < D.w) {
          var len = (170 + rnd() * 230) * s;
          var rx = x + gap / 2, ry = y + gap / 2, rw = len - gap, rh = ph - gap;
          var base = hsv(25 + rnd() * 9, 0.5 + rnd() * 0.14, 0.68 + rnd() * 0.12);
          var g = c.createLinearGradient(0, ry, 0, ry + rh);
          g.addColorStop(0, cs(lc(base, WHITE, 0.1))); g.addColorStop(0.5, cs(base)); g.addColorStop(1, cs(lc(base, [0, 0, 0], 0.18)));
          rrect(c, rx, ry, rw, rh, 2.5 * s); c.fillStyle = g; c.fill();
          c.save(); c.beginPath(); c.rect(rx, ry, rw, rh); c.clip();
          var lines = 11 + Math.floor(rnd() * 5), gcol = lc(base, [58, 32, 8], 0.5);
          for (var gI = 0; gI < lines; gI += 1) {
            var yy = ry + (gI + rnd()) / lines * rh, amp = (0.6 + rnd() * 2.2) * s, fq = 0.006 + rnd() * 0.012, p0 = rnd() * 6;
            c.beginPath(); c.moveTo(rx, yy);
            for (var xx = rx; xx <= rx + rw + 10; xx += 10 * s) c.lineTo(xx, yy + Math.sin(xx * fq / s + p0) * amp);
            c.lineWidth = (0.5 + rnd() * 1.1) * s; c.strokeStyle = cs(gcol, 0.18 + rnd() * 0.2); c.stroke();
          }
          if (rnd() < 0.35) {
            var kx = rx + rw * (0.15 + rnd() * 0.7), ky = ry + rh * (0.3 + rnd() * 0.4);
            c.lineWidth = 1.1 * s; c.strokeStyle = 'rgba(74,42,16,0.35)';
            for (var qq = 3; qq >= 1; qq -= 1) { c.beginPath(); c.ellipse(kx, ky, qq * 3.5 * s, qq * 1.8 * s, 0, 0, TAU); c.stroke(); }
            c.fillStyle = 'rgba(74,42,16,0.6)'; c.beginPath(); c.ellipse(kx, ky, 3 * s, 1.5 * s, 0, 0, TAU); c.fill();
          }
          c.restore();
          var nxs = [rx + 11 * s, rx + rw - 11 * s], nys = [ry + ph * 0.28, ry + rh - ph * 0.28];
          for (var a = 0; a < 2; a += 1) for (var bI = 0; bI < 2; bI += 1) {
            c.fillStyle = '#5A5650'; c.beginPath(); c.arc(nxs[a], nys[bI], 2.4 * s, 0, TAU); c.fill();
            c.fillStyle = '#B8B2A8'; c.beginPath(); c.arc(nxs[a] - 0.6 * s, nys[bI] - 0.6 * s, 1.0 * s, 0, TAU); c.fill();
          }
          x += len;
        }
      }
    }
    function mottle(c, rnd, col, dark, bright) {
      var base = hex(col), up = lc(base, WHITE, 0.35), dn = lc(base, [0, 0, 0], 0.45);
      var gu = radial(64, up, GLOW), gd = radial(64, dn, GLOW), n = Math.round(D.w * D.h / 900), i;
      for (i = 0; i < n; i += 1) {
        var hi = rnd() < 0.5, sz = (12 + rnd() * 46) * s;
        c.globalAlpha = (hi ? bright : dark) * (0.3 + 0.7 * rnd());
        c.drawImage(hi ? gu : gd, rnd() * D.w - sz / 2, rnd() * D.h - sz / 2, sz, sz);
      }
      c.globalAlpha = 0.35; c.fillStyle = cs(lc(base, [0, 0, 0], 0.5));
      for (i = 0; i < n * 6; i += 1) { var z = (0.8 + rnd() * 1.8) * s; c.fillRect(rnd() * D.w, rnd() * D.h, z, z); }
      c.globalAlpha = 1;
    }
    function paintAll() {
      var d = G.dpr, rnd = srand(11), c;
      /* clean deck (with a margin for the drop shadow) */
      clean = mkCanvas((D.w + M * 2) * d, (D.h + M * 2) * d);
      c = clean.getContext('2d'); c.scale(d, d); c.translate(M, M);
      c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 22 * d; c.shadowOffsetY = 10 * d;
      rrect(c, 0, 0, D.w, D.h, RAD); c.fillStyle = GAPC; c.fill(); c.restore();
      c.save(); rrect(c, 0, 0, D.w, D.h, RAD); c.clip(); paintDeck(c, rnd); c.restore();
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; rrect(c, 1, 1, D.w - 2, D.h - 2, RAD - 1); c.stroke();
      /* dust: the same deck, faded to grey (luma 0.36 + dust 0.55) with blotches */
      q = Math.min(d, 1.5);
      dustImg = mkCanvas(D.w * q, D.h * q); c = dustImg.getContext('2d'); c.scale(q, q);
      c.drawImage(clean, M * d, M * d, D.w * d, D.h * d, 0, 0, D.w, D.h);
      c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, D.w, D.h);
      c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(92,92,92)'; c.fillRect(0, 0, D.w, D.h);
      var dc = hex(DUST);
      c.globalCompositeOperation = 'lighter'; c.fillStyle = cs([dc[0] * 0.55, dc[1] * 0.55, dc[2] * 0.55]); c.fillRect(0, 0, D.w, D.h);
      c.globalCompositeOperation = 'source-over';
      mottle(c, srand(97 + seed), DUST, 0.2, 0.26);
      c.globalCompositeOperation = 'destination-in'; rrect(c, 0, 0, D.w, D.h, RAD); c.fillStyle = '#000'; c.fill();
      c.globalCompositeOperation = 'source-over';
      /* thick moss: dark green, mottled, with light and dark granules */
      thickImg = mkCanvas(D.w * q, D.h * q); c = thickImg.getContext('2d'); c.scale(q, q);
      rrect(c, 0, 0, D.w, D.h, RAD); c.clip();
      c.fillStyle = THICK; c.fillRect(0, 0, D.w, D.h);
      var r2 = srand(197 + seed);
      mottle(c, r2, THICK, 0.3, 0.3);
      var gB = radial(16, [157, 191, 78], DOT), gK = radial(16, [34, 58, 20], DOT), n = Math.round(D.w * D.h / 80);
      for (var i = 0; i < n; i += 1) {
        var br = r2() < 0.55, z = (1.4 + r2() * 3.4) * s;
        c.globalAlpha = br ? 0.55 : 0.6;
        c.drawImage(br ? gB : gK, r2() * D.w - z / 2, r2() * D.h - z / 2, z, z);
      }
      c.globalAlpha = 1;
      /* layers that hold "picture masked by grid" */
      dustL = mkCanvas(D.w * q, D.h * q); dLc = dustL.getContext('2d'); dLc.scale(q, q);
      thickL = mkCanvas(D.w * q, D.h * q); tLc = thickL.getContext('2d'); tLc.scale(q, q);
      glowM = radial(64, hex(MIST), GLOW); dotM = radial(24, hex(MIST), DOT); dotT = radial(24, hex(THICK), DOT); glowW = radial(64, WHITE, GLOW);
      dprNow = d;
    }

    /* ---------- layout ---------- */
    function setupGrid(keep) {
      var onx = nx, ony = ny, od = dust, ot = thick, ot0 = thick0;
      s = clamp(Math.min(D.w, D.h) / 360, 0.8, 2);
      reach = 30 * s;
      cell = Math.max(Math.min(D.w, D.h) / 95, Math.sqrt(D.w * D.h / 22000));
      nx = Math.ceil(D.w / cell) + 1; ny = Math.ceil(D.h / cell) + 1; N = nx * ny;
      dust = new Float32Array(N); thick = new Float32Array(N); dust0 = new Float32Array(N); thick0 = new Float32Array(N);
      th = new Float32Array(N); wet = new Float32Array(N); nD0 = new Float32Array(N); nT0 = new Float32Array(N); nTh = new Float32Array(N);
      mD = maskCanvas(); mT = maskCanvas(); mW = maskCanvas();
      cD = mD.c; cT = mT.c; cW = mW.c; iD = mD.im; iT = mT.im; iW = mW.im;
      var wd = iW.data;
      for (var k = 0; k < N; k += 1) { wd[k * 4] = 11; wd[k * 4 + 1] = 13; wd[k * 4 + 2] = 16; }
      return { keep: keep && od, onx: onx, ony: ony, od: od, ot: ot, ot0: ot0 };
    }
    function start(old) {
      initRows(seed, dust0, thick0, th, 0, ny);
      dust.set(dust0); thick.set(thick0);
      dirt0 = Math.max(1, visibleSum());
      if (old && old.keep) {
        /* relayout: carry the washed state over to the new grid */
        for (var j = 0; j < ny; j += 1) for (var i = 0; i < nx; i += 1) {
          var oi = Math.round(i * (old.onx - 1) / Math.max(1, nx - 1)), oj = Math.round(j * (old.ony - 1) / Math.max(1, ny - 1)), o = oj * old.onx + oi, k = j * nx + i;
          dust[k] = Math.min(dust0[k], old.od[o]);
          thick[k] = old.ot0[o] > 0.001 ? thick0[k] * clamp(old.ot[o] / old.ot0[o], 0, 1) : (old.ot[o] > 0 ? thick0[k] : 0);
        }
      } else if (!rounds) {
        /* first screen: one clean stripe already washed, so the idea reads at a glance */
        stripeY = D.h * 0.36;
        spray(D.w * 0.04, stripeY, D.w * 0.5, stripeY, 0.7, true);
        chips = 0;
      }
      progress = clamp(1 - visibleSum() / dirt0, 0, 1);
    }
    function layout(w, h) {
      W = w; H = h;
      var dw = Math.round(Math.min(w - 24, 560)), dh = Math.round(Math.min(h - 24, dw * 1.8));
      var same = dust && dw === D.w && dh === D.h;
      D = { x: Math.round((w - dw) / 2), y: Math.round((h - dh) / 2), w: dw, h: dh };
      if (same && dprNow === G.dpr) return;
      if (same) { paintAll(); flush(true); updateWetAll(); return; }
      var old = setupGrid(true);
      paintAll();
      start(old);
      flush(true);
      updateWetAll();
    }
    function updateWetAll() { wetMax = 1; updateWet(0); }

    /* ---------- particles ---------- */
    function spawnMist(x, y) {
      var a = Math.random() * TAU, sp = (120 + Math.random() * 300) * s, r0 = Math.random() * reach * 0.5;
      padd(mist, x + Math.cos(a) * r0, y + Math.sin(a) * r0, Math.cos(a) * sp, Math.sin(a) * sp, 0.2 + Math.random() * 0.28, (1.3 + Math.random() * 2.2) * s);
    }
    function flake(x, y, fx, fy) {
      var dx = x - fx, dy = y - fy, d = Math.max(1, Math.sqrt(dx * dx + dy * dy)), sp = (90 + Math.random() * 160) * s;
      padd(flakes, x, y, dx / d * sp + (Math.random() - 0.5) * 40, dy / d * sp + (Math.random() - 0.5) * 40, 0.3 + Math.random() * 0.3, (2 + Math.random() * 2.6) * s);
    }
    function drip(x, y) {
      for (var i = 0; i < 10; i += 1) {
        var a = i / 10 * TAU + Math.random() * 0.3, sp = (40 + Math.random() * 50) * s;
        padd(mist, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.3 + Math.random() * 0.15, (1.6 + Math.random()) * s);
      }
    }
    function glint(x, y, size) { glints.push({ x: x, y: y, t0: clock, sz: size }); if (glints.length > 40) glints.shift(); }

    /* ---------- sounds ---------- */
    function pssh() { var a = A(); if (!a) return; var t = a.currentTime + 0.003; nz(a, t, 0.14, 'highpass', 2600, 0.7, 0.22); nz(a, t, 0.09, 'lowpass', 600, 0.7, 0.18); }
    function plink() { var a = A(); if (!a) return; var t = a.currentTime + 0.003; tn(a, t, 'sine', 1500, 700, 0.06, 0.07); }

    /* ---------- round end / next round ---------- */
    function finish() {
      done = true; doneAt = clock; cleared = false;
      celebrate(D.x + D.w / 2, D.y + D.h / 2, [MIST, '#FFFFFF', '#6FD3E0', '#FFE6A8']);
      for (var e = 0; e < 3; e += 1) events.push({ at: clock + e * 0.14, step: e });
    }
    function newRound() {
      seed = prepSeed;
      var a = dust0; dust0 = nD0; nD0 = a; a = thick0; thick0 = nT0; nT0 = a; a = th; th = nTh; nTh = a;
      dust.set(dust0); thick.set(thick0);
      dirt0 = Math.max(1, visibleSum()); progress = 0;
      flush(true);
      done = false; layerA = 0; fadeAt = clock; roundAt = clock; rounds += 1; prepRow = -1;
      Sfx.fwip(); haptic(false, 8);
    }
    function updateEnd() {
      if (!done && fadeAt < 0 && progress >= GOAL && clock - roundAt > 0.4) finish();
      while (events.length && clock >= events[0].at) {
        var ev = events.shift();
        if (ev.step === 1) Sfx.sparkle(0.8);
        haptic(true, 8 + ev.step * 4);
        for (var g = 0; g < 7; g += 1) {
          var u = (ev.step + Math.random()) / 3;
          glint(D.w * (0.1 + 0.8 * Math.random()), D.h * clamp(u * 0.9 + 0.05 + (Math.random() - 0.5) * 0.2, 0, 1), (10 + Math.random() * 12) * s);
        }
      }
      if (done) {
        var age = clock - doneAt;
        if (age < 0.9) layerA = 1 - easeInOut(age / 0.9);
        else if (!cleared) {
          cleared = true;
          dust.fill(0); thick.fill(0); flush(true); layerA = 1;
          prepSeed = seed + 1; prepRow = 0;
        }
        if (prepRow >= 0 && prepRow < ny) {
          var step = Math.ceil(ny / 10);
          initRows(prepSeed, nD0, nT0, nTh, prepRow, prepRow + step);
          prepRow += step;
        }
        if (age > 2.3 && prepRow >= ny) newRound();
      }
      if (fadeAt >= 0) {
        var k = (clock - fadeAt) / 1.0;
        if (k >= 1) { layerA = 1; fadeAt = -100; } else layerA = easeInOut(k);
      }
    }

    /* ---------- input ---------- */
    function down(p) {
      var x = p.x - D.x, y = p.y - D.y;
      noz[p.id] = { x: x, y: y, sx: x, sy: y };
      nn += 1;
      var got = spray(x, y, x, y, 1 / 60, false);
      for (var i = 0; i < 14; i += 1) spawnMist(x, y);
      pssh();
      haptic(true, got > 0 ? 14 : 9);
    }
    function move(p) { var n = noz[p.id]; if (!n) return; n.x = p.x - D.x; n.y = p.y - D.y; }
    function up(p) {
      var n = noz[p.id]; if (!n) return;
      delete noz[p.id]; nn = Math.max(0, nn - 1);
      drip(n.x, n.y); plink(); haptic(false, 6);
    }

    /* ---------- frame ---------- */
    function update(dt) {
      clock += dt;
      var removed = 0, id;
      for (id in noz) {
        if (!Object.prototype.hasOwnProperty.call(noz, id)) continue;
        var n = noz[id];
        var got = spray(n.sx, n.sy, n.x, n.y, dt, false);
        removed += got; n.sx = n.x; n.sy = n.y;
        var cnt = clamp(Math.round(dt * 300), 1, 8);
        for (var i = 0; i < cnt; i += 1) spawnMist(n.x, n.y);
        runoff += got;
        if (runoff > 400 && rivs.length < 14) {
          runoff = 0;
          rivs.push({ x: n.x + (Math.random() - 0.5) * reach * 1.2, y: n.y + reach * (0.5 + Math.random() * 0.4), vy: (38 + Math.random() * 34) * s, seed: Math.random() * 10, life: 2 + Math.random() * 2, age: 0, pts: [] });
        }
      }
      var rate = clamp(removed / Math.max(dt, 1 / 240) / 900, 0, 1);
      removal += (rate - removal) * (1 - Math.exp(-dt * 12));
      hiss.set(nn ? 0.45 + 0.4 * removal : 0, 0.9 + 0.3 * removal);
      body.set(nn ? 0.5 + 0.45 * removal : 0, 0.9 + 0.4 * removal);
      if (nn && removal > 0.05 && clock - lastHap > 0.08) { lastHap = clock; haptic(false, 5 + Math.round(10 * removal)); }
      if (chips > 0 && clock - lastChip > 0.055) {
        lastChip = clock; chips = 0; haptic(false, 8);
        if (clock - lastTick > 0.07) { lastTick = clock; Sfx.tick(0.7); }
      }
      updateWet(dt);
      flush(false);
      if (sumDue) { sumDue = false; progress = clamp(1 - visibleSum() / dirt0, 0, 1); }
      updateEnd();
      /* particles */
      pstep(mist, dt, 6.5); pstep(flakes, dt, 5);
      for (var r = rivs.length - 1; r >= 0; r -= 1) {
        var v = rivs[r];
        v.age += dt; v.y += v.vy * dt; v.x += Math.sin(v.y * 0.05 + v.seed) * 0.35 * v.vy * dt;
        var L = v.pts.length;
        if (!L || dist(v.pts[L - 2], v.pts[L - 1], v.x, v.y) > 5 * s) { v.pts.push(v.x, v.y); if (v.pts.length > 40) v.pts.splice(0, 2); }
        if (v.age > v.life || v.y > D.h + 30) rivs.splice(r, 1);
      }
      for (var g = glints.length - 1; g >= 0; g -= 1) if (clock - glints[g].t0 > 0.75) glints.splice(g, 1);
      /* idle twinkle on clean wood so the deck never looks frozen */
      if (clock > nextGlint) {
        nextGlint = clock + 0.9 + Math.random() * 0.8;
        if (!nn) {
          for (var tries = 0; tries < 12; tries += 1) {
            var k = (Math.random() * N) | 0;
            if (dust[k] < 0.05 && thick[k] < 0.05) { glint((k % nx) * cell, Math.floor(k / nx) * cell, (6 + Math.random() * 6) * s); break; }
          }
        }
      }
    }
    function star(c, x, y, r, w) {
      c.lineWidth = w;
      c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke();
    }
    function draw(c) {
      if (!clean) return;
      c.drawImage(clean, D.x - M, D.y - M, D.w + M * 2, D.h + M * 2);
      c.save();
      c.translate(D.x, D.y);
      rrect(c, 0, 0, D.w, D.h, RAD); c.clip();
      if (wetMax > 0.01) c.drawImage(mW.cv, 0, 0, nx, ny, -cell / 2, -cell / 2, nx * cell, ny * cell);
      if (layerA > 0.003) {
        c.globalAlpha = layerA;
        c.drawImage(dustL, 0, 0, dustL.width, dustL.height, 0, 0, D.w, D.h);
        c.drawImage(thickL, 0, 0, thickL.width, thickL.height, 0, 0, D.w, D.h);
        c.globalAlpha = 1;
      }
      /* dirty runoff and flakes */
      var i;
      if (rivs.length) {
        c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 2.2 * s;
        for (i = 0; i < rivs.length; i += 1) {
          var v = rivs[i], pts = v.pts;
          if (pts.length < 4) continue;
          c.strokeStyle = rgba(THICK, (0.42 * clamp(1 - v.age / v.life, 0, 1)).toFixed(3));
          c.beginPath(); c.moveTo(pts[0], pts[1]);
          for (var pI = 2; pI < pts.length; pI += 2) c.lineTo(pts[pI], pts[pI + 1]);
          c.stroke();
        }
      }
      for (i = 0; i < flakes.n; i += 1) {
        var fz = flakes.sz[i] * 2;
        c.globalAlpha = 0.9 * (1 - flakes.age[i] / flakes.life[i]);
        c.drawImage(dotT, flakes.x[i] - fz / 2, flakes.y[i] - fz / 2, fz, fz);
      }
      c.globalAlpha = 1;
      /* shine sweep across the deck when it is clean */
      var age = clock - doneAt;
      c.globalCompositeOperation = 'lighter';
      if (age >= 0 && age <= 1.1) {
        var u = age / 1.1, dd = D.w + D.h, x0 = -0.3 * dd + u * 1.6 * dd;
        var sg = c.createLinearGradient(x0, 0, x0 + 0.35 * dd, 0.35 * dd);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.33)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = sg; c.fillRect(0, 0, D.w, D.h);
      }
      c.strokeStyle = '#FFFFFF'; c.lineCap = 'round';
      for (i = 0; i < glints.length; i += 1) {
        var gl = glints[i], kk = Math.sin(Math.PI * clamp((clock - gl.t0) / 0.75, 0, 1)), rr = gl.sz * kk;
        if (rr < 0.5) continue;
        c.globalAlpha = 0.5 * kk; c.drawImage(glowW, gl.x - rr * 1.1, gl.y - rr * 1.1, rr * 2.2, rr * 2.2);
        c.globalAlpha = 0.95 * kk; star(c, gl.x, gl.y, rr, 2.2 * s);
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.restore();
      /* the jet: from the nozzle below the screen up to each finger, white water where it lands */
      c.save(); c.translate(D.x, D.y);
      var mc = hex(MIST);
      for (var id in noz) {
        if (!Object.prototype.hasOwnProperty.call(noz, id)) continue;
        var n = noz[id], px = n.x, py = n.y;
        var ox = px + ((W / 2 - D.x) - px) * 0.3 + W * 0.12, oy = H - D.y + 40 * s;
        jet(c, ox, oy, px, py, 10 * s, 22 * s, cs(mc, 0.08), cs(mc, 0.26));
        jet(c, ox, oy, px, py, 2.4 * s, 6 * s, cs(mc, 0.4), cs(mc, 0.8));
        var gz = reach * 3.4;
        c.globalAlpha = 0.5; c.drawImage(glowM, px - gz / 2, py - gz / 2, gz, gz);
        c.globalAlpha = 0.3;
        for (i = 0; i < 16; i += 1) {
          var a = Math.random() * TAU, dR = reach * (0.75 + Math.random() * 0.3), z = (4 + Math.random() * 6) * s;
          c.drawImage(glowM, px + Math.cos(a) * dR - z / 2, py + Math.sin(a) * dR - z / 2, z, z);
        }
        c.globalAlpha = 1;
      }
      for (i = 0; i < mist.n; i += 1) {
        var mz = mist.sz[i] * 2;
        c.globalAlpha = 0.75 * (1 - mist.age[i] / mist.life[i]);
        c.drawImage(dotM, mist.x[i] - mz / 2, mist.y[i] - mz / 2, mz, mz);
      }
      c.globalAlpha = 1;
      c.restore();
    }
    function jet(c, ox, oy, px, py, w0, w1, c0, c1) {
      var dx = px - ox, dy = py - oy, L = Math.sqrt(dx * dx + dy * dy) || 1, nxv = -dy / L, nyv = dx / L;
      var g = c.createLinearGradient(ox, oy, px, py);
      g.addColorStop(0, c0); g.addColorStop(1, c1);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(ox + nxv * w0 / 2, oy + nyv * w0 / 2); c.lineTo(px + nxv * w1 / 2, py + nyv * w1 / 2);
      c.lineTo(px - nxv * w1 / 2, py - nyv * w1 / 2); c.lineTo(ox - nxv * w0 / 2, oy - nyv * w0 / 2);
      c.closePath(); c.fill();
    }

    return {
      layout: layout,
      down: down, move: move, up: up,
      update: update,
      draw: draw,
      hint: function () {
        /* first screen: continue the washed stripe; later: a pass along the dirtiest band that is left */
        if (!env.touched() || !dust) return { x: D.x + D.w * 0.5, y: D.y + stripeY, dx: D.w * 0.42, dy: 0 };
        if (clock - hintAt > 0.6) {
          hintAt = clock; var best = -1, bv = 0;
          for (var j = 3; j < ny - 3; j += 2) {
            var sum = 0;
            for (var i = 1; i < nx - 1; i += 2) { var k = j * nx + i, a = dustA(dust[k]) / DUST_MAX, b = thick[k] > 0 ? thickA(thick[k], th[k]) : 0; sum += a > b ? a : b; }
            if (sum > bv) { bv = sum; best = j; }
          }
          hintY = best < 0 || bv < nx * 0.08 ? -1 : best * cell;
        }
        return hintY < 0 ? null : { x: D.x + D.w * 0.1, y: D.y + hintY, dx: D.w * 0.8, dy: 0 };
      },
      debug: function () { return { washed: Math.round(progress * 1000) / 1000, rounds: rounds, done: done, spraying: nn, grid: nx + 'x' + ny }; },
      destroy: function () {
        hiss.stop(); body.stop(); noz = {}; nn = 0;
        clean = dustImg = thickImg = dustL = thickL = null; dLc = tLc = null; mD = mT = mW = null;
      }
    };
  }

  GAMES['powerwash'] = {
    name: { ko: '고압 세척', ja: '高圧洗浄', en: 'Power Wash' },
    tip: { ko: '물줄기로 때를 벗겨 보세요', ja: '水をかけて汚れを落としてみて', en: 'Spray the grime away' },
    bg: 'linear-gradient(180deg,#34261B 0%,#1D150E 100%) #34261B',
    tone: 'dark',
    top: '#34261B',
    accent: '#6FD3E0',
    make: PowerWash
  };
})();
