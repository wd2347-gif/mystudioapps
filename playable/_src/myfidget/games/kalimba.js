/* game: kalimba : a maple kalimba with nine silver tines (port of my_fidget kalimba_toy.dart, look 0 "maple").
 * Longest, lowest tine in the centre, higher notes alternate left and right. Tap a tine to pluck it (the tip
 * vibrates, a note rises), sweep sideways for a glissando. The next note of a short tune glows (follow_tune.dart);
 * finishing it ripples the tines with a rising arpeggio and notes float out of the sound hole, then a new tune. */
(function () {
  var ORDER = [7, 5, 3, 1, 0, 2, 4, 6, 8]; /* note index per tine, left to right */
  var FREQ = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99]; /* app kalimba_0..8 */
  var WOOD0 = '#E2B98A', WOOD1 = '#C4925E', GRAIN = 'rgba(112,74,32,0.13)';
  var TINE0 = '#FFFFFF', TINE1 = '#C9CFD6', TINE2 = '#8E979F', ACC = '#FFB347';
  /* opening phrases of the app's pentaTunes (0=C 1=D 2=E 3=G 4=A): short, so a viewer finishes one fast */
  var TUNES = [[0, 0, 3, 3, 4, 4, 3], [2, 1, 0, 1, 2, 2, 2], [3, 3, 4, 4, 3, 3, 2], [2, 1, 0, 2, 1, 0]];
  var REST = 2.6;

  function Kalimba(env) {
    var W = 0, H = 0, B = { x: 0, y: 0, w: 0, h: 0, cx: 0 }, bridge = 0, hole = { x: 0, y: 0, r: 20 }, gap = 20, tw = 12, sk = 1;
    var tines = [], board = null, ptr = {}, notes = [], flourish = [], clock = 0, buzz = 0, holePulse = 0;
    var F = { tune: Math.floor(Math.random() * TUNES.length), pos: 0, doneAt: -100, lastHit: -100, rightAt: -100, done: 0 };
    var n = { plucks: 0, sweeps: 0, right: 0 };

    /* ---- follow the tune (same rules as follow_tune.dart: no failing, wrong notes just ring) ---- */
    function cur() { return TUNES[F.tune % TUNES.length]; }
    function resting() { return clock - F.doneAt < REST; }
    function nextNote() { return resting() ? null : cur()[F.pos]; }
    function followHit(note) {
      F.lastHit = clock;
      if (resting() || note !== cur()[F.pos]) return false;
      F.rightAt = clock; F.pos += 1; n.right += 1;
      if (F.pos < cur().length) return false;
      F.pos = 0; F.tune = (F.tune + 1) % TUNES.length; F.doneAt = clock; F.done += 1;
      return true;
    }
    function glow() {
      if (resting()) return 0;
      var br = 0.6 + 0.4 * Math.sin(clock * TAU * 0.75);
      if (F.lastHit < -50) return br * 0.85;
      var idle = clock - F.lastHit;
      return br * (idle < 8 ? 1 : (idle < 12 ? 1 - 0.5 * (idle - 8) / 4 : 0.5));
    }

    function boardSprite() {
      var d = G.dpr, m = 26, b = B;
      board = { cv: mkCanvas((b.w + m * 2) * d, (b.h + m * 2) * d), m: m };
      var c = board.cv.getContext('2d');
      c.scale(d, d); c.translate(m - b.x, m - b.y);
      var rt = b.w * 0.14, rb = b.w * 0.06;
      function shape() {
        c.beginPath(); c.moveTo(b.x + rt, b.y); c.lineTo(b.x + b.w - rt, b.y); c.arcTo(b.x + b.w, b.y, b.x + b.w, b.y + rt, rt);
        c.lineTo(b.x + b.w, b.y + b.h - rb); c.arcTo(b.x + b.w, b.y + b.h, b.x + b.w - rb, b.y + b.h, rb);
        c.lineTo(b.x + rb, b.y + b.h); c.arcTo(b.x, b.y + b.h, b.x, b.y + b.h - rb, rb);
        c.lineTo(b.x, b.y + rt); c.arcTo(b.x, b.y, b.x + rt, b.y, rt); c.closePath();
      }
      c.save(); c.shadowColor = 'rgba(70,40,10,0.3)'; c.shadowBlur = 16 * d; c.shadowOffsetY = 10 * d;
      shape();
      var g = c.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
      g.addColorStop(0, WOOD0); g.addColorStop(1, WOOD1);
      c.fillStyle = g; c.fill(); c.restore();
      c.save(); shape(); c.clip();
      c.strokeStyle = GRAIN; c.lineWidth = 1;
      for (var i = 0; i < 18; i += 1) {
        var x = b.x + b.w * (i + 0.5) / 18;
        c.beginPath(); c.moveTo(x, b.y);
        for (var k = 1; k <= 12; k += 1) c.lineTo(x + Math.sin(k * 0.9 + i * 1.3) * b.w * 0.012, b.y + b.h * k / 12);
        c.stroke();
      }
      /* soft top light on the wood */
      var tl = c.createLinearGradient(0, b.y, 0, b.y + b.h * 0.5);
      tl.addColorStop(0, 'rgba(255,255,255,0.18)'); tl.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = tl; c.fillRect(b.x, b.y, b.w, b.h * 0.5);
      c.restore();
      c.strokeStyle = 'rgba(120,70,30,0.25)'; c.lineWidth = 1.2; shape(); c.stroke();
      /* sound hole ring */
      c.strokeStyle = mix(WOOD1, [0, 0, 0], 0.25); c.lineWidth = 2;
      c.beginPath(); c.arc(hole.x, hole.y, hole.r * 1.12, 0, TAU); c.stroke();
    }

    function layout(w0, h0, box) {
      W = w0; H = h0;
      var bw = Math.max(200, Math.min(box.w * 0.9, H * 0.62, 520)), bh = Math.min(H * 0.8, bw * 1.3);
      B = { x: box.x + (box.w - bw) / 2, y: H * 0.5 - bh / 2, w: bw, h: bh, cx: box.x + box.w / 2 };
      sk = bw / 324;
      bridge = B.y + bh * 0.15;
      gap = bw * 0.09; tw = gap * 0.62;
      var old = tines;
      tines = [];
      for (var i = 0; i < ORDER.length; i += 1) {
        var off = i - (ORDER.length - 1) / 2, x = B.cx + off * gap;
        var g = null;
        tines.push({ x: x, len: bh * (0.56 - 0.04 * Math.abs(off)), note: ORDER[i], amp: old[i] ? old[i].amp : 0, t0: old[i] ? old[i].t0 : -10, g: g });
      }
      hole = { x: B.cx, y: B.y + bh * 0.83, r: bw * 0.09 };
      boardSprite();
    }
    function tineGrad(c, t) {
      if (!t.g) {
        t.g = c.createLinearGradient(t.x - tw / 2, 0, t.x + tw / 2, 0);
        t.g.addColorStop(0, TINE1); t.g.addColorStop(0.4, TINE0); t.g.addColorStop(1, TINE2);
      }
      return t.g;
    }
    function byNote(note) { for (var i = 0; i < tines.length; i += 1) if (tines[i].note === note) return tines[i]; return tines[4]; }
    function slot(x) { return clamp(Math.round((x - tines[0].x) / gap), 0, tines.length - 1); }
    function onTine(i, x, y) {
      var t = tines[i];
      return Math.abs(x - t.x) < gap * 0.5 + 2 && y > bridge - 16 && y < bridge + t.len + 26;
    }

    function pluck(t, strength, user, quiet) {
      if (user && followHit(t.note)) win();
      t.amp = Math.max(t.amp * 0.5, 0) + (6 + 8 * strength) * sk; t.t0 = clock;
      Sfx.pluck(FREQ[t.note], 0.45 + 0.5 * strength, 0.3 + t.note * 0.06);
      if (user) { haptic(!quiet, 8 + Math.round(8 * strength)); n.plucks += 1; }
      buzz = Math.max(buzz, 0.25 + 0.2 * strength);
      holePulse = 1;
      if (notes.length < 40) {
        notes.push({ x: t.x + (Math.random() - 0.5) * tw, y: bridge + t.len - tw, vx: (Math.random() - 0.5) * 30, vy: -70 - Math.random() * 40,
          t0: clock, life: 1.0, r: tw * 0.42, hue: 20 + t.note * 36 });
      }
    }
    function win() {
      for (var i = 0; i < 12; i += 1) {
        notes.push({ x: hole.x + (Math.random() - 0.5) * hole.r, y: hole.y, vx: (Math.random() - 0.5) * 90 * sk, vy: (-110 - Math.random() * 90) * sk,
          t0: clock + i * 0.07, life: 1.8, r: tw * 0.85, hue: Math.random() * 360 });
      }
      for (var k = 0; k < 4; k += 1) flourish.push({ at: clock + 0.32 + k * 0.11, note: 5 + k });
      celebrate(null, null, null, { sound: false }); /* confetti + toast + haptic, no chime (it clashes with the arpeggio) */
      ringFX(hole.x, hole.y, hole.r, hole.r * 3.2, 'rgba(255,200,120,0.9)', 0.6);
    }

    function down(p) {
      var i = slot(p.x);
      ptr[p.id] = { x: p.x, y: p.y, t: p.t, last: onTine(i, p.x, p.y) ? i : -1 };
      if (ptr[p.id].last >= 0) pluck(tines[i], 0.6, true, false);
    }
    function move(p) {
      var q = ptr[p.id]; if (!q) return;
      var a = slot(q.x), b = slot(p.x), dt = Math.max(1, p.t - q.t), v = clamp(Math.abs(p.x - q.x) / dt * 1000 / 1500, 0, 1);
      if (a === b) {
        if (q.last !== b && onTine(b, p.x, p.y)) { pluck(tines[b], Math.max(v, 0.4), true, false); q.last = b; }
      } else {
        /* glissando: pluck every tine crossed since the last move, in order (fast swipes skip none) */
        var dir = b > a ? 1 : -1;
        for (var i = a + dir; dir > 0 ? i <= b : i >= b; i += dir) {
          var k = clamp((tines[i].x - q.x) / (p.x - q.x), 0, 1), y = q.y + (p.y - q.y) * k;
          if (i !== q.last && onTine(i, tines[i].x, y)) { pluck(tines[i], v, true, true); q.last = i; n.sweeps += 1; }
        }
      }
      if (!onTine(b, p.x, p.y)) q.last = -1;
      q.x = p.x; q.y = p.y; q.t = p.t;
    }
    function up(p) { delete ptr[p.id]; }

    function update(dt) {
      clock += dt;
      for (var i = 0; i < tines.length; i += 1) tines[i].amp *= Math.exp(-dt * 2.2);
      for (i = flourish.length - 1; i >= 0; i -= 1) {
        if (clock >= flourish[i].at) { var f = flourish.splice(i, 1)[0]; pluck(byNote(f.note), 0.35, false, true); }
      }
      for (i = notes.length - 1; i >= 0; i -= 1) {
        var nt = notes[i];
        if (clock - nt.t0 > nt.life) { notes.splice(i, 1); continue; }
        if (clock < nt.t0) continue;
        nt.x += nt.vx * dt; nt.y += nt.vy * dt;
        var dmp = Math.exp(-dt * 0.6); nt.vx *= dmp; nt.vy = nt.vy * dmp - 10 * dt;
      }
      holePulse *= Math.exp(-dt * 3);
      buzz *= Math.exp(-dt * 9);
    }

    function tinePath(c, t, dx, dy) {
      var shake = t.amp * Math.sin((clock - t.t0) * 90), y0 = bridge - 4, y1 = bridge + t.len, h2 = tw / 2;
      c.beginPath();
      for (var i = 0; i <= 8; i += 1) { var u = i / 8; c.lineTo(t.x + shake * u * u - h2 + dx, y0 + (y1 - y0) * u + dy); }
      c.arc(t.x + shake + dx, y1 + dy, h2, Math.PI, 0, true);
      for (i = 8; i >= 0; i -= 1) { var v = i / 8; c.lineTo(t.x + shake * v * v + h2 + dx, y0 + (y1 - y0) * v + dy); }
      c.closePath();
      return shake;
    }
    function soft(c, x, y, r, col, a) {
      if (a <= 0.003 || r < 0.5) return;
      var g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    function bar(c, y, hgt) {
      var x0 = tines[0].x - tw, x1 = tines[tines.length - 1].x + tw;
      var g = c.createLinearGradient(0, y, 0, y + hgt);
      g.addColorStop(0, TINE0); g.addColorStop(1, TINE2);
      c.fillStyle = 'rgba(60,40,20,0.22)'; rrect(c, x0 + 1, y + 3, x1 - x0, hgt, 4); c.fill();
      c.fillStyle = g; rrect(c, x0, y, x1 - x0, hgt, 4); c.fill();
    }
    function noteGlyph(c, x, y, r, col) {
      c.fillStyle = col; c.strokeStyle = col; c.lineWidth = r * 0.32; c.lineCap = 'round';
      c.save(); c.translate(x, y); c.rotate(-0.35); c.beginPath(); c.ellipse(0, 0, r * 1.1, r * 0.8, 0, 0, TAU); c.fill(); c.restore();
      c.beginPath(); c.moveTo(x + r * 0.95, y - r * 0.2); c.lineTo(x + r * 0.95, y - r * 3.2); c.lineTo(x + r * 2, y - r * 2.4); c.stroke();
    }

    function draw(c) {
      if (!board) return;
      var d = G.dpr, i, t;
      c.drawImage(board.cv, B.x - board.m, B.y - board.m, board.cv.width / d, board.cv.height / d);
      /* sound hole (breathes with each pluck) */
      var hr = hole.r * (1 + 0.06 * holePulse), hg = c.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, hr);
      hg.addColorStop(0, '#1A110A'); hg.addColorStop(1, mix(WOOD1, [0, 0, 0], 0.5));
      c.fillStyle = hg; c.beginPath(); c.arc(hole.x, hole.y, hr, 0, TAU); c.fill();
      bar(c, bridge - 6, 10);
      /* tines: shadow, metal, flash */
      for (i = 0; i < tines.length; i += 1) {
        t = tines[i];
        tinePath(c, t, 2, 4); c.fillStyle = 'rgba(70,40,15,0.2)'; c.fill();
        tinePath(c, t, 0, 0); c.fillStyle = tineGrad(c, t); c.fill();
        c.strokeStyle = 'rgba(90,96,104,0.35)'; c.lineWidth = 0.8; c.stroke();
        var gl = clamp(t.amp / (12 * sk), 0, 1);
        if (gl > 0.02) { c.fillStyle = 'rgba(255,255,255,' + (0.45 * gl).toFixed(3) + ')'; c.fill(); }
        var shake = t.amp * Math.sin((clock - t.t0) * 90);
        c.fillStyle = TINE2; c.beginPath(); c.arc(t.x + shake * 0.85, bridge + t.len - tw * 0.9, tw * 0.13, 0, TAU); c.fill();
      }
      /* the next note of the tune glows */
      var nx = nextNote(), gw = glow();
      if (nx != null && gw > 0.01) {
        t = byNote(nx);
        var tip = bridge + t.len - tw * 0.9;
        c.fillStyle = rgba(ACC, 0.12 * gw); rrect(c, t.x - tw * 1.25, bridge - 5, tw * 2.5, t.len + 16, tw * 1.25); c.fill();
        c.fillStyle = rgba(ACC, 0.2 * gw); rrect(c, t.x - tw * 0.85, bridge - 2, tw * 1.7, t.len + 10, tw); c.fill();
        c.fillStyle = rgba(ACC, 0.28 * gw); rrect(c, t.x - tw * 0.42, bridge + 4, tw * 0.84, t.len - 2, tw * 0.42); c.fill();
        soft(c, t.x, tip, tw * (1.9 + 0.5 * gw), ACC, 0.65 * gw);
        c.fillStyle = rgba(ACC, 0.6 + 0.4 * gw); c.beginPath(); c.arc(t.x, tip, tw * 0.36, 0, TAU); c.fill();
      }
      /* tune finished: a golden ripple from the centre outwards, the hole lights up */
      var r = (clock - F.doneAt) / REST;
      if (r >= 0 && r < 1) {
        for (i = 0; i < tines.length; i += 1) {
          t = tines[i];
          var order = Math.abs(t.x - B.cx) / (B.w * 0.4), k = clamp(1 - Math.abs(r * 2.2 - order * 0.6) * 2.5, 0, 1);
          if (k <= 0) continue;
          c.fillStyle = rgba(ACC, 0.4 * k); rrect(c, t.x - tw * 0.8, bridge - 6, tw * 1.6, t.len + 10, tw); c.fill();
        }
        soft(c, hole.x, hole.y, hole.r * 1.9, ACC, 0.45 * (1 - r));
      }
      bar(c, bridge + B.h * 0.06, 8);
      /* rising notes */
      for (i = 0; i < notes.length; i += 1) {
        var nt = notes[i], age = clock - nt.t0;
        if (age < 0) continue;
        var a = clamp(1 - age / nt.life, 0, 1) * clamp(age * 6, 0, 1);
        noteGlyph(c, nt.x, nt.y, nt.r, 'hsla(' + Math.round(nt.hue) + ',' + (nt.life > 1.5 ? '90%,70%,' : '75%,52%,') + a.toFixed(3) + ')');
      }
      c.lineCap = 'butt';
    }

    return {
      layout: layout, down: down, move: move, up: up, update: update, draw: draw,
      hint: function () {
        var nx = nextNote(), t = byNote(nx == null ? 0 : nx);
        return t ? { x: t.x, y: bridge + t.len - tw * 0.9 } : null;
      },
      debug: function () {
        return { plucks: n.plucks, sweeps: n.sweeps, right: n.right, tune: F.tune, pos: F.pos, done: F.done, next: nextNote(), resting: resting(),
          tines: tines.length, gap: Math.round(gap) };
      },
      destroy: function () { ptr = {}; notes = []; flourish = []; board = null; }
    };
  }

  GAMES['kalimba'] = {
    name: { ko: '칼림바', ja: 'カリンバ', en: 'Kalimba' },
    tip: { ko: '빛나는 건반을 따라 톡톡', ja: '光る鍵盤をはじいてみて', en: 'Pluck the glowing keys' },
    bg: 'linear-gradient(180deg,#F4EBDD 0%,#E6D6BE 100%) #F4EBDD',
    tone: 'light',
    top: '#F4EBDD',
    accent: '#E2B98A',
    make: Kalimba
  };
})();
