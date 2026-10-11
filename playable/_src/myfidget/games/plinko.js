/* game: plinko : glass marbles bounce down a field of glowing pegs (port of my_fidget plinko_toy.dart, look 0 "night sky").
 * Tap drops a marble at that x, holding drops a stream. Every peg it hits flashes and rings a pentatonic bell
 * (higher rows ring higher). One bin glows: three marbles into it make its marbles hop and sparkle (celebrate),
 * then another bin lights up. Bins start half full; resting marbles fade away so it never fills up. */
(function () {
  var PEG = '#9FB2FF', WALL = 'rgba(185,198,255,0.34)', TINT = '#FFE27A';
  var MARBLES = ['#7FDBFF', '#FF8AD8', '#FFD36E', '#8CFFB5', '#B79CFF'];
  /* C major pentatonic, row 0 (top) rings highest: same notes as the app's peg sounds */
  var NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
  var NEED = 3, REST_LIFE = 3.5, MAX_M = 80;

  function tok(v) { /* small glassy clack when a marble lands in a bin */
    var a = A(); if (!a) return;
    var t = a.currentTime + 0.003;
    tn(a, t, 'sine', 1250, 950, 0.045, 0.2 * v);
    nz(a, t, 0.012, 'bandpass', 3400, 1.4, 0.28 * v);
  }

  function Plinko(env) {
    var W = 0, H = 0, BX = 0, BW = 0, sx = 40, sy = 34, pr = 3, mr = 8, top = 0, binTop = 0, floorY = 0, dropY = 0, grav = 1800, rows = 10;
    var pegs = [], rowStart = [], dividers = [], marbles = [], droppers = {}, starsBg = [];
    var sprM = [], sprPeg = null, sprWhite = null, sprGlow = null, half = 0;
    var clock = 0, colorCursor = 0, lastTok = -1, lastBell = -1, lastAuto = -10, touchedOnce = false;
    var target = 0, hits = 0, hitAt = -10, goalAt = -10;
    var n = { drops: 0, pegHits: 0, binned: 0, goals: 0 };

    function binCenter(i) { return (dividers[i - 1] + dividers[i]) / 2; }
    function binOf(x) { var i = 0; while (i < dividers.length && dividers[i] < x) i += 1; return i; }
    function pickTarget() {
      var lo = 2, hi = dividers.length - 2;
      if (hi <= lo) { target = clamp(Math.ceil(dividers.length / 2), 1, dividers.length - 1); return; }
      var t = target;
      while (t === target) t = lo + Math.floor(Math.random() * (hi - lo + 1));
      target = t;
    }

    function sprites() {
      var d = G.dpr, i;
      half = mr * 1.3;
      sprM = [];
      for (i = 0; i < MARBLES.length; i += 1) {
        var col = MARBLES[i], cv = mkCanvas(half * 2 * d), c = cv.getContext('2d'), r = mr;
        c.scale(d, d); c.translate(half, half);
        var g = c.createRadialGradient(r * 0.2, r * 0.3, 0, r * 0.2, r * 0.3, r * 1.3);
        g.addColorStop(0, col); g.addColorStop(0.55, mix(col, [0, 0, 0], 0.15)); g.addColorStop(1, mix(col, [0, 0, 0], 0.44));
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(-r * 0.32, -r * 0.38, r * 0.3, r * 0.18, -0.5, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = r * 0.08; c.beginPath(); c.arc(0, 0, r * 0.96, 0, TAU); c.stroke();
        sprM.push(cv);
      }
      function dot(col, stops) {
        var s = 64, cv2 = mkCanvas(s), c2 = cv2.getContext('2d'), g2 = c2.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        for (var k = 0; k < stops.length; k += 1) g2.addColorStop(stops[k][0], rgba(col, stops[k][1]));
        c2.fillStyle = g2; c2.fillRect(0, 0, s, s);
        return cv2;
      }
      sprPeg = dot(PEG, [[0, 1], [0.42, 1], [0.6, 0.35], [1, 0]]);
      sprWhite = dot('#FFFFFF', [[0, 1], [0.45, 1], [0.7, 0.4], [1, 0]]);
      sprGlow = dot('#FFFFFF', [[0, 1], [0.12, 0.55], [0.32, 0.19], [0.6, 0.05], [1, 0]]);
    }

    function layout(w0, h0, box) {
      W = w0; H = h0; BX = box.x; BW = box.w;
      var cols = clamp(Math.floor(BW / (BW > 520 ? 52 : 44)), 6, 12); /* big tablets: fewer, larger pegs and marbles */
      sx = BW / (cols + 0.5);
      var byH = H * 0.6 / (6.5 * 0.84);
      if (sx > byH) { cols = clamp(Math.floor(BW / byH - 0.5), 6, 28); sx = BW / (cols + 0.5); }
      sy = sx * 0.84; pr = Math.max(sx * 0.08, 2.6); mr = sx * 0.2;
      top = H * 0.2; dropY = top - sy * 1.1;
      rows = clamp(Math.floor((H * 0.8 - top) / sy), 5, 30);
      binTop = top + (rows - 0.4) * sy;
      floorY = Math.min(H - Math.max(40, H * 0.06), binTop + sx * 2.6);
      grav = H * 2.3;
      pegs = []; rowStart = [];
      for (var r = 0; r < rows; r += 1) {
        rowStart.push(pegs.length);
        var cnt = r % 2 ? cols - 1 : cols, x0 = BX + (BW - (cnt - 1) * sx) / 2;
        for (var c = 0; c < cnt; c += 1) pegs.push({ x: x0 + c * sx, y: top + r * sy, row: r, flash: -10 });
      }
      rowStart.push(pegs.length);
      dividers = [];
      for (var i = rowStart[rows - 1]; i < rowStart[rows]; i += 1) dividers.push(pegs[i].x);
      var rnd = srand(5);
      starsBg = [];
      for (i = 0; i < 60; i += 1) starsBg.push({ x: rnd() * W, y: rnd() * H, s: 0.6 + (i % 3) * 0.35, f: 0.7 + (i % 5) * 0.2 });
      sprites();
      /* a relayout (rotation) re-seeds the bins like the app; the target bin and its progress are kept */
      marbles = [];
      if (target < 2 || target > dividers.length - 2) { hits = 0; pickTarget(); }
      seedPile();
    }
    function seedPile() {
      var nb = dividers.length, mid = nb / 2, room = Math.floor((floorY - binTop) / (mr * 1.96));
      for (var i = 1; i < nb; i += 1) {
        var x = binCenter(i), u = (i - mid) / Math.max(1, nb / 3.2);
        var count = Math.min(2 + Math.round(3 * Math.exp(-u * u)), room - 1);
        for (var k = 0; k < count; k += 1) {
          marbles.push({ x: x + (k % 2 ? 0.5 : -0.5) * mr * 0.2, y: floorY - mr - k * mr * 1.96, vx: 0, vy: 0, c: colorCursor++ % MARBLES.length,
            born: clock - 1, rest: 0, fadeAt: 1e9, landed: true, binned: true, seed: true, auto: false });
        }
      }
    }

    function drop(x, auto) {
      if (marbles.length >= MAX_M) {
        var old = null;
        for (var i = 0; i < marbles.length; i += 1) if (marbles[i].fadeAt > clock && (!old || marbles[i].born < old.born)) old = marbles[i];
        if (old) old.fadeAt = clock;
      }
      var cx = clamp(x, BX + mr * 2, BX + BW - mr * 2);
      marbles.push({ x: cx + (Math.random() - 0.5) * 2, y: dropY, vx: (Math.random() - 0.5) * sx * 0.6, vy: 0, c: colorCursor++ % MARBLES.length,
        born: clock, rest: 0, fadeAt: 1e9, landed: false, binned: false, seed: false, auto: !!auto });
      if (!auto) { n.drops += 1; haptic(false); }
    }

    function hit() {
      hits += 1; hitAt = clock;
      Sfx.sparkle(0.5);
      if (hits < NEED) return;
      /* goal: the marbles in that bin hop up and sparkle, then another bin glows */
      hits = 0; goalAt = clock; n.goals += 1;
      var x = binCenter(target);
      for (var i = 0; i < marbles.length; i += 1) {
        var m = marbles[i];
        if (m.y > binTop && binOf(m.x) === target && m.fadeAt > clock) {
          m.vx = (Math.random() - 0.5) * sx * 3; m.vy = -sx * (14 + 6 * Math.random()); m.rest = 0; m.binned = false; m.auto = true;
        }
      }
      celebrate(x, (binTop + floorY) / 2, MARBLES.concat(['#FFFFFF']));
      pickTarget();
    }

    function pegHits(m) {
      var r0 = Math.round((m.y - top) / sy), reach = mr + pr;
      for (var r = r0 - 1; r <= r0 + 1; r += 1) {
        if (r < 0 || r >= rows) continue;
        var a = rowStart[r], b = rowStart[r + 1], c0 = Math.round((m.x - pegs[a].x) / sx);
        for (var k = c0 - 1; k <= c0 + 1; k += 1) {
          var i = a + k;
          if (k < 0 || i >= b) continue;
          var p = pegs[i], dx = m.x - p.x, dy = m.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d >= reach || d < 1e-6) continue;
          var nx = dx / d, ny = dy / d;
          m.x = p.x + nx * reach; m.y = p.y + ny * reach;
          var vn = m.vx * nx + m.vy * ny;
          if (vn >= 0) continue;
          var kick = (Math.random() - 0.5) * sx * 0.9;
          m.vx += -nx * vn * 1.55 - ny * kick; m.vy += -ny * vn * 1.55 + nx * kick;
          var speed = -vn;
          if (speed > sx * 2 && clock - p.flash > 0.07) {
            p.flash = clock; n.pegHits += 1;
            var v = clamp(speed / (sx * 14), 0, 1);
            if (clock - lastBell > 0.035) { /* demo and hopping marbles ring softly and never buzz */
              lastBell = clock;
              Sfx.bell(NOTES[clamp(7 - Math.floor(p.row * 8 / rows), 0, 7)], (0.3 + 0.6 * v) * (m.auto ? 0.35 : 1));
              if (!m.auto) haptic(false, 8);
            }
          }
        }
      }
    }
    function walls(m) {
      var L = BX + mr, R = BX + BW - mr;
      if (m.x < L) { m.x = L; m.vx = Math.abs(m.vx) * 0.5; } else if (m.x > R) { m.x = R; m.vx = -Math.abs(m.vx) * 0.5; }
      if (m.y > binTop - mr) {
        var hf = mr + 1.5;
        for (var i = 0; i < dividers.length; i += 1) {
          var dx = m.x - dividers[i];
          if (Math.abs(dx) >= hf) continue;
          if (m.y < binTop) { /* round top of a divider: bounce like a peg */
            var ddx = m.x - dividers[i], ddy = m.y - binTop, d = Math.sqrt(ddx * ddx + ddy * ddy);
            if (d < hf && d > 1e-6) {
              var nx = ddx / d, ny = ddy / d;
              m.x = dividers[i] + nx * hf; m.y = binTop + ny * hf;
              var vn = m.vx * nx + m.vy * ny;
              if (vn < 0) { m.vx -= nx * vn * 1.4; m.vy -= ny * vn * 1.4; }
            }
          } else { m.x = dividers[i] + (dx < 0 ? -hf : hf); m.vx = -m.vx * 0.35; }
        }
      }
      if (m.y > floorY - mr) {
        var hard = m.vy > sx * 4;
        m.y = floorY - mr; m.vx *= 0.9; if (m.vy > 0) m.vy = -m.vy * 0.25;
        if (hard && !m.landed) {
          m.landed = true;
          if (clock - lastTok > 0.05) { lastTok = clock; tok(m.auto ? 0.25 : 0.5); if (!m.auto) haptic(false, 10); }
        }
      }
    }
    function pairs() {
      var cnt = marbles.length, d2 = mr * 2;
      for (var i = 0; i < cnt; i += 1) {
        var a = marbles[i];
        for (var j = i + 1; j < cnt; j += 1) {
          var b = marbles[j], dx = b.x - a.x;
          if (dx >= d2 || dx <= -d2) continue;
          var dy = b.y - a.y;
          if (dy >= d2 || dy <= -d2) continue;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d >= d2 || d < 1e-6) continue;
          var nx = dx / d, ny = dy / d, push = (d2 - d) / 2;
          a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
          var rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) { var k = rel * 0.65; a.vx += nx * k; a.vy += ny * k; b.vx -= nx * k; b.vy -= ny * k; }
        }
      }
    }

    function update(dt) {
      clock += dt;
      if (dt <= 0) return;
      for (var id in droppers) { var dd = droppers[id]; while (clock - dd.last >= 0.16) { dd.last += 0.16; drop(dd.x, false); } }
      /* before the first touch, a marble now and then shows how it works (silent: audio is still locked) */
      if (!touchedOnce && clock - lastAuto > 1.5 && clock > 0.6) { lastAuto = clock; drop(binCenter(target) + (Math.random() - 0.5) * sx * 1.5, true); }
      var hh = dt / 4, i, m;
      for (var s = 0; s < 4; s += 1) {
        for (i = 0; i < marbles.length; i += 1) {
          m = marbles[i];
          m.vy += grav * hh; m.x += m.vx * hh; m.y += m.vy * hh;
          pegHits(m); walls(m);
        }
        pairs();
      }
      var slow2 = (sx * 0.5) * (sx * 0.5);
      for (i = 0; i < marbles.length; i += 1) {
        m = marbles[i];
        if (!m.binned && m.y > binTop + mr) {
          m.binned = true; n.binned += 1;
          if (!m.auto && binOf(m.x) === target && clock - goalAt > 0.6) hit();
        }
        var slow = m.vx * m.vx + m.vy * m.vy < slow2;
        if (m.seed && !touchedOnce) m.rest = 0;
        else if (m.y > binTop && slow) { m.rest += dt; if (m.rest > REST_LIFE && m.fadeAt > clock) m.fadeAt = clock; }
        else m.rest = 0;
      }
      for (i = marbles.length - 1; i >= 0; i -= 1) if (clock - marbles[i].fadeAt > 0.5) marbles.splice(i, 1);
    }

    function down(p) {
      if (!touchedOnce) { touchedOnce = true; for (var i = 0; i < marbles.length; i += 1) if (marbles[i].auto && !marbles[i].binned) marbles[i].fadeAt = clock; }
      droppers[p.id] = { x: p.x, last: clock };
      drop(p.x, false);
    }
    function move(p) { var d = droppers[p.id]; if (d) d.x = p.x; }
    function up(p) { delete droppers[p.id]; }

    function draw(c) {
      var i, k, d;
      /* twinkling stars (full width: background detail) */
      c.fillStyle = '#FFFFFF';
      for (i = 0; i < starsBg.length; i += 1) {
        var st = starsBg[i], tw = 0.35 + 0.35 * Math.sin(clock * st.f + i);
        c.globalAlpha = 0.15 + 0.25 * tw; c.beginPath(); c.arc(st.x, st.y, st.s, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
      /* side rails when the board does not reach the screen edges (tablets: centred column) */
      c.lineCap = 'round'; c.strokeStyle = WALL; c.lineWidth = Math.max(2, pr * 0.9);
      if (BX > 2 || G.wide) {
        var e = c.lineWidth / 2;
        c.globalAlpha = 0.6; c.beginPath();
        c.moveTo(BX + e, dropY); c.lineTo(BX + e, floorY); c.moveTo(BX + BW - e, dropY); c.lineTo(BX + BW - e, floorY); c.stroke();
        c.globalAlpha = 1;
      }
      /* the glowing target bin: breathes, flashes on each marble, gets brighter as it fills */
      var on = clamp((clock - goalAt - 0.35) / 0.4, 0, 1), l = 0, r = 0, glowA = 0;
      if (on > 0 && target > 0 && target < dividers.length) {
        l = dividers[target - 1]; r = dividers[target];
        var fl = clamp(1 - (clock - hitAt) / 0.4, 0, 1), br = 0.5 + 0.5 * Math.sin(clock * 3.2), y0 = binTop - sy * 0.9;
        glowA = on * Math.min(1, 0.42 + 0.16 * br + 0.45 * fl + 0.1 * hits);
        var g = c.createLinearGradient(0, y0, 0, floorY);
        g.addColorStop(0, rgba(TINT, 0)); g.addColorStop(0.55, rgba(TINT, glowA * 0.45)); g.addColorStop(1, rgba(TINT, glowA * 0.8));
        c.fillStyle = g; c.fillRect(l, y0, r - l, floorY - y0);
      }
      c.beginPath();
      for (i = 0; i < dividers.length; i += 1) { c.moveTo(dividers[i], binTop); c.lineTo(dividers[i], floorY); }
      c.moveTo(BX + mr * 0.5, floorY + c.lineWidth / 2); c.lineTo(BX + BW - mr * 0.5, floorY + c.lineWidth / 2);
      c.stroke();
      if (glowA > 0) { /* the target bin's walls turn gold */
        c.strokeStyle = rgba(TINT, Math.min(1, glowA + 0.2)); c.beginPath();
        c.moveTo(l, binTop); c.lineTo(l, floorY); c.moveTo(r, binTop); c.lineTo(r, floorY); c.stroke();
      }
      /* pegs: flash white with a glow when hit */
      var ps = pr * 2.6;
      for (i = 0; i < pegs.length; i += 1) {
        var p = pegs[i];
        k = clamp(1 - (clock - p.flash) / 0.35, 0, 1);
        if (k > 0) {
          d = pr * (2.6 + 1.2 * k);
          c.drawImage(sprPeg, p.x - d / 2, p.y - d / 2, d, d);
          c.globalAlpha = k; c.drawImage(sprWhite, p.x - d / 2, p.y - d / 2, d, d); c.globalAlpha = 1;
        } else c.drawImage(sprPeg, p.x - ps / 2, p.y - ps / 2, ps, ps);
      }
      c.globalCompositeOperation = 'lighter';
      for (i = 0; i < pegs.length; i += 1) {
        k = clamp(1 - (clock - pegs[i].flash) / 0.35, 0, 1);
        if (k <= 0) continue;
        d = pr * 14 * (0.6 + 0.4 * k);
        c.globalAlpha = 0.5 * k; c.drawImage(sprGlow, pegs[i].x - d / 2, pegs[i].y - d / 2, d, d);
      }
      /* where marbles come out while a finger is down */
      for (var id in droppers) {
        var x = clamp(droppers[id].x, BX + mr * 2, BX + BW - mr * 2), gd = mr * 4;
        c.globalAlpha = 0.35; c.drawImage(sprGlow, x - gd / 2, dropY - gd / 2, gd, gd);
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      /* marbles */
      var s2 = half * 2;
      for (i = 0; i < marbles.length; i += 1) {
        var m = marbles[i], a = clamp(1 - (clock - m.fadeAt) / 0.5, 0, 1);
        if (a <= 0) continue;
        c.globalAlpha = a; c.drawImage(sprM[m.c], m.x - half, m.y - half, s2, s2);
      }
      c.globalAlpha = 1;
    }

    return {
      layout: layout, down: down, move: move, up: up, update: update, draw: draw,
      hint: function () { return dividers.length > target && target > 0 ? { x: binCenter(target), y: top - sy * 0.7 } : null; },
      debug: function () {
        return { marbles: marbles.length, drops: n.drops, pegHits: n.pegHits, binned: n.binned, target: target, hits: hits, goals: n.goals,
          bins: dividers.length - 1, rows: rows, held: Object.keys(droppers).length };
      },
      destroy: function () { marbles = []; droppers = {}; sprM = []; sprPeg = sprWhite = sprGlow = null; }
    };
  }

  GAMES['plinko'] = {
    name: { ko: '구슬 떨어뜨리기', ja: 'ビー玉おとし', en: 'Marble Drop' },
    tip: { ko: '꾹 누르면 구슬이 줄줄이', ja: '長押しでビー玉が次々と', en: 'Tap to drop, hold for more' },
    bg: 'radial-gradient(130% 85% at 50% 45%,rgba(0,0,0,0) 50%,rgba(0,0,0,.32) 100%),linear-gradient(180deg,#0B1028 0%,#1C1447 100%) #0B1028',
    tone: 'dark',
    top: '#0B1028',
    accent: '#9FB2FF',
    make: Plinko
  };
})();
