/* game: ice : a sheet of thin translucent ice over a dark winter lake. Tap: crack! jagged cracks shoot out
 * plus a ring crack, a white flash, ice chips and a tiny shake. Tap a cracked spot again: wedge shards drop
 * into the water and leave a dark hole that slowly refreezes. Drag: a crack follows the finger. Most of the
 * sheet cracked: it shatters and a fresh sheet freezes. Ported from my_fidget/lib/toys/ice_toy.dart
 * (look 0, winter lake). Everything is kept in sheet-local px. */
(function () {
  var ICE = '#E2F0FB', GAP = '#3D5F7E', WTOP = '#14324A', WBOT = '#06131F';
  var CRACK_HOLD = 4.0, CRACK_FADE = 2.2, HOLE_HOLD = 3.0, HOLE_FREEZE = 2.4, GOAL = 0.6, MARG = 30;
  function cs(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a == null ? 1 : a) + ')'; }
  function lc(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function radial(px, rgb, stops) {
    var cv = mkCanvas(px, px), c = cv.getContext('2d'), g = c.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    for (var i = 0; i < stops.length; i += 1) g.addColorStop(stops[i][0], cs(rgb, stops[i][1]));
    c.fillStyle = g; c.fillRect(0, 0, px, px);
    return cv;
  }
  var GLOW = [[0, 1], [0.12, 0.55], [0.32, 0.19], [0.6, 0.05], [1, 0]];
  var DOT = [[0, 1], [0.45, 1], [0.7, 0.4], [1, 0]];
  var ICE_C = hex(ICE), GAP_C = hex(GAP), WBOT_C = hex(WBOT);
  var GAP_S = cs(GAP_C, 0.7);

  /* sounds the shell does not have */
  function plop(v) { var a = A(); if (!a) return; var t = a.currentTime + 0.003; tn(a, t, 'sine', 640, 210, 0.11, 0.42 * v); nz(a, t, 0.06, 'lowpass', 900, 0.8, 0.2 * v); }
  function slosh(v) { var a = A(); if (!a) return; var t = a.currentTime + 0.003; tn(a, t, 'sine', 330, 120, 0.16, 0.32 * v); nz(a, t + 0.01, 0.32, 'lowpass', 700, 0.6, 0.35 * v); }
  function shatterSnd(v) {
    var a = A(); if (!a) return;
    var t = a.currentTime + 0.003;
    nz(a, t, 0.05, 'highpass', 2200, 0.7, 0.85 * v);
    tn(a, t, 'sine', 170, 50, 0.16, 0.45 * v);
    for (var i = 0; i < 4; i += 1) nz(a, t + 0.02 + Math.random() * 0.28, 0.018, 'bandpass', 2500 + Math.random() * 4000, 3, (0.25 + Math.random() * 0.2) * v);
    for (var j = 0; j < 2; j += 1) { var f = 2600 + Math.random() * 2400; tn(a, t + 0.05 + Math.random() * 0.2, 'sine', f, f, 0.14, 0.05 * v); }
  }
  function grain() { var a = A(); if (!a) return; nz(a, a.currentTime + 0.002, 0.012, 'highpass', 3800 + Math.random() * 1500, 0.8, 0.16); }

  function Ice(env) {
    var W = 0, H = 0, P = { x: 0, y: 0, w: 0, h: 0 }, s = 1, RAD = 22, dprNow = 0, seed = 5;
    var water = null, sheet = null, glowW = null, glowI = null, dotW = null, wGrad = null, frame = null;
    var cracks = [], impacts = [], holes = [], shards = [], ripples = [], chips = [], sparks = [], later = [];
    var touches = {}, drags = {};
    var cols = 4, rows = 4, cells = null, marked = 0;
    var shakeT0 = -10, shakeAmp = 0, freezeT0 = -10, finaleT0 = -10, refrozen = true, hintAt = -9, hintPt = null;
    var clock = 0, speed = 0, lastGrain = -1, rounds = 0, hits = 0, breaks = 0, nextTw = 1.5, seeded = false, dePre = false;
    var crackLoop = makeLoop({ type: 'highpass', freq: 3000, q: 0.7, gain: 0.2, smooth: 0.03 });

    function crackSpeed() { return 2600 * s; }
    function fadeOf(since) { return 1 - clamp((clock - since - CRACK_HOLD) / CRACK_FADE, 0, 1); }
    function holeScale(h) { var k = clamp((clock - h.born - HOLE_HOLD) / HOLE_FREEZE, 0, 1); return 1 - k * k * (3 - 2 * k); }

    /* ---------- pictures ---------- */
    function paintSheet() {
      var d = G.dpr, rnd = srand(seed * 5 + 1), c, i, j;
      wGrad = null;
      water = mkCanvas(P.w * d, P.h * d); c = water.getContext('2d'); c.scale(d, d);
      var g = c.createLinearGradient(0, 0, 0, P.h); g.addColorStop(0, WTOP); g.addColorStop(1, WBOT);
      c.fillStyle = g; c.fillRect(0, 0, P.w, P.h);
      sheet = mkCanvas(P.w * d, P.h * d); c = sheet.getContext('2d'); c.scale(d, d);
      c.drawImage(water, 0, 0, P.w, P.h);
      c.fillStyle = cs(ICE_C, 0.84); c.fillRect(0, 0, P.w, P.h);
      var gWhite = radial(96, WHITE, GLOW), gMid = radial(96, lc(ICE_C, GAP_C, 0.5), GLOW);
      for (i = 0; i < 22; i += 1) {
        var z = (90 + rnd() * 220) * s, white = rnd() < 0.6;
        c.globalAlpha = 0.16 + rnd() * 0.14;
        c.drawImage(white ? gWhite : gMid, rnd() * P.w - z / 2, rnd() * P.h - z / 2, z, z);
      }
      c.globalAlpha = 1;
      /* trapped air bubbles */
      c.lineWidth = 0.7; c.strokeStyle = cs(GAP_C, 0.35); c.fillStyle = 'rgba(255,255,255,0.55)';
      for (i = 0; i < 9; i += 1) {
        var px = rnd() * P.w, py = rnd() * P.h, a = rnd() * TAU;
        for (j = 0; j < 10; j += 1) {
          var st = (6 + rnd() * 8) * s; px += Math.cos(a) * st; py += Math.sin(a) * st;
          var rr = (1 + rnd() * 2.6) * s;
          c.beginPath(); c.arc(px, py, rr, 0, TAU); c.fill(); c.stroke();
        }
      }
      /* faint old scratches */
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 0.8;
      c.beginPath();
      for (i = 0; i < 26; i += 1) {
        var sx = rnd() * P.w, sy = rnd() * P.h, sa = rnd() * Math.PI, sl = (30 + rnd() * 120) * s;
        c.moveTo(sx, sy); c.lineTo(sx + Math.cos(sa) * sl, sy + Math.sin(sa) * sl);
      }
      c.stroke();
      var sh = c.createLinearGradient(0, 0, P.w, P.h);
      sh.addColorStop(0.2, 'rgba(255,255,255,0)'); sh.addColorStop(0.45, 'rgba(255,255,255,0.1)'); sh.addColorStop(0.7, 'rgba(255,255,255,0)');
      c.fillStyle = sh; c.fillRect(0, 0, P.w, P.h);
    }
    function paintFrame() {
      var d = G.dpr;
      frame = mkCanvas((P.w + MARG * 2) * d, (P.h + MARG * 2) * d);
      var c = frame.getContext('2d'); c.scale(d, d); c.translate(MARG, MARG);
      c.shadowColor = 'rgba(40,80,120,0.3)'; c.shadowBlur = 22 * d; c.shadowOffsetY = 8 * d;
      rrect(c, 0, 0, P.w, P.h, RAD); c.fillStyle = WTOP; c.fill();
    }
    function sprites() {
      glowW = radial(64, WHITE, GLOW); glowI = radial(64, ICE_C, GLOW); dotW = radial(24, WHITE, DOT);
      paintSheet(); paintFrame();
      dprNow = G.dpr;
    }

    /* ---------- cracks ---------- */
    function mkCrack(pts, born, weight) {
      var cum = [0], len = 0;
      for (var i = 2; i < pts.length; i += 2) { len += dist(pts[i - 2], pts[i - 1], pts[i], pts[i + 1]); cum.push(len); }
      return { pts: pts, cum: cum, len: len, born: born, weight: weight, touched: -1e9, pre: false };
    }
    function addPt(cr, x, y) {
      var n = cr.pts.length;
      cr.len += dist(cr.pts[n - 2], cr.pts[n - 1], x, y);
      cr.pts.push(x, y); cr.cum.push(cr.len);
    }
    function grow(x, y, a, len, delay, depth, out) {
      var pts = [x, y], ang = a, done = 0;
      while (done < len) {
        var st = (8 + Math.random() * 7) * s;
        ang += (Math.random() - 0.5) * 0.5;
        x += Math.cos(ang) * st; y += Math.sin(ang) * st;
        pts.push(x, y); done += st;
        if (depth < 2 && Math.random() < 0.09) {
          grow(x, y, ang + (Math.random() < 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.6), (len - done) * (0.3 + 0.4 * Math.random()), delay + done / crackSpeed(), depth + 1, out);
        }
        if (x < -40 || y < -40 || x > P.w + 40 || y > P.h + 40) break;
      }
      var cr = mkCrack(pts, clock + delay, depth === 0 ? 1 : 0.75);
      cracks.push(cr); if (out) out.push(cr);
    }
    function grown(cr) { var age = clock - cr.born; return age <= 0 ? 0 : clamp(age * crackSpeed() / Math.max(1, cr.len), 0, 1); }
    function crackFade(cr) { return cr.pre && !env.touched() ? 1 : fadeOf(Math.max(cr.born, cr.touched)); }

    /* ---------- holes ---------- */
    function inHole(x, y) {
      for (var hI = 0; hI < holes.length; hI += 1) {
        var h = holes[hI], sc = holeScale(h);
        if (sc <= 0.02) continue;
        var r = h.rim, inside = false, n = r.length;
        for (var i = 0, j = n - 2; i < n; j = i, i += 2) {
          var xi = h.cx + (r[i] - h.cx) * sc, yi = h.cy + (r[i + 1] - h.cy) * sc, xj = h.cx + (r[j] - h.cx) * sc, yj = h.cy + (r[j + 1] - h.cy) * sc;
          if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
        }
        if (inside) return true;
      }
      return false;
    }
    function holePath(c, h) {
      var sc = holeScale(h), r = h.rim;
      c.moveTo(h.cx + (r[0] - h.cx) * sc, h.cy + (r[1] - h.cy) * sc);
      for (var i = 2; i < r.length; i += 2) c.lineTo(h.cx + (r[i] - h.cx) * sc, h.cy + (r[i + 1] - h.cy) * sc);
      c.closePath();
    }

    /* ---------- goal cells ---------- */
    function setupCells(keep) {
      var oc = cols, or = rows, old = cells, sh = Math.min(P.w, P.h) / 5;
      cols = Math.max(4, Math.round(P.w / sh)); rows = Math.max(4, Math.round(P.h / sh));
      cells = new Uint8Array(cols * rows); marked = 0;
      if (keep && old) {
        for (var y = 0; y < rows; y += 1) for (var x = 0; x < cols; x += 1) {
          if (old[Math.floor(y * or / rows) * oc + Math.floor(x * oc / cols)]) { cells[y * cols + x] = 1; marked += 1; }
        }
      }
    }
    function share() { return cells ? marked / cells.length : 0; }
    function mark(x, y, r) {
      if (!cells || clock - finaleT0 < 1.6) return;
      var cw = P.w / cols, ch = P.h / rows, lim = r + Math.min(cw, ch) * 0.35;
      for (var yy = 0; yy < rows; yy += 1) for (var xx = 0; xx < cols; xx += 1) {
        var k = yy * cols + xx;
        if (!cells[k] && dist((xx + 0.5) * cw, (yy + 0.5) * ch, x, y) < lim) { cells[k] = 1; marked += 1; }
      }
      if (share() >= GOAL) finale();
    }

    /* ---------- effects ---------- */
    function burstChips(x, y, n, power) {
      for (var i = 0; i < n; i += 1) {
        var a = Math.random() * TAU, sp = (160 + Math.random() * 360) * s * power;
        chips.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: clock, life: 0.3 + Math.random() * 0.3, sz: (1.6 + Math.random() * 2.6) * s });
      }
      if (chips.length > 260) chips.splice(0, chips.length - 260);
    }
    function shake(a) { shakeT0 = clock; shakeAmp = a * s; }
    function at(dt, fn) { later.push({ t: clock + dt, fn: fn }); }
    function buzz(ms) { return function () { haptic(true, ms); }; }

    /* ---------- hits ---------- */
    function hit(x, y, power, quiet) {
      if (inHole(x, y)) {
        ripples.push({ x: x, y: y, t: clock });
        plop(0.9); haptic(true, 8);
        return;
      }
      for (var i = 0; i < impacts.length; i += 1) {
        var im = impacts[i];
        if (!im.broken && clock >= im.born && impFade(im) > 0.3 && dist(im.x, im.y, x, y) < im.ring * 1.3) { breakOut(im); return; }
      }
      var n = 6 + Math.floor(Math.random() * 4), a0 = Math.random() * TAU, angles = [], out = [];
      for (i = 0; i < n; i += 1) angles.push(a0 + i * TAU / n + (Math.random() - 0.5) * 0.5);
      for (i = 0; i < n; i += 1) grow(x, y, angles[i], (70 + Math.random() * 160) * s * power, 0, 0, out);
      var ring = (40 + Math.random() * 22) * s * (0.7 + 0.3 * power), pts = [];
      for (i = 0; i <= 28; i += 1) {
        var a = a0 + i * TAU / 28, rr = ring * (0.9 + 0.2 * Math.random());
        pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      var rc = mkCrack(pts, clock + 0.02, 0.8); cracks.push(rc); out.push(rc);
      var imp = { x: x, y: y, angles: angles, ring: ring, born: clock, fadeFrom: -1e9, broken: false, pre: !!quiet, quiet: !!quiet };
      impacts.push(imp);
      if (impacts.length > 40) impacts.shift();
      hits += 1;
      mark(x, y, ring * 1.25);
      if (quiet) {
        for (i = 0; i < out.length; i += 1) { out[i].born = clock - 1; out[i].pre = true; }
        imp.born = clock - 1;
        return;
      }
      Sfx.crack(0.65 + 0.35 * power); haptic(true, 16);
      burstChips(x, y, 12 + Math.round(8 * power), 1);
      shake(3.2 * power);
      at(0.05, buzz(8)); at(0.1, buzz(7)); at(0.17, buzz(5));
    }
    function impFade(im) { return im.pre && !env.touched() ? 1 : fadeOf(Math.max(im.born, im.fadeFrom)); }
    function breakOut(im) {
      im.broken = true; im.born = clock; breaks += 1;
      var ang = im.angles.slice().sort(function (p, q) { return p - q; }), n = ang.length, rim = [];
      for (var i = 0; i < n; i += 1) {
        var a0 = ang[i], a1 = ang[(i + 1) % n];
        if (a1 <= a0) a1 += TAU;
        var poly = [im.x, im.y];
        for (var j = 0; j <= 4; j += 1) {
          var a = a0 + (a1 - a0) * j / 4, qx, qy;
          if (j === 0 && rim.length) { qx = rim[rim.length - 2]; qy = rim[rim.length - 1]; }
          else {
            var rr = im.ring * (0.95 + 0.15 * Math.random());
            qx = im.x + Math.cos(a) * rr; qy = im.y + Math.sin(a) * rr;
          }
          poly.push(qx, qy);
          if (j > 0 || !rim.length) rim.push(qx, qy);
        }
        var cx = 0, cy = 0, m = poly.length / 2;
        for (var k = 0; k < poly.length; k += 2) { cx += poly[k]; cy += poly[k + 1]; }
        cx /= m; cy /= m;
        for (k = 0; k < poly.length; k += 2) { poly[k] -= cx; poly[k + 1] -= cy; }
        shards.push({ poly: poly, cx: cx, cy: cy, born: clock + i * 0.035, drift: Math.random() - 0.5 });
      }
      holes.push({ rim: rim, cx: im.x, cy: im.y, born: clock });
      if (holes.length > 12) holes.shift();
      mark(im.x, im.y, im.ring * 1.8);
      ripples.push({ x: im.x, y: im.y, t: clock + 0.12 });
      shatterSnd(0.9); haptic(true, 22);
      burstChips(im.x, im.y, 26, 1.2);
      shake(4.5);
      at(0.12, function () { slosh(0.5); });
      for (i = 1; i <= 3; i += 1) at(0.03 + i * 0.05, buzz(7));
    }
    function finale() {
      finaleT0 = clock; refrozen = false; rounds += 1;
      celebrate(P.x + P.w / 2, P.y + P.h / 2, ['#FFFFFF', ICE, '#9FDFF0', '#CFEAF8']);
      Sfx.crack(1);
      at(0.03, function () { shatterSnd(1); });
      at(0.14, function () { slosh(0.6); });
      shake(7);
      /* the whole sheet splits: long cracks from a few points, sparks and chips everywhere */
      for (var p = 0; p < 5; p += 1) {
        var fx = P.w * (0.15 + 0.7 * Math.random()), fy = P.h * (0.12 + 0.76 * p / 4);
        for (var a = 0; a < 5; a += 1) grow(fx, fy, Math.random() * TAU, (120 + Math.random() * 200) * s, p * 0.03, 1, null);
      }
      for (var i = 0; i < 9; i += 1) {
        var x = P.w * (0.15 + 0.7 * Math.random()), y = P.h * (0.12 + 0.76 * (i / 8)), t0 = clock + i * 0.05;
        sparks.push({ x: x, y: y, t0: t0, r: (22 + Math.random() * 18) * s });
        burstChips(x, y, 12, 1.1);
        at(i * 0.05, buzz(10));
      }
      for (i = 0; i < 28; i += 1) sparks.push({ x: P.w * Math.random(), y: P.h * Math.random(), t0: clock + 0.1 + Math.random() * 0.7, r: (6 + Math.random() * 10) * s });
    }
    function refreeze() {
      refrozen = true;
      cracks = []; impacts = []; holes = []; shards = []; ripples = []; drags = {};
      setupCells(false);
      seed += 1; paintSheet();
      freezeT0 = clock;
      Sfx.fwip(); haptic(false, 8);
    }

    /* ---------- layout ---------- */
    function layout(w, h) {
      W = w; H = h;
      var pw = Math.round(Math.min(w - 20, 620)), ph = Math.round(Math.min(h - 20, pw * 1.75));
      var ox = P.w, oy = P.h, same = pw === P.w && ph === P.h;
      P = { x: Math.round((w - pw) / 2), y: Math.round((h - ph) / 2), w: pw, h: ph };
      s = clamp(Math.min(pw, ph) / 390, 0.8, 2);
      if (same && dprNow === G.dpr) return;
      if (!same && ox > 0) {
        /* keep the play: scale everything into the new sheet */
        var kx = pw / ox, ky = ph / oy, kr = Math.min(kx, ky), i, j;
        for (i = 0; i < cracks.length; i += 1) {
          var cr = cracks[i], pts = cr.pts;
          for (j = 0; j < pts.length; j += 2) { pts[j] *= kx; pts[j + 1] *= ky; }
          var re = mkCrack(pts, cr.born, cr.weight); cr.cum = re.cum; cr.len = re.len;
        }
        for (i = 0; i < impacts.length; i += 1) { impacts[i].x *= kx; impacts[i].y *= ky; impacts[i].ring *= kr; }
        for (i = 0; i < holes.length; i += 1) {
          var hh = holes[i]; hh.cx *= kx; hh.cy *= ky;
          for (j = 0; j < hh.rim.length; j += 2) { hh.rim[j] *= kx; hh.rim[j + 1] *= ky; }
        }
        shards = []; chips = []; ripples = [];
        setupCells(true);
      } else if (!cells) setupCells(false);
      sprites();
      if (!seeded) {
        seeded = true;
        /* first screen: one crack star already there, so the idea reads at a glance */
        hit(P.w * 0.3, P.h * 0.27, 0.9, true);
      }
    }

    /* ---------- input ---------- */
    function down(p) {
      var x = p.x - P.x, y = p.y - P.y, i;
      if (!dePre) {
        /* the starter crack heals at the normal pace from the first touch on */
        dePre = true;
        for (i = 0; i < cracks.length; i += 1) if (cracks[i].pre) { cracks[i].pre = false; cracks[i].touched = clock; }
        for (i = 0; i < impacts.length; i += 1) if (impacts[i].pre) { impacts[i].pre = false; impacts[i].fadeFrom = clock; }
      }
      touches[p.id] = { sx: x, sy: y, x: x, y: y, lx: x, ly: y, lt: p.t, travel: 0 };
      if (!refrozen) { haptic(false, 6); return; }
      hit(x, y, 1, false);
    }
    function move(p) {
      var t = touches[p.id]; if (!t) return;
      var x = p.x - P.x, y = p.y - P.y;
      t.travel += dist(t.x, t.y, x, y);
      var v = dist(t.lx, t.ly, x, y) / Math.max(8, p.t - t.lt) * 1000;
      t.x = x; t.y = y; t.lx = x; t.ly = y; t.lt = p.t;
      if (t.travel < 16 * s || !refrozen || inHole(x, y)) return;
      var cr = drags[p.id];
      if (!cr) { cr = mkCrack([t.sx, t.sy], clock - 1, 0.9); drags[p.id] = cr; cracks.push(cr); }
      cr.touched = clock;
      var n = cr.pts.length, lx = cr.pts[n - 2], ly = cr.pts[n - 1], d = dist(lx, ly, x, y);
      if (d < 11 * s) return;
      var ux = (x - lx) / d, uy = (y - ly) / d, side = (Math.random() - 0.5) * 6 * s;
      addPt(cr, x - uy * side, y + ux * side);
      speed = Math.max(speed, clamp(v / 1400, 0, 1));
      haptic(false, 6);
      if (clock - lastGrain > 0.035) { lastGrain = clock; grain(); }
      if (Math.random() < 0.18) grow(x, y, Math.atan2(uy, ux) + (Math.random() < 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.7), (18 + Math.random() * 40) * s, 0, 2, null);
      burstChips(x, y, 1, 0.5);
      mark(x, y, 14 * s);
    }
    function up(p) { delete touches[p.id]; delete drags[p.id]; }

    /* ---------- frame ---------- */
    function update(dt) {
      clock += dt;
      var i;
      for (i = later.length - 1; i >= 0; i -= 1) if (clock >= later[i].t) { var f = later[i].fn; later.splice(i, 1); f(); }
      var dk = Math.exp(-dt * 7);
      for (i = chips.length - 1; i >= 0; i -= 1) {
        var ch = chips[i];
        if (clock - ch.born > ch.life) { chips.splice(i, 1); continue; }
        ch.vx *= dk; ch.vy *= dk; ch.x += ch.vx * dt; ch.y += ch.vy * dt;
      }
      for (i = shards.length - 1; i >= 0; i -= 1) if (clock - shards[i].born > 1.3) shards.splice(i, 1);
      for (i = sparks.length - 1; i >= 0; i -= 1) if (clock - sparks[i].t0 > 0.9) sparks.splice(i, 1);
      for (i = ripples.length - 1; i >= 0; i -= 1) if (clock - ripples[i].t > 1.4) ripples.splice(i, 1);
      if (!refrozen && clock - finaleT0 > 0.7) refreeze();
      /* healed cracks go away (the one being drawn stays); cap the total */
      var live = [];
      for (var id in drags) if (Object.prototype.hasOwnProperty.call(drags, id)) live.push(drags[id]);
      var pts = 0;
      for (i = cracks.length - 1; i >= 0; i -= 1) {
        var cr = cracks[i];
        if (live.indexOf(cr) < 0 && crackFade(cr) <= 0) { cracks.splice(i, 1); continue; }
        pts += cr.pts.length;
      }
      while (pts > 4800 && cracks.length > 1) {
        var k = 0;
        while (k < cracks.length && live.indexOf(cracks[k]) >= 0) k += 1;
        if (k >= cracks.length) break;
        pts -= cracks[k].pts.length; cracks.splice(k, 1);
      }
      for (i = impacts.length - 1; i >= 0; i -= 1) {
        var im = impacts[i];
        if ((!im.broken && impFade(im) <= 0) || (im.broken && clock - im.born > 2)) impacts.splice(i, 1);
      }
      for (i = holes.length - 1; i >= 0; i -= 1) if (holeScale(holes[i]) <= 0.02) holes.splice(i, 1);
      var dragging = live.length > 0 && speed > 0.03;
      crackLoop.set(dragging ? 0.15 + 0.6 * speed : 0, 1 + 0.4 * speed);
      speed *= Math.exp(-dt * 8);
      /* idle twinkle on the ice */
      if (clock > nextTw) {
        nextTw = clock + 0.8 + Math.random() * 0.9;
        if (env.idle() > 1.2 && refrozen) sparks.push({ x: P.w * (0.1 + 0.8 * Math.random()), y: P.h * (0.08 + 0.84 * Math.random()), t0: clock, r: (7 + Math.random() * 7) * s });
      }
    }

    function crackPath(c, cr, g, ox) {
      var p = cr.pts, n = p.length / 2;
      if (g >= 1) {
        c.moveTo(p[0] + ox, p[1] + ox);
        for (var i = 1; i < n; i += 1) c.lineTo(p[i * 2] + ox, p[i * 2 + 1] + ox);
        return;
      }
      var want = cr.len * g;
      c.moveTo(p[0] + ox, p[1] + ox);
      for (var j = 1; j < n; j += 1) {
        if (cr.cum[j] >= want) {
          var seg = cr.cum[j] - cr.cum[j - 1], u = seg > 0 ? (want - cr.cum[j - 1]) / seg : 1;
          c.lineTo(p[j * 2 - 2] + (p[j * 2] - p[j * 2 - 2]) * u + ox, p[j * 2 - 1] + (p[j * 2 + 1] - p[j * 2 - 1]) * u + ox);
          return;
        }
        c.lineTo(p[j * 2] + ox, p[j * 2 + 1] + ox);
      }
    }
    function drawCracks(c, ia) {
      var pass, i, cr, g, f, wts = [1, 0.9, 0.8, 0.75], b;
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (pass = 0; pass < 2; pass += 1) {
        var ox = pass ? -0.8 * s : 0, base = pass ? 1.25 * s : 2.4 * s;
        c.strokeStyle = pass ? 'rgba(255,255,255,0.9)' : GAP_S;
        /* settled cracks: one path per weight */
        for (b = 0; b < wts.length; b += 1) {
          var any = false;
          c.beginPath();
          for (i = 0; i < cracks.length; i += 1) {
            cr = cracks[i];
            if (cr.weight !== wts[b] || grown(cr) < 1 || crackFade(cr) < 1) continue;
            crackPath(c, cr, 1, ox); any = true;
          }
          if (any) { c.globalAlpha = ia; c.lineWidth = base * wts[b]; c.stroke(); }
        }
        /* growing or healing cracks: one by one */
        for (i = 0; i < cracks.length; i += 1) {
          cr = cracks[i]; g = grown(cr); f = crackFade(cr);
          if (g <= 0 || f <= 0 || (g >= 1 && f >= 1)) continue;
          c.globalAlpha = ia * f; c.lineWidth = base * cr.weight;
          c.beginPath(); crackPath(c, cr, g, ox); c.stroke();
        }
      }
      c.globalAlpha = 1;
    }
    function star(c, x, y, r) {
      c.beginPath(); c.moveTo(x, y - r);
      c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
      c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r);
      c.closePath(); c.fill();
    }
    function draw(c) {
      if (!sheet) return;
      var i, k, sx = 0, sy = 0, sk = 1 - (clock - shakeT0) / 0.12;
      if (sk > 0 && shakeAmp > 0) { var a = shakeAmp * sk * sk; sx = Math.sin(clock * 97) * a; sy = Math.cos(clock * 131) * a; }
      c.drawImage(frame, P.x - MARG, P.y - MARG, P.w + MARG * 2, P.h + MARG * 2);
      c.save();
      c.translate(P.x + sx, P.y + sy);
      rrect(c, 0, 0, P.w, P.h, RAD); c.save(); c.clip();
      if (!wGrad) { wGrad = c.createLinearGradient(0, 0, 0, P.h); wGrad.addColorStop(0, WTOP); wGrad.addColorStop(1, WBOT); }
      var freeze = clamp((clock - freezeT0) / 0.7, 0, 1);
      var gone = refrozen ? 1 : 1 - 0.85 * clamp((clock - finaleT0) / 0.55, 0, 1);
      var ia = (freeze < 1 ? 0.3 + 0.7 * freeze : 1) * gone;
      if (ia < 0.999) c.drawImage(water, 0, 0, P.w, P.h);
      if (ia > 0.001) { c.globalAlpha = ia; c.drawImage(sheet, 0, 0, P.w, P.h); c.globalAlpha = 1; }
      drawCracks(c, ia);
      /* crushed white spots where it was hit */
      for (i = 0; i < impacts.length; i += 1) {
        var im = impacts[i];
        if (im.broken) continue;
        k = clamp((clock - im.born) / 0.06, 0, 1) * impFade(im) * ia;
        if (k <= 0) continue;
        var gz = (10 + 8 * k) * s * 3.2;
        c.globalAlpha = 0.5 * k; c.drawImage(glowW, im.x - gz / 2, im.y - gz / 2, gz, gz);
        c.globalAlpha = 0.9 * k; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(im.x, im.y, 3.4 * s * k, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
      /* holes: white rim on the ice side, then dark water, then what happens in the water */
      if (holes.length) {
        var freezing = 0;
        for (i = 0; i < holes.length; i += 1) freezing = Math.max(freezing, 1 - holeScale(holes[i]));
        c.beginPath(); for (i = 0; i < holes.length; i += 1) holePath(c, holes[i]);
        c.lineJoin = 'round'; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = (2.4 + 5 * freezing) * s * 2; c.stroke();
        c.fillStyle = wGrad; c.fill();
        c.save(); c.clip();
        for (i = 0; i < 9; i += 1) {
          var gx = P.w * ((i * 0.37 + clock * 0.02) % 1), gy = P.h * ((i * 0.61 + Math.sin(clock * 0.3 + i) * 0.05 + 1) % 1), gs = 160 * s;
          c.globalAlpha = 0.1; c.drawImage(glowI, gx - gs / 2, gy - gs / 2, gs, gs);
        }
        c.globalAlpha = 1;
        c.strokeStyle = cs(ICE_C, 0.45); c.lineWidth = 2 * s;
        for (i = 0; i < ripples.length; i += 1) {
          var rp = ripples[i], age = clock - rp.t;
          for (var rk = 0; rk < 2; rk += 1) {
            var ra = age - rk * 0.18; if (ra <= 0) continue;
            c.globalAlpha = clamp(1 - ra / 1.2, 0, 1);
            c.beginPath(); c.arc(rp.x, rp.y, (6 + 70 * ra) * s, 0, TAU); c.stroke();
          }
        }
        c.globalAlpha = 1;
        for (i = 0; i < shards.length; i += 1) {
          var sd = shards[i]; if (clock < sd.born) continue;
          k = clamp((clock - sd.born) / 1.3, 0, 1);
          c.save();
          c.translate(sd.cx + sd.drift * 20 * s * k, sd.cy + 14 * s * k); c.rotate(sd.drift * 0.6 * k); c.scale(1 - 0.45 * k, 1 - 0.6 * k);
          c.fillStyle = cs(lc(ICE_C, WBOT_C, 0.25 + 0.6 * k), 0.9 * (1 - k));
          c.beginPath(); c.moveTo(sd.poly[0], sd.poly[1]); for (var pI = 2; pI < sd.poly.length; pI += 2) c.lineTo(sd.poly[pI], sd.poly[pI + 1]); c.closePath(); c.fill();
          c.restore();
        }
        c.restore();
      }
      /* shards flash white for a moment as they break off */
      for (i = 0; i < shards.length; i += 1) {
        var sf = shards[i], kf = (clock - sf.born) / 0.25;
        if (kf < 0 || kf > 1) continue;
        c.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - kf)).toFixed(3) + ')';
        c.beginPath(); c.moveTo(sf.cx + sf.poly[0], sf.cy + sf.poly[1]);
        for (var pJ = 2; pJ < sf.poly.length; pJ += 2) c.lineTo(sf.cx + sf.poly[pJ], sf.cy + sf.poly[pJ + 1]);
        c.closePath(); c.fill();
      }
      /* finale: white flash */
      var fa = clock - finaleT0;
      if (fa >= 0 && fa < 0.35) { c.fillStyle = 'rgba(255,255,255,' + (0.35 * (1 - fa / 0.35)).toFixed(3) + ')'; c.fillRect(0, 0, P.w, P.h); }
      c.restore();
      /* rim of the sheet */
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 3; rrect(c, -0.5, -0.5, P.w + 1, P.h + 1, RAD); c.stroke();
      /* impact flash: ring + glow */
      for (i = 0; i < impacts.length; i += 1) {
        var ip = impacts[i], ag = clock - ip.born;
        if (ag < 0 || ag > 0.2 || ip.quiet) continue;
        k = ag / 0.2;
        c.globalAlpha = 0.8 * (1 - k); c.strokeStyle = '#FFFFFF'; c.lineWidth = (4 - 3 * k) * s;
        c.beginPath(); c.arc(ip.x, ip.y, (8 + 70 * k) * s, 0, TAU); c.stroke();
        var fz = (26 - 10 * k) * s * 3;
        c.globalAlpha = 0.6 * (1 - k); c.drawImage(glowW, ip.x - fz / 2, ip.y - fz / 2, fz, fz);
      }
      /* sparkles (finale and idle twinkle) */
      c.fillStyle = '#FFFFFF';
      for (i = 0; i < sparks.length; i += 1) {
        var sp = sparks[i], sa = clock - sp.t0; if (sa < 0) continue;
        var sk2 = clamp(sa / 0.9, 0, 1), r = sp.r * Math.sin(Math.PI * sk2);
        if (r < 0.5) continue;
        c.globalAlpha = 0.95 * (1 - sk2); star(c, sp.x, sp.y, r);
      }
      /* flying ice chips */
      for (i = 0; i < chips.length; i += 1) {
        var cp = chips[i], ck = clamp((clock - cp.born) / cp.life, 0, 1), cz = cp.sz * 2.4;
        c.globalAlpha = 0.95 * (1 - ck * ck);
        c.drawImage(dotW, cp.x - cz / 2, cp.y - cz / 2, cz, cz);
      }
      c.globalAlpha = 1;
      c.restore();
    }

    return {
      layout: layout,
      down: down, move: move, up: up,
      update: update,
      draw: draw,
      hint: function () {
        /* a spot of fresh ice: the usual one unless it is a hole or already cracked, then the nearest clear spot */
        if (clock - hintAt > 0.5) {
          hintAt = clock; var bx = P.w * 0.62, by = P.h * 0.56, best = null, bd = 1e9;
          for (var gy = -1; gy < 6; gy += 1) for (var gx = 0; gx < 5; gx += 1) {
            if (gy < 0 && gx > 0) continue;
            var x = gy < 0 ? bx : P.w * (0.14 + 0.18 * gx), y = gy < 0 ? by : P.h * (0.12 + 0.152 * gy), ok = !inHole(x, y);
            for (var i = 0; ok && i < impacts.length; i += 1) { var im = impacts[i]; if (!im.broken && dist(im.x, im.y, x, y) < im.ring * 1.4) ok = false; }
            var d = (x - bx) * (x - bx) + (y - by) * (y - by);
            if (ok && d < bd) { bd = d; best = [x, y]; }
          }
          hintPt = best || [bx, by];
        }
        return { x: P.x + hintPt[0], y: P.y + hintPt[1] };
      },
      debug: function () { return { cracked: Math.round(share() * 100) / 100, hits: hits, breaks: breaks, holes: holes.length, cracks: cracks.length, rounds: rounds }; },
      destroy: function () { crackLoop.stop(); sheet = water = frame = null; cracks = []; chips = []; later = []; }
    };
  }

  GAMES['ice'] = {
    name: { ko: '살얼음 깨기', ja: '薄氷わり', en: 'Thin Ice' },
    tip: { ko: '얼음을 톡 쳐서 깨 보세요', ja: '氷をタップして割ってみて', en: 'Tap the ice to crack it' },
    bg: 'linear-gradient(180deg,#EEF6FC 0%,#D5E6F2 100%) #EEF6FC',
    tone: 'light',
    top: '#EEF6FC',
    accent: '#9FDFF0',
    make: Ice
  };
})();
