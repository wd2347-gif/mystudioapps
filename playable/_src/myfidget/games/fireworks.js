/* game: fireworks : night sky (app FireworksToy). Tap: a rocket whistles up to the finger and bursts into
 * glowing sparks with fading tails, the sky tints in its colour. Hold, then let go: a bigger shell with
 * crossettes popping round it. When nobody touches, an occasional rocket keeps the sky alive. */
(function () {
  var PAL = [
    ['#FFD27A', '#FFF4D6'], ['#FF7EB6', '#FFD1E8'], ['#7FE7FF', '#D6FAFF'], ['#B18CFF', '#E9DEFF'],
    ['#8CFFB0', '#E2FFE9'], ['#FF9A62', '#FFDDB8'], ['#6FA8FF', '#FFFFFF']
  ];
  /* colour table: every spark colour gets an id, cached rgba strings and a glow sprite */
  var COL = [], CIX = {}, STR = [], GLOW = [];
  function cid(h) {
    if (CIX[h] == null) {
      CIX[h] = COL.length; COL.push(h);
      var a = hex(h);
      for (var l = 0; l < 6; l += 1) STR.push('rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + (l / 5) + ')');
    }
    return CIX[h];
  }
  function lerpHex(x, y, k) {
    var a = hex(x), b = hex(y), o = '#';
    for (var i = 0; i < 3; i += 1) { var v = Math.round(a[i] + (b[i] - a[i]) * k); o += (v < 16 ? '0' : '') + v.toString(16); }
    return o.toUpperCase();
  }
  var PID = [], EMB = {};
  (function () {
    for (var i = 0; i < PAL.length; i += 1) PID.push([cid(PAL[i][0]), cid(PAL[i][1])]);
    var base = COL.slice();
    base.push('#FFC266');
    for (var j = 0; j < base.length; j += 1) EMB[cid(base[j])] = cid(lerpHex(base[j], '#FFB050', 0.5));
  })();
  var GOLD = cid('#FFC266'), TAIL = cid('#FFD9A0'), CH1 = cid('#FFE6B0'), CH2 = cid('#FFB45A'), BR = cid('#FFF2C8');
  var ROCK = cid('#FFE2B0'), CHG = cid('#FFC870'), WHT = cid('#FFFFFF'), STAR = cid('#DDE6FF');
  var FLASHC = [];
  for (var fi = 0; fi < PAL.length; fi += 1) FLASHC.push(cid(lerpHex(PAL[fi][0], '#FFFFFF', 0.5)));

  /* soft glow (bright centre, long falloff), same stops as the app's Sprites.glow */
  function glow(id) {
    if (GLOW[id]) return GLOW[id];
    var n = 64, cv = mkCanvas(n), c = cv.getContext('2d'), a = hex(COL[id]), s = 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',';
    var g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, s + '1)'); g.addColorStop(0.12, s + '0.55)'); g.addColorStop(0.32, s + '0.19)');
    g.addColorStop(0.6, s + '0.05)'); g.addColorStop(1, s + '0)');
    c.fillStyle = g; c.fillRect(0, 0, n, n);
    GLOW[id] = cv;
    return cv;
  }
  var DOT = null;
  function dot() {
    if (DOT) return DOT;
    var n = 32, c; DOT = mkCanvas(n); c = DOT.getContext('2d');
    var g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(221,230,255,1)'); g.addColorStop(0.45, 'rgba(221,230,255,1)');
    g.addColorStop(0.7, 'rgba(221,230,255,0.4)'); g.addColorStop(1, 'rgba(221,230,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, n, n);
    return DOT;
  }

  var MAXS = 1400;

  function Fireworks(env) {
    var W = 0, H = 0, sc = 1, wide = false, edge = 60, clock = 0, first = true;
    var sparks = [], pool = [], rockets = [], flashes = [], later = [], pops = [], stars = [];
    var ptr = {}, crackleUntil = -1, nextAuto = 1.3, launched = 0, bursts = 0, grands = 0, opened = false;
    var bk = {}, used = [], WL = [1, 1.8, 2.8, 4];

    function R() { return Math.random(); }
    function spark(x, y, vx, vy, c, life, hist) {
      var s = pool.length ? pool.pop() : { h: new Float32Array(8) };
      s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.c = c; s.life = life; s.max = life;
      s.trail = 0.05; s.drag = 0.972; s.grav = 55; s.w = 2.2; s.emb = false; s.tw = false; s.hist = !!hist; s.ht = 0;
      if (hist) for (var k = 0; k < 8; k += 2) { s.h[k] = x; s.h[k + 1] = y; }
      sparks.push(s);
      return s;
    }
    function sphere(x, y, v, pal, n, trail, emb, tw) {
      n = Math.round(n * 0.95);
      for (var i = 0; i < n; i += 1) {
        var z = R() * 2 - 1, th = R() * TAU, rr = Math.sqrt(1 - z * z), sp = v * (0.93 + R() * 0.07);
        var s = spark(x, y, Math.cos(th) * rr * sp, Math.sin(th) * rr * sp, R() < 0.75 ? pal[0] : pal[1], 1.7 + R() * 0.7, true);
        s.trail = trail; s.emb = !!emb; s.tw = !!tw;
      }
    }
    function willow(x, y, v) {
      for (var i = 0; i < 80; i += 1) {
        var z = R() * 2 - 1, th = R() * TAU, rr = Math.sqrt(1 - z * z), sp = v * (0.9 + R() * 0.1);
        var s = spark(x, y, Math.cos(th) * rr * sp, Math.sin(th) * rr * sp, GOLD, 2.8 + R() * 0.8, true);
        s.trail = 0.16; s.drag = 0.955; s.grav = 70; s.w = 1.6; s.emb = true;
      }
    }
    function ring(x, y, v, pal) {
      var tilt = 0.35 + R() * 0.6, rot = R() * Math.PI;
      for (var i = 0; i < 64; i += 1) {
        var a = TAU * i / 64, px = Math.cos(a), py = Math.sin(a) * tilt;
        spark(x, y, (px * Math.cos(rot) - py * Math.sin(rot)) * v, (px * Math.sin(rot) + py * Math.cos(rot)) * v, i % 2 ? pal[1] : pal[0], 1.8, true);
      }
      sphere(x, y, v * 0.25, pal, 20, 0.03);
    }
    function heart(x, y, v, pal) {
      for (var i = 0; i < 76; i += 1) {
        var t = TAU * i / 76, hx = 16 * Math.pow(Math.sin(t), 3) / 17;
        var hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
        spark(x, y, hx * v, hy * v, pal[0], 1.9, true).grav = 25;
      }
    }
    function flash(x, y, pi, size) { flashes.push({ x: x, y: y, p: pi, t0: clock, size: size || 1 }); }

    function launch(tx, ty, power, auto) {
      ty = Math.min(ty, H * 0.8);
      var fx = clamp(tx + (R() - 0.5) * 60 * sc, 10, W - 10), fy = H + 10, d = dist(fx, fy, tx, ty);
      rockets.push({ fx: fx, fy: fy, tx: tx, ty: ty, x: fx, y: fy, t: 0, dur: 0.45 + d / H * 0.35 + 0.12 * power, pi: Math.floor(R() * PAL.length), pw: power, auto: !!auto });
      Sfx.launch((0.45 + 0.4 * power) * (auto ? 0.55 : 1));
      launched += 1;
    }
    function burstAt(rk, quiet) {
      if (rk.pw > 0.15) { grand(rk); return; }
      var x = rk.tx, y = rk.ty, pal = PID[rk.pi], v = 370 * sc * (0.85 + R() * 0.3), roll = R(), cr = false;
      if (roll < 0.22) sphere(x, y, v, pal, 120, 0.05);
      else if (roll < 0.4) { sphere(x, y, v * 1.05, pal, 110, 0.1, true); cr = true; }
      else if (roll < 0.55) willow(x, y, v * 0.75);
      else if (roll < 0.67) ring(x, y, v, pal);
      else if (roll < 0.76) heart(x, y, v * 0.95, pal);
      else if (roll < 0.9) { sphere(x, y, v, pal, 90, 0.05); sphere(x, y, v * 0.5, PID[Math.floor(R() * PAL.length)], 50, 0.04); }
      else { sphere(x, y, v, pal, 120, 0.04, false, true); cr = true; }
      flash(x, y, rk.pi);
      bursts += 1;
      if (quiet) return;
      var vol = rk.auto ? 0.5 : 0.9;
      Sfx.boom(0.5, vol);
      if (!rk.auto) haptic(true, 26);
      if (cr) later.push({ at: clock + 0.45, k: 'c', v: 0.55 * vol });
    }
    function grand(rk) {
      var x = rk.tx, y = rk.ty, pw = rk.pw, pal = PID[rk.pi], p2 = Math.floor(R() * PAL.length), v = 370 * sc * (1.12 + 0.45 * pw);
      sphere(x, y, v, pal, 150 + 150 * pw, 0.06, true, pw > 0.55);
      sphere(x, y, v * 0.55, PID[p2], 50 + 40 * pw, 0.04);
      var n = 4 + Math.round(4 * pw), a0 = R() * TAU;
      for (var i = 0; i < n; i += 1) {
        var a = a0 + TAU * i / n + (R() - 0.5) * 0.4, rr = v * (0.42 + 0.06 * pw);
        pops.push({ at: clock + 0.42 + i * 0.045 + R() * 0.05, x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr, pi: i % 2 ? p2 : rk.pi });
      }
      flash(x, y, rk.pi, 1.35 + 0.5 * pw);
      Sfx.boom(1, 1); haptic(true, 40);
      later.push({ at: clock + 0.07, k: 'b', v: 0.55 }, { at: clock + 0.75, k: 'c', v: 0.7 });
      grands += 1; bursts += 1;
    }

    function charge(q, dt) {
      var held = clock - q.t0 - 0.2;
      if (held <= 0) return;
      var was = q.level;
      q.level = clamp(held / 1.3, 0, 1);
      var n = clamp(Math.round(dt * (60 + 220 * q.level)), 1, 8);
      for (var i = 0; i < n; i += 1) {
        var a = R() * TAU, r = (70 + 40 * R()) * sc * (1 - 0.35 * q.level), sp = r / (0.28 + 0.1 * R());
        var s = spark(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r, -Math.cos(a) * sp, -Math.sin(a) * sp, R() < 0.5 ? CH1 : CH2, 0.26);
        s.trail = 0.03; s.drag = 1; s.grav = 0; s.w = 1.2;
      }
      if (Math.floor(q.level * 4) > Math.floor(was * 4)) {
        if (q.level >= 1) { haptic(true, 20); Sfx.crackle(6, 0.35); } else { haptic(true, 8); Sfx.tick(0.6); }
      }
    }

    function layout(w, h) {
      W = w; H = h;
      wide = !!G.wide;
      /* tablets: the sky is a centred column, so shells stay a little smaller to bloom inside it */
      sc = clamp(Math.min(w, h) / 400, 0.6, 2.2) * (wide ? 0.78 : 1);
      edge = Math.max(40, w * 0.14);
      var rnd = srand(11), n = Math.round(clamp(w * h / 2300, 70, 150));
      stars = [];
      for (var i = 0; i < n; i += 1) stars.push({ x: rnd() * w, y: Math.pow(rnd(), 1.4) * h * 0.8, s: 0.6 + rnd() * 1.6, ph: rnd() * TAU, sp: 0.5 + rnd() * 1.8 });
      if (first) {
        first = false;
        /* the sky is already lit when the toy appears (silent: nobody has touched yet) */
        burstAt({ tx: w * 0.5, ty: h * 0.32, pi: 1, pw: 0 }, true);
      }
    }

    function add(key, pts) {
      var b = bk[key];
      if (!b) { b = bk[key] = []; }
      if (!b.length) used.push(key);
      b.push(pts.length / 2);
      for (var i = 0; i < pts.length; i += 1) b.push(pts[i]);
    }
    function key(c, a, w) {
      var lv = Math.round(a * 5);
      if (lv <= 0) return -1;
      var ww = w / sc, wl = ww < 1.4 ? 0 : (ww < 2.3 ? 1 : (ww < 3.4 ? 2 : 3));
      return ((c * 6 + Math.min(5, lv)) * 4) + wl;
    }
    var tmp6 = [0, 0, 0, 0, 0, 0], tmp4 = [0, 0, 0, 0];

    return {
      layout: layout,
      down: function (p) { ptr[p.id] = { x: p.x, y: p.y, t0: clock, level: 0 }; haptic(true, 6); },
      move: function (p) { var q = ptr[p.id]; if (!q) return; q.x = p.x; q.y = p.y; },
      up: function (p) {
        var q = ptr[p.id]; if (!q) return;
        delete ptr[p.id];
        if (q.level > 0.15) { launch(p.x, p.y, q.level); haptic(true, 12 + Math.round(18 * q.level)); }
        else { launch(p.x, p.y, 0); haptic(true, 10); }
        nextAuto = Math.max(nextAuto, clock + 4);
      },
      update: function (dt) {
        clock += dt;
        var i, s;
        for (i = later.length - 1; i >= 0; i -= 1) {
          if (clock < later[i].at) continue;
          if (later[i].k === 'c') { Sfx.crackle(14, later[i].v); crackleUntil = clock + 1.3; } else Sfx.boom(0.6, later[i].v);
          later.splice(i, 1);
        }
        for (i = pops.length - 1; i >= 0; i -= 1) {
          var pp = pops[i];
          if (clock < pp.at) continue;
          pops.splice(i, 1);
          sphere(pp.x, pp.y, 120 * sc, PID[pp.pi], 34, 0.04, false, true);
          flash(pp.x, pp.y, pp.pi, 0.45);
          Sfx.boom(0.1, 0.3); haptic(false, 8);
        }
        for (var id in ptr) if (Object.prototype.hasOwnProperty.call(ptr, id)) charge(ptr[id], dt);
        if (clock < crackleUntil && R() < 0.12) haptic(false, 5);
        /* idle sky: before the first touch, and again after a quiet spell */
        var quiet = env.touched() ? env.idle() > 4 : true;
        if (quiet && clock > nextAuto && !rockets.length) {
          launch(W * (0.2 + 0.6 * R()), H * (0.16 + 0.3 * R()), 0, true);
          nextAuto = clock + (env.touched() ? 2.2 + R() * 1.2 : 1.5 + R() * 0.9);
        }
        for (i = rockets.length - 1; i >= 0; i -= 1) {
          var rk = rockets[i];
          rk.t += dt;
          var k = clamp(rk.t / rk.dur, 0, 1), e = 1 - Math.pow(1 - k, 2.2);
          rk.x = lerp(rk.fx, rk.tx, e); rk.y = lerp(rk.fy, rk.ty, e);
          for (var j = 0; j < 3 + Math.round(rk.pw * 4); j += 1) {
            s = spark(rk.x, rk.y, (R() - 0.5) * 40, 40 + R() * 60, TAIL, 0.25 + R() * 0.25);
            s.trail = 0.03; s.w = 1.3;
          }
          if (k >= 1) { rockets.splice(i, 1); burstAt(rk); }
        }
        var n0 = sparks.length;
        for (i = n0 - 1; i >= 0; i -= 1) {
          s = sparks[i];
          s.life -= dt;
          if (s.life <= 0) { sparks[i] = sparks[sparks.length - 1]; sparks.pop(); if (pool.length < 2000) pool.push(s); continue; }
          if (s.hist) {
            s.ht += dt;
            if (s.ht >= 0.04) {
              s.ht = 0;
              var h = s.h;
              h[6] = h[4]; h[7] = h[5]; h[4] = h[2]; h[5] = h[3]; h[2] = h[0]; h[3] = h[1]; h[0] = s.x; h[1] = s.y;
            }
          }
          var d = Math.pow(s.drag, dt * 60);
          s.vx *= d; s.vy = s.vy * d + s.grav * sc * dt;
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.emb && R() < dt * 5 && sparks.length < 1100) {
            var em = spark(s.x, s.y, s.vx * 0.1, s.vy * 0.1 + 10, EMB[s.c] != null ? EMB[s.c] : s.c, 0.5);
            em.trail = 0.02; em.w = 1; em.grav = 40;
          }
        }
        if (sparks.length > MAXS) {
          var cut = sparks.splice(0, sparks.length - MAXS);
          for (i = 0; i < cut.length && pool.length < 2000; i += 1) pool.push(cut[i]);
        }
        for (i = flashes.length - 1; i >= 0; i -= 1) if (clock - flashes[i].t0 > 1.2) flashes.splice(i, 1);
      },
      draw: function (c) {
        var i, f, a;
        c.save();
        c.globalCompositeOperation = 'lighter';
        /* the sky takes the burst's colour for a moment */
        if (flashes.length) {
          var big = wide ? W * 0.62 : Math.max(W, H) * 0.7;
          for (i = 0; i < flashes.length; i += 1) {
            f = flashes[i]; a = Math.exp(-(clock - f.t0) * 3) * 0.34;
            if (a < 0.01) continue;
            var col = hex(PAL[f.p][0]), g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, big);
            g.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a.toFixed(3) + ')');
            g.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
            c.fillStyle = g; c.fillRect(0, 0, W, H);
          }
          /* the tint fades out before the play-area edges (header, buttons and, on tablets, the column sides) */
          c.globalCompositeOperation = 'destination-out';
          var vg = c.createLinearGradient(0, 0, 0, H);
          vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(0.14, 'rgba(0,0,0,0)');
          vg.addColorStop(0.82, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
          c.fillStyle = vg; c.fillRect(0, 0, W, H);
          if (wide) {
            var eg = c.createLinearGradient(0, 0, W, 0);
            eg.addColorStop(0, 'rgba(0,0,0,1)'); eg.addColorStop(0.24, 'rgba(0,0,0,0)');
            eg.addColorStop(0.76, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,1)');
            c.fillStyle = eg; c.fillRect(0, 0, W, H);
          }
          c.globalCompositeOperation = 'lighter';
        }
        var ds = dot();
        for (i = 0; i < stars.length; i += 1) {
          var st = stars[i], tw = 0.55 + 0.45 * Math.sin(clock * st.sp + st.ph), sz = st.s * 3.2;
          c.globalAlpha = 0.5 * tw;
          c.drawImage(ds, st.x - sz / 2, st.y - sz / 2, sz, sz);
        }
        /* sparks: glows now (additive, order does not matter), tails batched by colour / alpha / width */
        used.length = 0;
        for (i = 0; i < sparks.length; i += 1) {
          var s = sparks[i], fr = s.life / s.max;
          a = fr < 0.3 ? fr / 0.3 : 1; a *= a;
          if (s.tw && fr < 0.6 && R() < 0.5) a *= 0.15;
          if (wide) { var ex = Math.min(s.x, W - s.x) / edge; if (ex < 1) a *= ex > 0 ? ex * ex : 0; }
          var w = s.w * sc * (0.55 + 0.45 * fr) * 1.8, kk;
          if (s.hist) {
            var h = s.h;
            kk = key(s.c, a * 0.4, w * 0.55);
            if (kk >= 0) { tmp6[0] = h[6]; tmp6[1] = h[7]; tmp6[2] = h[4]; tmp6[3] = h[5]; tmp6[4] = h[2]; tmp6[5] = h[3]; add(kk, tmp6); }
            kk = key(s.c, a * 0.9, w * 0.85);
            if (kk >= 0) { tmp6[0] = h[2]; tmp6[1] = h[3]; tmp6[2] = h[0]; tmp6[3] = h[1]; tmp6[4] = s.x; tmp6[5] = s.y; add(kk, tmp6); }
          } else {
            kk = key(s.c, a * 0.8, w * 0.7);
            if (kk >= 0) { tmp4[0] = s.x - s.vx * s.trail; tmp4[1] = s.y - s.vy * s.trail; tmp4[2] = s.x; tmp4[3] = s.y; add(kk, tmp4); }
          }
          var ga = a * 0.36;
          if (ga > 0.02 && (s.hist || sparks.length < 800)) { var gd = w * 8; c.globalAlpha = ga; c.drawImage(glow(s.c), s.x - gd / 2, s.y - gd / 2, gd, gd); }
        }
        c.globalAlpha = 1; c.lineCap = 'round'; c.lineJoin = 'round';
        for (i = 0; i < used.length; i += 1) {
          var ky = used[i], b = bk[ky], wl = ky % 4, ca = (ky - wl) / 4;
          c.strokeStyle = STR[ca]; c.lineWidth = WL[wl] * sc;
          c.beginPath();
          for (var j = 0; j < b.length;) {
            var np = b[j]; j += 1;
            c.moveTo(b[j], b[j + 1]);
            for (var m = 1; m < np; m += 1) c.lineTo(b[j + m * 2], b[j + m * 2 + 1]);
            j += np * 2;
          }
          c.stroke();
          b.length = 0;
        }
        for (i = 0; i < rockets.length; i += 1) {
          var rk = rockets[i], rs = (26 + 22 * rk.pw) * sc;
          c.globalAlpha = 0.9; c.drawImage(glow(ROCK), rk.x - rs / 2, rk.y - rs / 2, rs, rs);
        }
        for (var id in ptr) {
          if (!Object.prototype.hasOwnProperty.call(ptr, id)) continue;
          var q = ptr[id];
          if (q.level <= 0) continue;
          var beat = 0.85 + 0.15 * Math.sin(clock * (10 + 14 * q.level)), g1 = (48 + 120 * q.level) * sc * beat, g2 = (16 + 26 * q.level) * sc;
          c.globalAlpha = 0.35 + 0.5 * q.level; c.drawImage(glow(CHG), q.x - g1 / 2, q.y - g1 / 2, g1, g1);
          c.globalAlpha = 0.5 + 0.5 * q.level; c.drawImage(glow(WHT), q.x - g2 / 2, q.y - g2 / 2, g2, g2);
        }
        for (i = 0; i < flashes.length; i += 1) {
          f = flashes[i];
          var age = clock - f.t0;
          if (age >= 0.35) continue;
          var fs = 240 * sc * (0.6 + age) * f.size, fe = wide ? clamp(Math.min(f.x, W - f.x) / (edge * 1.6), 0, 1) : 1;
          c.globalAlpha = (1 - age / 0.35) * 0.7 * fe * fe; c.drawImage(glow(FLASHC[f.p]), f.x - fs / 2, f.y - fs / 2, fs, fs);
        }
        c.restore();
      },
      hint: function () { return { x: W * 0.5, y: H * 0.36 }; },
      debug: function () {
        var held = 0;
        for (var id in ptr) if (Object.prototype.hasOwnProperty.call(ptr, id)) held = Math.max(held, ptr[id].level);
        return { launched: launched, bursts: bursts, grand: grands, rockets: rockets.length, sparks: sparks.length, charge: Math.round(held * 100) / 100 };
      },
      destroy: function () { sparks = []; pool = []; rockets = []; flashes = []; later = []; pops = []; ptr = {}; bk = {}; used = []; }
    };
  }

  /* sky gradient of the app, with the two hill silhouettes and a few stars drawn into the full-screen
   * background so they also reach past the centred column on tablets */
  var HILLS = [
    'radial-gradient(48% 7.5% at 22% 100%,#05060F 98.5%,rgba(5,6,15,0) 100%)',
    'radial-gradient(42% 6.5% at 80% 100%,#05060F 98.5%,rgba(5,6,15,0) 100%)',
    'radial-gradient(36% 13% at 6% 100%,#0A0C1E 98.5%,rgba(10,12,30,0) 100%)',
    'radial-gradient(40% 11% at 54% 100%,#0A0C1E 98.5%,rgba(10,12,30,0) 100%)',
    'radial-gradient(34% 14.5% at 97% 100%,#0A0C1E 98.5%,rgba(10,12,30,0) 100%)'
  ];
  var SKY_STARS = [[4, 9], [9, 31], [13, 18], [6, 52], [15, 44], [3, 70], [88, 12], [94, 27], [86, 40], [97, 49], [91, 63], [84, 22], [48, 6], [70, 15], [27, 11]];
  var bgStars = [];
  for (var si = 0; si < SKY_STARS.length; si += 1) {
    var sz = si % 3 ? 1.2 : 1.8;
    bgStars.push('radial-gradient(' + sz + 'px ' + sz + 'px at ' + SKY_STARS[si][0] + '% ' + SKY_STARS[si][1] + '%,rgba(221,230,255,' + (si % 2 ? 0.55 : 0.8) + '),rgba(221,230,255,0))');
  }

  GAMES['fireworks'] = {
    name: { ko: '불꽃놀이', ja: '花火', en: 'Fireworks' },
    tip: { ko: '톡 치면 펑, 꾹 누르면 크게', ja: 'タップで打ち上げ、長押しで大きく', en: 'Tap to launch, hold for more' },
    bg: HILLS.concat(bgStars).join(',') + ',linear-gradient(180deg,#04060F 0%,#0A0F2A 60%,#1D1336 100%) #04060F',
    tone: 'dark',
    top: '#04060F',
    accent: '#FFD27A',
    make: Fireworks
  };
})();
