/* game: popit : heart-shaped rainbow silicone Pop It (app PopItToy, heart variant).
 * Tap or rub to push the glossy domes in. All pressed: rainbow sparkle, the board flips over with a squash,
 * the domes pop back up and the colour bands rotate one step. Then it is ready again by itself. */
(function () {
  var BANDS = ['#FF6B6B', '#FFA24C', '#FFD54A', '#66D18A', '#55A8F2', '#A67CF2'];
  var FLIP_DELAY = 0.35, FLIP_TIME = 0.6;

  /* heart outline (same curve as the app), unit polygon centred on its bounds */
  var HEART = (function () {
    var pts = [], i, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (i = 0; i < 180; i += 1) {
      var t = TAU * i / 180, x = 16 * Math.pow(Math.sin(t), 3);
      var y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push(x, y);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    var sc = 1 / Math.max(maxX - minX, maxY - minY), mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
    for (i = 0; i < pts.length; i += 2) { pts[i] = (pts[i] - mx) * sc; pts[i + 1] = (pts[i + 1] - my) * sc; }
    return pts;
  })();

  function inPoly(P, x, y) {
    var inside = false, n = P.length / 2;
    for (var i = 0, j = n - 1; i < n; j = i, i += 1) {
      var xi = P[i * 2], yi = P[i * 2 + 1], xj = P[j * 2], yj = P[j * 2 + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function polyPath(c, P) {
    c.beginPath(); c.moveTo(P[0], P[1]);
    for (var i = 2; i < P.length; i += 2) c.lineTo(P[i], P[i + 1]);
    c.closePath();
  }
  function rgb(h, k) { var a = hex(h); return [Math.round(a[0] * k), Math.round(a[1] * k), Math.round(a[2] * k)]; }
  function css(a, al) { return 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + (al == null ? 1 : al) + ')'; }

  /* a raised (k=0) or pushed-in (k=1) bubble of colour col, radius r, centred at 0,0 (app sprite x band colour) */
  function paintBubble(c, r, col, pressed) {
    var g;
    if (!pressed) {
      g = c.createRadialGradient(0, r * 0.1, r * 0.6, 0, r * 0.1, r * 1.14);
      g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, r * 0.1, r * 1.14, 0, TAU); c.fill();
      g = c.createRadialGradient(-r * 0.3, -r * 0.35, 0, -r * 0.3, -r * 0.35, r * 1.5);
      g.addColorStop(0, css(rgb(col, 1))); g.addColorStop(0.35, css(rgb(col, 0.93)));
      g.addColorStop(0.8, css(rgb(col, 0.79))); g.addColorStop(1, css(rgb(col, 0.65)));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      /* soft gloss oval + rim light */
      c.save(); c.translate(-r * 0.34, -r * 0.4); c.rotate(-0.6); c.scale(1, 0.47);
      g = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.38);
      g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.6, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 0.38, 0, TAU); c.fill();
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = r * 0.09; c.lineCap = 'round';
      c.beginPath(); c.arc(0, 0, r * 0.8, 0.3, 1.7); c.stroke();
      return;
    }
    var hr = r * 0.97;
    g = c.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, css(rgb(col, 0.6))); g.addColorStop(0.55, css(rgb(col, 0.83))); g.addColorStop(1, css(rgb(col, 0.94)));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, hr, 0, TAU); c.fill();
    /* inner shadow under the upper-left wall */
    c.save(); c.beginPath(); c.arc(0, 0, hr, 0, TAU); c.clip();
    g = c.createRadialGradient(r * 0.18, r * 0.22, r * 0.62, r * 0.18, r * 0.22, r * 1.25);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.26)'); g.addColorStop(1, 'rgba(0,0,0,0.34)');
    c.fillStyle = g; c.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
    c.restore();
    c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = r * 0.05;
    c.beginPath(); c.arc(0, 0, hr, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.42)'; c.lineWidth = r * 0.1; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, r * 0.78, 0.2, 1.5); c.stroke();
  }

  function PopIt(env) {
    var W = 0, H = 0, cx = 0, cy = 0, b = 300, s = 37, br = 15, P = [], clip = null, bounds = null;
    var cells = [], stripes = [], board = null, boardBox = null, raised = [], pushed = [], spx = 0;
    var clock = 0, pressed = 0, flipAt = -1, swapped = false, landed = false, goal = false, hue = 0, flips = 0;
    var ptr = {}, lastSnd = -1, sheenAt = 2.2, parts = [], rings = [];

    function band(k) { return BANDS[(k + hue) % 6]; }

    function buildCells() {
      var nx = Math.ceil(b / s) + 1, ny = nx, reach = s * 0.41 * 1.22, best = [], offs = [[0, 0], [0, 0.5], [0.5, 0], [0.5, 0.5]];
      for (var o = 0; o < offs.length; o += 1) {
        var list = [];
        for (var j = -ny; j <= ny; j += 1) {
          for (var i = -nx; i <= nx; i += 1) {
            var x = cx + (i + offs[o][0]) * s, y = cy + (j + offs[o][1]) * s, ok = inPoly(P, x, y);
            for (var k = 0; ok && k < 8; k += 1) ok = inPoly(P, x + Math.cos(k * Math.PI / 4) * reach, y + Math.sin(k * Math.PI / 4) * reach);
            if (ok) list.push({ x: x, y: y, band: 0, on: false, at: -1 });
          }
        }
        if (list.length > best.length) best = list;
      }
      /* rows of equal height make one line; the lines are split into six rainbow bands */
      var ys = [], m;
      for (m = 0; m < best.length; m += 1) { var ry = Math.round(best[m].y); if (ys.indexOf(ry) < 0) ys.push(ry); }
      ys.sort(function (a, c) { return a - c; });
      for (m = 0; m < best.length; m += 1) best[m].band = Math.min(5, Math.floor(ys.indexOf(Math.round(best[m].y)) * 6 / ys.length));
      stripes = [bounds.y - 2];
      for (var q = 1; q < 6; q += 1) {
        var last = ys[0], first = null;
        for (m = 0; m < ys.length; m += 1) {
          var bd = Math.min(5, Math.floor(m * 6 / ys.length));
          if (bd < q) last = ys[m]; else if (first === null) first = ys[m];
        }
        stripes.push(first === null ? last : (last + first) / 2);
      }
      stripes.push(bounds.y + bounds.h + 2);
      return best;
    }

    function paintBoard() {
      var d = G.dpr, pad = s * 0.75;
      boardBox = { x: bounds.x - pad, y: bounds.y - pad, w: bounds.w + pad * 2, h: bounds.h + pad * 2 };
      board = mkCanvas(boardBox.w * d, boardBox.h * d);
      var c = board.getContext('2d'), i;
      c.scale(d, d); c.translate(-boardBox.x, -boardBox.y);
      /* soft floor shadow (blur via an offset shadow) and the slab thickness */
      c.save();
      c.shadowColor = 'rgba(107,74,90,0.24)'; c.shadowBlur = s * 0.45 * d; c.shadowOffsetX = 4000 * d; c.shadowOffsetY = s * 0.22 * d;
      c.translate(-4000, 0); polyPath(c, P); c.fillStyle = '#000'; c.fill();
      c.restore();
      c.save(); c.translate(0, s * 0.1); polyPath(c, P); c.fillStyle = 'rgba(0,0,0,0.14)'; c.fill(); c.restore();
      c.save(); polyPath(c, P); c.clip();
      for (i = 0; i < 6; i += 1) {
        c.fillStyle = mix(band(i), [0, 0, 0], 0.05);
        c.fillRect(bounds.x - 2, stripes[i], bounds.w + 4, stripes[i + 1] - stripes[i] + 0.5);
      }
      var g = c.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y + bounds.h);
      g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.09)');
      c.fillStyle = g; c.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      for (i = 0; i < cells.length; i += 1) {
        var q = cells[i], sy = q.y + br * 0.08, rg = c.createRadialGradient(q.x, sy, br * 0.7, q.x, sy, br * 1.18);
        rg.addColorStop(0, 'rgba(0,0,0,0.13)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = rg; c.beginPath(); c.arc(q.x, sy, br * 1.18, 0, TAU); c.fill();
      }
      c.restore();
      polyPath(c, P); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = s * 0.06; c.lineJoin = 'round'; c.stroke();
    }

    function paintSprites() {
      var d = G.dpr;
      spx = Math.ceil(s * 1.25 * d);
      raised = []; pushed = [];
      for (var i = 0; i < 6; i += 1) {
        for (var k = 0; k < 2; k += 1) {
          var cv = mkCanvas(spx), c = cv.getContext('2d');
          c.scale(spx / (s * 1.25), spx / (s * 1.25)); c.translate(s * 0.625, s * 0.625);
          paintBubble(c, br, BANDS[i], k === 1);
          (k ? pushed : raised).push(cv);
        }
      }
    }

    function layout(w, h, box) {
      W = w; H = h;
      b = Math.max(150, Math.min(box.w * 0.94, (h - 28) / 0.92, 560));
      cx = w / 2; cy = h * 0.5;
      s = b / 8; br = s * 0.41;
      P = [];
      var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (var i = 0; i < HEART.length; i += 2) {
        var x = cx + HEART[i] * b, y = cy + HEART[i + 1] * b;
        P.push(x, y);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      bounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      var old = cells;
      cells = buildCells();
      pressed = 0;
      for (var j = 0; j < cells.length; j += 1) {
        if (old.length === cells.length) { cells[j].on = old[j].on; cells[j].at = old[j].at; }
        if (cells[j].on) pressed += 1;
      }
      if (!old.length) {
        /* inviting first screen: a few bubbles already pushed in */
        var n = cells.length, pick = [Math.floor(n * 0.2), Math.floor(n * 0.46), Math.floor(n * 0.62) + 1, Math.floor(n * 0.8)];
        for (var m = 0; m < pick.length; m += 1) { var q = cells[pick[m] % n]; if (!q.on) { q.on = true; pressed += 1; } }
      }
      try { clip = new Path2D(); clip.moveTo(P[0], P[1]); for (var k = 2; k < P.length; k += 2) clip.lineTo(P[k], P[k + 1]); clip.closePath(); } catch (e) { clip = null; }
      paintBoard();
      paintSprites();
    }

    function flipping() { return flipAt >= 0 && clock >= flipAt; }

    function popSound(v) {
      var a = A(); if (!a) return;
      var t = a.currentTime + 0.003, p = 0.9 + Math.random() * 0.2;
      tn(a, t, 'sine', 380 * p, 150 * p, 0.075, 0.55 * v);
      nz(a, t, 0.03, 'bandpass', 1250 * p, 1.3, 0.55 * v);
      tn(a, t, 'triangle', 1100 * p, 620 * p, 0.016, 0.14 * v);
    }

    function press(q, strong) {
      q.on = true; q.at = clock; pressed += 1;
      if (strong || clock - lastSnd > 0.03) { lastSnd = clock; popSound(strong ? 0.95 : 0.7); }
      haptic(!!strong, strong ? 14 : 9);
      var col = band(q.band);
      burst(q.x, q.y, [col, '#FFFFFF', mix(col, WHITE, 0.5)], strong ? 6 : 4, br * 4.2, br * 0.13);
      ringFX(q.x, q.y, br * 0.5, br * 1.35, 'rgba(255,255,255,0.8)', 0.24);
    }
    function pressAt(x, y, strong) {
      if (flipping() || flipAt >= 0) return;
      var rr = s * 0.5;
      for (var i = 0; i < cells.length; i += 1) {
        var q = cells[i], dx = q.x - x, dy = q.y - y;
        if (dx * dx + dy * dy < rr * rr) { if (!q.on) press(q, strong); return; }
      }
    }

    /* the app's goal reward (Celebration): light rings, rainbow sparkle stars and tumbling confetti from the board */
    function cheer() {
      var size = Math.min(bounds.w, bounds.h) * 0.5;
      rings.push({ t: 0, d: 0, s: size }, { t: 0, d: 0.12, s: size * 0.7 });
      for (var i = 0; i < 64; i += 1) {
        var a = Math.random() * TAU, sp = size * (1.1 + 2.4 * Math.random()), star = i % 3 === 0;
        parts.push({
          x: cx + Math.cos(a) * size * 0.08, y: cy + Math.sin(a) * size * 0.08, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - size * 0.6,
          c: star ? mix(BANDS[i % 6], WHITE, 0.55) : BANDS[i % 6], t: 0, life: 0.9 + 0.8 * Math.random(),
          sz: size * (star ? 0.11 : 0.07) * (0.7 + 0.6 * Math.random()), rot: 0, spin: (Math.random() - 0.5) * 14, star: star, g: size * (star ? 0.5 : 1.6)
        });
      }
    }
    function drawCheer(c) {
      var i;
      for (i = 0; i < rings.length; i += 1) {
        var r = rings[i], t = (r.t - r.d) / 0.75;
        if (t < 0 || t > 1) continue;
        var e = 1 - Math.pow(1 - t, 3);
        c.strokeStyle = 'rgba(255,255,255,' + ((1 - t) * 0.85).toFixed(3) + ')'; c.lineWidth = r.s * 0.07 * (1 - t) + 1;
        c.beginPath(); c.arc(cx, cy, r.s * (0.25 + 1.6 * e), 0, TAU); c.stroke();
        if (t < 0.4) {
          var rr = r.s * (0.3 + 0.5 * t), g = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
          g.addColorStop(0, 'rgba(255,255,255,' + (0.55 * (1 - t / 0.4)).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rr, 0, TAU); c.fill();
        }
      }
      for (i = 0; i < parts.length; i += 1) {
        var p = parts[i], a = clamp(1 - p.t / p.life, 0, 1), fade = a < 0.3 ? a / 0.3 : 1;
        c.globalAlpha = fade; c.fillStyle = p.c;
        c.save(); c.translate(p.x, p.y);
        if (p.star) {
          var z = p.sz * (0.8 + 0.4 * Math.sin(p.t * 18));
          c.rotate(p.rot * 0.2);
          c.beginPath(); c.moveTo(0, -z); c.quadraticCurveTo(0, 0, z, 0); c.quadraticCurveTo(0, 0, 0, z);
          c.quadraticCurveTo(0, 0, -z, 0); c.quadraticCurveTo(0, 0, 0, -z); c.fill();
        } else {
          var w = p.sz * 1.6 * clamp(Math.abs(Math.cos(p.rot)), 0.15, 1);
          c.rotate(p.rot * 0.35); rrect(c, -w / 2, -p.sz / 2, w, p.sz, p.sz * 0.2); c.fill();
        }
        c.restore();
      }
      c.globalAlpha = 1;
    }

    return {
      layout: layout,
      down: function (p) { ptr[p.id] = { x: p.x, y: p.y }; pressAt(p.x, p.y, true); },
      move: function (p) {
        var q = ptr[p.id]; if (!q) return;
        var dx = p.x - q.x, dy = p.y - q.y, len = Math.sqrt(dx * dx + dy * dy), step = s * 0.35;
        for (var d = step; d <= len + 0.01; d += step) { var k = Math.min(d, len) / Math.max(len, 1e-6); pressAt(q.x + dx * k, q.y + dy * k, false); }
        if (len < step) pressAt(p.x, p.y, false);
        q.x = p.x; q.y = p.y;
      },
      up: function (p) { delete ptr[p.id]; },
      update: function (dt) {
        clock += dt;
        if (flipAt < 0 && cells.length && pressed >= cells.length) {
          /* goal: rainbow sparkle over the board, then it flips and the colours move one step */
          flipAt = clock + FLIP_DELAY; swapped = false; landed = false; goal = true;
          celebrate();
          cheer();
          Sfx.sparkle(0.8);
        }
        if (flipping()) {
          var u = (clock - flipAt) / FLIP_TIME;
          if (u > 0 && u - dt / FLIP_TIME <= 0) { Sfx.whoosh(0.45, true); haptic(true, 12); }
          if (u >= 0.5 && !swapped) {
            swapped = true;
            if (goal) { goal = false; hue += 1; paintBoard(); }
            for (var i = 0; i < cells.length; i += 1) { cells[i].on = false; cells[i].at = clock; }
            pressed = 0;
          }
          if (u >= 0.82 && !landed) { landed = true; Sfx.flop(0.95); }
          if (u >= 1) { flipAt = -1; flips += 1; haptic(true, 22); Sfx.fwip(); }
        }
        if (clock > sheenAt + 1.6) sheenAt = clock + 0.6 + Math.random() * 0.6;
        for (var pi = parts.length - 1; pi >= 0; pi -= 1) {
          var pp = parts[pi], dd = Math.exp(-2.6 * dt);
          pp.t += dt;
          if (pp.t >= pp.life) { parts.splice(pi, 1); continue; }
          pp.vx *= dd; pp.vy = pp.vy * dd + pp.g * dt; pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.rot += pp.spin * dt;
        }
        for (var ri = rings.length - 1; ri >= 0; ri -= 1) { rings[ri].t += dt; if (rings[ri].t > rings[ri].d + 0.75) rings.splice(ri, 1); }
      },
      draw: function (c) {
        if (!board) return;
        c.save();
        if (flipping()) {
          var f = clamp((clock - flipAt) / FLIP_TIME, 0, 1);
          var sx = Math.max(0.03, Math.abs(Math.cos(Math.PI * f))), lift = 1 + 0.07 * Math.sin(Math.PI * f);
          c.translate(cx, cy); c.scale(sx * lift, lift); c.translate(-cx, -cy);
        }
        c.drawImage(board, boardBox.x, boardBox.y, boardBox.w, boardBox.h);
        var half = s * 0.625;
        for (var i = 0; i < cells.length; i += 1) {
          var q = cells[i], col = (q.band + hue) % 6, k = q.at < 0 ? 1 : clamp((clock - q.at) / 0.09, 0, 1), z;
          if (q.on) {
            if (k < 1) { z = half * (1 - 0.06 * k); c.globalAlpha = 1 - k; c.drawImage(raised[col], q.x - z, q.y - z, z * 2, z * 2); }
            z = half * (1 - 0.05 * Math.sin(Math.PI * k)); c.globalAlpha = k; c.drawImage(pushed[col], q.x - z, q.y - z, z * 2, z * 2);
          } else {
            if (k < 1) { c.globalAlpha = 1 - k; c.drawImage(pushed[col], q.x - half, q.y - half, half * 2, half * 2); }
            z = half * (1 + 0.1 * Math.sin(Math.PI * k)); c.globalAlpha = k; c.drawImage(raised[col], q.x - z, q.y - z, z * 2, z * 2);
          }
        }
        c.globalAlpha = 1;
        /* idle gloss: a soft light band glides over the silicone now and then */
        var su = (clock - sheenAt) / 1.6;
        if (clip && su > 0 && su < 1 && !flipping()) {
          c.save(); c.clip(clip);
          var x0 = bounds.x - bounds.w * 0.5 + su * bounds.w * 2, g = c.createLinearGradient(x0 - b * 0.22, bounds.y, x0 + b * 0.22, bounds.y + b * 0.25);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.26)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g; c.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
          c.restore();
        }
        c.restore();
        if (parts.length || rings.length) drawCheer(c);
      },
      hint: function () {
        if (flipAt >= 0) return null;
        var best = null, bd = 1e9, tx = cx, ty = cy - s * 0.6;
        for (var i = 0; i < cells.length; i += 1) {
          var q = cells[i]; if (q.on) continue;
          var d = (q.x - tx) * (q.x - tx) + (q.y - ty) * (q.y - ty);
          if (d < bd) { bd = d; best = q; }
        }
        return best ? { x: best.x, y: best.y } : null;
      },
      debug: function () { return { pressed: pressed, total: cells.length, flips: flips, hue: hue % 6, flipping: flipAt >= 0 }; },
      destroy: function () { ptr = {}; cells = []; board = null; raised = []; pushed = []; clip = null; parts = []; rings = []; }
    };
  }

  GAMES['popit'] = {
    name: { ko: '팝잇', ja: 'プッシュポップ', en: 'Pop It' },
    tip: { ko: '다 누르면 휙 뒤집혀요', ja: '全部押すとくるっと裏返るよ', en: 'Press them all to flip it' },
    bg: 'linear-gradient(180deg,#FFF6EC 0%,#F6E7F2 100%) #FFF6EC',
    tone: 'light',
    top: '#FFF6EC',
    accent: '#FF8A80',
    make: PopIt
  };
})();
