/* game: scratch : rainbow scratch-art card (app ScratchToy, rainbow kind). A matte black coat over diagonal
 * rainbow bands with soft light blobs and a hidden picture in the middle. The finger scratches thick lines
 * through the coat. About 80% of the picture zone scratched: sparkle reveal, then a fresh coat slides over. */
(function () {
  var MOTIFS = 9, GOAL = 0.8, CELLS = 32;

  function hsv(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  function rgbs(a, al) { return 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + al + ')'; }
  function starPath(c, x, y, s) {
    c.beginPath();
    for (var i = 0; i < 10; i += 1) {
      var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.45 : s;
      if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  }
  function sparkle4(c, x, y, s) {
    c.beginPath(); c.moveTo(x, y - s);
    c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s);
    c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s);
    c.fill();
  }
  function line(c, x0, y0, x1, y1) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }

  /* the hidden pictures of the app (heart, star, sun, clover, moon, smile, cat, flower, rainbow), centred on 0,0 */
  function paintMotif(c, k, s) {
    var i, a;
    c.lineCap = 'round';
    switch (k) {
      case 0:
        c.fillStyle = '#FF4F7B'; c.beginPath(); c.moveTo(0, s * 0.85);
        c.bezierCurveTo(-s * 1.3, -s * 0.1, -s * 0.75, -s * 1.05, 0, -s * 0.45);
        c.bezierCurveTo(s * 0.75, -s * 1.05, s * 1.3, -s * 0.1, 0, s * 0.85); c.fill(); break;
      case 1: c.fillStyle = '#3D8BFF'; starPath(c, 0, 0, s); c.fill(); break;
      case 2:
        c.strokeStyle = '#FF9F1C'; c.lineWidth = s * 0.12;
        for (i = 0; i < 12; i += 1) { a = i * Math.PI / 6; line(c, Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.72, Math.cos(a) * s * 1.05, Math.sin(a) * s * 1.05); }
        c.fillStyle = '#FFB627'; c.beginPath(); c.arc(0, 0, s * 0.58, 0, TAU); c.fill(); break;
      case 3:
        c.strokeStyle = '#2E9E5B'; c.lineWidth = s * 0.1; line(c, 0, 0, s * 0.35, s * 1.1);
        c.fillStyle = '#34B36A';
        for (i = 0; i < 4; i += 1) { a = Math.PI / 4 + i * Math.PI / 2; c.beginPath(); c.arc(Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42, s * 0.42, 0, TAU); c.fill(); }
        break;
      case 4:
        c.fillStyle = '#8E6CFF'; c.beginPath(); c.arc(0, 0, s * 0.85, 0, TAU); c.fill();
        c.globalCompositeOperation = 'destination-out';
        c.beginPath(); c.arc(s * 0.42, -s * 0.22, s * 0.72, 0, TAU); c.fill();
        c.globalCompositeOperation = 'source-over'; break;
      case 6:
        c.fillStyle = '#FFA94D'; c.beginPath(); c.arc(0, s * 0.1, s * 0.75, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(-s * 0.68, -s * 0.2); c.lineTo(-s * 0.55, -s * 0.95); c.lineTo(-s * 0.12, -s * 0.55); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(s * 0.68, -s * 0.2); c.lineTo(s * 0.55, -s * 0.95); c.lineTo(s * 0.12, -s * 0.55); c.closePath(); c.fill();
        c.fillStyle = '#4A2A12';
        c.beginPath(); c.arc(-s * 0.28, 0, s * 0.09, 0, TAU); c.fill(); c.beginPath(); c.arc(s * 0.28, 0, s * 0.09, 0, TAU); c.fill();
        c.fillStyle = '#FF6B8A'; c.beginPath(); c.arc(0, s * 0.22, s * 0.07, 0, TAU); c.fill();
        c.strokeStyle = '#4A2A12'; c.lineWidth = s * 0.03;
        for (i = -1; i <= 1; i += 2) { line(c, i * s * 0.2, s * 0.28, i * s * 0.7, s * 0.2); line(c, i * s * 0.2, s * 0.33, i * s * 0.7, s * 0.38); }
        break;
      case 7:
        c.fillStyle = '#FF7EB3';
        for (i = 0; i < 6; i += 1) { a = i * Math.PI / 3; c.beginPath(); c.arc(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, s * 0.38, 0, TAU); c.fill(); }
        c.fillStyle = '#FFD23F'; c.beginPath(); c.arc(0, 0, s * 0.32, 0, TAU); c.fill(); break;
      case 8:
        var bands = ['#FF5A5F', '#FFA94D', '#FFD23F', '#6BCB77', '#4D96FF', '#9B72FF'];
        c.lineWidth = s * 0.12; c.lineCap = 'butt';
        for (i = 0; i < 6; i += 1) { c.strokeStyle = bands[i]; c.beginPath(); c.arc(0, s * 0.45, s * (1 - i * 0.12), Math.PI, TAU); c.stroke(); }
        c.fillStyle = '#FFFFFF';
        for (i = -1; i <= 1; i += 2) { c.beginPath(); c.ellipse(i * s * 0.78, s * 0.5, s * 0.3, s * 0.15, 0, 0, TAU); c.fill(); }
        break;
      default:
        c.fillStyle = '#FF8A3D'; c.beginPath(); c.arc(0, 0, s * 0.9, 0, TAU); c.fill();
        c.fillStyle = '#5A2A10';
        c.beginPath(); c.arc(-s * 0.3, -s * 0.2, s * 0.1, 0, TAU); c.fill(); c.beginPath(); c.arc(s * 0.3, -s * 0.2, s * 0.1, 0, TAU); c.fill();
        c.strokeStyle = '#5A2A10'; c.lineWidth = s * 0.09; c.beginPath(); c.arc(0, s * 0.05, s * 0.48, 0.35, Math.PI - 0.35); c.stroke();
    }
  }

  function glowSprite(rgb) {
    var n = 64, cv = mkCanvas(n), c = cv.getContext('2d'), s = 'rgba(' + rgb + ',';
    var g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, s + '1)'); g.addColorStop(0.12, s + '0.55)'); g.addColorStop(0.32, s + '0.19)'); g.addColorStop(0.6, s + '0.05)'); g.addColorStop(1, s + '0)');
    c.fillStyle = g; c.fillRect(0, 0, n, n);
    return cv;
  }

  function Scratch(env) {
    var W = 0, H = 0, card = null, zone = null, rad = 22, scale = 1, nib = 24, k = 1;
    var art = null, coat = null, cc = null, frame = null, nextArt = null, nextCoat = null;
    var motif = 0, nextMotif = 0, seed = 4, cells = [], revealed = 0, rounds = 0;
    var state = 'play', doneAt = -1, slideAt = -1, clock = 0, speed = 0, grit = 0, ptr = {}, flakes = [];
    var warm = glowSprite('255,244,194'), white = glowSprite('255,255,255'), flakeSpr = mkCanvas(16);
    (function () { var c = flakeSpr.getContext('2d'); c.fillStyle = '#2B2B2F'; c.beginPath(); c.arc(8, 8, 7, 0, TAU); c.fill(); })();
    var loop = makeLoop({ type: 'bandpass', freq: 2800, q: 0.6, gain: 0.42, smooth: 0.03 });

    function paintArt(m, sd) {
      var cv = mkCanvas(card.w * k, card.h * k), c = cv.getContext('2d'), r = srand(sd), i;
      c.scale(k, k);
      rrect(c, 1, 1, card.w - 2, card.h - 2, rad - 1); c.clip();
      var g = c.createLinearGradient(0, 0, card.w, card.h);
      for (i = 0; i <= 14; i += 1) g.addColorStop(i / 14, rgbs(hsv(i * 360 / 7, 0.78, 1), 1));
      c.fillStyle = g; c.fillRect(0, 0, card.w, card.h);
      for (i = 0; i < 14; i += 1) {
        var x = r() * card.w, y = r() * card.h, d = (120 + r() * 200) * scale, col = hsv(r() * 360, 0.6, 1);
        var bg = c.createRadialGradient(x, y, 0, x, y, d / 2);
        bg.addColorStop(0, rgbs(col, 0.35)); bg.addColorStop(0.12, rgbs(col, 0.19)); bg.addColorStop(0.32, rgbs(col, 0.07)); bg.addColorStop(1, rgbs(col, 0));
        c.fillStyle = bg; c.fillRect(x - d / 2, y - d / 2, d, d);
      }
      var zx = zone.x - card.x + zone.w / 2, zy = zone.y - card.y + zone.h / 2, zr = zone.w * 0.42 + 24 * scale;
      var wg = c.createRadialGradient(zx, zy, 0, zx, zy, zr);
      wg.addColorStop(0, 'rgba(255,255,255,0.55)'); wg.addColorStop(0.62, 'rgba(255,255,255,0.5)'); wg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = wg; c.fillRect(zx - zr, zy - zr, zr * 2, zr * 2);
      /* the picture on its own little canvas (the moon needs a cut-out), then dropped on with a soft shadow */
      var s = zone.w * 0.33, half = s * 1.3, mc = mkCanvas(half * 2 * k), m2 = mc.getContext('2d');
      m2.scale(k, k); m2.translate(half, half); paintMotif(m2, m, s);
      c.shadowColor = 'rgba(0,0,0,0.22)'; c.shadowBlur = s * 0.12 * k; c.shadowOffsetY = s * 0.05 * k;
      c.drawImage(mc, zx - half, zy - half, half * 2, half * 2);
      return cv;
    }
    function paintCoat() {
      var cv = mkCanvas(card.w * k, card.h * k), c = cv.getContext('2d'), r = srand(9), i;
      c.scale(k, k);
      rrect(c, 0, 0, card.w, card.h, rad); c.fillStyle = '#131315'; c.fill();
      c.save(); rrect(c, 0, 0, card.w, card.h, rad); c.clip();
      c.fillStyle = '#FFFFFF';
      var n = Math.round(card.w * card.h / (390 * 844) * 1800);
      for (i = 0; i < n; i += 1) {
        var sz = (1 + r() * 2) * scale * 0.7;
        c.globalAlpha = 0.03 + r() * 0.035;
        c.fillRect(r() * card.w, r() * card.h, sz, sz);
      }
      c.globalAlpha = 1;
      var g = c.createLinearGradient(0, 0, card.w, card.h);
      g.addColorStop(0.25, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0.055)'); g.addColorStop(0.65, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, card.w, card.h);
      c.restore();
      /* teaser, as in the app: a faint dashed frame round the hidden picture, four sparkles and two scratches */
      var zx = zone.x - card.x, zy = zone.y - card.y;
      c.save();
      c.setLineDash([9 * scale, 9 * scale]); c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 2 * scale;
      rrect(c, zx, zy, zone.w, zone.h, 28 * scale); c.stroke();
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.4)';
      sparkle4(c, zx, zy, 9 * scale); sparkle4(c, zx + zone.w, zy, 9 * scale); sparkle4(c, zx, zy + zone.h, 9 * scale); sparkle4(c, zx + zone.w, zy + zone.h, 9 * scale);
      c.globalCompositeOperation = 'destination-out';
      c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = nib * 1.1;
      var st = [[0.06, 0.12, 0.32], [0.56, 0.68, 0.34]];
      for (var j = 0; j < st.length; j += 1) {
        var ox = zx + zone.w * st[j][0], oy = zy + zone.h * st[j][1];
        c.beginPath(); c.moveTo(ox, oy);
        for (i = 1; i <= 10; i += 1) c.lineTo(ox + i / 10 * zone.w * st[j][2], oy + Math.sin(i * 1.1 + j) * zone.h * 0.03 + i * zone.h * 0.006);
        c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
      return cv;
    }
    function paintFrame() {
      var m = 34, d = G.dpr;
      frame = mkCanvas((card.w + m * 2) * d, (card.h + m * 2) * d);
      var c = frame.getContext('2d');
      c.scale(d, d);
      c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 26 * d; c.shadowOffsetY = 10 * d;
      rrect(c, m, m, card.w, card.h, rad); c.fillStyle = '#131315'; c.fill();
    }
    function ctxOf(cv) {
      var c = cv.getContext('2d');
      c.setTransform(k, 0, 0, k, 0, 0);
      c.globalCompositeOperation = 'destination-out'; c.lineCap = 'round'; c.lineJoin = 'round'; c.fillStyle = '#000'; c.strokeStyle = '#000';
      return c;
    }

    function layout(w, h, box) {
      W = w; H = h;
      var m = 12, cw = Math.min(box.w - m * 2, 560), ch = Math.min(h - m * 2, cw * 1.5);
      var nc = { x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: Math.round(cw), h: Math.round(ch) };
      var same = card && card.w === nc.w && card.h === nc.h && k === Math.min(G.dpr, 2);
      card = nc;
      scale = clamp(Math.min(card.w, card.h) / 360, 0.8, 2);
      rad = 22 * scale; nib = Math.max(22, 26 * scale);
      var side = Math.min(card.w, card.h) * 0.74;
      zone = { x: card.x + (card.w - side) / 2, y: card.y + (card.h - side) / 2, w: side, h: side };
      if (same && coat) { paintFrame(); return; }
      k = Math.min(G.dpr, 2);
      if (card.w * card.h * k * k > 1.6e6) k = Math.max(1, Math.sqrt(1.6e6 / (card.w * card.h)));
      var old = coat;
      if (!cells.length) { cells = []; for (var i = 0; i < CELLS * CELLS; i += 1) cells.push(false); }
      art = paintArt(motif, seed);
      coat = paintCoat();
      if (old && revealed > 0) {
        /* keep what was scratched: the old coat, rescaled, decides what stays covered */
        var c0 = coat.getContext('2d');
        c0.globalCompositeOperation = 'destination-in';
        c0.drawImage(old, 0, 0, coat.width, coat.height);
        c0.globalCompositeOperation = 'source-over';
      }
      cc = ctxOf(coat);
      if (state === 'slide') { nextArt = paintArt(nextMotif, seed); nextCoat = paintCoat(); } else { nextArt = null; nextCoat = null; }
      paintFrame();
    }

    function mark(ax, ay, bx, by) {
      var cw = zone.w / CELLS, ch = zone.h / CELLS, reach = nib * 0.5;
      var n = Math.max(1, Math.ceil(dist(ax, ay, bx, by) / (Math.min(cw, ch) * 0.5)));
      for (var s = 0; s <= n; s += 1) {
        var qx = lerp(ax, bx, s / n), qy = lerp(ay, by, s / n);
        var i0 = clamp(Math.floor((qx - reach - zone.x) / cw), 0, CELLS - 1), i1 = clamp(Math.floor((qx + reach - zone.x) / cw), 0, CELLS - 1);
        var j0 = clamp(Math.floor((qy - reach - zone.y) / ch), 0, CELLS - 1), j1 = clamp(Math.floor((qy + reach - zone.y) / ch), 0, CELLS - 1);
        if (qx + reach < zone.x || qx - reach > zone.x + zone.w || qy + reach < zone.y || qy - reach > zone.y + zone.h) continue;
        for (var j = j0; j <= j1; j += 1) {
          for (var i = i0; i <= i1; i += 1) {
            var id = j * CELLS + i;
            if (cells[id]) continue;
            var cx = zone.x + (i + 0.5) * cw, cy = zone.y + (j + 0.5) * ch;
            if ((cx - qx) * (cx - qx) + (cy - qy) * (cy - qy) < reach * reach) { cells[id] = true; revealed += 1; }
          }
        }
      }
      if (state === 'play' && revealed >= cells.length * GOAL) finish();
    }
    function inCard(x, y) { return x > card.x && x < card.x + card.w && y > card.y && y < card.y + card.h; }
    function scratch(ax, ay, bx, by) {
      if (!cc) return;
      var ox = card.x, oy = card.y;
      if (ax === bx && ay === by) { cc.beginPath(); cc.arc(ax - ox, ay - oy, nib / 2, 0, TAU); cc.fill(); }
      else { cc.lineWidth = nib; cc.beginPath(); cc.moveTo(ax - ox, ay - oy); cc.lineTo(bx - ox, by - oy); cc.stroke(); }
      mark(ax, ay, bx, by);
    }
    function chips(x, y, dx, dy, n) {
      for (var i = 0; i < n; i += 1) {
        var a = Math.random() * TAU, sp = (40 + Math.random() * 140) * scale;
        flakes.push({ x: x + (Math.random() - 0.5) * nib, y: y + (Math.random() - 0.5) * nib, vx: Math.cos(a) * sp * 0.6 + dx * sp * 0.5, vy: Math.sin(a) * sp * 0.6 + dy * sp * 0.5, s: (1.4 + Math.random() * 1.6) * scale, t0: clock });
      }
      if (flakes.length > 280) flakes.splice(0, flakes.length - 280);
    }
    function finish() {
      state = 'done'; doneAt = clock;
      var zx = zone.x + zone.w / 2, zy = zone.y + zone.h / 2;
      celebrate(zx, zy, ['#FF6B6B', '#FFD54A', '#66D18A', '#55A8F2', '#A67CF2', '#FFFFFF']);
      Sfx.sparkle(0.9);
      for (var i = 0; i < 40; i += 1) chips(zone.x + Math.random() * zone.w, zone.y + Math.random() * zone.h, 0, 0, 1);
    }
    function startSlide() {
      state = 'slide'; slideAt = clock; rounds += 1;
      do { nextMotif = Math.floor(Math.random() * MOTIFS); } while (nextMotif === motif);
      seed = 4 + rounds * 7;
      nextArt = paintArt(nextMotif, seed);
      nextCoat = paintCoat();
      Sfx.fwip(); haptic(true, 12);
    }
    function endSlide() {
      motif = nextMotif; art = nextArt; coat = nextCoat; cc = ctxOf(coat); nextArt = null; nextCoat = null;
      for (var i = 0; i < cells.length; i += 1) cells[i] = false;
      revealed = 0; state = 'play'; Sfx.thud(0.5);
    }

    function drawReward(c) {
      var t = clock - doneAt, kk = clamp(1 - t / 1.8, 0, 1);
      if (kk <= 0) return;
      var zx = zone.x + zone.w / 2, zy = zone.y + zone.h / 2, sd = zone.w * (0.9 + 0.5 * easeOutCubic(clamp(t / 0.6, 0, 1)));
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.55 * kk; c.drawImage(warm, zx - sd / 2, zy - sd / 2, sd, sd);
      for (var i = 0; i < 18; i += 1) {
        var a = i / 18 * TAU + clock * 1.4, rr = 0.3 + 0.28 * (1 - kk), tw = 0.6 + 0.4 * Math.sin(clock * 9 + i), d = (34 + 20 * tw) * scale * kk;
        c.globalAlpha = kk; c.drawImage(warm, zx + Math.cos(a) * zone.w * rr - d / 2, zy + Math.sin(a) * zone.h * rr - d / 2, d, d);
      }
      var u = clamp(t / 1, 0, 1);
      if (u < 1) {
        var ax = zone.w / (zone.w + zone.h) * 2, ay = -zone.h / (zone.w + zone.h) * 2, bx = zone.x - zone.w * 0.3 + u * zone.w * 1.6, bs = zone.w * 0.32;
        for (var j = -4; j <= 4; j += 1) {
          var qx = bx + ax * j * zone.w * 0.12, qy = zy + ay * j * zone.w * 0.12;
          c.globalAlpha = 0.22 * kk * (1 - Math.abs(j) / 5); c.drawImage(white, qx - bs / 2, qy - bs / 2, bs, bs);
        }
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }

    return {
      layout: layout,
      down: function (p) {
        if (state !== 'play') {
          if (inCard(p.x, p.y)) { burst(p.x, p.y, ['#FFFFFF', '#FFF4C2', '#FFB3E6'], 8, 120, 2.5); Sfx.tick(0.6); }
          return;
        }
        ptr[p.id] = { x: p.x, y: p.y, t: p.t };
        if (inCard(p.x, p.y)) { scratch(p.x, p.y, p.x, p.y); haptic(true, 6); chips(p.x, p.y, 0, 0, 4); }
      },
      move: function (p) {
        var q = ptr[p.id]; if (!q) return;
        var d = dist(q.x, q.y, p.x, p.y);
        if (d < 0.01) return;
        if (state === 'play') {
          speed = Math.max(speed, clamp(d / Math.max(1, p.t - q.t) * 1000 / 1500, 0, 1));
          scratch(q.x, q.y, p.x, p.y);
          if (inCard(p.x, p.y)) {
            grit += d;
            if (grit > 15 * scale) { grit = 0; haptic(false, 6); }
            if (Math.random() < 0.45) chips(p.x, p.y, (p.x - q.x) / d, (p.y - q.y) / d, 1);
          }
        }
        q.x = p.x; q.y = p.y; q.t = p.t;
      },
      up: function (p) { delete ptr[p.id]; },
      update: function (dt) {
        clock += dt;
        for (var i = flakes.length - 1; i >= 0; i -= 1) {
          var f = flakes[i], e = Math.exp(-dt * 1.5);
          f.vy += 520 * scale * dt; f.vx *= e; f.vy *= e; f.x += f.vx * dt; f.y += f.vy * dt;
          if (clock - f.t0 > 1.4 || f.y > H + 20) flakes.splice(i, 1);
        }
        var any = false;
        for (var id in ptr) if (Object.prototype.hasOwnProperty.call(ptr, id)) { any = true; break; }
        var on = any && speed > 0.03 && state === 'play';
        loop.set(on ? 0.12 + 0.6 * speed : 0, 0.8 + 0.5 * speed);
        speed *= Math.exp(-dt * 9);
        if (state === 'done' && clock - doneAt > 1.7) startSlide();
        if (state === 'slide' && clock - slideAt >= 0.55) endSlide();
      },
      draw: function (c) {
        if (!art) return;
        var d = G.dpr;
        c.drawImage(frame, card.x - 34, card.y - 34, frame.width / d, frame.height / d);
        c.drawImage(art, card.x, card.y, card.w, card.h);
        var gone = state === 'play' ? 0 : clamp((clock - doneAt) / 0.7, 0, 1);
        if (gone < 1) { c.globalAlpha = 1 - gone; c.drawImage(coat, card.x, card.y, card.w, card.h); c.globalAlpha = 1; }
        if (state === 'play') {
          /* the four sparkles round the hidden picture twinkle so the card never looks frozen */
          var pts = [[zone.x, zone.y], [zone.x + zone.w, zone.y], [zone.x, zone.y + zone.h], [zone.x + zone.w, zone.y + zone.h]];
          for (var i = 0; i < 4; i += 1) {
            var tw = Math.pow(0.5 + 0.5 * Math.sin(clock * 2.4 + i * 1.7), 3);
            c.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.55 * tw).toFixed(3) + ')';
            sparkle4(c, pts[i][0], pts[i][1], (7 + 6 * tw) * scale);
          }
        }
        if (flakes.length) {
          for (var j = 0; j < flakes.length; j += 1) {
            var f = flakes[j];
            c.globalAlpha = 0.9 * clamp(1 - (clock - f.t0) / 1.4, 0, 1);
            c.drawImage(flakeSpr, f.x - f.s, f.y - f.s, f.s * 2, f.s * 2);
          }
          c.globalAlpha = 1;
        }
        if (state !== 'play') drawReward(c);
        if (state === 'slide' && nextCoat) {
          var e = easeOutCubic(clamp((clock - slideAt) / 0.55, 0, 1));
          c.save(); rrect(c, card.x, card.y, card.w, card.h, rad); c.clip();
          c.drawImage(nextCoat, card.x, card.y - (1 - e) * card.h, card.w, card.h);
          c.restore();
        }
        c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 1.5;
        rrect(c, card.x + 0.75, card.y + 0.75, card.w - 1.5, card.h - 1.5, rad); c.stroke();
      },
      hint: function () {
        if (state !== 'play' || !zone) return null;
        return { x: zone.x + zone.w * 0.14, y: zone.y + zone.h * 0.4, dx: zone.w * 0.72, dy: zone.h * 0.12 };
      },
      debug: function () { return { revealed: Math.round(revealed / Math.max(1, cells.length) * 100) / 100, state: state, rounds: rounds, motif: motif }; },
      destroy: function () { loop.stop(); ptr = {}; art = coat = cc = frame = nextArt = nextCoat = null; flakes = []; }
    };
  }

  GAMES['scratch'] = {
    name: { ko: '스크래치', ja: 'スクラッチ', en: 'Scratch Art' },
    tip: { ko: '긁으면 숨은 그림이 나와요', ja: 'けずるとかくれた絵が出るよ', en: 'Scratch to find the picture' },
    bg: 'radial-gradient(130% 80% at 50% 30%,#2A2A30 0%,#1B1B20 55%,#111114 100%) #1B1B20',
    tone: 'dark',
    top: '#1B1B20',
    accent: '#FFB3E6',
    make: Scratch
  };
})();
