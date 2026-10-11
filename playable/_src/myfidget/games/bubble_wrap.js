/* game: bubble_wrap : port of bubble_wrap_toy.dart. Clear plastic domes over the sheet colour; tap to pop, rub to pop a row.
 * Popping every bubble plays the app's reward (light rings, sparkle stars, confetti), then a new sheet in the next
 * colour (pink, lavender, clear, mint) puffs up in a wave from the left. A soft light runs over the sheet when idle. */
(function () {
  /* the app's four sheets: [top, bottom, tint] */
  var SHEETS = [
    ['#FCE1EA', '#F2BCCD', '#E88AAA'], /* pink */
    ['#E7E1FB', '#C9BEF0', '#9C8AE6'], /* lavender */
    ['#E4ECF2', '#C7D5E1', '#9DB7CC'], /* clear */
    ['#D5F3E8', '#A6DCC9', '#5FC0A0']  /* mint */
  ];
  /* the sheet colour plus the app's slanted light streaks on the plastic */
  function bgCss(s) {
    return 'linear-gradient(135deg,rgba(255,255,255,0) 15%,rgba(255,255,255,.18) 30%,rgba(255,255,255,0) 45%,rgba(255,255,255,.12) 62%,rgba(255,255,255,0) 80%),' +
      'linear-gradient(180deg,' + s[0] + ' 0%,' + s[1] + ' 100%) ' + s[0];
  }
  function lerpHex(a, b, k) { var x = hex(a), y = hex(b); return [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]; }
  function rgbaA(v, a) { return 'rgba(' + Math.round(v[0]) + ',' + Math.round(v[1]) + ',' + Math.round(v[2]) + ',' + a + ')'; }

  function BubbleWrap() {
    var W = 0, H = 0, R = 24, B = [], rows = 0, cols = 0, cell = 0, dome = null, flats = [];
    var sheetIx = 0, clock = 0, left = 0, rounds = 0, popped = 0, refillAt = -1, puffs = [], ptr = {};
    var ch = makeCheer(), lastHap = -1, GLINT_P = 3.6;

    /* one inflated dome (dome_) and three crumpled flats (_flat), drawn once per size and colour */
    function drawDome(c, x, y, r, tint) {
      var deep = lerpHex(tint, '#000000', 0.35), g;
      c.save(); c.translate(x + r * 0.08, y + r * 0.2); c.scale(1.04, 0.95);
      g = c.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.12);
      g.addColorStop(0, rgbaA(deep, 0.28)); g.addColorStop(1, rgbaA(deep, 0));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.12, 0, TAU); c.fill(); c.restore();
      g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x - r * 0.3, y - r * 0.35, r * 1.45);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.32, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.78, rgba(tint, 0.32)); g.addColorStop(1, rgbaA(deep, 0.45));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = r * 0.1;
      c.beginPath(); c.arc(x, y, r * 0.76, 0.25, 1.75); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = Math.max(1, r * 0.045);
      c.beginPath(); c.arc(x, y, r * 0.985, 0, TAU); c.stroke();
      c.save(); c.translate(x - r * 0.36, y - r * 0.4); c.rotate(-0.65);
      c.shadowColor = 'rgba(255,255,255,0.9)'; c.shadowBlur = r * 0.09 * G.dpr;
      c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.ellipse(0, 0, r * 0.29, r * 0.15, 0, 0, TAU); c.fill(); c.restore();
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(x + r * 0.12, y - r * 0.55, r * 0.065, 0, TAU); c.fill();
    }
    function drawFlat(c, x, y, r, tint, seed) {
      var rnd = srand(seed), pts = [], k;
      for (k = 0; k < 12; k += 1) {
        var a = TAU * k / 12 + (rnd() - 0.5) * 0.35, rad = r * (0.8 + 0.14 * rnd());
        pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]);
      }
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (k = 1; k < 12; k += 1) c.lineTo(pts[k][0], pts[k][1]);
      c.closePath();
      c.fillStyle = rgbaA(lerpHex('#FFFFFF', tint, 0.35), 0.3); c.fill();
      c.lineJoin = 'round'; c.lineWidth = 1.1; c.strokeStyle = 'rgba(255,255,255,0.55)'; c.stroke();
      c.lineWidth = 1;
      for (k = 0; k < 5; k += 1) {
        var fx = x + (rnd() - 0.5) * r * 0.6, fy = y + (rnd() - 0.5) * r * 0.6, p = pts[Math.floor(rnd() * 12)];
        var tx = x + (p[0] - x) * 0.85, ty = y + (p[1] - y) * 0.85;
        c.strokeStyle = rgba(tint, 0.35); c.beginPath(); c.moveTo(fx + 0.8, fy + 0.8); c.lineTo(tx + 0.8, ty + 0.8); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.moveTo(fx, fy); c.lineTo(tx, ty); c.stroke();
      }
    }
    function sprites() {
      var d = G.dpr, tint = SHEETS[sheetIx][2], px, c;
      cell = R * 2.7; px = Math.ceil(cell * d);
      dome = mkCanvas(px); c = dome.getContext('2d'); c.scale(d, d); drawDome(c, cell / 2, cell / 2, R, tint);
      flats = [];
      for (var k = 0; k < 3; k += 1) {
        var f = mkCanvas(px); c = f.getContext('2d'); c.scale(d, d); drawFlat(c, cell / 2, cell / 2, R, tint, k * 13 + 3); flats.push(f);
      }
    }
    function layout(w, h) {
      W = w; H = h;
      R = clamp(Math.min(w, h) / 13, 20, 44);
      var dx = R * 2.2, dy = dx * 0.866, m = R * 0.35;
      cols = clamp(Math.floor((w - R * 0.4) / dx), 3, 40);
      rows = clamp(Math.floor((h - m * 2 - R * 2) / dy) + 1, 2, 40);
      var ox = (w - (cols - 1) * dx - dx / 2) / 2, oy = (h - (rows - 1) * dy) / 2;
      var old = B; B = []; left = 0;
      for (var r = 0; r < rows; r += 1) {
        for (var cI = 0; cI < cols; cI += 1) {
          var was = old[B.length];
          var b = { x: ox + cI * dx + (r % 2 ? dx / 2 : 0), y: oy + r * dy, r: r, c: cI, v: (r * 31 + cI * 17) % 3,
            popped: was ? was.popped : false, at: was ? was.at : -9, app: was ? was.app : -9 };
          if (!b.popped) left += 1;
          B.push(b);
        }
      }
      if (!old.length) {
        /* start like a finger already rubbed a few: three flat bubbles above the middle */
        var r0 = Math.max(0, Math.floor(rows / 2) - 2);
        for (var k = 1; k <= 3 && k < cols; k += 1) { var q = B[r0 * cols + k]; if (q && !q.popped) { q.popped = true; q.at = -9; left -= 1; } }
      }
      sprites();
    }
    function pop(b, strong) {
      b.popped = true; b.at = clock; left -= 1; popped += 1;
      for (var k = 0; k < 7; k += 1) {
        var a = Math.random() * TAU, sp = R * (2.5 + Math.random() * 3.5);
        puffs.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.22 + Math.random() * 0.15, s: R * (0.05 + Math.random() * 0.06) });
      }
      if (puffs.length > 240) puffs.splice(0, puffs.length - 240);
      Sfx.pop(strong ? 0.95 : 0.75);
      if (strong) haptic(true, 12);
      else if (clock - lastHap > 0.04) { lastHap = clock; haptic(false, 8); }
    }
    function live(b) { return !b.popped && b.app <= clock; }
    function tapAt(x, y) {
      var best = null, bd = R * R * 1.02;
      for (var i = 0; i < B.length; i += 1) {
        var b = B[i]; if (!live(b)) continue;
        var d = (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) pop(best, true);
    }
    function rub(x0, y0, x1, y1) {
      for (var i = 0; i < B.length; i += 1) {
        var b = B[i];
        if (live(b) && segDist(b.x, b.y, x0, y0, x1, y1) < R * 0.9) pop(b, false);
      }
    }
    function refill() {
      sheetIx = (sheetIx + 1) % SHEETS.length;
      setBg(bgCss(SHEETS[sheetIx]), true);
      sprites();
      /* the new sheet puffs up in a wave from the left */
      for (var i = 0; i < B.length; i += 1) { var b = B[i]; b.popped = false; b.at = -9; b.app = clock + (b.x / W) * 0.45 + (b.y / H) * 0.25; }
      left = B.length; rounds += 1; refillAt = -1;
      Sfx.fwip();
    }
    return {
      layout: layout,
      down: function (p) { ptr[p.id] = { x: p.x, y: p.y }; tapAt(p.x, p.y); },
      move: function (p) { var q = ptr[p.id]; if (!q) return; rub(q.x, q.y, p.x, p.y); q.x = p.x; q.y = p.y; },
      up: function (p) { delete ptr[p.id]; },
      update: function (dt) {
        clock += dt;
        for (var i = puffs.length - 1; i >= 0; i -= 1) {
          var f = puffs[i]; f.t += dt;
          if (f.t >= f.life) { puffs.splice(i, 1); continue; }
          var k = Math.exp(-7 * dt); f.vx *= k; f.vy *= k; f.x += f.vx * dt; f.y += f.vy * dt;
        }
        if (left <= 0 && refillAt < 0) {
          refillAt = clock + 0.9;
          var s = SHEETS[sheetIx];
          ch.burst(W / 2, H / 2, Math.min(W, H) * 0.42, [s[2], s[1], '#FF8FB1', '#FFD36E', '#7FD6FF', '#B79CFF'], 70);
          celebrate();
        }
        if (refillAt >= 0 && clock >= refillAt) refill();
        ch.update(dt);
      },
      draw: function (c) {
        if (!dome) return;
        var hc = cell / 2, gl = 0;
        for (var i = 0; i < B.length; i += 1) {
          var b = B[i], s, k;
          if (b.app > clock) continue;
          if (!b.popped) {
            var age = clock - b.app;
            s = 1;
            if (age < 0.35) { var x = age / 0.35; s = 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2); }
            else {
              /* idle light: a soft band runs diagonally over the sheet, each dome swells a touch as it passes */
              var u = ((clock / GLINT_P - (b.x / W + b.y / H * 0.6) / 2.6) % 1 + 1) % 1;
              gl = u < 0.14 ? Math.sin(u / 0.14 * Math.PI) : 0;
              s = 1 + 0.05 * gl;
            }
            c.drawImage(dome, b.x - hc * s, b.y - hc * s, cell * s, cell * s);
            if (gl > 0.05) {
              c.globalAlpha = 0.7 * gl; c.fillStyle = '#FFFFFF';
              c.beginPath(); c.ellipse(b.x - R * 0.36, b.y - R * 0.4, R * 0.34, R * 0.2, -0.65, 0, TAU); c.fill();
              c.globalAlpha = 1; gl = 0;
            }
          } else {
            k = clock - b.at;
            if (k < 0.12) { var e = k / 0.12; s = 1 + 0.12 * e; c.globalAlpha = 1 - e; c.drawImage(dome, b.x - hc * s, b.y - hc * s, cell * s, cell * s); }
            c.globalAlpha = clamp(k / 0.08, 0, 1);
            c.drawImage(flats[b.v], b.x - hc, b.y - hc, cell, cell);
            c.globalAlpha = 1;
          }
        }
        c.fillStyle = '#FFFFFF';
        for (var j = 0; j < puffs.length; j += 1) {
          var f = puffs[j], a = 1 - f.t / f.life;
          c.globalAlpha = 0.85 * a; c.beginPath(); c.arc(f.x, f.y, f.s * (0.6 + 0.4 * a), 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
        ch.draw(c);
      },
      hint: function () {
        /* a rub across the row with the most bubbles left, below the middle */
        var best = -1, bn = 1, r0 = Math.floor(rows / 2) + 1;
        for (var t = 0; t < rows; t += 1) {
          var r = (r0 + t) % rows, n = 0;
          for (var cI = 0; cI < cols; cI += 1) if (live(B[r * cols + cI])) n += 1;
          if (n > bn) { bn = n; best = r; }
        }
        if (best < 0) {
          for (var i = 0; i < B.length; i += 1) if (live(B[i])) return { x: B[i].x, y: B[i].y };
          return null;
        }
        var a = B[best * cols], z = B[best * cols + cols - 1];
        return { x: a.x, y: a.y, dx: z.x - a.x, dy: 0 };
      },
      debug: function () { return { left: left, total: B.length, rounds: rounds, popped: popped, sheet: sheetIx }; },
      destroy: function () { B = []; ptr = {}; puffs = []; dome = null; flats = []; ch.clear(); }
    };
  }

  GAMES['bubble_wrap'] = {
    name: { ko: '뽁뽁이', ja: 'プチプチ', en: 'Bubble Wrap' },
    tip: { ko: '눌러서 뽁, 문지르면 뽁뽁뽁', ja: '押してプチッ、こすってプチプチ', en: 'Tap to pop, rub for more' },
    bg: bgCss(SHEETS[0]),
    tone: 'light',
    top: SHEETS[0][0],
    accent: '#E88AAA',
    make: BubbleWrap
  };
})();
