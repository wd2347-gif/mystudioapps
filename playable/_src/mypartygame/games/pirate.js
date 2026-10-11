/* 해적 룰렛 (pirate): the app's pirate.dart barrel in 2.5D (two rows of eight slots around the front, staves, three grey hoops),
   the pirate's head peeking out of the top and glancing at each new sword. Tap an empty slot: a sword slides in (thud + tick),
   the barrel jiggles and the turn passes to the next name. One hidden slot launches the pirate spinning high (boing + confetti),
   he drops back dizzy, the pill names whoever launched him, and a new round starts by itself (or on the next tap). */
(function () {
  'use strict';
  var TAU = Math.PI * 2, PI = Math.PI;
  var T = {
    ko: { turn: '{0} 차례', hint: '빈 구멍을 눌러 칼을 꽂아요', left: '남은 구멍 {0}', res: '{0}!', lose: '해적을 날렸어요! 벌칙 당첨' },
    ja: { turn: '{0}の番', hint: '空いた穴をタップして剣を刺そう', left: '残りの穴 {0}', res: '{0}！', lose: '海賊を飛ばした！罰ゲーム' },
    en: { turn: '{0}’s turn', hint: 'Tap an empty slot to stab', left: 'Slots left: {0}', res: '{0}!', lose: 'Launched the pirate! Forfeit time' }
  };
  var RING = 8, NS = RING * 2, TILT = 0.26, SKY = 0.30, SPAN = 1.02 + SKY, FLY = 1.9;
  var GOLD = '#FFC94A', RED = '#E5484D', SKIN = '#FFD6B3', INK = '#1E1A18';
  var PHIS = [], ORDER = [], i;
  for (i = 0; i < RING; i++) PHIS.push((-70 + i * 20) * PI / 180);
  for (i = 0; i < NS; i++) ORDER.push(i);
  // side swords first, front ones last (front hilts overlap)
  ORDER.sort(function (a, b) { return (Math.cos(PHIS[a % RING]) - Math.cos(PHIS[b % RING])) || a - b; });

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function rrect(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function line(g, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function dot(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }

  // barrel shape inside a square of side s (pirate.dart _Geo)
  function Geo(s) {
    this.s = s; this.cx = s * 0.5; this.top = s * 0.42; this.bottom = s * 0.92;
    this.mid = (this.top + this.bottom) / 2; this.half = (this.bottom - this.top) / 2;
    this.rEnd = s * 0.28; this.rMid = s * 0.325; this.hr = s * 0.13; this.hy = this.top - s * 0.012;
  }
  Geo.prototype.r = function (y) { var k = clamp((y - this.mid) / this.half, -1, 1); return this.rEnd + (this.rMid - this.rEnd) * (1 - k * k); };
  Geo.prototype.surf = function (y, phi) { var rr = this.r(y); return [this.cx + rr * Math.sin(phi), y + rr * TILT * Math.cos(phi)]; };
  Geo.prototype.slot = function (i) { return this.surf(this.top + (this.bottom - this.top) * (i < RING ? 0.3 : 0.67), PHIS[i % RING]); };
  Geo.prototype.body = function () {
    var p = new Path2D(), n = 22, k, y, o, top = this.top, bot = this.bottom;
    p.moveTo(this.cx - this.r(top), top);
    for (k = 1; k <= n; k++) { y = top + (bot - top) * k / n; p.lineTo(this.cx - this.r(y), y); }
    for (k = 1; k <= n; k++) { o = this.surf(bot, -PI / 2 + PI * k / n); p.lineTo(o[0], o[1]); }
    for (k = n - 1; k >= 0; k--) { y = top + (bot - top) * k / n; p.lineTo(this.cx + this.r(y), y); }
    for (k = n - 1; k >= 1; k--) { o = this.surf(top, -PI / 2 + PI * k / n); p.lineTo(o[0], o[1]); }
    p.closePath();
    return p;
  };
  Geo.prototype.ring = function (g, y, dy) {
    g.beginPath();
    for (var k = 0; k <= 24; k++) { var o = this.surf(y, -PI / 2 + PI * k / 24); if (k) g.lineTo(o[0], o[1] + dy); else g.moveTo(o[0], o[1] + dy); }
  };

  function paintBarrel(g, G, body) {
    var s = G.s, k, gr = g.createLinearGradient(G.cx - G.rMid, 0, G.cx + G.rMid, 0);
    gr.addColorStop(0, '#8A5226'); gr.addColorStop(0.25, '#C07A3C'); gr.addColorStop(0.45, '#DC9A55');
    gr.addColorStop(0.72, '#C07A3C'); gr.addColorStop(1, '#7E4A21');
    g.fillStyle = gr; g.fill(body);
    g.save(); g.clip(body);
    // staves
    g.strokeStyle = 'rgba(0,0,0,.275)'; g.lineWidth = s * 0.006;
    for (k = -3; k <= 3; k++) {
      g.beginPath();
      for (var j = 0; j <= 16; j++) { var o = G.surf(G.top + (G.bottom - G.top) * j / 16, k * 0.45); if (j) g.lineTo(o[0], o[1]); else g.moveTo(o[0], o[1]); }
      g.stroke();
    }
    // a few grain lines
    g.strokeStyle = 'rgba(0,0,0,.133)'; g.lineWidth = s * 0.004; g.lineCap = 'round';
    for (k = 0; k < 5; k++) {
      var phi = -1.1 + k * 0.52, y = G.top + (G.bottom - G.top) * (0.15 + 0.17 * (k % 3));
      var a = G.surf(y, phi), b = G.surf(y + s * 0.05, phi + 0.04);
      line(g, a[0], a[1], b[0], b[1]);
    }
    g.restore();
    // three iron hoops with rivets
    g.lineCap = 'round';
    [0.07, 0.485, 0.93].forEach(function (f) {
      var y = G.top + (G.bottom - G.top) * f;
      G.ring(g, y, 0); g.strokeStyle = '#4E5964'; g.lineWidth = s * 0.03; g.stroke();
      G.ring(g, y, -s * 0.007); g.strokeStyle = 'rgba(199,208,216,.55)'; g.lineWidth = s * 0.006; g.stroke();
      g.fillStyle = '#D5DCE2';
      [-1, 0, 1].forEach(function (phi) { var o = G.surf(y, phi); dot(g, o[0], o[1], s * 0.007); });
    });
  }

  // pirate head (+ striped shirt) at 0,0; mood 0 calm, 1 nervous, 2 flying, 3 dizzy (pirate.dart _paintPirate)
  function paintPirate(g, hr, lookX, lookY, mood, blink, spin) {
    g.save();
    rrect(g, -hr * 0.775, hr * 0.8, hr * 1.55, hr * 1.6, hr * 0.5);
    g.clip(); g.fillStyle = '#FFFFFF'; g.fillRect(-hr, hr * 0.8, hr * 2, hr * 1.6);
    g.fillStyle = RED;
    for (var i = 0; i < 5; i++) g.fillRect(-hr, hr * (0.85 + i * 0.34), hr * 2, hr * 0.16);
    g.restore();
    g.fillStyle = '#F5C49C'; dot(g, -hr * 0.96, hr * 0.1, hr * 0.2); dot(g, hr * 0.96, hr * 0.1, hr * 0.2);
    g.fillStyle = SKIN; dot(g, 0, 0, hr);
    // bandana with white dots
    var band = new Path2D();
    band.moveTo(-hr, -hr * 0.12);
    band.arc(0, 0, hr * 1.04, PI * 1.03, PI * 1.97);
    band.quadraticCurveTo(0, -hr * 0.34, -hr, -hr * 0.12);
    band.closePath();
    g.fillStyle = RED; g.fill(band);
    g.save(); g.clip(band); g.fillStyle = '#FFFFFF';
    [[-0.55, -0.55], [-0.1, -0.78], [0.4, -0.6], [0.75, -0.3], [-0.85, -0.25], [0.05, -0.42]].forEach(function (d) { dot(g, d[0] * hr, d[1] * hr, hr * 0.075); });
    g.restore();
    // knot and tails
    var kx = hr * 0.98, ky = -hr * 0.3;
    g.fillStyle = '#C8363B'; dot(g, kx, ky, hr * 0.15);
    g.beginPath();
    g.moveTo(kx, ky); g.lineTo(kx + hr * 0.5, ky + hr * 0.2); g.lineTo(kx + hr * 0.36, ky + hr * 0.42); g.closePath();
    g.moveTo(kx, ky); g.lineTo(kx + hr * 0.18, ky + hr * 0.56); g.lineTo(kx - hr * 0.06, ky + hr * 0.5); g.closePath();
    g.fill();
    // cheeks
    g.fillStyle = 'rgba(255,122,138,.33)'; dot(g, -hr * 0.58, hr * 0.3, hr * 0.14); dot(g, hr * 0.62, hr * 0.3, hr * 0.14);
    // eye patch and strap
    g.strokeStyle = INK; g.lineWidth = hr * 0.07; g.lineCap = 'round';
    line(g, -hr * 0.98, hr * 0.22, hr * 0.2, -hr * 0.3);
    g.fillStyle = INK; g.beginPath(); g.ellipse(-hr * 0.38, 0, hr * 0.21, hr * 0.18, 0, 0, TAU); g.fill();
    // right eye
    var ex = hr * 0.36, ey = -hr * 0.02;
    if (mood === 3) {
      g.strokeStyle = INK; g.lineWidth = hr * 0.05; g.beginPath();
      for (var k = 0; k <= 24; k++) {
        var a = spin + k * 0.5, rr = hr * 0.015 + hr * 0.0072 * k;
        if (k) g.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr); else g.moveTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
      }
      g.stroke();
    } else if (blink && mood !== 2) {
      g.strokeStyle = INK; g.lineWidth = hr * 0.06; line(g, ex - hr * 0.15, ey, ex + hr * 0.15, ey);
    } else {
      var er = mood === 2 ? hr * 0.23 : hr * 0.19, pr = mood === 2 ? hr * 0.07 : hr * 0.1;
      var px = ex + lookX * hr * 0.07, py = ey + lookY * hr * 0.06;
      g.fillStyle = '#FFFFFF'; dot(g, ex, ey, er);
      g.fillStyle = INK; dot(g, px, py, pr);
      g.fillStyle = '#FFFFFF'; dot(g, px - pr * 0.35, py - pr * 0.35, pr * 0.35);
    }
    // nose
    g.fillStyle = '#F2B087'; dot(g, hr * 0.02, hr * 0.2, hr * 0.12);
    // mouth
    if (mood === 2) {
      g.fillStyle = '#7A1F25'; g.beginPath(); g.ellipse(0, hr * 0.56, hr * 0.15, hr * 0.17, 0, 0, TAU); g.fill();
    } else {
      g.strokeStyle = '#7A1F25'; g.lineWidth = hr * 0.07; g.lineCap = 'round'; g.beginPath();
      if (mood === 1) {
        g.moveTo(-hr * 0.2, hr * 0.56);
        for (var z = 1; z <= 4; z++) g.lineTo(-hr * 0.2 + hr * 0.1 * z, hr * 0.56 + (z % 2 ? -hr * 0.05 : 0));
      } else g.ellipse(0, hr * 0.5, hr * 0.2, hr * 0.12, 0, 0.2, PI - 0.2);
      g.stroke();
    }
    // moustache
    g.fillStyle = '#3A2A20';
    [-1, 1].forEach(function (sg) {
      g.save(); g.translate(sg * hr * 0.2, hr * 0.38); g.rotate(sg * -0.28);
      g.beginPath(); g.ellipse(0, 0, hr * 0.22, hr * 0.085, 0, 0, TAU); g.fill(); g.restore();
      dot(g, sg * hr * 0.44, hr * 0.26, hr * 0.06);
    });
    // sweat drop
    if (mood === 1) {
      var dx = -hr * 0.82, dy = -hr * 0.05;
      g.fillStyle = '#7CC8FF'; g.beginPath(); g.moveTo(dx, dy - hr * 0.2);
      g.quadraticCurveTo(dx + hr * 0.12, dy, dx, dy + hr * 0.06); g.quadraticCurveTo(dx - hr * 0.12, dy, dx, dy - hr * 0.2); g.fill();
    }
  }

  function star(g, x, y, r) {
    g.beginPath();
    for (var k = 0; k < 10; k++) { var a = -PI / 2 + k * PI / 5, rr = k % 2 ? r * 0.45 : r; if (k) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }

  GAMES['pirate'] = {
    name: { ko: '해적 룰렛', ja: '海賊ルーレット', en: 'Pirate Barrel' },
    tip: { ko: '칼을 꽂다가 해적이 튀어나오면 꽝', ja: '剣を刺して海賊が飛んだら負け', en: 'Stab the barrel, don’t launch the pirate' },
    cat: 'bet', who: '2+', accent: '#D9363E',
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx, names = ctx.names, N = names.length, SLOTS = ctx.SLOTS, dpr = ctx.dpr;
      var root = ctx.el;
      root.innerHTML = '<div class="top"><div class="pill"></div></div><div class="ft" aria-live="polite"></div>';
      var pill = root.querySelector('.pill'), ft = root.querySelector('.ft');
      var c = ctx.canvas(root), g = c.g;
      root.insertBefore(c.cv, root.firstChild);
      var bc = document.createElement('canvas'), bb = [0, 0, 1, 1];
      var W = 0, H = 0, G = null, ox = 0, oy = 0, SL = [], body = null, pillH = 0;
      var swords = [], trig = 0, turn = 0, last = -1, launcher = -1, phase = 'play', busy = false, armed = false, seq = 0;
      var clock = 0, stabAt = -9, jigAt = -9, launchAt = -9, launches = 0, stabs = 0;

      function filled() { var n = 0; for (var k = 0; k < NS; k++) if (swords[k] != null) n++; return n; }
      function setPill(text, col, big) {
        pill.textContent = text;
        pill.style.background = col; pill.style.color = ctx.inkOn(col);
        pill.style.boxShadow = '0 5px 14px ' + ctx.rgba(col, 0.35);
        pill.classList.toggle('big', !!big);
        pill.classList.remove('in', 'gone'); void pill.offsetWidth; pill.classList.add('in');
      }
      function setFoot() {
        if (phase === 'play') { ft.classList.remove('res'); ft.textContent = t.hint + ' · ' + ctx.fmt(t.left, NS - filled()); }
        else { ft.classList.add('res'); ft.textContent = t.lose; }
      }
      function newRound(quiet) {
        seq++;
        for (var k = 0; k < NS; k++) swords[k] = null;
        trig = ctx.rnd(NS); last = -1; launcher = -1; phase = 'play'; armed = false; launchAt = -9;
        busy = true;
        var my = seq;
        ctx.later(function () { if (my === seq) busy = false; }, 320);
        setPill(ctx.fmt(t.turn, names[turn]), SLOTS[turn % SLOTS.length]);
        setFoot();
        if (!quiet) { S.swipe(); jigAt = clock; }
        ctx.wake();
      }
      function stab(k) {
        var my = seq;
        S.thud(); ctx.buzz(16);
        swords[k] = turn; last = k; busy = true; stabs++;
        stabAt = clock; jigAt = clock;
        setFoot(); ctx.wake();
        if (k === trig) { ctx.later(function () { if (my === seq) launch(); }, 170); return; }
        // phew: the turn passes, with a tick that grows as the slots run out
        var danger = clamp(filled() / (NS - 1), 0, 1);
        ctx.later(function () {
          if (my !== seq) return;
          S.tone(1500 + 700 * danger, 0.03, 'square', 0.035 + 0.06 * danger);
          ctx.buzz(Math.round(8 + 20 * danger));
          turn = (turn + 1) % N; busy = false;
          setPill(ctx.fmt(t.turn, names[turn]), SLOTS[turn % SLOTS.length]);
        }, 240);
      }
      function launch() {
        var my = seq;
        phase = 'fly'; launcher = turn; launchAt = clock; launches++;
        S.boing(); ctx.buzz([40, 40, 30, 50, 20]);
        pill.classList.add('gone');
        ctx.burst(ox + G.cx, oy + G.top, 80, { speed: 820 });
        ctx.later(function () { if (my === seq) { S.pop(0.35); ctx.buzz(22); } }, 875);
        ctx.later(function () {
          if (my !== seq) return;
          setPill(ctx.fmt(t.res, names[launcher]), SLOTS[launcher % SLOTS.length], true);
          setFoot();
        }, 950);
        ctx.later(function () { if (my === seq) { S.pop(0.15); ctx.buzz(12); } }, 1255);
        ctx.later(function () {
          if (my !== seq) return;
          phase = 'result'; S.stamp(); ctx.buzz(30); setFoot();
          ctx.later(function () { if (my === seq) S.lose(); }, 200);
          ctx.later(function () { if (my === seq) armed = true; }, 450);
          ctx.later(function () { if (my === seq) { turn = (launcher + 1) % N; newRound(); } }, 1900);
        }, 1950);
        ctx.wake();
      }
      function onDown(e) {
        if (phase === 'result') { if (armed) { turn = (launcher + 1) % N; newRound(); } return; }
        if (phase !== 'play' || busy || !G) return;
        var p = ctx.local(e), qx = p.x - ox, qy = p.y - oy, best = -1, bd = G.s * 0.1;
        for (var k = 0; k < NS; k++) {
          var d = Math.hypot(SL[k][0] - qx, SL[k][1] - qy);
          if (d < bd) { bd = d; best = k; }
        }
        if (best < 0) return;
        if (swords[best] != null) { S.tick(); ctx.buzz(8); return; }
        stab(best);
      }

      function renderBarrel() {
        var s = G.s, x0 = G.cx - G.rMid - s * 0.03, y0 = G.top - s * 0.04;
        var w = G.rMid * 2 + s * 0.06, h = G.bottom - G.top + G.rEnd * TILT + s * 0.08;
        bc.width = Math.ceil(w * dpr); bc.height = Math.ceil(h * dpr);
        var bg = bc.getContext('2d');
        bg.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
        paintBarrel(bg, G, body);
        bb = [x0, y0, bc.width / dpr, bc.height / dpr];
      }
      function resize() {
        W = root.clientWidth; H = root.clientHeight; pillH = root.querySelector('.top').offsetHeight;
        c.fit(W, H);
        var bw = ctx.box().w, hreg = Math.max(80, H - ft.offsetHeight);
        var s = Math.max(90, Math.min(bw / 0.94, hreg / SPAN, 520));
        var extra = Math.max(0, hreg - s * SPAN);
        ox = (W - s) / 2; oy = s * SKY + extra * 0.65;
        G = new Geo(s); body = G.body(); SL = [];
        for (var k = 0; k < NS; k++) SL.push(G.slot(k));
        renderBarrel(); draw();
      }

      function paintSword(k, col, out, glow) {
        var s = G.s, o = SL[k], phi = PHIS[k % RING], dx = Math.sin(phi), dy = 0.42 * Math.cos(phi);
        var gx = o[0] + dx * s * 0.16 * out, gy = o[1] + dy * s * 0.16 * out, len = s * 0.115;
        g.lineCap = 'round';
        if (out > 0.01) {
          g.strokeStyle = '#DDE3EA'; g.lineWidth = s * 0.022; line(g, o[0], o[1], gx, gy);
          g.strokeStyle = '#FFFFFF'; g.lineWidth = s * 0.006; line(g, o[0], o[1], gx, gy);
        }
        if (glow) {
          var gr = g.createRadialGradient(gx, gy, 0, gx, gy, s * 0.08);
          gr.addColorStop(0, 'rgba(255,224,102,.75)'); gr.addColorStop(1, 'rgba(255,224,102,0)');
          g.fillStyle = gr; dot(g, gx, gy, s * 0.08);
        }
        var ex = gx + dx * len * 0.8, ey = gy + dy * len * 0.8;
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = s * 0.03; line(g, gx, gy + s * 0.008, ex, ey + s * 0.008);
        g.strokeStyle = col; g.lineWidth = s * 0.034; line(g, gx, gy, ex, ey);
        g.lineCap = 'butt'; g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = s * 0.004;
        for (var j = 1; j <= 3; j++) {
          var mx = gx + dx * len * 0.8 * j / 4, my = gy + dy * len * 0.8 * j / 4;
          line(g, mx, my - s * 0.012, mx + (Math.abs(dx) < 0.3 ? s * 0.01 : 0), my + s * 0.012);
        }
        g.fillStyle = GOLD; rrect(g, gx - s * 0.01, gy - s * 0.04, s * 0.02, s * 0.08, s * 0.01); g.fill();
        g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = s * 0.004;
        line(g, gx - s * 0.003, gy - s * 0.03, gx - s * 0.003, gy + s * 0.03);
        var qx = gx + dx * len * 0.95, qy = gy + dy * len * 0.95;
        g.fillStyle = GOLD; dot(g, qx, qy, s * 0.024);
        g.fillStyle = 'rgba(255,255,255,.8)'; dot(g, qx - s * 0.006, qy - s * 0.006, s * 0.007);
      }

      function draw() {
        if (!G) return;
        var dark = ctx.dark, s = G.s, ti = (clock / 3.2) % 1, k;
        var f = launchAt >= 0 ? clamp((clock - launchAt) / FLY, 0, 1) : 0;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        // drifting clouds
        var cloud = dark ? '#2A3036' : '#FFFFFF', shade = dark ? '#1E2327' : '#E6E8E3';
        for (k = 0; k < 3; k++) {
          var bx = W * (0.18 + 0.32 * k) + Math.sin((ti + k * 0.33) * TAU) * s * 0.025;
          var by = Math.max(pillH + s * 0.06, oy + s * (0.1 + 0.07 * (k % 2))) - (k === 1 ? s * 0.05 : 0);
          var cr = s * (k === 1 ? 0.06 : 0.05);
          [[-cr * 1.1, cr * 0.25, cr * 0.75], [0, 0, cr], [cr * 1.1, cr * 0.3, cr * 0.7]].forEach(function (q) {
            g.fillStyle = shade; dot(g, bx + q[0], by + q[1] + cr * 0.12, q[2]);
            g.fillStyle = cloud; dot(g, bx + q[0], by + q[1], q[2]);
          });
        }
        g.save(); g.translate(ox, oy);
        // sea pond, waves and the barrel's shadow
        g.fillStyle = dark ? 'rgba(29,74,107,.9)' : 'rgba(191,230,255,.9)';
        g.beginPath(); g.ellipse(G.cx, G.bottom + s * 0.035, s * 0.46, s * 0.065, 0, 0, TAU); g.fill();
        g.strokeStyle = dark ? 'rgba(62,127,174,.8)' : 'rgba(255,255,255,.8)'; g.lineWidth = s * 0.006; g.lineCap = 'round';
        for (k = 0; k < 4; k++) {
          var wx = G.cx + (k - 1.5) * s * 0.24 + Math.sin((ti + k * 0.3) * TAU) * s * 0.012, wy = G.bottom + s * (0.05 + (k % 2 ? -0.01 : 0.015));
          g.beginPath(); g.ellipse(wx, wy, s * 0.035, s * 0.015, 0, PI * 1.1, PI * 1.9); g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(G.cx, G.bottom + s * 0.04, G.rEnd * 1.15, s * 0.035, 0, 0, TAU); g.fill();

        // jiggle (squash around the bottom centre), and a kick as the pirate shoots out
        var j = (clock - jigAt) / 0.56, wob = j <= 0 || j >= 1 ? 0 : Math.sin(j * PI * 6) * (1 - j);
        var kick = f > 0 && f < 0.12 ? Math.sin(f / 0.12 * PI) : 0;
        g.save(); g.translate(G.cx, G.bottom);
        g.scale(1 + 0.035 * wob - 0.04 * kick, 1 - 0.03 * wob + 0.05 * kick); g.rotate(0.025 * wob);
        g.translate(-G.cx, -G.bottom);
        // rim back: the dark inside of the barrel
        g.fillStyle = '#B27238'; g.beginPath(); g.ellipse(G.cx, G.top, G.rEnd, G.rEnd * TILT, 0, 0, TAU); g.fill();
        g.fillStyle = '#341E0F'; g.beginPath(); g.ellipse(G.cx, G.top, G.rEnd * 0.9, G.rEnd * TILT * 0.875, 0, 0, TAU); g.fill();

        // the pirate: breathing, glancing at the last sword; when launched he spins up and drops back
        var up = 0, rot = 0, hH = s * 0.42, u;
        if (f > 0) {
          if (f < 0.46) { u = f / 0.46; up = hH * 4 * u * (1 - u); rot = 4 * PI * easeInOut(u); }
          else if (f < 0.66) { u = (f - 0.46) / 0.2; up = hH * 0.22 * 4 * u * (1 - u); rot = 0.3 * Math.sin(u * PI); }
          else if (f < 0.78) { u = (f - 0.66) / 0.12; up = hH * 0.06 * 4 * u * (1 - u); }
        }
        var nf = filled(), lookX = Math.sin(ti * TAU) * 0.6, lookY = 0.3;
        if (last >= 0) { lookX = Math.sin(PHIS[last % RING]) * 1.2; lookY = last < RING ? 0.7 : 1.0; }
        var mood = f > 0 && f < 0.5 ? 2 : f >= 0.5 ? 3 : nf >= 7 ? 1 : 0;
        var shiver = f === 0 && nf >= 10 ? Math.sin(clock * TAU * 14) * s * 0.002 * (nf - 9) : 0;
        g.save(); g.translate(G.cx + shiver, G.hy + Math.sin(ti * TAU * 2) * s * 0.004 - up); g.rotate(rot);
        paintPirate(g, G.hr, lookX, lookY, mood, (ti * 3) % 1 < 0.04, clock * 9.4);
        g.restore();

        g.drawImage(bc, bb[0], bb[1], bb[2], bb[3]);
        // slots (empty ones glow in the colour of whoever's turn it is)
        var glow = phase === 'play' && !busy ? SLOTS[turn % SLOTS.length] : null, pulse = 0.5 + 0.5 * Math.sin(ti * TAU * 3);
        for (k = 0; k < NS; k++) {
          var o = SL[k], sw = s * (0.012 + 0.02 * Math.cos(PHIS[k % RING])), sh = s * 0.074;
          if (glow && swords[k] == null) {
            var inf = s * (0.005 + 0.004 * pulse);
            g.fillStyle = ctx.rgba(glow, (0.18 + 0.3 * pulse).toFixed(3));
            rrect(g, o[0] - sw / 2 - inf, o[1] - sh / 2 - inf, sw + inf * 2, sh + inf * 2, sw / 2 + inf); g.fill();
          }
          g.fillStyle = '#26140A'; rrect(g, o[0] - sw / 2, o[1] - sh / 2, sw, sh, sw / 2); g.fill();
          g.strokeStyle = 'rgba(255,226,184,.33)'; g.lineWidth = s * 0.004; g.lineCap = 'round';
          line(g, o[0] - sw * 0.3, o[1] + sh / 2 + s * 0.004, o[0] + sw * 0.3, o[1] + sh / 2 + s * 0.004);
        }
        var sv = easeOutCubic(clamp((clock - stabAt) / 0.17, 0, 1));
        for (var q = 0; q < NS; q++) {
          var idx = ORDER[q];
          if (swords[idx] == null) continue;
          paintSword(idx, SLOTS[swords[idx] % SLOTS.length], idx === last ? 1 - sv : 0, launcher >= 0 && idx === trig);
        }
        // rim front lip
        g.strokeStyle = '#E2A665'; g.lineWidth = s * 0.018; g.lineCap = 'butt';
        g.beginPath(); g.ellipse(G.cx, G.top, G.rEnd, G.rEnd * TILT, 0, 0, PI); g.stroke();
        g.restore();

        // dizzy stars
        if (mood === 3) {
          g.fillStyle = GOLD;
          for (k = 0; k < 3; k++) {
            var a = ti * TAU * 3 + k * TAU / 3;
            star(g, G.cx + Math.cos(a) * G.hr * 1.1, G.hy - G.hr * 1.15 + Math.sin(a) * G.hr * 0.25, G.hr * 0.16);
          }
        }
        g.restore();
      }

      ctx.on(root, 'pointerdown', onDown);
      for (var k0 = 0; k0 < NS; k0++) swords.push(null);
      newRound(true);
      // point at a front slot of the top row
      ctx.hint(function () { return G ? { x: ox + SL[3][0], y: oy + SL[3][1] } : null; });

      function frac(k) { return k < 0 || !G ? null : [+((ox + SL[k][0]) / W).toFixed(4), +((oy + SL[k][1]) / H).toFixed(4)]; }
      return {
        resize: resize,
        redraw: draw,
        frame: function (dt) { clock += dt; draw(); return true; },
        destroy: function () { seq++; },
        debug: function () {
          var safe = -1;
          for (var k = 0; k < NS; k++) if (swords[k] == null && k !== trig) { safe = k; break; }
          return { phase: phase, turn: names[turn], filled: filled(), stabs: stabs, launches: launches,
            launcher: launcher >= 0 ? names[launcher] : null, trig: frac(trig), safe: frac(safe) };
        }
      };
    }
  };
})();
