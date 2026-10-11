/* game: keycaps : port of keycaps_toy.dart. A light macropad: 4x3 keycaps plus a long space bar in the app's switch kits.
 * Pressing a key sinks it by its travel (same frame as the click and haptic), it springs back up, light spreads under it,
 * and a small LED stays on in its corner. Once every key is lit a rainbow wave sweeps the board (the app's goal), the LEDs
 * go out and the next kit (blue, brown, red switch) slides in. Idle: a soft light breathes under one unlit key. */
(function () {
  var KITS = [
    { bg: ['#EAF4FF', '#F4EEFF'], cs: '#F8FAFE', plate: '#D5DEEC', keys: ['#FFFFFF', '#C4E4FF', '#8EC5F2'], accent: '#FF8FA3', artisan: '#DCEBFF', legend: '#6C8BB0', glows: ['#5EC8FF', '#8E9BFF', '#5EE6D6'], v: [0, 2, 5] },
    { bg: ['#FFF4E6', '#F6EADF'], cs: '#EFE1CE', plate: '#C7AE92', keys: ['#FFF6E6', '#EBD3B3', '#B98A62'], accent: '#F2A65A', artisan: '#FFE9C9', legend: '#8F6A4C', glows: ['#FFB259', '#FF8A5C', '#FFD36E'], v: [3, 6, 8] },
    { bg: ['#FFF0F3', '#FCEAF4'], cs: '#FFFFFF', plate: '#F0CDD8', keys: ['#FFF8F2', '#FFCAD6', '#FF8BA4'], accent: '#FFE08A', artisan: '#FFE3EA', legend: '#C0687F', glows: ['#FF6FA0', '#FF9BCB', '#C77DFF'], v: [1, 4, 7] }
  ];
  /* colour (0..2 base keys, 3 accent, 4 artisan) and legend per key, as in the app */
  var LAY = [[3, 'heart'], [0, ''], [0, ''], [1, 'dot'], [0, ''], [1, 'bar'], [4, 'face'], [0, ''], [1, 'dot'], [0, ''], [0, 'star'], [2, '']];
  var WAVE = 1.5;
  function bgCss(k) { return 'linear-gradient(180deg,' + k.bg[0] + ' 0%,' + k.bg[1] + ' 100%) ' + k.bg[0]; }
  function lh(a, b, k) { var x = hex(a), y = hex(b); return [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]; }
  function css(v, a) { return 'rgba(' + Math.round(v[0]) + ',' + Math.round(v[1]) + ',' + Math.round(v[2]) + ',' + (a == null ? 1 : a) + ')'; }

  function Keycaps() {
    var W = 0, H = 0, u = 80, grid = null, plate = null, board = null, glowSpr = null, kitIx = 0, kit = KITS[0];
    var keys = [], fingers = {}, lit = {}, litN = 0, wave = -1, hue = 0, clock = 0, rounds = 0, presses = 0, breathe = 0, bKey = -1;
    var ch = makeCheer();
    for (var i0 = 0; i0 < 13; i0 += 1) keys.push({ i: i0, x: 0, y: 0, w: 1, h: 1, col: i0 < 12 ? LAY[i0][0] : 1, lg: i0 < 12 ? LAY[i0][1] : 'bar', space: i0 === 12, holders: 0, down: false, depth: 0, vel: 0, glow: 0, hue: 0 });

    function keyColor(k) { return k.col === 3 ? kit.accent : (k.col === 4 ? kit.artisan : kit.keys[k.col]); }
    function buildBoard() {
      var d = G.dpr, m = u * 0.6, bw = grid.w + u * 0.56, bh = grid.h + u * 0.56, c;
      board = mkCanvas((bw + m * 2) * d, (bh + m * 2) * d);
      c = board.getContext('2d'); c.scale(d, d);
      var x = m, y = m, rr = u * 0.34;
      /* soft drop shadow, case thickness, the case, its rim, then the plate the keys sit in */
      c.save(); c.shadowColor = 'rgba(88,64,96,0.2)'; c.shadowBlur = u * 0.4 * d; c.shadowOffsetY = u * 0.16 * d;
      c.fillStyle = css(lh(kit.cs, '#000000', 0.14)); rrect(c, x, y + u * 0.07, bw, bh, rr); c.fill(); c.restore();
      c.fillStyle = css(lh(kit.cs, '#000000', 0.14)); rrect(c, x, y + u * 0.07, bw, bh, rr); c.fill();
      var g = c.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0, css(lh(kit.cs, '#FFFFFF', 0.5))); g.addColorStop(1, kit.cs);
      c.fillStyle = g; rrect(c, x, y, bw, bh, rr); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.5; rrect(c, x + 1, y + 1, bw - 2, bh - 2, rr - 1); c.stroke();
      var px = x + u * 0.28 - u * 0.05, py = y + u * 0.28 - u * 0.05, pw = grid.w + u * 0.1, ph = grid.h + u * 0.1;
      c.fillStyle = kit.plate; rrect(c, px, py, pw, ph, u * 0.14); c.fill();
      c.save(); rrect(c, px, py, pw, ph, u * 0.14); c.clip();
      c.shadowColor = 'rgba(0,0,0,0.17)'; c.shadowBlur = u * 0.12 * d; c.shadowOffsetY = u * 0.05 * d;
      c.strokeStyle = '#000000'; c.lineWidth = u * 0.12; rrect(c, px - u * 0.06, py - u * 0.06, pw + u * 0.12, ph + u * 0.12, u * 0.2); c.stroke();
      c.restore();
      board.ox = grid.x - u * 0.28 - m; board.oy = grid.y - u * 0.28 - m; board.w = bw + m * 2; board.h = bh + m * 2;
      plate = { x: grid.x - u * 0.05, y: grid.y - u * 0.05, w: pw, h: ph };
      /* white radial glow sprite, tinted per key with globalCompositeOperation-free alpha */
      glowSpr = [];
      for (var gi = 0; gi < kit.glows.length; gi += 1) {
        var s = mkCanvas(128), gc = s.getContext('2d'), gg = gc.createRadialGradient(64, 64, 0, 64, 64, 64), cv = hex(kit.glows[gi]);
        gg.addColorStop(0, css(cv, 0.75)); gg.addColorStop(0.45, css(cv, 0.3)); gg.addColorStop(1, css(cv, 0));
        gc.fillStyle = gg; gc.fillRect(0, 0, 128, 128); glowSpr.push(s);
      }
    }
    function layout(w, h) {
      W = w; H = h;
      u = Math.min(Math.min(w * 0.84 / 4, h * 0.68 / 4.5), 132);
      grid = { x: w / 2 - u * 2, y: h * 0.52 - u * 2, w: u * 4, h: u * 4 };
      /* the case is 0.28u bigger all round: keep it inside the play area */
      if (grid.y - u * 0.3 < 6) grid.y = 6 + u * 0.3;
      if (grid.y + grid.h + u * 0.4 > h - 4) grid.y = Math.max(6 + u * 0.3, h - 4 - u * 0.4 - grid.h);
      var gap = u * 0.1;
      for (var i = 0; i < 12; i += 1) {
        var k = keys[i];
        k.x = grid.x + (i % 4) * u + gap / 2; k.y = grid.y + Math.floor(i / 4) * u + gap / 2; k.w = u - gap; k.h = u - gap;
      }
      var sp = keys[12];
      sp.x = grid.x + gap / 2; sp.y = grid.y + 3 * u + gap / 2; sp.w = u * 4 - gap; sp.h = u - gap;
      buildBoard();
    }
    function keyAt(x, y) {
      var pad = u * 0.035;
      for (var i = 0; i < keys.length; i += 1) {
        var k = keys[i];
        if (x >= k.x - pad && x <= k.x + k.w + pad && y >= k.y - pad && y <= k.y + k.h + pad) return i;
      }
      return -1;
    }
    function voice() { return kit.v[Math.floor(Math.random() * 2)]; }
    function press(i) {
      var k = keys[i];
      k.holders += 1;
      if (k.holders > 1) return;
      k.down = true; k.depth = Math.max(k.depth, 0.6); k.vel = 0; k.glow = 1; k.hue = hue++ % kit.glows.length;
      presses += 1;
      if (k.space) { Sfx.key(9, false); Sfx.key(voice(), false); haptic(true, 18); }
      else { Sfx.key(voice(), false); haptic(true, kitIx === 0 ? 12 : 9); }
      mark(i);
    }
    function mark(i) {
      if (wave >= 0 || lit[i]) return;
      lit[i] = true; litN += 1;
      if (litN < keys.length) return;
      wave = 0;
      ch.burst(grid.x + grid.w / 2, grid.y + grid.h / 2, u * 1.6, kit.glows, 64);
      celebrate();
    }
    function release(i) {
      var k = keys[i];
      if (k.holders <= 0) return;
      k.holders -= 1;
      if (k.holders > 0) return;
      k.down = false; k.vel = -2;
      Sfx.key(kit.v[2], true);
      if (kitIx === 0) haptic(false, 6);
    }
    function waveAt(i) { return i === 12 ? WAVE * 0.8 : WAVE * 0.12 * ((i % 4) + Math.floor(i / 4)); }
    function newRound() {
      lit = {}; litN = 0; wave = -1; rounds += 1;
      kitIx = (kitIx + 1) % KITS.length; kit = KITS[kitIx];
      setBg(bgCss(kit), true); buildBoard();
      for (var i = 0; i < keys.length; i += 1) { keys[i].vel = -6; keys[i].glow = 0; }
      Sfx.key(9, false); Sfx.fwip();
    }
    function drawLegend(c, k, fx, fy, fw, fh) {
      var cx = fx + fw / 2, cy = fy + fh / 2, s = Math.min(fw, fh), ink = rgba(kit.legend, k.col === 3 ? 0.8 : 0.55), i;
      if (k.lg === 'dot') { c.fillStyle = ink; c.beginPath(); c.arc(cx, cy, s * 0.06, 0, TAU); c.fill(); }
      else if (k.lg === 'bar') { var bw = s * (k.space ? 0.5 : 0.22); c.fillStyle = ink; rrect(c, cx - bw / 2, cy + s * (k.space ? 0 : 0.14) - s * 0.025, bw, s * 0.05, s * 0.03); c.fill(); }
      else if (k.lg === 'heart') {
        var hs = s * 0.2; c.fillStyle = 'rgba(255,255,255,0.9)';
        c.beginPath(); c.moveTo(cx, cy + hs * 0.9);
        c.bezierCurveTo(cx - hs * 1.4, cy - hs * 0.1, cx - hs * 0.7, cy - hs * 1.1, cx, cy - hs * 0.35);
        c.bezierCurveTo(cx + hs * 0.7, cy - hs * 1.1, cx + hs * 1.4, cy - hs * 0.1, cx, cy + hs * 0.9); c.fill();
      } else if (k.lg === 'star') {
        c.fillStyle = ink; c.beginPath();
        for (i = 0; i < 10; i += 1) { var a = -Math.PI / 2 + Math.PI * i / 5, rr = s * (i % 2 ? 0.075 : 0.17); if (i) c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        c.closePath(); c.fill();
      } else if (k.lg === 'face') {
        c.fillStyle = rgba(kit.legend, 0.9);
        c.beginPath(); c.arc(cx - s * 0.15, cy - s * 0.02, s * 0.045, 0, TAU); c.arc(cx + s * 0.15, cy - s * 0.02, s * 0.045, 0, TAU); c.fill();
        c.fillStyle = rgba(kit.accent, 0.55);
        c.beginPath(); c.arc(cx - s * 0.25, cy + s * 0.09, s * 0.06, 0, TAU); c.arc(cx + s * 0.25, cy + s * 0.09, s * 0.06, 0, TAU); c.fill();
        c.strokeStyle = rgba(kit.legend, 0.9); c.lineWidth = s * 0.03; c.lineCap = 'round';
        c.beginPath(); c.ellipse(cx, cy + s * 0.05, s * 0.07, s * 0.05, 0, 0.2, Math.PI - 0.2); c.stroke();
      }
    }
    function drawKey(c, k, isLit) {
      var d = clamp(k.depth, -0.1, 1), dp = clamp(d, 0, 1), hgt = Math.min(k.h, u), travel = hgt * 0.15 * d, skirt = hgt * 0.17 * (1 - 0.75 * dp);
      var base = keyColor(k), side = lh(base, '#3A2A40', 0.2), rad = hgt * 0.17, g;
      c.fillStyle = 'rgba(0,0,0,0.18)'; rrect(c, k.x, k.y + hgt * 0.05 * (1 - dp) + 1.5, k.w, k.h, rad); c.fill();
      var by = k.y + travel, bh = k.h - travel;
      g = c.createLinearGradient(0, by, 0, by + bh);
      var bv = hex(base); g.addColorStop(0, css([side[0] + (bv[0] - side[0]) * 0.4, side[1] + (bv[1] - side[1]) * 0.4, side[2] + (bv[2] - side[2]) * 0.4])); g.addColorStop(1, css(side));
      c.fillStyle = g; rrect(c, k.x, by, k.w, bh, rad); c.fill();
      var ins = hgt * 0.085, fx = k.x + ins, fy = by + hgt * 0.035, fw = k.w - ins * 2, fh = k.y + k.h - skirt - fy;
      g = c.createLinearGradient(0, fy, 0, fy + fh);
      g.addColorStop(0, css(lh(base, '#FFFFFF', 0.35))); g.addColorStop(0.55, base); g.addColorStop(1, css(lh(base, '#000000', 0.04)));
      c.fillStyle = g; rrect(c, fx, fy, fw, fh, hgt * 0.13); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = Math.max(1, hgt * 0.014); c.stroke();
      if (wave >= 0 && k.glow > 0.02) { c.fillStyle = rgba(kit.glows[k.hue % kit.glows.length], (0.6 * k.glow).toFixed(3)); rrect(c, fx, fy, fw, fh, hgt * 0.13); c.fill(); }
      if (d > 0.02) { c.fillStyle = 'rgba(40,20,50,' + (0.1 * dp).toFixed(3) + ')'; rrect(c, fx, fy, fw, fh, hgt * 0.13); c.fill(); }
      if (k.glow > 0.02) { c.strokeStyle = rgba(kit.glows[k.hue % kit.glows.length], (0.55 * k.glow).toFixed(3)); c.lineWidth = Math.max(1.2, hgt * 0.025); rrect(c, k.x, by, k.w, bh, rad); c.stroke(); }
      drawLegend(c, k, fx, fy, fw, fh);
      if (isLit) {
        /* the app's little LED in the top-left corner of the face: this key was pressed this round */
        var gcol = kit.glows[(k.space ? 12 : k.i) % kit.glows.length], lx = fx + hgt * 0.14, ly = fy + hgt * 0.14;
        g = c.createRadialGradient(lx, ly, 0, lx, ly, hgt * 0.15);
        g.addColorStop(0, rgba(gcol, 0.55)); g.addColorStop(1, rgba(gcol, 0));
        c.fillStyle = g; c.beginPath(); c.arc(lx, ly, hgt * 0.15, 0, TAU); c.fill();
        c.fillStyle = gcol; c.beginPath(); c.arc(lx, ly, hgt * 0.05, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(lx - hgt * 0.014, ly - hgt * 0.014, hgt * 0.018, 0, TAU); c.fill();
      }
    }
    /* start like the app's first screen after a few taps: two keys already lit */
    lit[0] = true; lit[6] = true; litN = 2;
    return {
      layout: layout,
      down: function (p) { var i = keyAt(p.x, p.y); fingers[p.id] = i; if (i >= 0) press(i); },
      move: function (p) {
        if (!(p.id in fingers)) return;
        var i = keyAt(p.x, p.y), cur = fingers[p.id];
        if (i === cur) return;
        if (cur >= 0) release(cur);
        fingers[p.id] = i;
        if (i >= 0) press(i);
      },
      up: function (p) { if (!(p.id in fingers)) return; var cur = fingers[p.id]; delete fingers[p.id]; if (cur >= 0) release(cur); },
      update: function (dt) {
        clock += dt;
        ch.update(dt);
        var i, k;
        if (wave >= 0) {
          var before = wave; wave += dt;
          for (i = 0; i < keys.length; i += 1) {
            var at = waveAt(i);
            if (before < at && wave >= at) { k = keys[i]; k.glow = Math.max(k.glow, 1); k.hue = i; if ((i < 12 && i % 4 === 0) || i === 12) Sfx.key(kit.v[2], true); }
          }
          if (wave >= WAVE + 0.4) newRound();
        }
        for (i = 0; i < keys.length; i += 1) {
          k = keys[i];
          if (k.down) { k.depth = Math.min(1, k.depth + dt / 0.03); k.glow = Math.max(k.glow - dt * 0.5, 0.6); }
          else {
            k.vel += (-1500 * k.depth - 24 * k.vel) * dt; k.depth += k.vel * dt;
            if (k.depth < -0.1) { k.depth = -0.1; k.vel = 0; }
            if (Math.abs(k.depth) < 0.002 && Math.abs(k.vel) < 0.05) { k.depth = 0; k.vel = 0; }
            k.glow = Math.max(0, k.glow - dt * 1.4);
          }
        }
        /* idle: light breathes under one unlit key at a time, so the board never looks frozen */
        breathe += dt;
        if (bKey < 0 || breathe > 1.8 || lit[bKey]) {
          breathe = 0; bKey = -1;
          var free = [];
          for (i = 0; i < keys.length; i += 1) if (!lit[i] && !keys[i].down) free.push(i);
          if (free.length && wave < 0) bKey = free[Math.floor(Math.random() * free.length)];
        }
      },
      draw: function (c) {
        if (!board) return;
        var d = G.dpr, i, k;
        c.drawImage(board, board.ox, board.oy, board.w, board.h);
        c.save(); rrect(c, plate.x, plate.y, plate.w, plate.h, u * 0.14); c.clip();
        for (i = 0; i < keys.length; i += 1) {
          k = keys[i];
          var gw = k.glow, gs = k.hue % kit.glows.length;
          if (i === bKey && !k.down) { var bb = Math.sin(clamp(breathe / 1.8, 0, 1) * Math.PI); if (bb * 0.45 > gw) { gw = bb * 0.45; gs = i % kit.glows.length; } }
          if (gw <= 0.01) continue;
          c.globalAlpha = Math.min(1, gw);
          if (k.space) { for (var s = 0; s < 4; s += 1) { var sx = k.x + k.w * (s + 0.5) / 4, sy = k.y + k.h / 2; c.drawImage(glowSpr[gs], sx - u, sy - u, u * 2, u * 2); } }
          else c.drawImage(glowSpr[gs], k.x + k.w / 2 - u * 1.4, k.y + k.h / 2 - u * 1.4, u * 2.8, u * 2.8);
        }
        c.globalAlpha = 1; c.restore();
        for (i = 0; i < keys.length; i += 1) drawKey(c, keys[i], !!lit[i]);
        ch.draw(c);
      },
      hint: function () {
        /* the unlit key nearest the middle of the pad */
        var best = null, bd = 1e9, cx = grid.x + grid.w / 2, cy = grid.y + grid.h * 0.4;
        for (var i = 0; i < 12; i += 1) {
          if (lit[i]) continue;
          var k = keys[i], dd = Math.pow(k.x + k.w / 2 - cx, 2) + Math.pow(k.y + k.h / 2 - cy, 2);
          if (dd < bd) { bd = dd; best = k; }
        }
        if (!best) best = keys[12];
        return { x: best.x + best.w / 2, y: best.y + best.h / 2 };
      },
      debug: function () { var dn = 0; for (var i = 0; i < keys.length; i += 1) if (keys[i].holders > 0) dn += 1; return { down: dn, lit: litN, total: keys.length, presses: presses, wave: wave >= 0, rounds: rounds, kit: kitIx }; },
      destroy: function () { fingers = {}; board = null; glowSpr = null; ch.clear(); }
    };
  }

  GAMES['keycaps'] = {
    name: { ko: '키캡 클리커', ja: 'キーキャップ', en: 'Keycap Clicker' },
    tip: { ko: '키를 눌러 딸깍딸깍', ja: 'キーを押してカチカチ', en: 'Tap the keys: clack clack' },
    bg: bgCss(KITS[0]),
    tone: 'light',
    top: KITS[0].bg[0],
    accent: '#8EC5F2',
    make: Keycaps
  };
})();
