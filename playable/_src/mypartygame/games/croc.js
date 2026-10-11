/* 악어 이빨 (croc): the app's croc.dart crocodile seen from the front, mouth wide open (green skin, pink palate and tongue,
   fangs on the upper jaw, thirteen white lower teeth on a curve). Tap a tooth: it sinks with a click and a low hum, the jaw
   trembles a little more each time and the eyes follow your finger. One sore tooth snaps the upper jaw shut (chomp, shake,
   pink flash, gold burst lines), the pill names who got bitten, then the jaw swings open again for a new round by itself. */
(function () {
  'use strict';
  var TAU = Math.PI * 2, PI = Math.PI;
  var T = {
    ko: { turn: '{0} 차례', hint: '이빨을 하나 눌러요', left: '남은 이빨 {0}개', bit: '{0} 물렸어요!', forfeit: '벌칙 당첨!' },
    ja: { turn: '{0}の番', hint: '歯を1本押してね', left: '残りの歯 {0}本', bit: '{0}がかまれた！', forfeit: '罰ゲーム決定！' },
    en: { turn: '{0}’s turn', hint: 'Press a tooth', left: 'Teeth left: {0}', bit: '{0} got bitten!', forfeit: 'Forfeit time!' }
  };
  var NT = 13, A0 = 166 * PI / 180, A1 = 14 * PI / 180;
  var SKIN = '#45C46F', SKIN_D = '#2F9A55', SKIN_U = '#38A962', BELLY = '#CDEFC0', PALATE = '#F58BA0', FLOOR = '#F07892',
    TONGUE = '#FFA3B5', THROAT = '#8A2B3E', EDGE = '#D5DDE3', INK = '#1E2A22';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeIn(x) { return x * x * x; }
  function easeOutBack(x) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function dot(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function oval(g, x, y, w, h) { g.beginPath(); g.ellipse(x, y, w / 2, h / 2, 0, 0, TAU); g.fill(); }
  function line(g, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }

  // head shape inside a square of side s, hinge line at jy (croc.dart _Geo)
  function Geo(s) {
    this.s = s; this.cx = s * 0.5; this.jy = s * 0.5; this.rxO = s * 0.44; this.ryO = s * 0.3;
    this.rxI = s * 0.355; this.ryI = s * 0.225; this.tw = s * 0.062; this.th = s * 0.08;
    this.base = []; this.sc = []; this.order = [];
    for (var i = 0; i < NT; i++) {
      var a = A0 + (A1 - A0) * i / (NT - 1);
      this.base.push(this.rimI(a, 1)); this.sc.push(0.72 + 0.28 * Math.sin(a)); this.order.push(i);
    }
    var b = this.base;
    this.order.sort(function (p, q) { return b[p][1] - b[q][1] || p - q; });
  }
  Geo.prototype.rimI = function (a, k) { return [this.cx + this.rxI * Math.cos(a), this.jy + k * this.ryI * Math.sin(a)]; };
  Geo.prototype.rimO = function (a, k) { return [this.cx + this.rxO * Math.cos(a), this.jy + k * this.ryO * Math.sin(a)]; };
  Geo.prototype.center = function (i) { return [this.base[i][0], this.base[i][1] - this.th * this.sc[i] * 0.5]; };
  // half ellipse folded at the hinge by k (1 = lower jaw, negative = upper jaw opened up)
  Geo.prototype.half = function (g, outer, k) {
    var rx = outer ? this.rxO : this.rxI, ry = outer ? this.ryO : this.ryI;
    g.beginPath(); g.moveTo(this.cx - rx, this.jy);
    for (var j = 1; j <= 28; j++) { var a = PI - PI * j / 28; g.lineTo(this.cx + rx * Math.cos(a), this.jy + k * ry * Math.sin(a)); }
    g.closePath();
  };

  function tooth(g, bx, by, w, h, press, sore) {
    var hh = h * (1 - 0.58 * press), x = bx - w / 2, y = by - hh, H = hh + w * 0.12, rt = w * 0.46, rb = w * 0.12;
    function shape(dy) {
      g.beginPath(); g.moveTo(x, y + rt + dy); g.arcTo(x, y + dy, x + rt, y + dy, rt); g.arcTo(x + w, y + dy, x + w, y + rt + dy, rt);
      g.lineTo(x + w, y + H - rb + dy); g.arcTo(x + w, y + H + dy, x + w - rb, y + H + dy, rb); g.arcTo(x, y + H + dy, x, y + H - rb + dy, rb); g.closePath();
    }
    shape(w * 0.06); g.fillStyle = 'rgba(0,0,0,.2)'; g.fill();
    shape(0); g.fillStyle = sore ? '#FFE08A' : press > 0.5 ? '#EDE7DC' : '#FFFFFF'; g.fill();
    g.strokeStyle = EDGE; g.lineWidth = w * 0.06; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = w * 0.1; g.lineCap = 'round';
    line(g, bx - w * 0.18, by - hh + w * 0.3, bx - w * 0.18, by - hh + w * 0.3 + hh * 0.35);
    if (press > 0.05) { g.fillStyle = 'rgba(160,48,74,.33)'; oval(g, bx, by + w * 0.1, w * 1.25, w * 0.32); }
  }
  function fang(g, bx, by, w, h) {
    g.beginPath(); g.moveTo(bx - w / 2, by);
    g.quadraticCurveTo(bx - w * 0.3, by + h * 0.7, bx, by + h); g.quadraticCurveTo(bx + w * 0.3, by + h * 0.7, bx + w / 2, by); g.closePath();
    g.fillStyle = '#FFFFFF'; g.fill(); g.strokeStyle = EDGE; g.lineWidth = w * 0.07; g.stroke();
  }

  // one crocodile; k = how far the upper jaw is folded (-1 wide open, 0 flat, 1 shut) (croc.dart _paintCroc)
  function paintCroc(g, G, k, press, sore, lookX, lookY, happy, blink, nervous) {
    var s = G.s, cx = G.cx, jy = G.jy, i, sg;
    // front feet
    for (sg = -1; sg <= 1; sg += 2) {
      var fx = cx + sg * s * 0.36, fy = jy + s * 0.27;
      g.fillStyle = SKIN_D; oval(g, fx, fy, s * 0.2, s * 0.11);
      g.fillStyle = SKIN; oval(g, fx, fy - s * 0.008, s * 0.19, s * 0.095);
      for (var tt = -1; tt <= 1; tt++) dot(g, fx + sg * s * 0.07 + tt * s * 0.035, fy + s * 0.03 - Math.abs(tt) * s * 0.008, s * 0.022);
    }
    // back of the head behind the hinge
    g.fillStyle = '#4CCB76'; oval(g, cx, jy, G.rxO * 1.75, s * 0.26);
    // lower jaw: green outside with a pale belly band, pink floor inside
    var gr = g.createLinearGradient(0, jy, 0, jy + G.ryO);
    gr.addColorStop(0, SKIN); gr.addColorStop(1, SKIN_D);
    G.half(g, true, 1); g.fillStyle = gr; g.fill();
    g.save(); G.half(g, true, 1); g.clip(); g.fillStyle = BELLY; oval(g, cx, jy + G.ryO * 1.05, G.rxO * 1.5, G.ryO * 0.75); g.restore();
    G.half(g, false, 1); g.fillStyle = FLOOR; g.fill();
    g.fillStyle = '#FF9DB2';
    for (sg = -1; sg <= 1; sg += 2) oval(g, cx + sg * G.rxO * 0.84, jy + G.ryO * 0.58, s * 0.06, s * 0.03);
    // tongue
    var ty = jy + G.ryI * 0.5, tw = G.rxI * 0.95, th = G.ryI * 0.75;
    g.fillStyle = TONGUE; oval(g, cx, ty, tw, th);
    g.strokeStyle = 'rgba(194,64,94,.33)'; g.lineWidth = s * 0.006; g.lineCap = 'round';
    line(g, cx, ty - th / 2 + th * 0.18, cx, ty - th / 2 + th * 0.7);
    // lower teeth (hidden once the mouth is shut)
    if (k <= 0.4) {
      for (var q = 0; q < NT; q++) {
        i = G.order[q];
        tooth(g, G.base[i][0], G.base[i][1], G.tw * G.sc[i], G.th * G.sc[i], press[i], i === sore);
      }
    }
    // upper jaw
    var a, sc, p;
    if (k < 0) {
      // seen from below: green rim, pink palate with ridges, throat, fangs
      G.half(g, true, k); g.fillStyle = SKIN_U; g.fill();
      G.half(g, false, k); g.fillStyle = PALATE; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.27)'; g.lineWidth = s * 0.006;
      [0.45, 0.7].forEach(function (f) {
        g.beginPath();
        for (var j = 0; j <= 16; j++) {
          var aa = PI * 0.2 + PI * 0.6 * j / 16, x = cx + G.rxI * f * Math.cos(aa), y = jy + k * G.ryI * f * Math.sin(aa);
          if (j) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
      });
      g.fillStyle = THROAT; oval(g, cx, jy, G.rxI * 1.1, s * 0.07 * clamp(-k, 0, 1));
      for (i = 0; i < 11; i++) {
        a = PI * (160 - i * 14) / 180; sc = 0.72 + 0.28 * Math.sin(a); p = G.rimI(a, k);
        fang(g, p[0], p[1], G.tw * 0.8 * sc, G.th * 0.62 * sc);
      }
    } else {
      // seen from above: the snout with dots, nostrils and fangs over the lip
      var sn = g.createLinearGradient(0, jy, 0, jy + G.ryO * k + 1);
      sn.addColorStop(0, '#52CF7B'); sn.addColorStop(1, SKIN);
      G.half(g, true, k); g.fillStyle = sn; g.fill();
      g.fillStyle = 'rgba(47,154,85,.5)';
      [[-0.5, 0.35], [-0.2, 0.25], [0.15, 0.3], [0.45, 0.4], [-0.32, 0.6], [0.3, 0.62]].forEach(function (d) { dot(g, cx + d[0] * G.rxO, jy + d[1] * G.ryO * k, s * 0.016); });
      g.fillStyle = 'rgba(30,42,34,.75)';
      for (sg = -1; sg <= 1; sg += 2) oval(g, cx + sg * s * 0.05, jy + G.ryO * k * 0.84, s * 0.03, s * 0.02 * clamp(k, 0.2, 1));
      for (i = 0; i < 9; i++) {
        a = PI * (148 - i * 14.5) / 180; sc = 0.7 + 0.3 * Math.sin(a); p = G.rimO(a, k);
        fang(g, p[0], p[1], G.tw * 0.7 * sc, G.th * 0.45 * sc * clamp(k, 0, 1));
      }
    }
    // two eyes bulging on top of the head
    var ey = Math.min(jy - s * 0.075, jy + k * G.ryO - s * 0.04);
    for (sg = -1; sg <= 1; sg += 2) {
      var ex = cx + sg * s * 0.16, ecy = ey + s * 0.008;
      g.fillStyle = SKIN_D; dot(g, ex, ey + s * 0.008, s * 0.085);
      g.fillStyle = SKIN; dot(g, ex, ey, s * 0.083);
      g.strokeStyle = INK; g.lineCap = 'round';
      if (happy) {
        g.lineWidth = s * 0.012; g.beginPath(); g.ellipse(ex, ecy + s * 0.012, s * 0.035, s * 0.03, 0, PI * 1.1, PI * 1.9); g.stroke();
        continue;
      }
      if (blink) { g.lineWidth = s * 0.01; line(g, ex - s * 0.035, ecy, ex + s * 0.035, ecy); continue; }
      g.fillStyle = '#FFFFFF'; dot(g, ex, ecy, s * 0.058);
      var px = ex + lookX * s * 0.02, py = ecy + lookY * s * 0.018;
      g.fillStyle = INK; dot(g, px, py, s * 0.03);
      g.fillStyle = '#FFFFFF'; dot(g, px - s * 0.01, py - s * 0.01, s * 0.01);
      // eyelid (lifts when nervous)
      var lid = 0.5 - 0.35 * nervous;
      g.save(); g.beginPath(); g.rect(ex - s * 0.07, ecy - s * 0.07, s * 0.14, s * 0.012 + s * 0.116 * lid * 0.5); g.clip();
      g.fillStyle = SKIN; dot(g, ex, ecy, s * 0.062); g.restore();
    }
  }

  GAMES['croc'] = {
    name: { ko: '악어 이빨', ja: 'ワニの歯', en: 'Crocodile Teeth' },
    tip: { ko: '이빨을 누르다 콱 물리면 당첨', ja: '歯を押して噛まれたら当たり', en: 'Press a tooth, get chomped, you’re it' },
    cat: 'bet', who: '2+', accent: '#2FB36B',
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx, names = ctx.names, N = names.length, SLOTS = ctx.SLOTS, dpr = ctx.dpr;
      var root = ctx.el;
      root.innerHTML = '<div class="top"><div class="pill"></div></div><div class="ft" aria-live="polite"></div>';
      var topEl = root.querySelector('.top'), pill = root.querySelector('.pill'), ft = root.querySelector('.ft');
      var c = ctx.canvas(root), g = c.g;
      root.insertBefore(c.cv, root.firstChild);
      var W = 0, H = 0, G = null, ox = 0, oy = 0, CT = [];
      var pressedAt = [], press = [], bad = 0, turn = 0, last = -1, bitten = -1, phase = 'play', busy = false, armed = false, seq = 0;
      var clock = 0, snapAt = -9, openAt = -9, kFrom = 0.9, bites = 0, presses = 0;
      for (var z = 0; z < NT; z++) { pressedAt.push(null); press.push(0); }

      function count() { var n = 0; for (var k = 0; k < NT; k++) if (pressedAt[k] != null) n++; return n; }
      function setPill(text, col, big) {
        pill.textContent = text;
        pill.style.background = col; pill.style.color = ctx.inkOn(col);
        pill.style.boxShadow = '0 5px 14px ' + ctx.rgba(col, 0.35);
        pill.classList.toggle('big', !!big);
        pill.classList.remove('in'); void pill.offsetWidth; pill.classList.add('in');
      }
      function setFoot() {
        if (phase === 'play') { ft.classList.remove('res'); ft.textContent = t.hint + ' · ' + ctx.fmt(t.left, NT - count()); }
        else { ft.classList.add('res'); ft.textContent = t.forfeit; }
      }
      function newRound(quiet) {
        seq++;
        for (var k = 0; k < NT; k++) pressedAt[k] = null;
        bad = ctx.rnd(NT); last = -1; bitten = -1; phase = 'play'; armed = false; presses = 0;
        if (!quiet) { openAt = clock; S.whoosh(); S.tone(260, 0.18, 'triangle', 0.12, 420, 0.05); }
        snapAt = -9;
        busy = true;
        var my = seq;
        ctx.later(function () { if (my === seq) busy = false; }, quiet ? 200 : 520);
        setPill(ctx.fmt(t.turn, names[turn]), SLOTS[turn % SLOTS.length]);
        setFoot(); ctx.wake();
      }
      function hit(k) {
        var my = seq, n;
        pressedAt[k] = clock; last = k; busy = true; presses++;
        n = count();
        // the press: a click and a low hum that deepens as more teeth go down
        S.click(); S.tone(92 + 4 * n, 0.32, 'triangle', 0.09 + 0.012 * n, 78 + 4 * n);
        ctx.buzz(12 + 2 * n);
        setFoot(); ctx.wake();
        if (k === bad) { ctx.later(function () { if (my === seq) chomp(); }, 150); return; }
        if (NT - n <= 5) {
          // a soft drum roll when only a few teeth are left
          for (var r = 0; r < 5; r++) S.noise(0.05, 0.1 + 0.05 * (5 - (NT - n)), 900, 260, 'lowpass', 0, 0.12 + r * 0.055);
        }
        ctx.later(function () {
          if (my !== seq) return;
          turn = (turn + 1) % N; busy = false;
          setPill(ctx.fmt(t.turn, names[turn]), SLOTS[turn % SLOTS.length]);
        }, 230);
      }
      function chomp() {
        var my = seq;
        phase = 'bit'; bitten = turn; snapAt = clock; bites++;
        S.chomp(); ctx.buzz([60, 30, 50, 30, 30]);
        ctx.shake(); ctx.flash('#FFFFFF', '#FF8FA3');
        setPill(ctx.fmt(t.bit, names[bitten]), '#E5484D', true);
        setFoot();
        ctx.later(function () {
          if (my !== seq) return;
          phase = 'result'; S.stamp(); ctx.buzz(30);
          ctx.later(function () { if (my === seq) S.lose(); }, 200);
          ctx.later(function () { if (my === seq) armed = true; }, 300);
          ctx.later(function () { if (my === seq) again(); }, 1500);
        }, 1300);
        ctx.wake();
      }
      function again() { turn = (bitten + 1) % N; kFrom = currentK(); newRound(); }
      function onDown(e) {
        if (phase === 'result') { if (armed) again(); return; }
        if (phase !== 'play' || busy || !G) return;
        var p = ctx.local(e), qx = p.x - ox, qy = p.y - oy, best = -1, bd = G.s * 0.085;
        for (var k = 0; k < NT; k++) {
          var d = Math.hypot(CT[k][0] - qx, CT[k][1] - qy);
          if (d < bd) { bd = d; best = k; }
        }
        if (best < 0) return;
        if (pressedAt[best] != null) { S.tick(); ctx.buzz(8); return; }
        hit(best);
      }

      function resize() {
        W = root.clientWidth; H = root.clientHeight;
        c.fit(W, H);
        var bw = ctx.box().w, top = topEl.offsetHeight, hreg = Math.max(80, H - top - ft.offsetHeight);
        var side = Math.max(90, Math.min(bw, hreg, 560)), s = side / 0.98;
        ox = (W - s) / 2; oy = top + (hreg - s) / 2 + s * 0.01;
        G = new Geo(s); CT = [];
        for (var k = 0; k < NT; k++) CT.push(G.center(k));
        draw();
      }
      function currentK() {
        var kOpen = -1.05 + 0.022 * count(), v = snapAt >= 0 ? clamp((clock - snapAt) / 0.42, 0, 1) : 0;
        if (v > 0) {
          if (v < 0.22) return kOpen + (1.04 - kOpen) * easeIn(v / 0.22);
          var u = (v - 0.22) / 0.78;
          return 0.9 + 0.14 * Math.cos(u * 3 * PI) * (1 - u);
        }
        var o = (clock - openAt) / 0.55;
        if (o >= 0 && o < 1) return kFrom + (kOpen - kFrom) * easeOutBack(o);
        return kOpen + Math.sin(clock * TAU * 9) * (0.004 + 0.0045 * count());
      }

      function draw() {
        if (!G) return;
        var dark = ctx.dark, s = G.s, k, j;
        var v = snapAt >= 0 ? clamp((clock - snapAt) / 0.42, 0, 1) : 0;
        for (k = 0; k < NT; k++) press[k] = pressedAt[k] == null ? 0 : easeOutBack(clamp((clock - pressedAt[k]) / 0.09, 0, 1));
        var kk = currentK(), sx = 0, sy = 0;
        if (v > 0.18 && v < 1) { var amp = s * 0.03 * (1 - v); sx = Math.sin(v * 70) * amp; sy = Math.cos(v * 53) * amp; }
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        g.save(); g.translate(ox + sx, oy + sy);
        // pond with little waves
        var py = G.jy + s * 0.36;
        g.fillStyle = dark ? '#1D4A6B' : '#BFE6FF'; oval(g, G.cx, py, s * 0.98, s * 0.16);
        g.strokeStyle = dark ? 'rgba(62,127,174,.85)' : 'rgba(255,255,255,.85)'; g.lineWidth = s * 0.006; g.lineCap = 'round';
        for (j = 0; j < 4; j++) {
          var wx = G.cx + (j - 1.5) * s * 0.26 + Math.sin(clock * 1.5 + j) * s * 0.01;
          g.beginPath(); g.ellipse(wx, py + (j % 2 ? -s * 0.035 : s * 0.04), s * 0.04, s * 0.015, 0, PI * 1.1, PI * 1.9); g.stroke();
        }
        var lookX = Math.sin(clock * 0.9) * 0.6, lookY = 0.4;
        if (last >= 0) { lookX = clamp((G.base[last][0] - G.cx) / G.rxI, -1, 1); lookY = 1; }
        paintCroc(g, G, kk, press, bitten >= 0 ? bad : -1, lookX, lookY, v > 0.15, v === 0 && (clock % 3.7) < 0.12, clamp(count() / 10, 0, 1));
        // gold snap lines around the head
        if (v > 0.18 && v < 0.75) {
          var u = (v - 0.18) / 0.57, cy = G.jy + s * 0.08;
          g.strokeStyle = 'rgba(255,201,74,' + (1 - u).toFixed(3) + ')'; g.lineWidth = s * 0.014; g.lineCap = 'round';
          for (j = 0; j < 12; j++) {
            var a = j * PI / 6 + 0.2, dx = Math.cos(a), dy = Math.sin(a) * 0.75;
            line(g, G.cx + dx * s * (0.42 + 0.08 * u), cy + dy * s * (0.42 + 0.08 * u), G.cx + dx * s * (0.5 + 0.14 * u), cy + dy * s * (0.5 + 0.14 * u));
          }
        }
        g.restore();
      }

      ctx.on(root, 'pointerdown', onDown);
      newRound(true);
      // point at a front tooth (slightly left of the middle one)
      ctx.hint(function () { return G ? { x: ox + CT[5][0], y: oy + CT[5][1] } : null; });

      function frac(k) { return k < 0 || !G ? null : [+((ox + CT[k][0]) / W).toFixed(4), +((oy + CT[k][1]) / H).toFixed(4)]; }
      return {
        resize: resize,
        redraw: draw,
        frame: function (dt) { clock += dt; draw(); return true; },
        destroy: function () { seq++; },
        debug: function () {
          var safe = -1;
          for (var k = 0; k < NT; k++) if (pressedAt[k] == null && k !== bad) { safe = k; break; }
          return { phase: phase, turn: names[turn], pressed: count(), presses: presses, bites: bites,
            bitten: bitten >= 0 ? names[bitten] : null, bad: frac(bad), safe: frac(safe) };
        }
      };
    }
  };
})();
