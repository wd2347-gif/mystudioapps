/* game: jelly : a glossy strawberry jelly on a plate (port of my_fidget jelly_toy.dart, look 0 "strawberry").
 * Soft body of 44 rim points with shape matching + gravity + floor. Tap: wobble and squint (> <).
 * Grab and drag: it stretches. Fling it up into the star: the star bursts (celebrate), the jelly smiles,
 * and once it has landed a new star appears somewhere else. Endless. */
(function () {
  var N = 44;
  var BODY = '#FF7A9C', DEEP = '#D9365E', INK = '#3A2632';
  var LITE = mix(BODY, WHITE, 0.38), DARK = mix(BODY, hex(DEEP), 0.65);

  /* soft-edged ellipse (radial gradient, no blur filter): opaque to `hard` of the radius, then fades out */
  function softOval(c, x, y, rx, ry, rot, col, a, hard) {
    if (rx < 0.5 || ry < 0.5 || a <= 0.003) return;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(1, ry / rx);
    var g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(hard, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill();
    c.restore();
  }

  function Jelly(env) {
    var W = 0, H = 0, BX = 0, BW = 0, w = 200, h = 160, floor = 400, grav = 1500, gk = 1, sk = 1;
    var px = new Float64Array(N), py = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N);
    var qx = new Float64Array(N), qy = new Float64Array(N);
    var cx = 0, cy = 0, rot = 0, minX = 0, maxX = 0, minY = 0, maxY = 0, wob = 0;
    var grabs = {}, touches = {}, pokers = {};
    var clock = 0, squintUntil = -1, blinkAt = 2.5, impact = 0, lastLand = -1, mouthUntil = -1, lastSquish = -1, lastIdle = 0;
    var star = { u: 0.5, x: 0, y: 0 }, starT0 = 0, hitT0 = -100;
    var feats = null, plate = null, placed = false;
    var n = { pokes: 0, grabs: 0, flings: 0, lands: 0, stars: 0 };

    /* ---- shape ---- */
    function restShape() {
      var sx = 0, sy = 0, i;
      for (i = 0; i < N; i += 1) {
        var th = TAU * i / N, co = Math.cos(th), si = Math.sin(th), p = 2.7;
        var x = w / 2 * (co < 0 ? -1 : 1) * Math.pow(Math.abs(co), 2 / p);
        var y = h / 2 * (si < 0 ? -1 : 1) * Math.pow(Math.abs(si), 2 / p);
        if (si > 0) x *= 1 + 0.07 * si; /* belly a little wider */
        qx[i] = x; qy[i] = y; sx += x; sy += y;
      }
      for (i = 0; i < N; i += 1) { qx[i] -= sx / N; qy[i] -= sy / N; }
      /* face features follow the bend of the body: precomputed weights per feature */
      var F = [[-0.2, -0.27], [0.05, -0.36], [-0.16, -0.02], [0.16, -0.02], [0, 0.1], [-0.25, 0.08], [0.25, 0.08]];
      feats = [];
      var sig2 = 2 * Math.pow(w * 0.32, 2);
      for (var f = 0; f < F.length; f += 1) {
        var fx0 = F[f][0] * w, fy0 = F[f][1] * h, wt = new Float64Array(N), ws = 0;
        for (i = 0; i < N; i += 1) {
          var dx = qx[i] - fx0, dy = qy[i] - fy0;
          wt[i] = Math.exp(-(dx * dx + dy * dy) / sig2); ws += wt[i];
        }
        for (i = 0; i < N; i += 1) wt[i] /= ws;
        feats.push({ x: fx0, y: fy0, w: wt, ox: 0, oy: 0 });
      }
    }
    function place(x, y) { for (var i = 0; i < N; i += 1) { px[i] = x + qx[i]; py[i] = y + qy[i]; vx[i] = 0; vy[i] = 0; } }
    function plateSprite() {
      var d = G.dpr, pw = Math.min(w * 1.5, BW - 8), ph = w * 0.3, m = 14;
      plate = { cv: mkCanvas((pw + m * 2) * d, (ph + m * 2 + 8) * d), w: pw, h: ph, m: m };
      var c = plate.cv.getContext('2d');
      c.scale(d, d);
      softOval(c, m + pw / 2, m + ph / 2 + 8, pw / 2 + 6, ph / 2 + 4, 0, '#5A3020', 0.16, 0.55);
      var g = c.createLinearGradient(0, m, 0, m + ph);
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#EDE7E2');
      c.fillStyle = g; c.beginPath(); c.ellipse(m + pw / 2, m + ph / 2, pw / 2, ph / 2, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.08)'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(m + pw / 2, m + ph / 2, pw / 2 - w * 0.06, ph / 2 - w * 0.06 * 0.3, 0, 0, TAU); c.stroke();
    }
    function newStar(first) {
      star.u = first ? 0.5 : 0.28 + 0.44 * Math.random();
      starT0 = clock; hitT0 = -100;
      starPos();
    }
    function starPos() { star.x = BX + BW * star.u; star.y = Math.max(H * 0.17, 40); }

    function layout(w0, h0, box) {
      var oldW = w, oldFloor = floor, oldCx = W / 2, first = !placed;
      W = w0; H = h0; BX = box.x; BW = box.w;
      w = Math.max(120, Math.min(BW * 0.78, H * 0.46, 420)); h = w * 0.8;
      floor = H * 0.69;
      gk = clamp(H / 800, 0.7, 1.6); grav = 1500 * gk; sk = w / 280;
      restShape();
      if (first) { place(W / 2, floor - h / 2 - H * 0.12); placed = true; newStar(true); }
      else {
        var k = w / oldW;
        for (var i = 0; i < N; i += 1) {
          px[i] = W / 2 + (px[i] - oldCx) * k; py[i] = floor + (py[i] - oldFloor) * k;
          vx[i] *= k; vy[i] *= k;
        }
        starPos();
      }
      centroid();
      plateSprite();
    }

    /* ---- physics (same model as the app) ---- */
    function centroid() {
      var sx = 0, sy = 0, i;
      for (i = 0; i < N; i += 1) { sx += px[i]; sy += py[i]; }
      cx = sx / N; cy = sy / N;
      var a = 0, b = 0;
      for (i = 0; i < N; i += 1) { var rx = px[i] - cx, ry = py[i] - cy; a += qx[i] * ry - qy[i] * rx; b += qx[i] * rx + qy[i] * ry; }
      rot = Math.atan2(a, b);
    }
    function inside(x, y) {
      var c = false;
      for (var i = 0, j = N - 1; i < N; j = i, i += 1) {
        if ((py[i] > y) !== (py[j] > y) && x < (px[j] - px[i]) * (y - py[i]) / (py[j] - py[i]) + px[i]) c = !c;
      }
      return c;
    }
    function substep(hh) {
      centroid();
      var r = rot * 0.88, co = Math.cos(r), si = Math.sin(r), K = 820, mvx = 0, mvy = 0, i, id;
      for (i = 0; i < N; i += 1) { mvx += vx[i]; mvy += vy[i]; }
      mvx /= N; mvy /= N;
      for (i = 0; i < N; i += 1) {
        var gx = cx + co * qx[i] - si * qy[i], gy = cy + si * qx[i] + co * qy[i];
        vx[i] += ((gx - px[i]) * K - (vx[i] - mvx) * 3.2) * hh;
        vy[i] += ((gy - py[i]) * K + grav - (vy[i] - mvy) * 3.2) * hh;
      }
      for (id in grabs) {
        var gr = grabs[id];
        for (i = 0; i < N; i += 1) {
          var wt = gr.w[i];
          if (wt < 0.02) continue;
          vx[i] += ((gr.fx + gr.ox[i] - px[i]) * 1300 - vx[i] * 18) * wt * hh;
          vy[i] += ((gr.fy + gr.oy[i] - py[i]) * 1300 - vy[i] * 18) * wt * hh;
        }
      }
      var fr = Math.max(22, w * 0.1);
      for (id in pokers) {
        var f = pokers[id];
        for (i = 0; i < N; i += 1) {
          var dx = px[i] - f.x, dy = py[i] - f.y, dd = Math.sqrt(dx * dx + dy * dy);
          if (dd < fr && dd > 0.01) {
            var nx = dx / dd, ny = dy / dd;
            px[i] = f.x + nx * fr; py[i] = f.y + ny * fr;
            var vn = vx[i] * nx + vy[i] * ny;
            if (vn < 0) { vx[i] -= vn * nx; vy[i] -= vn * ny; }
          }
        }
      }
      var damp = Math.exp(-0.9 * hh);
      for (i = 0; i < N; i += 1) {
        vx[i] *= damp; vy[i] *= damp;
        px[i] += vx[i] * hh; py[i] += vy[i] * hh;
        if (py[i] > floor) {
          if (vy[i] > impact) impact = vy[i];
          py[i] = floor; if (vy[i] > 0) vy[i] *= -0.12; vx[i] *= 0.86;
        }
        if (px[i] < 6) { px[i] = 6; if (vx[i] < 0) vx[i] *= -0.3; }
        else if (px[i] > W - 6) { px[i] = W - 6; if (vx[i] > 0) vx[i] *= -0.3; }
        if (py[i] < 6) { py[i] = 6; if (vy[i] < 0) vy[i] *= -0.3; }
      }
    }
    function squish(v) { if (clock - lastSquish > 0.06) { lastSquish = clock; Sfx.squish(v); } }

    /* a poke dents the rim where the finger lands and the whole body wobbles back */
    function poke(x, y, strength, snd) {
      var ox = x - cx, oy = y - cy, ol = Math.sqrt(ox * ox + oy * oy), i, best = -1e9, bi = 0;
      if (ol < w * 0.15) { ox = 0; oy = -1; ol = 1; } /* centre tap: press it down from the top */
      var nx = ox / ol, ny = oy / ol;
      for (i = 0; i < N; i += 1) { var dp = (px[i] - cx) * nx + (py[i] - cy) * ny; if (dp > best) { best = dp; bi = i; } }
      var ix = px[bi], iy = py[bi], gap = Math.max(0, ol - best);
      var s = strength * sk * clamp(1 - gap / (w * 0.6), 0, 1), reach = w * 0.5;
      if (s < 40) return false;
      for (i = 0; i < N; i += 1) {
        var d = dist(px[i], py[i], ix, iy);
        if (d < reach) { var k = Math.pow(1 - d / reach, 2) * s; vx[i] -= nx * k; vy[i] -= ny * k; }
      }
      squintUntil = Math.max(squintUntil, clock + 0.55); mouthUntil = Math.max(mouthUntil, clock + 0.35);
      if (snd) { squish(0.85); haptic(true, 14); }
      n.pokes += 1;
      return true;
    }
    /* the star bursts when the released jelly flies up into it. The app needs a real toss; here a gentle toss,
       or carrying the jelly up onto the star and letting go (force), counts too, so the goal is easy to reach. */
    function checkStar(force) {
      if (hitT0 > -100) {
        if (!force && clock - hitT0 > 2.2 && !Object.keys(grabs).length && cy > floor - h) newStar(false);
        return;
      }
      if (Object.keys(grabs).length || clock - starT0 < 0.6) return;
      var mvy = 0, near = 1e9;
      for (var i = 0; i < N; i += 1) { mvy += vy[i]; near = Math.min(near, dist(px[i], py[i], star.x, star.y)); }
      mvy /= N;
      if (!force && mvy > -60 * Math.sqrt(gk)) return;
      if (!inside(star.x, star.y) && near > w * 0.14) return;
      hitT0 = clock; squintUntil = clock + 1.2; mouthUntil = clock + 0.6; n.stars += 1;
      squish(1);
      celebrate(star.x, star.y, [BODY, '#FFE27A', '#FFFFFF', DEEP]);
    }

    /* ---- input ---- */
    function down(p) {
      touches[p.id] = { x0: p.x, y0: p.y, t0: clock, moved: 0, s: [{ x: p.x, y: p.y, t: p.t }], inside: false };
      if (inside(p.x, p.y)) {
        var sig = w * 0.34, wt = new Float64Array(N), ox = new Float64Array(N), oy = new Float64Array(N);
        for (var i = 0; i < N; i += 1) {
          var dx = px[i] - p.x, dy = py[i] - p.y;
          wt[i] = Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig)); ox[i] = dx; oy[i] = dy;
        }
        grabs[p.id] = { w: wt, ox: ox, oy: oy, fx: p.x, fy: p.y };
        touches[p.id].inside = true;
        squintUntil = Math.max(squintUntil, clock + 0.3);
        squish(0.6); haptic(true, 12); n.grabs += 1;
      } else pokers[p.id] = { x: p.x, y: p.y };
    }
    function move(p) {
      var t = touches[p.id]; if (!t) return;
      t.moved = Math.max(t.moved, dist(t.x0, t.y0, p.x, p.y));
      t.s.push({ x: p.x, y: p.y, t: p.t }); if (t.s.length > 8) t.s.shift();
      if (grabs[p.id]) { grabs[p.id].fx = p.x; grabs[p.id].fy = p.y; }
      if (pokers[p.id]) { pokers[p.id].x = p.x; pokers[p.id].y = p.y; }
    }
    function up(p) {
      var t = touches[p.id]; if (!t) return;
      var g = grabs[p.id];
      delete touches[p.id]; delete grabs[p.id]; delete pokers[p.id];
      if (clock - t.t0 < 0.3 && t.moved < 12) { poke(p.x, p.y, 520, !t.inside); return; }
      if (!g) return;
      /* fling: pointer velocity over the last ~100 ms */
      var s = t.s, last = s[s.length - 1], a = last;
      for (var i = s.length - 1; i >= 0 && last.t - s[i].t < 110; i -= 1) a = s[i];
      var dt = Math.max(0.016, (last.t - a.t) / 1000), fvx = (last.x - a.x) / dt, fvy = (last.y - a.y) / dt;
      if (p.t - last.t > 120) { fvx = 0; fvy = 0; } /* held still before letting go */
      var sp = Math.sqrt(fvx * fvx + fvy * fvy), cap = 3600 * Math.sqrt(gk);
      if (sp > cap) { fvx *= cap / sp; fvy *= cap / sp; sp = cap; }
      for (i = 0; i < N; i += 1) { vx[i] += fvx * 0.35 * g.w[i]; vy[i] += fvy * 0.35 * g.w[i]; }
      var fl = clamp(sp / 2200, 0, 1);
      if (sp > 300) n.flings += 1;
      squish(0.4 + 0.3 * fl); haptic(true, 10 + Math.round(10 * fl));
      if (t.y0 - p.y > 40 * sk && fvy <= 0) checkStar(true);
    }

    /* ---- per frame ---- */
    function update(dt) {
      clock += dt;
      if (dt <= 0) return;
      impact = 0;
      if (!Object.keys(touches).length && env.idle() > 3.5 && clock - lastIdle > 3.4) {
        lastIdle = clock; /* stay alive in screenshots: a gentle silent wobble */
        var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        if (poke(cx + Math.cos(a) * w * 0.5, cy + Math.sin(a) * h * 0.5, 300, false)) n.pokes -= 1;
      }
      for (var k = 0; k < 5; k += 1) substep(dt / 5);
      centroid();
      minX = 1e9; maxX = -1e9; minY = 1e9; maxY = -1e9; wob = 0;
      for (var i = 0; i < N; i += 1) {
        if (px[i] < minX) minX = px[i]; if (px[i] > maxX) maxX = px[i];
        if (py[i] < minY) minY = py[i]; if (py[i] > maxY) maxY = py[i];
        wob += Math.abs(vx[i]) + Math.abs(vy[i]);
      }
      wob /= N;
      checkStar();
      var th = 650 * Math.sqrt(gk);
      if (impact > th && clock - lastLand > 0.25) {
        lastLand = clock; n.lands += 1;
        var v = clamp((impact - th) / (1400 * Math.sqrt(gk)), 0, 1);
        squish(0.35 + 0.6 * v); haptic(v > 0.3, 10 + Math.round(14 * v));
        mouthUntil = clock + 0.25;
      }
      if (clock > blinkAt + 0.14) blinkAt = clock + 2.2 + Math.random() * 3;
      /* where the face features sit on the bent body */
      var co = Math.cos(rot), si = Math.sin(rot);
      for (var f = 0; f < feats.length; f += 1) {
        var F = feats[f], wx = 0, wy = 0;
        for (i = 0; i < N; i += 1) {
          var wt = F.w[i];
          if (wt < 1e-4) continue;
          wx += (px[i] - (cx + co * qx[i] - si * qy[i])) * wt;
          wy += (py[i] - (cy + si * qx[i] + co * qy[i])) * wt;
        }
        F.ox = cx + co * F.x - si * F.y + wx * 0.7; F.oy = cy + si * F.x + co * F.y + wy * 0.7;
      }
    }

    function X(i, s) { i = (i + N) % N; return cx + (px[i] - cx) * s; }
    function Y(i, s) { i = (i + N) % N; return cy + (py[i] - cy) * s; }
    function bodyPath(s) {
      var P = new Path2D();
      P.moveTo(X(0, s), Y(0, s));
      for (var i = 0; i < N; i += 1) {
        P.bezierCurveTo(X(i, s) + (X(i + 1, s) - X(i - 1, s)) / 6, Y(i, s) + (Y(i + 1, s) - Y(i - 1, s)) / 6,
          X(i + 1, s) - (X(i + 2, s) - X(i, s)) / 6, Y(i + 1, s) - (Y(i + 2, s) - Y(i, s)) / 6, X(i + 1, s), Y(i + 1, s));
      }
      P.closePath();
      return P;
    }
    function drawStar(c) {
      var appear = clamp((clock - starT0) / 0.6, 0, 1), hit = hitT0 > -100 ? clamp((clock - hitT0) / 0.5, 0, 1) : 0;
      var a = appear * (1 - hit);
      if (a <= 0.01) return;
      var r = w * 0.1 * (1 + 0.6 * hit) * (0.6 + 0.4 * appear), x = star.x, y = star.y + Math.sin(clock * 2.2) * w * 0.015;
      var tw = 0.75 + 0.25 * Math.sin(clock * 3.1);
      var g = c.createRadialGradient(x, y, 0, x, y, r * 2.6);
      g.addColorStop(0, rgba('#FFE27A', 0.5 * a * tw)); g.addColorStop(1, rgba('#FFE27A', 0));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.6, 0, TAU); c.fill();
      c.beginPath();
      for (var i = 0; i < 10; i += 1) {
        var an = -Math.PI / 2 + Math.PI * i / 5 + clock * 0.3, rr = r * (i % 2 ? 0.45 : 1);
        if (i) c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); else c.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
      }
      c.closePath();
      c.fillStyle = rgba('#FFD54F', 0.95 * a); c.fill();
      c.lineJoin = 'round'; c.lineWidth = r * 0.12; c.strokeStyle = 'rgba(255,255,255,' + (0.8 * a).toFixed(3) + ')'; c.stroke();
    }
    function drawFace(c) {
      var hl = feats, le = hl[2], re = hl[3], mo = hl[4], lc = hl[5], rc = hl[6];
      var ew = w * 0.05, eh = w * 0.068;
      softOval(c, lc.ox, lc.oy, w * 0.062, w * 0.036, rot, '#FF5C8A', 0.3, 0.35);
      softOval(c, rc.ox, rc.oy, w * 0.062, w * 0.036, rot, '#FF5C8A', 0.3, 0.35);
      var squint = clock < squintUntil, blink = !squint && clock > blinkAt && clock < blinkAt + 0.14;
      c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = w * 0.017; c.lineCap = 'round'; c.lineJoin = 'round';
      var eyes = [[le, 1], [re, -1]];
      for (var k = 0; k < 2; k += 1) {
        var e = eyes[k][0], sd = eyes[k][1];
        c.save(); c.translate(e.ox, e.oy); c.rotate(rot);
        if (squint) {
          c.beginPath(); c.moveTo(-ew * 0.6 * sd, -eh * 0.45); c.lineTo(ew * 0.6 * sd, 0); c.lineTo(-ew * 0.6 * sd, eh * 0.45); c.stroke();
        } else if (blink) {
          c.beginPath(); c.moveTo(-ew * 0.6, 0); c.lineTo(ew * 0.6, 0); c.stroke();
        } else {
          c.beginPath(); c.ellipse(0, 0, ew / 2, eh / 2, 0, 0, TAU); c.fill();
          c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(-ew * 0.18, -eh * 0.2, ew * 0.2, 0, TAU); c.fill(); c.fillStyle = INK;
        }
        c.restore();
      }
      var mw = w * 0.05;
      c.save(); c.translate(mo.ox, mo.oy); c.rotate(rot);
      if (clock < mouthUntil) { c.beginPath(); c.ellipse(0, mw * 0.2, mw * 0.55, mw * 0.6, 0, 0, TAU); c.fill(); }
      else {
        c.lineWidth = w * 0.014;
        c.beginPath(); c.moveTo(-mw, 0); c.quadraticCurveTo(-mw * 0.5, mw * 0.8, 0, 0); c.quadraticCurveTo(mw * 0.5, mw * 0.8, mw, 0); c.stroke();
      }
      c.restore();
    }
    function draw(c) {
      if (!feats) return;
      var d = G.dpr;
      c.drawImage(plate.cv, W / 2 - plate.w / 2 - plate.m, floor + w * 0.03 - plate.h / 2 - plate.m, plate.cv.width / d, plate.cv.height / d);
      drawStar(c);
      var lift = clamp((floor - maxY) / (H * 0.4), 0, 1);
      softOval(c, cx, floor + 2, (maxX - minX) * (0.95 - 0.4 * lift) / 2, 9 * (1 - 0.5 * lift), 0, DEEP, 0.32 * (1 - lift), 0.35);
      var body = bodyPath(1);
      var g = c.createLinearGradient(0, minY, 0, maxY);
      g.addColorStop(0, LITE); g.addColorStop(0.45, BODY); g.addColorStop(1, DARK);
      c.fillStyle = g; c.fill(body);
      c.save(); c.clip(body);
      var rg = c.createRadialGradient(cx, cy + h * 0.1, 0, cx, cy + h * 0.1, h * 0.85);
      rg.addColorStop(0, rgba(DEEP, 0)); rg.addColorStop(1, rgba(DEEP, 0.28));
      c.fillStyle = rg; c.fillRect(minX, minY, maxX - minX, maxY - minY);
      softOval(c, cx, maxY - h * 0.06, (maxX - minX) * 0.36, h * 0.12, 0, '#FFFFFF', 0.2, 0.3);
      softOval(c, feats[0].ox, feats[0].oy, w * 0.16, h * 0.08, rot - 0.45, '#FFFFFF', 0.85, 0.62);
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(feats[1].ox, feats[1].oy, w * 0.022, 0, TAU); c.fill();
      c.restore();
      c.lineWidth = w * 0.03; c.strokeStyle = 'rgba(255,255,255,0.13)'; c.stroke(bodyPath(0.93));
      c.lineWidth = 1.6; c.strokeStyle = rgba(DEEP, 0.35); c.stroke(body);
      drawFace(c);
    }

    return {
      layout: layout, down: down, move: move, up: up, update: update, draw: draw,
      hint: function () {
        /* drag the jelly up toward the star: shows the throw */
        if (hitT0 > -100) return { x: cx, y: cy };
        var y0 = cy - h * 0.05;
        return { x: cx, y: y0, dx: (star.x - cx) * 0.7, dy: Math.min(-40, star.y + w * 0.12 - y0) };
      },
      debug: function () {
        return { pokes: n.pokes, grabs: n.grabs, flings: n.flings, lands: n.lands, stars: n.stars, held: Object.keys(grabs).length,
          cy: Math.round(cy), top: Math.round(minY), wob: Math.round(wob), star: [Math.round(star.x), Math.round(star.y)], starHit: hitT0 > -100 };
      },
      destroy: function () { grabs = {}; touches = {}; pokers = {}; plate = null; }
    };
  }

  GAMES['jelly'] = {
    name: { ko: '말랑 젤리', ja: 'ぷるぷるゼリー', en: 'Squishy Jelly' },
    tip: { ko: '휙 던져서 별을 맞혀 보세요', ja: '上に投げて星に当ててみて', en: 'Toss it up to hit the star' },
    bg: 'linear-gradient(180deg,#FFF1E8 0%,#FDDCCB 100%) #FFF1E8',
    tone: 'light',
    top: '#FFF1E8',
    accent: '#FF7A9C',
    make: Jelly
  };
})();
