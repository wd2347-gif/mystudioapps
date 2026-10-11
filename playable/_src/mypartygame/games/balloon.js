/* 풍선 펌프 (balloon): the app's balloon.dart scene: a pink balloon on a stand, fed by a hand pump (barrel in the colour of
   whoever's turn it is) through a hose. Tap anywhere: the T handle pushes down, air bubbles run along the hose and the balloon
   swells with a soft springy wobble, getting shinier and shakier. The turn passes by itself after 1 to 3 pumps. The hidden pop
   point is shorter than the app's (5 to 13 pumps) so it pops within seconds: flash, gold star, rubber shreds, confetti and the
   forfeit line for whoever popped it, then a fresh balloon by itself (or on the next tap). */
(function () {
  'use strict';
  var TAU = Math.PI * 2, PI = Math.PI;
  var T = {
    ko: { turn: '{0} 차례', hint: '펌프를 눌러요', soFar: '모두 {0}번 불었어요', popped: '{0} 펑!', forfeit: '벌칙 당첨!' },
    ja: { turn: '{0}の番', hint: 'ポンプを押してね', soFar: '全部で{0}回ふくらませたよ', popped: '{0}がパーン！', forfeit: '罰ゲーム決定！' },
    en: { turn: '{0}’s turn', hint: 'Tap the pump', soFar: '{0} pumps in total', popped: '{0} popped it!', forfeit: 'Forfeit time!' }
  };
  var PINK = '#FF5C7A', PINK_L = '#FF9AAE', KNOT = '#E8455F', GREY = '#5B6670', ROD = '#B8C2CC', MAXP = 14;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, k) {
    var p = rgb(a), q = rgb(b);
    return 'rgb(' + Math.round(p[0] + (q[0] - p[0]) * k) + ',' + Math.round(p[1] + (q[1] - p[1]) * k) + ',' + Math.round(p[2] + (q[2] - p[2]) * k) + ')';
  }
  function mixHex(a, b, k) { var p = rgb(a), q = rgb(b), o = '#'; for (var i = 0; i < 3; i++) o += ('0' + Math.round(p[i] + (q[i] - p[i]) * k).toString(16)).slice(-2); return o; }
  function rrect(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function line(g, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function bez(p0, p1, p2, p3, u) { var v = 1 - u; return v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3; }
  function target(n) { return 0.42 + 0.58 * Math.pow(clamp(n / MAXP, 0, 1), 0.85); }

  // scene in a square of side s (balloon.dart _Geo.fit): the stand rises and the balloon moves to the middle when there is room
  function fit(w, h) {
    var s = Math.min(w / 0.96, h, 540), ox = (w - s) / 2, oy = h - s;
    var maxLift = s * 0.3, lift = clamp((oy - s * 0.04) * 0.8, 0, maxLift), k = lift / maxLift;
    var mid = w / 2 - ox, bx = s * 0.4 + (Math.min(mid, s * 0.5) - s * 0.4) * k;
    var edge = (Math.min(ox + bx, w - ox - bx) - 6) / 0.98, side = s * 0.36 + (Math.max(edge, s * 0.36) - s * 0.36) * k;
    var room = oy + s * 0.8 - lift - 4;
    return { s: s, ox: ox, oy: oy, lift: lift, bx: bx, rMax: Math.min(side, room / 2.3),
      kx: bx, ky: s * 0.8 - lift, nx: bx, ny: s * 0.9, px: s * 0.84, pTop: s * 0.62, pBot: s * 0.94, travel: s * 0.1 };
  }
  function hose(G) {
    var s = G.s, fx = G.px - s * 0.04, fy = G.pBot - s * 0.03, tx = G.nx + s * 0.03, ty = G.ny + s * 0.02;
    return [fx, fy, fx - s * 0.08, fy + s * 0.06, tx + s * 0.16, ty + s * 0.08, tx, ty];
  }

  function paintBalloon(g, kx, ky, r, sx, sy, stretch, sway) {
    var rx = r * 0.9 * sx, ry = r * sy, cx = kx, cy = ky - ry * 1.02;
    g.save(); g.translate(kx, ky); g.rotate(sway); g.translate(-kx, -ky);
    g.beginPath();
    g.moveTo(kx, ky - ry * 0.04);
    g.bezierCurveTo(cx - rx * 0.55, ky - ry * 0.12, cx - rx * 1.02, cy + ry * 0.55, cx - rx, cy);
    g.bezierCurveTo(cx - rx * 0.98, cy - ry * 0.62, cx - rx * 0.56, cy - ry * 1.02, cx, cy - ry);
    g.bezierCurveTo(cx + rx * 0.56, cy - ry * 1.02, cx + rx * 0.98, cy - ry * 0.62, cx + rx, cy);
    g.bezierCurveTo(cx + rx * 1.02, cy + ry * 0.55, cx + rx * 0.55, ky - ry * 0.12, kx, ky - ry * 0.04);
    g.closePath();
    var base = mixHex(PINK, PINK_L, stretch * 0.55), M = Math.max(rx, ry);
    var gr = g.createRadialGradient(cx - 0.35 * M, cy - 0.45 * M, 0, cx - 0.35 * M, cy - 0.45 * M, M * 2);
    gr.addColorStop(0, mix(base, '#FFFFFF', 0.35)); gr.addColorStop(0.55, base); gr.addColorStop(1, mix(base, '#B0213F', 0.45));
    g.fillStyle = gr; g.fill();
    // shine: longer and brighter as the rubber stretches
    g.save(); g.translate(cx - rx * 0.42, cy - ry * 0.42); g.rotate(-0.6);
    g.fillStyle = 'rgba(255,255,255,' + (0.55 + 0.3 * stretch).toFixed(3) + ')';
    g.beginPath(); g.ellipse(0, 0, rx * (0.22 - 0.06 * stretch) / 2, ry * (0.42 + 0.22 * stretch) / 2, 0, 0, TAU); g.fill();
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(cx - rx * 0.12, cy - ry * 0.72, r * 0.05, 0, TAU); g.fill();
    if (stretch > 0.35) {
      var a = clamp((stretch - 0.35) / 0.65, 0, 1);
      g.strokeStyle = 'rgba(255,255,255,' + (0.35 * a).toFixed(3) + ')'; g.lineWidth = r * 0.018; g.lineCap = 'round';
      for (var k = 0; k < 3; k++) {
        g.beginPath(); g.ellipse(cx, cy, rx * (1.5 - k * 0.18) / 2, ry * (1.6 - k * 0.2) / 2, 0, PI * (1.15 + k * 0.08), PI * (1.5 + k * 0.08)); g.stroke();
      }
    }
    g.fillStyle = KNOT; g.beginPath();
    g.moveTo(kx, ky - ry * 0.05); g.lineTo(kx - r * 0.09, ky + r * 0.07); g.lineTo(kx + r * 0.09, ky + r * 0.07); g.closePath(); g.fill();
    g.restore();
  }

  function paintPump(g, G, down, acc, dark) {
    var s = G.s, x = G.px, bodyTop = G.pTop + s * 0.06, hy = G.pTop - s * 0.06 + G.travel * down;
    g.fillStyle = GREY; rrect(g, x - s * 0.1, G.pBot - s * 0.02, s * 0.2, s * 0.04, s * 0.02); g.fill();
    g.strokeStyle = ROD; g.lineWidth = s * 0.018; g.lineCap = 'butt'; line(g, x, hy, x, bodyTop + s * 0.02);
    var gr = g.createLinearGradient(x - s * 0.05, 0, x + s * 0.05, 0);
    gr.addColorStop(0, mix(acc, '#000000', 0.25)); gr.addColorStop(0.3, mix(acc, '#FFFFFF', 0.25));
    gr.addColorStop(0.6, acc); gr.addColorStop(1, mix(acc, '#000000', 0.3));
    g.fillStyle = gr; rrect(g, x - s * 0.05, bodyTop, s * 0.1, G.pBot - s * 0.01 - bodyTop, s * 0.025); g.fill();
    g.fillStyle = GREY; rrect(g, x - s * 0.056, bodyTop - s * 0.012, s * 0.112, s * 0.026, s * 0.01); g.fill();
    // T handle
    g.fillStyle = 'rgba(0,0,0,.2)'; rrect(g, x - s * 0.085, hy - s * 0.02 + s * 0.006, s * 0.17, s * 0.04, s * 0.02); g.fill();
    g.fillStyle = dark ? '#59625C' : '#2B2F2A'; rrect(g, x - s * 0.085, hy - s * 0.02, s * 0.17, s * 0.04, s * 0.02); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.33)'; g.lineWidth = s * 0.006; g.lineCap = 'round'; line(g, x - s * 0.06, hy - s * 0.008, x + s * 0.06, hy - s * 0.008);
  }

  function paintStand(g, G, dark) {
    var s = G.s, h = hose(G);
    g.strokeStyle = dark ? '#6E7872' : '#2B2F2A'; g.lineWidth = s * 0.018; g.lineCap = 'round';
    g.beginPath(); g.moveTo(h[0], h[1]); g.bezierCurveTo(h[2], h[3], h[4], h[5], h[6], h[7]); g.stroke();
    g.fillStyle = GREY; rrect(g, G.nx - s * 0.06, G.ny + s * 0.025 - s * 0.0175, s * 0.12, s * 0.035, s * 0.015); g.fill();
    g.fillStyle = '#8D99A3'; rrect(g, G.nx - s * 0.018, G.ky, s * 0.036, G.ny + s * 0.02 - G.ky, s * 0.008); g.fill();
    if (G.lift > s * 0.04) {
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = s * 0.006; line(g, G.nx - s * 0.007, G.ky + s * 0.03, G.nx - s * 0.007, G.ny);
      g.fillStyle = GREY; rrect(g, G.nx - s * 0.03, G.ky + s * 0.012 - s * 0.012, s * 0.06, s * 0.024, s * 0.012); g.fill();
    }
  }

  function star(g, x, y, r, n, inner) {
    g.beginPath();
    for (var k = 0; k < n * 2; k++) { var a = -PI / 2 + k * PI / n, rr = k % 2 ? r * inner : r; if (k) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }

  GAMES['balloon'] = {
    name: { ko: '풍선 펌프', ja: '風船ポンプ', en: 'Balloon Pump' },
    tip: { ko: '한 번, 두 번… 펑 터뜨리면 벌칙', ja: '1回、2回…割ったら罰ゲーム', en: 'Pump once, twice… pop it and you lose' },
    cat: 'bet', who: '2+', accent: '#FF5C7A',
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx, names = ctx.names, N = names.length, SLOTS = ctx.SLOTS, dpr = ctx.dpr;
      var root = ctx.el;
      root.innerHTML = '<div class="top"><div class="pill"></div></div><div class="ft" aria-live="polite"></div>';
      var topEl = root.querySelector('.top'), pill = root.querySelector('.pill'), ft = root.querySelector('.ft');
      var c = ctx.canvas(root), g = c.g;
      root.insertBefore(c.cv, root.firstChild);
      var W = 0, H = 0, G = null, ox = 0, oy = 0;
      var r = 0.2, rv = 0, pumps = 0, limit = 8, turn = 0, turnPumps = 0, quota = 2, popper = -1;
      var phase = 'play', passing = false, armed = false, seq = 0, clock = 0, lastPump = -10, popAt = -1, pops = 0, total = 0;
      var shreds = [];

      function setPill(text, col, big) {
        pill.textContent = text;
        pill.style.background = col; pill.style.color = ctx.inkOn(col);
        pill.style.boxShadow = '0 5px 14px ' + ctx.rgba(col, 0.35);
        pill.classList.toggle('big', !!big);
        pill.classList.remove('in'); void pill.offsetWidth; pill.classList.add('in');
      }
      function setFoot() {
        if (phase === 'play') { ft.classList.remove('res'); ft.textContent = pumps ? ctx.fmt(t.soFar, pumps) : t.hint; }
        else { ft.classList.add('res'); ft.textContent = t.forfeit + ' · ' + ctx.fmt(t.soFar, pumps); }
      }
      function newRound(quiet) {
        seq++;
        r = 0.2; rv = 0; pumps = 0; lastPump = -10; popAt = -1; shreds = []; popper = -1;
        limit = 5 + ctx.rnd(9); turnPumps = 0; quota = 1 + ctx.rnd(3); phase = 'play'; passing = false; armed = false;
        setPill(ctx.fmt(t.turn, names[turn]), SLOTS[turn % SLOTS.length]);
        setFoot();
        if (!quiet) { S.tone(420, 0.12, 'sine', 0.14, 760); ctx.buzz(10); }
        ctx.wake();
      }
      function pump() {
        var my = seq;
        if (passing) { S.tick(); return; }
        pumps++; total++; turnPumps++; lastPump = clock;
        if (pumps >= limit) { pop(); return; }
        // pfft + a tap, the balloon bulges
        var grow = clamp(pumps / MAXP, 0, 1);
        S.tone(170, 0.07, 'sine', 0.3, 95); S.noise(0.3, 0.32, 380, 2600, 'bandpass', 0.05);
        ctx.buzz(14 + Math.round(20 * grow));
        rv += 1.6;
        if (grow >= 0.4) S.tone(1100 + 500 * grow, 0.07, 'triangle', 0.04 + 0.07 * grow, 1600 + 600 * grow, 0.15);
        setFoot();
        if (turnPumps >= quota) {
          // the turn passes by itself after this person's pumps
          passing = true;
          ctx.later(function () {
            if (my !== seq) return;
            turn = (turn + 1) % N; turnPumps = 0; quota = 1 + ctx.rnd(3); passing = false;
            S.whoosh(); ctx.buzz(10);
            setPill(ctx.fmt(t.turn, names[turn]), SLOTS[turn % SLOTS.length]);
          }, 420);
        }
        ctx.wake();
      }
      function pop() {
        var my = seq, cx = ox + G.kx, cy = oy + G.ky - G.rMax * r;
        phase = 'pop'; popper = turn; popAt = clock; pops++;
        S.bang(); S.pop(0.95); ctx.buzz([70, 30, 50, 30, 30]);
        shreds = [];
        for (var i = 0; i < 9; i++) {
          var a = Math.random() * TAU, v = 0.5 + Math.random() * 0.5;
          shreds.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.4, spin: (Math.random() - 0.5) * 16, flip: 4 + Math.random() * 10,
            c: Math.random() < 0.5 ? PINK : KNOT, w: 0.05 + Math.random() * 0.05, h: 0.03 + Math.random() * 0.03 });
        }
        ctx.burst(cx, cy, 90, { speed: 820, ring: true });
        setPill(ctx.fmt(t.popped, names[popper]), SLOTS[popper % SLOTS.length], true);
        setFoot();
        ctx.later(function () {
          if (my !== seq) return;
          phase = 'result'; S.stamp(); ctx.buzz(30);
          ctx.later(function () { if (my === seq) S.lose(); }, 200);
          ctx.later(function () { if (my === seq) armed = true; }, 400);
          ctx.later(function () { if (my === seq) again(); }, 1700);
        }, 1300);
        ctx.wake();
      }
      function again() { turn = (popper + 1) % N; newRound(); }
      function onDown() {
        if (phase === 'result') { if (armed) again(); return; }
        if (phase !== 'play' || !G) return;
        pump();
      }

      function resize() {
        W = root.clientWidth; H = root.clientHeight;
        c.fit(W, H);
        var bw = ctx.box().w, top = topEl.offsetHeight, hreg = Math.max(80, H - top - ft.offsetHeight);
        G = fit(bw, hreg);
        ox = (W - bw) / 2 + G.ox; oy = top + G.oy;
        draw();
      }

      function draw() {
        if (!G) return;
        var dark = ctx.dark, s = G.s, popped = popAt >= 0, since = popped ? clock - popAt : 0, k;
        var who = popped ? popper : turn, acc = SLOTS[who % SLOTS.length];
        var shx = 0, shy = 0;
        if (popped && since < 0.4) { var a0 = s * 0.025 * (1 - since / 0.4); shx = Math.sin(since * 90) * a0; shy = Math.cos(since * 70) * a0; }
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        g.save(); g.translate(ox + shx, oy + shy);
        // floor shadow (pulled in a little when the scene is wider than the column, so the canvas edge never cuts it)
        var fx = s * 0.55, frx = s * 0.475, over = ox + fx + frx - (W - 6);
        if (over > 0) { fx -= over / 2; frx -= over / 2; }
        g.fillStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)';
        g.beginPath(); g.ellipse(fx, s * 0.95, frx, s * 0.03, 0, 0, TAU); g.fill();
        paintStand(g, G, dark);
        // handle: down fast, back up softly
        var dp = clock - lastPump, down = dp < 0 ? 0 : dp < 0.07 ? dp / 0.07 : dp < 0.32 ? 1 - (1 - Math.pow(1 - (dp - 0.07) / 0.25, 2)) : 0;
        paintPump(g, G, down, acc, dark);
        // air bubbles running along the hose
        if (dp >= 0 && dp < 0.3 && !popped) {
          var h = hose(G);
          g.fillStyle = 'rgba(255,255,255,.92)';
          for (k = 0; k < 3; k++) {
            var u = dp / 0.3 - k * 0.12;
            if (u <= 0 || u >= 1) continue;
            g.beginPath(); g.arc(bez(h[0], h[2], h[4], h[6], u), bez(h[1], h[3], h[5], h[7], u), s * 0.016 * (1 - k * 0.2), 0, TAU); g.fill();
          }
        }
        var grow = clamp(pumps / MAXP, 0, 1);
        if (!popped) {
          var squash = clamp(rv * 0.08, -0.12, 0.12), shiver = grow > 0.4 ? Math.sin(clock * 50) * 0.004 * grow * 2 : 0;
          paintBalloon(g, G.kx, G.ky, G.rMax * r, 1 - squash * 0.7 + shiver, 1 + squash - shiver, grow, Math.sin(clock * 1.3) * 0.03);
        } else {
          // POP: white flash, spiky gold star, rubber shreds
          var cx = G.kx, cy = G.ky - G.rMax * r;
          if (since < 0.35) {
            var q = since / 0.35;
            g.fillStyle = 'rgba(255,255,255,' + (0.85 * (1 - q)).toFixed(3) + ')';
            g.beginPath(); g.arc(cx, cy, G.rMax * r * (1 + q * 0.9), 0, TAU); g.fill();
            g.fillStyle = 'rgba(255,201,74,' + (1 - q).toFixed(3) + ')';
            star(g, cx, cy, G.rMax * (0.75 + 0.5 * (1 - (1 - q) * (1 - q))), 12, 0.62);
          }
          // what is left on the stand: a crumpled bit of rubber at the knot
          g.fillStyle = KNOT; g.beginPath();
          g.moveTo(G.kx - s * 0.03, G.ky + s * 0.01); g.lineTo(G.kx - s * 0.038, G.ky - s * 0.03); g.lineTo(G.kx - s * 0.012, G.ky - s * 0.016);
          g.lineTo(G.kx + s * 0.004, G.ky - s * 0.042); g.lineTo(G.kx + s * 0.02, G.ky - s * 0.014); g.lineTo(G.kx + s * 0.04, G.ky - s * 0.026);
          g.lineTo(G.kx + s * 0.03, G.ky + s * 0.01); g.closePath(); g.fill();
          var grav = s * 2.2;
          for (k = 0; k < shreds.length; k++) {
            var b = shreds[k], x = cx + b.vx * s * since, y = cy + b.vy * s * since + 0.5 * grav * since * since;
            if (y > H) continue;
            g.save(); g.translate(x, y); g.rotate(b.spin * since); g.fillStyle = b.c;
            g.beginPath(); g.ellipse(0, 0, b.w * s / 2, b.h * s / 2 * clamp(Math.abs(Math.cos(b.flip * since)), 0.3, 1), 0, 0, TAU); g.fill();
            g.restore();
          }
        }
        // bouncing arrow over the handle while it is someone's turn
        if (!popped && !passing) {
          var bob = Math.sin(clock * 6) * s * 0.012, ax = G.px, ay = G.pTop - s * 0.16 + bob;
          g.fillStyle = ctx.rgba(acc, 0.85); g.beginPath();
          g.moveTo(ax - s * 0.035, ay - s * 0.02); g.lineTo(ax + s * 0.035, ay - s * 0.02); g.lineTo(ax, ay + s * 0.025); g.closePath(); g.fill();
        }
        g.restore();
      }

      ctx.on(root, 'pointerdown', onDown);
      newRound(true);
      ctx.hint(function () { return G ? { x: ox + G.px, y: oy + G.pTop - G.s * 0.06 } : null; });

      return {
        resize: resize,
        redraw: draw,
        frame: function (dt) {
          clock += dt;
          if (popAt < 0) {
            // soft spring towards the size for this many pumps (two half steps keep it stable)
            var tg = target(pumps);
            for (var i = 0; i < 2; i++) { var h = dt / 2; rv += (240 * (tg - r) - 8.5 * rv) * h; r += rv * h; }
          }
          draw();
          return true;
        },
        destroy: function () { seq++; },
        debug: function () {
          return { phase: phase, turn: names[turn], pumps: pumps, limit: limit, turnPumps: turnPumps, quota: quota, passing: passing,
            pops: pops, total: total, popper: popper >= 0 ? names[popper] : null, size: +r.toFixed(3) };
        }
      };
    }
  };
})();
