/* game: spinner : port of spinner_toy.dart, mint look. Three lobes with steel ball-bearing weights, a centre cap.
 * Grab a wing and turn it, flick it, or brush past the edge; hold the cap to brake. Fast spins blur into a disc with
 * the app's motion blur; above the app's goal speed a gold light ring glows and sparks fly from the tips.
 * It starts spinning, ticks as each wing passes the top when slow, and gives itself a little push when left idle. */
(function () {
  var TOP = '#F2F8F4', BOT = '#D7E8DE', BODY = '#3CC48A', DEEP = '#1C8F60', CAP = '#3CC48A';
  var MAX_OM = 70, GOAL = 26, N = 3; /* app goal 34 rad/s; a bit lower here so a good flick on a phone reaches it */
  function lh(a, b, k) { var x = hex(a), y = hex(b); return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * k) + ',' + Math.round(x[1] + (y[1] - x[1]) * k) + ',' + Math.round(x[2] + (y[2] - x[2]) * k) + ')'; }
  function wrapA(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

  function Spinner(env) {
    var W = 0, H = 0, cx = 0, cy = 0, R = 120, side = 0, body = null, shadow = null;
    var th = 0, om = 16, speed = 16, lastTh = 0, dir = 1, clock = 0, wh = null, whT = 1;
    var caps = {}, grabs = {}, sparks = [], lit = false, litT = -10, goals = 0, lastCheer = -9, autos = 0, autoSign = -1;
    var Rc, D, RL, capR;

    /* union outline of the centre disc and the three lobe circles, built from arcs (canvas has no path union) */
    function shapePath(c) {
      var cphi = (Rc * Rc + D * D - RL * RL) / (2 * Rc * D), phi = Math.acos(clamp(cphi, -1, 1));
      var px = Rc * Math.cos(phi) - D, py = Rc * Math.sin(phi), bo = Math.atan2(py, px);
      c.beginPath();
      for (var k = 0; k < N; k += 1) {
        var a = -Math.PI / 2 + TAU * k / N;
        c.arc(Math.cos(a) * D, Math.sin(a) * D, RL, a - bo, a + bo, false);
        c.arc(0, 0, Rc, a + phi, a + TAU / N - phi, false);
      }
      c.closePath();
    }
    function weight(c, x, y, r) {
      var g = c.createLinearGradient(x - r, y - r, x + r, y + r);
      g.addColorStop(0, '#F7F8FA'); g.addColorStop(0.55, '#A7AFB8'); g.addColorStop(1, '#E6E9EC');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.fillStyle = '#2B3036'; c.beginPath(); c.arc(x, y, r * 0.8, 0, TAU); c.fill();
      for (var i = 0; i < 9; i += 1) {
        var a = TAU * i / 9, bx = x + Math.cos(a) * r * 0.62, by = y + Math.sin(a) * r * 0.62;
        var bg = c.createRadialGradient(bx - r * 0.05, by - r * 0.05, 0, bx - r * 0.05, by - r * 0.05, r * 0.2);
        bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(0.5, '#B9C0C8'); bg.addColorStop(1, '#5E666F');
        c.fillStyle = bg; c.beginPath(); c.arc(bx, by, r * 0.15, 0, TAU); c.fill();
      }
      g = c.createLinearGradient(x - r * 0.44, y - r * 0.44, x + r * 0.44, y + r * 0.44);
      g.addColorStop(0, '#F2F4F6'); g.addColorStop(1, '#9DA5AE');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 0.44, 0, TAU); c.fill();
      c.fillStyle = lh(DEEP, '#000000', 0.2); c.beginPath(); c.arc(x, y, r * 0.28, 0, TAU); c.fill();
    }
    function build() {
      var d = G.dpr, px = Math.min(Math.ceil(side * d), 1600), s = px / side, c, g;
      body = mkCanvas(px); c = body.getContext('2d'); c.scale(s, s); c.translate(side / 2, side / 2);
      shapePath(c);
      g = c.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, lh(BODY, '#FFFFFF', 0.28)); g.addColorStop(0.6, BODY); g.addColorStop(1, DEEP);
      c.fillStyle = g; c.fill();
      c.save(); c.clip(); c.strokeStyle = 'rgba(255,255,255,0.33)'; c.lineWidth = R * 0.06; c.stroke(); c.restore();
      c.strokeStyle = DEEP; c.lineWidth = R * 0.012; c.stroke();
      for (var k = 0; k < N; k += 1) { var a = -Math.PI / 2 + TAU * k / N; weight(c, Math.cos(a) * D, Math.sin(a) * D, RL * 0.7); }
      weight(c, 0, 0, capR * 1.45);
      /* soft shadow of the same outline (drawn far away, only its blurred shadow lands in the sprite) */
      shadow = mkCanvas(px); c = shadow.getContext('2d'); c.scale(s, s); c.translate(side / 2 - 10000, side / 2);
      c.shadowColor = '#000000'; c.shadowBlur = R * 0.12 * s; c.shadowOffsetX = 10000 * s;
      shapePath(c); c.fillStyle = '#000000'; c.fill();
    }
    function layout(w, h) {
      W = w; H = h; cx = w / 2; cy = h * 0.48;
      R = clamp(Math.min(Math.min(w, h) * 0.46, h * 0.37, (w / 2 - 6) / 1.1), 70, 300); /* the gold goal ring (1.08 R) stays on screen */
      Rc = R * 0.46; D = R * 0.6; RL = R * 0.4; capR = R * 0.2; side = R * 2.3;
      build();
    }
    function ang(p) { return Math.atan2(p.y - cy, p.x - cx); }
    function cheer() {
      lit = true; litT = clock; goals += 1;
      haptic(true, 22);
      if (clock - lastCheer > 3) { lastCheer = clock; celebrate(); } else Sfx.sparkle(0.7);
    }
    return {
      layout: layout,
      down: function (p) {
        var r = dist(p.x, p.y, cx, cy);
        if (r < capR * 1.2) { caps[p.id] = 1; haptic(true, 10); Sfx.click(0.6); return; }
        var on = r < R * 1.04;
        grabs[p.id] = { a: ang(p), on: on, last: clock, w: 0, turned: 0, log: [[p.t, 0]], x: p.x, y: p.y, t: p.t, vx: 0, vy: 0 };
        if (on) { if (Math.abs(om) > 4) haptic(true, Math.round(8 + 12 * clamp(Math.abs(om) / 40, 0, 1))); Sfx.tick(0.8); om = 0; }
      },
      move: function (p) {
        var g = grabs[p.id]; if (!g) return;
        var dtm = Math.max(1, p.t - g.t) / 1000;
        g.vx = g.vx * 0.4 + ((p.x - g.x) / dtm) * 0.6; g.vy = g.vy * 0.4 + ((p.y - g.y) / dtm) * 0.6;
        g.x = p.x; g.y = p.y; g.t = p.t;
        var a = ang(p), da = wrapA(a - g.a);
        g.a = a; g.last = clock; g.turned += da; g.log.push([p.t, g.turned]); if (g.log.length > 24) g.log.shift();
        var rx = p.x - cx, ry = p.y - cy, r2 = Math.max(rx * rx + ry * ry, 1), wf = (rx * g.vy - ry * g.vx) / r2;
        if (g.on) { th += da; g.w = wf; }
        else {
          /* brushing past the edge drags it along at the finger's speed */
          var reach = clamp(1 - (Math.sqrt(r2) - R) / (R * 0.6), 0, 1);
          if (reach > 0) {
            var before = Math.abs(om), faster = Math.abs(wf) > Math.abs(om) || (wf > 0) !== (om > 0);
            om = clamp(om + (wf * 1.1 - om) * (faster ? 0.55 : 0.2) * reach, -MAX_OM, MAX_OM);
            if (before < 6 && Math.abs(om) >= 6) { haptic(true, 14); Sfx.whoosh(0.5); }
          }
        }
      },
      up: function (p) {
        if (caps[p.id]) { delete caps[p.id]; return; }
        var g = grabs[p.id]; delete grabs[p.id];
        if (!g || !g.on) return;
        /* flick speed = angle actually turned over the last 0.08 s (as the app does) */
        var L = g.log, last = L[L.length - 1], first = last, fl = 0;
        for (var i = L.length - 1; i >= 0; i -= 1) { if (last[0] - L[i][0] > 80) break; first = L[i]; }
        var span = (last[0] - first[0]) / 1000;
        if (span > 0.012 && p.t - last[0] < 120) fl = (last[1] - first[1]) / span;
        var w = clock - g.last > 0.12 ? 0 : (Math.abs(fl) > Math.abs(g.w) ? fl : g.w) * 1.15;
        om = clamp(w, -MAX_OM, MAX_OM);
        if (Math.abs(om) > 6) { haptic(true, Math.round(10 + 14 * clamp(Math.abs(om) / 40, 0, 1))); Sfx.whoosh(0.35 + 0.4 * clamp(Math.abs(om) / 40, 0, 1)); }
      },
      update: function (dt) {
        clock += dt;
        var held = false, braking = false, id;
        for (id in grabs) if (grabs[id].on) held = true;
        for (id in caps) braking = true;
        if (!held) {
          var w = om * Math.exp(-(braking ? 3 : 0.045) * dt), mu = (braking ? 3 : 0.25) * dt;
          om = Math.abs(w) <= mu ? 0 : w - mu * (w > 0 ? 1 : -1);
          th += om * dt;
        }
        var d = th - lastTh; lastTh = th;
        if (dt > 0) speed += (Math.abs(d) / dt - speed) * (1 - Math.exp(-dt * 12));
        if (d !== 0) dir = d > 0 ? 1 : -1;
        if (!lit && speed > GOAL) cheer();
        else if (lit && speed < 10) lit = false;
        if (lit && speed > 20) {
          for (var k = 0; k < N; k += 1) {
            if (Math.random() > 0.35) continue;
            var a = th - Math.PI / 2 + TAU * k / N, ca = Math.cos(a), sa = Math.sin(a), m = 0.6 + Math.random() * 0.6;
            sparks.push({ x: cx + ca * R * 0.98, y: cy + sa * R * 0.98, vx: (-sa * dir * m + ca * 0.5) * R * 2.2, vy: (ca * dir * m + sa * 0.5) * R * 2.2, t: 0 });
          }
          if (sparks.length > 160) sparks.splice(0, sparks.length - 160);
        }
        for (var i = sparks.length - 1; i >= 0; i -= 1) {
          var s = sparks[i]; s.t += dt;
          if (s.t > 0.6) { sparks.splice(i, 1); continue; }
          var f = Math.exp(-3 * dt); s.vx *= f; s.vy *= f; s.x += s.vx * dt; s.y += s.vy * dt;
        }
        /* a wing passing the top: a tick you can feel while it is slow */
        var u0 = Math.floor((th - d) * N / TAU), u1 = Math.floor(th * N / TAU);
        if (u0 !== u1 && speed < 18 && speed > 0.3) { Sfx.tick(0.4 + 0.5 * clamp(speed / 18, 0, 1)); haptic(false, 6); }
        /* left alone and stopped: give it a gentle push so it never sits frozen */
        if (!held && !braking && Math.abs(om) < 1.5 && env.idle() > 5 && clock > 3) { autoSign = -autoSign; om = 12 * autoSign; autos += 1; }
        whT += dt;
        if (!wh && S.ac && S.ac.state === 'running') wh = makeWhirr(S.ac);
        if (wh && whT > 0.05) { whT = 0; wh.set(speed); }
        if (Math.abs(th) > 1000) { var kk = Math.floor(th / TAU) * TAU; th -= kk; lastTh -= kk; }
      },
      draw: function (c) {
        if (!body) return;
        var hs = side / 2, i;
        c.save(); c.translate(cx, cy + R * 0.08); c.rotate(th); c.globalAlpha = 0.3; c.drawImage(shadow, -hs, -hs, side, side); c.restore();
        /* motion blur: copies over the angle swept in the last 1/60 s; fast spins blend evenly into a disc */
        var spread = Math.min(speed / 60, TAU / N * 1.4), copies = spread < 0.04 ? 1 : clamp(Math.ceil(spread / 0.02), 2, 14), even = smooth(0.12, 0.6, spread);
        if (even > 0.05) {
          var g = c.createRadialGradient(cx, cy, Rc, cx, cy, R);
          g.addColorStop(0, rgba(BODY, 0.0)); g.addColorStop(0.5, rgba(BODY, 0.28 * even)); g.addColorStop(1, rgba(BODY, 0));
          c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
        }
        for (var k = copies - 1; k >= 0; k -= 1) {
          var f = copies === 1 ? 0 : k / (copies - 1), crisp = k === 0 ? 0.85 : clamp((1 - f) * 2.4 / copies, 0, 1), avg = 1 / (copies - k);
          c.globalAlpha = copies === 1 ? 1 : clamp(crisp + (avg - crisp) * even, 0, 1);
          c.save(); c.translate(cx, cy); c.rotate(th - dir * spread * f); c.drawImage(body, -hs, -hs, side, side); c.restore();
        }
        c.globalAlpha = 1;
        /* goal: gold light ring, bright flash when it lights up, sparks from the tips */
        if (lit) {
          var since = clock - litT, flash = Math.exp(-since * 2.5), pulse = 0.5 + 0.5 * Math.sin(clock * 10);
          c.strokeStyle = 'rgba(255,178,48,' + clamp(0.45 + 0.25 * pulse + 0.3 * flash, 0, 1).toFixed(3) + ')';
          c.lineWidth = R * (0.07 + 0.1 * flash);
          c.shadowColor = 'rgba(255,178,48,0.8)'; c.shadowBlur = R * 0.12 * G.dpr;
          c.beginPath(); c.arc(cx, cy, R * (1.08 + 0.25 * flash), 0, TAU); c.stroke();
          c.shadowBlur = 0; c.shadowColor = 'rgba(0,0,0,0)';
          c.strokeStyle = 'rgba(255,196,70,' + (0.7 + 0.3 * pulse).toFixed(3) + ')'; c.lineWidth = R * 0.022;
          c.beginPath(); c.arc(cx, cy, R * 1.08, 0, TAU); c.stroke();
        }
        for (i = 0; i < sparks.length; i += 1) {
          var sp = sparks[i], q = sp.t / 0.6;
          c.fillStyle = 'rgba(255,' + Math.round(190 - 90 * q) + ',50,' + (1 - q).toFixed(3) + ')';
          c.beginPath(); c.arc(sp.x, sp.y, R * 0.034 * (1 - q * 0.6), 0, TAU); c.fill();
        }
        /* centre cap (does not turn) */
        var pressed = false; for (var id in caps) pressed = true;
        var r = capR * (pressed ? 0.94 : 1);
        var sg = c.createRadialGradient(cx, cy + r * 0.16, r * 0.7, cx, cy + r * 0.16, r * 1.2);
        sg.addColorStop(0, 'rgba(0,0,0,0.25)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = sg; c.beginPath(); c.arc(cx, cy + r * 0.16, r * 1.2, 0, TAU); c.fill();
        var cg = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 1.7);
        cg.addColorStop(0, lh(CAP, '#FFFFFF', 0.55)); cg.addColorStop(0.45, CAP); cg.addColorStop(1, lh(CAP, '#000000', 0.3));
        c.fillStyle = cg; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = r * 0.07; c.beginPath(); c.arc(cx, cy, r * 0.92, 0, TAU); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(cx - r * 0.3, cy - r * 0.4, r * 0.31, r * 0.15, 0, 0, TAU); c.fill();
      },
      /* a flick across the top wing */
      hint: function () { return { x: cx - R * 0.6, y: cy - R * 0.78, dx: R * 1.2, dy: 0 }; },
      debug: function () { return { om: Math.round(om * 100) / 100, th: Math.round(th * 100) / 100, speed: Math.round(speed * 10) / 10, lit: lit, goals: goals, autos: autos, whirr: !!wh }; },
      destroy: function () { if (wh) wh.stop(); wh = null; grabs = {}; caps = {}; sparks = []; body = null; shadow = null; }
    };
  }

  GAMES['spinner'] = {
    name: { ko: '피젯 스피너', ja: 'ハンドスピナー', en: 'Fidget Spinner' },
    tip: { ko: '휙 튕겨서 돌려 보세요', ja: 'はじいて回してみて', en: 'Flick it to spin' },
    bg: 'linear-gradient(180deg,' + TOP + ' 0%,' + BOT + ' 100%) ' + TOP,
    tone: 'light',
    top: TOP,
    accent: '#3CC48A',
    make: Spinner
  };
})();
