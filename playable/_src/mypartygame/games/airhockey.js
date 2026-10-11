/* 에어하키 (airhockey): you against the computer on the app's teal table (airhockey.dart _TablePainter / _ActorPainter colours).
   AirHockeyPhysics is ported as is: table width 1, length = height / width, 1/240 s substeps, heavy mallets, round corners, goal posts.
   You drag the pink bottom mallet; the blue top mallet is a small computer player (holds a line in front of its goal, attacks the
   puck from behind when it rests on its side). First to 3 goals, the result for a beat, then a new match by itself. */
(function () {
  'use strict';
  var T = {
    ko: { goal: '골!', mp: '매치 포인트!', go: '시작!', win: '이겼어요!', lose: '졌어요', again: '다시 하기', you: '나', cpu: '컴퓨터' },
    ja: { goal: 'ゴール！', mp: 'マッチポイント！', go: 'スタート！', win: '勝ち！', lose: '負け…', again: 'もう一回', you: 'あなた', cpu: 'コンピューター' },
    en: { goal: 'Goal!', mp: 'Match point!', go: 'Go!', win: 'You win!', lose: 'You lose', again: 'Play again', you: 'You', cpu: 'Computer' }
  };
  // AirHockeyPhysics constants (lengths in table widths, time in seconds)
  var PR = 0.05, MR = 0.08, GHW = 0.18, RC = 0.14, MAXP = 6.5, MAXM = 12, REST = 0.9, WREST = 0.85, MASS = 12, FRIC = 0.3;
  var STEP = 1 / 240, HOME = 0.13, RIMK = 0.05, TARGET = 3;
  var COL = ['#FF5C7A', '#3E9BFF'], TEAL = '#00A9AE', CONF = ['#FFB020', '#00C2C7', '#FF5C7A', '#A368FF', '#2FC85E'];

  // HSL lightness shift like the app's _shade()
  function shade(hex, dl) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    l = Math.max(0, Math.min(1, l + dl));
    return 'hsl(' + h.toFixed(1) + ',' + (s * 100).toFixed(1) + '%,' + (l * 100).toFixed(1) + '%)';
  }
  var MDARK = [shade(COL[0], -0.17), shade(COL[1], -0.17)], MLIGHT = [shade(COL[0], 0.13), shade(COL[1], 0.13)];
  var MDISH = [shade(COL[0], -0.077), shade(COL[1], -0.077)];
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function backOut(t) { var u = t - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; }
  function elasticOut(t) { return t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 2 * Math.PI / 0.4) + 1; }
  // rounded rect path with per-corner radii (tl, tr, br, bl)
  function rr(g, x, y, w, h, a, b, c, d) {
    if (b == null) { b = c = d = a; }
    g.beginPath(); g.moveTo(x + a, y);
    g.lineTo(x + w - b, y); if (b) g.arc(x + w - b, y + b, b, -Math.PI / 2, 0);
    g.lineTo(x + w, y + h - c); if (c) g.arc(x + w - c, y + h - c, c, 0, Math.PI / 2);
    g.lineTo(x + d, y + h); if (d) g.arc(x + d, y + h - d, d, Math.PI / 2, Math.PI);
    g.lineTo(x, y + a); if (a) g.arc(x + a, y + a, a, Math.PI, Math.PI * 1.5);
    g.closePath();
  }
  var SAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9"/><path d="M8.2 16.4c2.1-2 5.5-2 7.6 0"/><circle cx="9" cy="10" r=".9" fill="currentColor"/><circle cx="15" cy="10" r=".9" fill="currentColor"/></svg>';

  GAMES['airhockey'] = {
    name: { ko: '에어하키', ja: 'エアホッケー', en: 'Air Hockey' },
    tip: { ko: '채를 끌어서 퍽을 골문에 넣어요', ja: 'マレットを動かしてゴールを狙おう', en: 'Drag your mallet and score a goal' },
    cat: 'duel', accent: '#00C2C7',
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx, TAU = ctx.TAU, rgba = ctx.rgba, FONT = ctx.FONT;
      var root = ctx.el;
      var wrap = ctx.mk('div', 'pl'); root.appendChild(wrap);
      var c = ctx.canvas(wrap), cv = c.cv, g = c.g;
      var tb = document.createElement('canvas'), tg = tb.getContext('2d');
      var card = ctx.mk('div', 'card', '<div class="ic"></div><div class="tt"></div><div class="sc"></div>' +
        '<div class="ag">' + ctx.ICON.again + '<span>' + ctx.esc(t.again) + '</span></div>');
      wrap.appendChild(card);
      var cardIc = card.querySelector('.ic'), cardTt = card.querySelector('.tt'), cardSc = card.querySelector('.sc');

      /* ---------- physics (AirHockeyPhysics) ---------- */
      var len = 1.8, P = { x: 0.5, y: 0.9, vx: 0, vy: 0 };
      var M = [{ x: 0.5, y: 1.67, vx: 0, vy: 0 }, { x: 0.5, y: 0.13, vx: 0, vy: 0 }];
      var aimX = [0.5, 0.5], aimY = [1.67, 0.13], live = true, qx = 0, qy = 0;
      var tPrev = [false, false], tNow = [false, false], wPrev = false, wNow = false, hitX = 0, hitY = 0, wallX = 0, wallY = 0;
      var FX = [0, 0], FY = [0, 0], TX = [0, 0], TY = [0, 0];

      function homeY(sd) { return sd === 0 ? len - HOME : HOME; }
      // nearest allowed mallet spot (own half, inside the round-cornered table) -> qx, qy
      function cl(sd, x, y) {
        var X = x !== x ? 0.5 : clamp(x, MR, 1 - MR);
        var lo = sd === 0 ? len / 2 + MR : MR, hi = sd === 0 ? len - MR : len / 2 - MR;
        var Y = y !== y ? (lo + hi) / 2 : clamp(y, lo, hi);
        var kx = X < RC ? RC : (X > 1 - RC ? 1 - RC : -1), ky = Y < RC ? RC : (Y > len - RC ? len - RC : -1);
        if (kx >= 0 && ky >= 0) {
          var lim = RC - MR, dx = X - kx, dy = Y - ky, d = Math.sqrt(dx * dx + dy * dy);
          if (d > lim) { X = kx + dx / d * lim; Y = ky + dy / d * lim; }
        }
        qx = X; qy = Y;
      }
      function putMallet(sd, x, y) { cl(sd, x, y); var m = M[sd]; m.x = qx; m.y = qy; m.vx = m.vy = 0; aimX[sd] = qx; aimY[sd] = qy; }
      function placePuck(x, y) {
        P.x = x; P.y = y; P.vx = P.vy = 0; live = true;
        tPrev[0] = tPrev[1] = false; wPrev = false; unpin(0, false); unpin(1, false);
      }
      // the side that conceded gets the puck, resting on its half where its mallet is not
      function serve(sd) {
        var m = M[sd], y0 = sd === 0 ? len * 0.7 : len * 0.3, y1 = sd === 0 ? len * 0.84 : len * 0.16, clr = PR + MR + 0.05;
        var bx = 0.5, by = y0, best = -1, ys = [y0, y1], xs = [0.5, 0.27, 0.73];
        for (var i = 0; i < 2; i++) for (var j = 0; j < 3; j++) {
          var dx = xs[j] - m.x, dy = ys[i] - m.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d >= clr) { placePuck(xs[j], ys[i]); return; }
          if (d > best) { best = d; bx = xs[j]; by = ys[i]; }
        }
        placePuck(bx, by);
      }
      function setLength(v) {
        if (!(v > 0) || v === len) return;
        var k = v / len; len = v; P.y *= k;
        for (var sd = 0; sd < 2; sd++) { aimY[sd] *= k; var m = M[sd]; cl(sd, m.x, m.y * k); m.x = qx; m.y = qy; }
      }
      function update(dt) {
        if (!(dt > 0)) return;
        var n = Math.max(1, Math.ceil(dt / STEP - 1e-9)), h = dt / n, damp = Math.exp(-FRIC * h), sd, k;
        for (sd = 0; sd < 2; sd++) { FX[sd] = M[sd].x; FY[sd] = M[sd].y; cl(sd, aimX[sd], aimY[sd]); TX[sd] = qx; TY[sd] = qy; }
        for (k = 1; k <= n; k++) {
          var f = k / n;
          for (sd = 0; sd < 2; sd++) moveMallet(sd, FX[sd] + (TX[sd] - FX[sd]) * f, FY[sd] + (TY[sd] - FY[sd]) * f, h);
          stepPuck(h, damp);
        }
      }
      function moveMallet(sd, gx, gy, h) {
        var m = M[sd], dx = gx - m.x, dy = gy - m.y, d = Math.sqrt(dx * dx + dy * dy), maxD = MAXM * h;
        if (d > maxD) { dx *= maxD / d; dy *= maxD / d; }
        cl(sd, m.x + dx, m.y + dy);
        m.vx = (qx - m.x) / h; m.vy = (qy - m.y) / h; m.x = qx; m.y = qy;
      }
      function stepPuck(h, damp) {
        var p = P;
        if (!live) {
          // sliding into the goal: no more hits, stops inside the slot
          var k = Math.exp(-9 * h), deep = PR * 0.6;
          p.vx *= k; p.vy *= k; p.x += p.vx * h; p.y += p.vy * h;
          if (p.y < -deep) { p.y = -deep; p.vy = 0; } else if (p.y > len + deep) { p.y = len + deep; p.vy = 0; }
          if (p.y < 0 || p.y > len) { var lim = GHW - PR * 0.4; p.x = clamp(p.x, 0.5 - lim, 0.5 + lim); }
          return;
        }
        p.vx *= damp; p.vy *= damp; cap();
        p.x += p.vx * h; p.y += p.vy * h;
        tNow[0] = tNow[1] = false; wNow = false;
        hitMallet(0); hitMallet(1); walls(); unpin(0, true); unpin(1, true); cap();
        tPrev[0] = tNow[0]; tPrev[1] = tNow[1]; wPrev = wNow;
        if (Math.abs(p.x - 0.5) < GHW) { if (p.y < 0) onGoal(0); else if (p.y > len) onGoal(1); }
      }
      function hitMallet(sd) {
        var p = P, m = M[sd], r = PR + MR, nx = p.x - m.x, ny = p.y - m.y, d2 = nx * nx + ny * ny;
        if (d2 >= r * r) return;
        tNow[sd] = true;
        var d = Math.sqrt(d2);
        if (d < 1e-9) { nx = 0; ny = sd === 0 ? -1 : 1; } else { nx /= d; ny /= d; }
        p.x = m.x + nx * r; p.y = m.y + ny * r;
        var vn = (p.vx - m.vx) * nx + (p.vy - m.vy) * ny;
        if (vn < 0) {
          var k = (1 + REST) * MASS / (1 + MASS);
          p.vx -= k * vn * nx; p.vy -= k * vn * ny;
          if (!tPrev[sd]) { hitX = m.x + nx * MR; hitY = m.y + ny * MR; onMalletHit(sd, -vn); }
        }
      }
      function walls() {
        var p = P;
        if (p.y < RC) { if (p.x < RC) corner(RC, RC); else if (p.x > 1 - RC) corner(1 - RC, RC); }
        else if (p.y > len - RC) { if (p.x < RC) corner(RC, len - RC); else if (p.x > 1 - RC) corner(1 - RC, len - RC); }
        if (p.x < PR) { p.x = PR; wNow = true; wallX = 0; wallY = p.y; if (p.vx < 0) { bounce(-p.vx); p.vx = -p.vx * WREST; } }
        else if (p.x > 1 - PR) { p.x = 1 - PR; wNow = true; wallX = 1; wallY = p.y; if (p.vx > 0) { bounce(p.vx); p.vx = -p.vx * WREST; } }
        if (p.y < PR) endWall(0, 1); else if (p.y > len - PR) endWall(len, -1);
      }
      function corner(kx, ky) {
        var p = P, lim = RC - PR, dx = p.x - kx, dy = p.y - ky, d2 = dx * dx + dy * dy;
        if (d2 <= lim * lim) return;
        var d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        p.x = kx + nx * lim; p.y = ky + ny * lim; wNow = true; wallX = kx + nx * RC; wallY = ky + ny * RC;
        var vn = p.vx * nx + p.vy * ny;
        if (vn > 0) { p.vx -= (1 + WREST) * vn * nx; p.vy -= (1 + WREST) * vn * ny; bounce(vn); }
      }
      // end wall at y = wy (inward = direction into the table): flat outside the goal mouth, only the two posts inside it
      function endWall(wy, inward) {
        var p = P, lo = 0.5 - GHW, hi = 0.5 + GHW;
        if (p.x <= lo || p.x >= hi) {
          if ((p.y - wy) * inward < PR) {
            p.y = wy + inward * PR; wNow = true; wallX = p.x; wallY = wy;
            var vn = p.vy * inward;
            if (vn < 0) { p.vy = -p.vy * WREST; bounce(-vn); }
          }
        } else { post(lo, wy, inward); post(hi, wy, inward); }
      }
      function post(x, wy, inward) {
        var p = P, nx = p.x - x, ny = p.y - wy, d2 = nx * nx + ny * ny;
        if (d2 >= PR * PR) return;
        var d = Math.sqrt(d2);
        if (d < 1e-9) { nx = 0; ny = inward; } else { nx /= d; ny /= d; }
        p.x = x + nx * PR; p.y = wy + ny * PR; wNow = true; wallX = x; wallY = wy;
        var vn = p.vx * nx + p.vy * ny;
        if (vn < 0) { p.vx -= (1 + WREST) * vn * nx; p.vy -= (1 + WREST) * vn * ny; bounce(-vn); }
      }
      // a puck pushed against a wall that still overlaps a mallet moves the mallet aside (and loses its kick toward it)
      function unpin(sd, kill) {
        var p = P, m = M[sd], r = PR + MR, nx = p.x - m.x, ny = p.y - m.y, d2 = nx * nx + ny * ny;
        if (d2 >= (r - 1e-7) * (r - 1e-7)) return;
        var d = Math.sqrt(d2);
        if (d < 1e-9) { nx = 0; ny = sd === 0 ? -1 : 1; } else { nx /= d; ny /= d; }
        cl(sd, p.x - nx * r, p.y - ny * r); m.x = qx; m.y = qy;
        if (kill) {
          tNow[sd] = true;
          var vn = p.vx * nx + p.vy * ny;
          if (vn < 0) { p.vx -= vn * nx; p.vy -= vn * ny; }
        }
      }
      function cap() {
        var v2 = P.vx * P.vx + P.vy * P.vy;
        if (v2 > MAXP * MAXP) { var k = MAXP / Math.sqrt(v2); P.vx *= k; P.vy *= k; }
        else if (v2 < 1e-6) { P.vx = P.vy = 0; }
      }
      function bounce(impact) { if (!wPrev) onWallHit(impact); }

      /* ---------- game state ---------- */
      var phase = 'play', phaseT = 0, clock = 0, scores = [0, 0], lastScorer = 0, winner = -1, matches = 0;
      var goT = -1, ptr = null, holding = false, quiet = 0, lastHitSfx = -1, lastWallSfx = -1, winAt = -1;
      var hits = [0, 0], goals = 0;
      // look (the app's _Scene): puck pop-in, trail, hit rings, sparks, goal glow, mallet pulse / held halo
      var appear = 1, pAlpha = 1, pScale = 1, heldA = 0, pulse = [0, 0], lastHitter = -1, glow = 0, glowY = 0, glowCol = TEAL;
      var TRN = 14, trX = new Float32Array(TRN), trY = new Float32Array(TRN), trV = new Float32Array(TRN), trHead = 0, trLen = 0;
      var RN = 8, RLIFE = 0.4, rX = new Float32Array(RN), rY = new Float32Array(RN), rAge = new Float32Array(RN).fill(9), rK = new Float32Array(RN), rSide = new Int8Array(RN), rI = 0;
      var SN = 72, sX = new Float32Array(SN), sY = new Float32Array(SN), sVX = new Float32Array(SN), sVY = new Float32Array(SN);
      var sLife = new Float32Array(SN), sMax = new Float32Array(SN).fill(1), sSize = new Float32Array(SN), sCol = new Array(SN), sI = 0;

      function ring(x, y, k, sd) { var i = rI; rI = (rI + 1) % RN; rX[i] = x; rY[i] = y; rAge[i] = 0; rK[i] = k; rSide[i] = sd; }
      function spray(x, y, dx, dy, spread, n, sd, speed) {
        var base = Math.atan2(dy, dx);
        for (var j = 0; j < n; j++) {
          var i = sI; sI = (sI + 1) % SN;
          var a = base + (Math.random() - 0.5) * spread, v = speed * (0.45 + Math.random() * 0.75), life = 0.45 + Math.random() * 0.5;
          sX[i] = x; sY[i] = y; sVX[i] = Math.cos(a) * v; sVY[i] = Math.sin(a) * v; sLife[i] = life; sMax[i] = life;
          sSize[i] = 0.008 + Math.random() * 0.011; sCol[i] = j % 3 === 0 ? COL[sd] : CONF[ctx.rnd(CONF.length)];
        }
      }

      /* ---------- physics news: sound, haptics, effects ---------- */
      function onMalletHit(sd, impact) {
        lastHitter = sd; hits[sd]++;
        if (sd === 1) aiHitAt = clock;
        if (impact < 0.35) return;
        var k = clamp(impact / 5, 0, 1);
        pulse[sd] = Math.max(pulse[sd], 0.35 + 0.65 * k);
        ring(hitX, hitY, k, sd);
        if (impact > 3.2) spray(hitX, hitY, P.vx, P.vy, 1.6, Math.round(4 + 8 * k), sd, 1.2 + 1.2 * k);
        if (clock - lastHitSfx < 0.06) return;
        lastHitSfx = clock;
        if (impact < 1.6) S.pop(0.15 + 0.2 * k);
        else { S.thud(); if (impact > 3.6) S.noise(0.05, 0.35, 6000, 2000, 'bandpass'); }
        if (sd === 0) ctx.buzz(Math.round(8 + 22 * k));
      }
      function onWallHit(impact) {
        if (impact < 0.45) return;
        var k = clamp(impact / 6, 0, 1);
        if (impact > 1.2) ring(wallX, wallY, k * 0.6, -1);
        if (clock - lastWallSfx < 0.06) return;
        lastWallSfx = clock;
        S.tick(impact > 3);
        if (impact > 2.4) ctx.buzz(6);
      }
      function onGoal(scorer) {
        var conceder = 1 - scorer;
        live = false; scores[scorer]++; lastScorer = scorer; goals++;
        phase = 'goal'; phaseT = 0; goT = -1;
        var mouthY = conceder === 0 ? len : 0;
        glow = 1; glowY = mouthY; glowCol = COL[scorer];
        spray(0.5, mouthY, 0, conceder === 0 ? -1 : 1, 2.4, 30, scorer, 1.9);
        S.tone(392, 0.16, 'square', 0.09); S.tone(523, 0.42, 'square', 0.1, null, 0.13); S.bang();
        ctx.buzz([40, 60, 30]);
        ctx.burst(offX + tx + s / 2, offY + ty + mouthY * s, 60, { speed: 560, colors: [COL[scorer], '#FFB020', '#00C2C7', '#A368FF', '#2FC85E'] });
      }

      /* ---------- flow ---------- */
      function startMatch(first) {
        scores = [0, 0]; winner = -1; winAt = -1; lastHitter = -1; trLen = 0;
        if (!first) matches++;
        putMallet(1, 0.5, homeY(1));
        if (first || ptr === null) putMallet(0, 0.5, homeY(0));
        placePuck(0.5, len / 2 + 0.17);
        appear = first ? 1 : 0; phase = 'play'; phaseT = 0; goT = first ? -1 : 0; aiWait = 0.6;
        card.className = 'card';
        if (!first) S.go();
      }
      function finish(w) {
        live = false; P.vx = P.vy = 0;
        phase = 'over'; phaseT = 0; winner = w; winAt = 0.22;
        S.stamp();
        card.className = 'card on' + (w === 0 ? '' : ' lose');
        cardIc.innerHTML = w === 0 ? ctx.ICON.trophy : SAD;
        cardTt.textContent = w === 0 ? t.win : t.lose;
        cardSc.textContent = scores[0] + ' : ' + scores[1];
        if (w === 0) ctx.rain(60);
      }
      function timeline() {
        if (phase === 'goal' && phaseT >= 1.0) {
          if (scores[lastScorer] >= TARGET) finish(lastScorer);
          else {
            serve(1 - lastScorer); trLen = 0; appear = 0; phase = 'play'; phaseT = 0;
            aiWait = 0.5; S.pop(0.5);
          }
        } else if (phase === 'over') {
          if (winAt >= 0 && phaseT >= winAt) { winAt = -1; if (winner === 0) S.win(); else S.lose(); }
          if (phaseT >= 3.0) startMatch(false);
        }
      }

      /* ---------- the computer (top mallet) ---------- */
      var aiTx = 0.5, aiTy = HOME, aiNext = 0, aiWait = 0.6, aiMode = 'home', aiJit = 0, aiHitAt = 0, aiSince = 0;
      function ai(dt) {
        var m = M[1], p = P, half = len / 2;
        aiNext -= dt; aiWait -= dt;
        var mine = p.y < half + PR * 0.5;
        if (mine && live) aiSince += dt; else aiSince = 0;
        if (aiNext <= 0) {
          aiNext = 0.06 + Math.random() * 0.06;
          if (phase !== 'play' || !live || aiWait > 0) { aiMode = 'home'; aiTx = 0.5; aiTy = HOME + 0.04; }
          else if (mine && p.vy > -1.4) {
            if (aiSince > 2.2 && clock - aiHitAt > 1.6) {
              // stuck somewhere awkward (wall, corner): just go at it
              aiMode = 'hit'; aiTx = p.x; aiTy = p.y;
            } else {
              aiMode = 'atk';
              var open = Math.abs(M[0].x - 0.5) < 0.05 ? (aiJit > 0 ? 1 : -1) : (M[0].x < 0.5 ? 1 : -1);
              // aim at the side of the goal your mallet leaves open
              var gx = 0.5 + open * (0.07 + Math.abs(aiJit) * 0.4), gy = len + 0.25, ux = gx - p.x, uy = gy - p.y, d = Math.sqrt(ux * ux + uy * uy);
              ux /= d; uy /= d;
              var lead = 0.07, bx = p.x + p.vx * lead - ux * (PR + MR + 0.03), by = p.y + p.vy * lead - uy * (PR + MR + 0.03);
              if (m.y > p.y - 0.02) {
                // on the wrong side of the puck: go round it
                var sx = m.x < p.x ? -1 : 1, ox = p.x + sx * (PR + MR + 0.07);
                if (ox < MR || ox > 1 - MR) { sx = -sx; ox = p.x + sx * (PR + MR + 0.07); }
                aiTx = ox; aiTy = p.y - 0.07;
              } else if (Math.sqrt((m.x - bx) * (m.x - bx) + (m.y - by) * (m.y - by)) < 0.06) {
                aiMode = 'hit'; aiTx = p.x + ux * 0.3; aiTy = p.y + uy * 0.3;
              } else { aiTx = bx; aiTy = by; }
            }
          } else {
            // defend a line in front of the goal, leaning toward where the puck will cross it
            aiMode = 'def';
            var ly = 0.2, px = p.x;
            if (p.vy < -0.2) {
              var tt = (p.y - ly) / -p.vy, span = 1 - 2 * PR, u = (p.x + p.vx * tt - PR) / span;
              u = u - 2 * Math.floor(u / 2); if (u > 1) u = 2 - u;
              px = PR + u * span;
            }
            aiTx = clamp(0.5 + (px - 0.5) * 0.7, 0.3, 0.7); aiTy = ly;
          }
        }
        var lead2 = scores[0] - scores[1];
        var sp = aiMode === 'hit' ? 3.6 : aiMode === 'atk' ? 2.6 : aiMode === 'def' ? 2.0 : 1.5;
        sp *= 1 + clamp(lead2, -1, 2) * 0.08;
        var dx = aiTx - m.x, dy = aiTy - m.y, dd = Math.sqrt(dx * dx + dy * dy), mx = sp * dt;
        if (dd > mx) { dx *= mx / dd; dy *= mx / dd; }
        aimX[1] = m.x + dx; aimY[1] = m.y + dy;
      }
      function rejig() { aiJit = (Math.random() - 0.5) * 0.3; }

      /* ---------- geometry and drawing ---------- */
      var W = 0, H = 0, dpr = ctx.dpr, s = 100, th = 180, tx = 0, ty = 0, offX = 0, offY = 0;

      function paintTable() {
        var gg = tg, dark = ctx.dark, rim = s * RIMK, rc = RC * s, cx = tx + s / 2, cy = ty + th / 2;
        gg.setTransform(dpr, 0, 0, dpr, 0, 0); gg.clearRect(0, 0, W, H);
        // shadow and rim
        rr(gg, tx - rim + 1, ty - rim + rim * 0.75, s + 2 * rim - 2, th + 2 * rim, rc + rim);
        gg.fillStyle = dark ? 'rgba(0,0,0,.45)' : 'rgba(0,40,44,.16)'; gg.fill();
        var gr = gg.createLinearGradient(0, ty - rim, 0, ty + th + rim);
        gr.addColorStop(0, dark ? '#1F6B6F' : '#3FDCE0'); gr.addColorStop(1, dark ? '#134447' : '#00AAB0');
        rr(gg, tx - rim, ty - rim, s + 2 * rim, th + 2 * rim, rc + rim); gg.fillStyle = gr; gg.fill();
        rr(gg, tx - rim * 0.8, ty - rim * 0.8, s + rim * 1.6, th + rim * 1.6, rc + rim * 0.8);
        gg.lineWidth = Math.max(1, rim * 0.14); gg.strokeStyle = 'rgba(255,255,255,' + (dark ? 0.12 : 0.35) + ')'; gg.stroke();
        // surface
        rr(gg, tx, ty, s, th, rc); gg.fillStyle = dark ? '#14272A' : '#F6FCFD'; gg.fill();
        gg.save(); rr(gg, tx, ty, s, th, rc); gg.clip();
        gg.fillStyle = rgba(COL[1], dark ? 0.07 : 0.055); gg.fillRect(tx, ty, s, th / 2);
        gg.fillStyle = rgba(COL[0], dark ? 0.07 : 0.055); gg.fillRect(tx, cy, s, th / 2);
        var rg = gg.createRadialGradient(cx, cy, 0, cx, cy, th * 0.55);
        rg.addColorStop(0, 'rgba(255,255,255,' + (dark ? 0.05 : 0.55) + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        gg.fillStyle = rg; gg.fillRect(tx, ty, s, th);
        // air holes
        var sp = s / 17, hr = Math.max(0.8, s * 0.0042);
        gg.beginPath();
        for (var y = ty + sp * 0.5; y < ty + th; y += sp) for (var x = tx + sp * 0.5; x < tx + s; x += sp) { gg.moveTo(x + hr, y); gg.arc(x, y, hr, 0, TAU); }
        gg.fillStyle = dark ? 'rgba(255,255,255,.07)' : rgba(TEAL, 0.16); gg.fill();
        // goal arcs in the defender's colour
        for (var sd = 0; sd < 2; sd++) {
          gg.beginPath(); gg.arc(cx, sd === 0 ? ty + th : ty, s * 0.27, 0, TAU);
          gg.fillStyle = rgba(COL[sd], 0.1); gg.fill();
          gg.lineWidth = s * 0.009; gg.strokeStyle = rgba(COL[sd], 0.5); gg.stroke();
        }
        // centre line, circle, dot
        var lc = dark ? 'rgba(255,255,255,.22)' : rgba(TEAL, 0.38);
        gg.lineWidth = s * 0.011; gg.strokeStyle = lc;
        gg.beginPath(); gg.moveTo(tx, cy); gg.lineTo(tx + s, cy); gg.stroke();
        gg.beginPath(); gg.arc(cx, cy, s * 0.16, 0, TAU); gg.stroke();
        gg.beginPath(); gg.arc(cx, cy, s * 0.022, 0, TAU); gg.fillStyle = lc; gg.fill();
        gg.restore();
        rr(gg, tx, ty, s, th, rc); gg.lineWidth = 1.5; gg.strokeStyle = 'rgba(255,255,255,' + (dark ? 0.1 : 0.85) + ')'; gg.stroke();
        // goal slots cut in the rim, posts in the defender's colour
        var gw = GHW * s, depth = rim * 0.9, rad = rim * 0.45;
        for (sd = 0; sd < 2; sd++) {
          var edge = sd === 0 ? ty + th : ty;
          if (sd === 0) rr(gg, cx - gw, edge - 1, gw * 2, depth + 1, 0, 0, rad, rad);
          else rr(gg, cx - gw, edge - depth, gw * 2, depth + 1, rad, rad, 0, 0);
          gg.fillStyle = dark ? '#040A0B' : '#0D3B3E'; gg.fill();
          for (var q = -1; q <= 1; q += 2) {
            var px = cx + q * gw;
            gg.beginPath(); gg.arc(px, edge, rim * 0.45, 0, TAU); gg.fillStyle = COL[sd]; gg.fill();
            gg.beginPath(); gg.arc(px - rim * 0.12, edge - rim * 0.13, rim * 0.14, 0, TAU); gg.fillStyle = 'rgba(255,255,255,.65)'; gg.fill();
          }
        }
      }

      function label(txt, x, y, size, color, halo) {
        g.font = '900 ' + Math.round(size) + 'px ' + FONT;
        if (halo) { g.lineWidth = Math.max(3, size * 0.16); g.strokeStyle = halo; g.lineJoin = 'round'; g.strokeText(txt, x, y); }
        g.fillStyle = color; g.fillText(txt, x, y);
      }
      function popIn(age, dur) { var k = clamp(age / dur, 0, 1); return { a: clamp(k * 3, 0, 1), s: 1.6 - 0.6 * backOut(k) }; }

      // faint big score in each half, between the mallet's home and the centre line, its label on the centre-line side
      function drawMarks() {
        var dark = ctx.dark, cx = tx + s / 2, base = dark ? 0.24 : 0.18, goal = phase === 'goal';
        var room = (len / 2 - HOME - MR - 0.02) * s, fs = Math.max(28, Math.min(s * 0.42, room * 0.66)), blk = fs * 1.3;
        var ink = dark ? '241,247,248' : '23,39,43';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        for (var sd = 0; sd < 2; sd++) {
          var y0 = sd === 1 ? ty + (HOME + MR + 0.02) * s + (room - blk) / 2 : ty + th / 2 + (room - blk) / 2;
          var ny = sd === 1 ? y0 + fs * 0.5 : y0 + blk - fs * 0.5, ly = sd === 1 ? y0 + fs * 1.15 : y0 + fs * 0.12;
          var pop = goal && lastScorer === sd, k = pop ? clamp(phaseT / 1.0, 0, 1) : 1, hi = pop ? 1 - k * k * k : 0;
          var sc = pop ? 1 + 0.55 * (1 - elasticOut(k)) : 1;
          g.save(); g.translate(cx, ny); g.scale(sc, sc);
          g.globalAlpha = base + (0.95 - base) * hi; label(String(scores[sd]), 0, 0, fs, COL[sd]); g.restore();
          // the labels step aside while "Goal!" sits on the centre line
          g.globalAlpha = goal ? clamp(1 - phaseT * 6, 0, 1) : clamp(phaseT * 4, 0, 1);
          g.font = '800 ' + Math.round(Math.max(12, fs * 0.17)) + 'px ' + FONT;
          g.fillStyle = 'rgba(' + ink + ',' + (dark ? 0.42 : 0.34) + ')';
          g.fillText(sd === 0 ? t.you : t.cpu, cx, ly);
        }
        g.globalAlpha = 1;
      }

      function drawGoal() {
        var cx = tx + s / 2, mid = ty + th / 2, halo = ctx.dark ? 'rgba(10,20,22,.8)' : 'rgba(255,255,255,.92)';
        if (phase === 'goal') {
          g.textAlign = 'center'; g.textBaseline = 'middle';
          var pi = popIn(phaseT, 0.52), gs = Math.min(s * 0.17, th * 0.085);
          g.save(); g.globalAlpha = pi.a; g.translate(cx, mid); g.scale(pi.s, pi.s);
          label(t.goal, 0, 0, gs, COL[lastScorer], halo); g.restore();
          if (scores[lastScorer] < TARGET && (scores[0] === TARGET - 1 || scores[1] === TARGET - 1) && phaseT > 0.25) {
            var fz = Math.max(12, gs * 0.3), tw, py = mid + gs * 0.95;
            g.font = '900 ' + Math.round(fz) + 'px ' + FONT; tw = g.measureText(t.mp).width;
            rr(g, cx - tw / 2 - fz * 0.8, py - fz * 0.85, tw + fz * 1.6, fz * 1.7, fz * 0.85);
            g.fillStyle = '#FFB020'; g.fill(); g.fillStyle = '#3A2600'; g.fillText(t.mp, cx, py + 1);
          }
        }
      }

      function draw() {
        var dark = ctx.dark;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        g.drawImage(tb, 0, 0, W, H);
        if (phase !== 'over') drawMarks();
        var ox = tx, oy = ty, cx = tx + s / 2, i;
        // goal glow at the conceded mouth, in the scorer's colour
        if (glow > 0) {
          var gy = oy + glowY * s, rx = s * (0.31 + 0.15 * (1 - glow)), ry = s * (0.17 + 0.06 * (1 - glow));
          g.save(); g.translate(cx, gy); g.scale(1, ry / rx);
          var gr = g.createRadialGradient(0, 0, 0, 0, 0, rx * 1.25);
          gr.addColorStop(0, rgba(glowCol, 0.65 * glow)); gr.addColorStop(1, rgba(glowCol, 0));
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx * 1.25, 0, TAU); g.fill(); g.restore();
          rr(g, cx - GHW * s, gy - s * 0.0225, GHW * s * 2, s * 0.045, s * 0.0225);
          g.fillStyle = 'rgba(255,255,255,' + (0.7 * glow * glow).toFixed(3) + ')'; g.fill();
        }
        // hit rings
        g.lineCap = 'round';
        for (i = 0; i < RN; i++) {
          if (rAge[i] >= RLIFE) continue;
          var f = rAge[i] / RLIFE, k = rK[i], col = rSide[i] < 0 ? (dark ? '#FFFFFF' : TEAL) : COL[rSide[i]];
          g.strokeStyle = rgba(col, (1 - f) * (0.3 + 0.5 * k)); g.lineWidth = Math.max(1, s * 0.014 * (1 - f));
          g.beginPath(); g.arc(ox + rX[i] * s, oy + rY[i] * s, s * (0.02 + (0.05 + 0.09 * k) * (1 - (1 - f) * (1 - f))), 0, TAU); g.stroke();
        }
        var pr = PR * s, pa = pAlpha;
        // trail when fast, in the last hitter's colour
        if (trLen > 1 && pa > 0.02) {
          var tc = lastHitter < 0 ? (dark ? '#FFFFFF' : TEAL) : COL[lastHitter], prev = (trHead - trLen + TRN) % TRN;
          for (var j = 1; j < trLen; j++) {
            var ni = (prev + 1) % TRN, v = Math.min(trV[prev], trV[ni]), ff = clamp((v - 1.4) / 3, 0, 1);
            if (ff > 0) {
              var age = j / trLen;
              g.strokeStyle = rgba(tc, 0.4 * ff * age * pa); g.lineWidth = pr * 2 * (0.18 + 0.7 * age);
              g.beginPath(); g.moveTo(ox + trX[prev] * s, oy + trY[prev] * s); g.lineTo(ox + trX[ni] * s, oy + trY[ni] * s); g.stroke();
            }
            prev = ni;
          }
        }
        // puck
        if (pa > 0.01) {
          var r = pr * pScale, px = ox + P.x * s, py = oy + P.y * s;
          g.globalAlpha = pa;
          g.fillStyle = dark ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.22)';
          g.beginPath(); g.arc(px + r * 0.1, py + r * 0.28, r * 1.04, 0, TAU); g.fill();
          g.fillStyle = dark ? '#B7C4D1' : '#1C2333'; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
          g.fillStyle = dark ? '#F5F8FB' : '#34405A'; g.beginPath(); g.arc(px, py - r * 0.1, r * 0.84, 0, TAU); g.fill();
          g.lineWidth = Math.max(1, r * 0.09); g.strokeStyle = dark ? 'rgba(140,155,171,.45)' : 'rgba(255,255,255,.16)';
          g.beginPath(); g.arc(px, py - r * 0.1, r * 0.55, 0, TAU); g.stroke();
          g.fillStyle = dark ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.5)';
          g.beginPath(); g.arc(px - r * 0.34, py - r * 0.46, r * 0.15, 0, TAU); g.fill();
          g.globalAlpha = 1;
        }
        // mallets
        for (var sd = 0; sd < 2; sd++) {
          var m = M[sd], mx = ox + m.x * s, my = oy + m.y * s, mr = MR * s * (1 + 0.08 * pulse[sd]), hl = sd === 0 ? heldA : 0;
          if (hl > 0.01) { g.fillStyle = rgba(COL[sd], 0.2 * hl); g.beginPath(); g.arc(mx, my, mr * (1.2 + 0.18 * hl), 0, TAU); g.fill(); }
          g.fillStyle = dark ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.24)'; g.beginPath(); g.arc(mx + mr * 0.08, my + mr * 0.22, mr * 1.03, 0, TAU); g.fill();
          g.fillStyle = MDARK[sd]; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
          var top = my - mr * 0.07;
          g.fillStyle = COL[sd]; g.beginPath(); g.arc(mx, top, mr * 0.92, 0, TAU); g.fill();
          g.fillStyle = MDISH[sd]; g.beginPath(); g.arc(mx, top, mr * 0.62, 0, TAU); g.fill();
          var ky = top - mr * 0.05;
          g.fillStyle = MDARK[sd]; g.beginPath(); g.arc(mx, ky + mr * 0.06, mr * 0.4, 0, TAU); g.fill();
          g.fillStyle = MLIGHT[sd]; g.beginPath(); g.arc(mx, ky, mr * 0.38, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(mx - mr * 0.13, ky - mr * 0.14, mr * 0.11, 0, TAU); g.fill();
          g.lineWidth = mr * 0.09; g.strokeStyle = 'rgba(255,255,255,.42)';
          g.beginPath(); g.arc(mx, top, mr * 0.77, Math.PI * 1.08, Math.PI * 1.44); g.stroke();
        }
        // sparks
        for (i = 0; i < SN; i++) {
          if (sLife[i] <= 0) continue;
          var sf = sLife[i] / sMax[i];
          g.globalAlpha = Math.min(1, sf * 1.6); g.fillStyle = sCol[i];
          g.beginPath(); g.arc(ox + sX[i] * s, oy + sY[i] * s, s * sSize[i] * (0.4 + 0.6 * sf), 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
        drawGoal();
        // "Go!" in both halves after a new match starts
        if (goT >= 0 && goT < 0.9) {
          var pi = popIn(goT, 0.52), fs = Math.min(s * 0.2, th * 0.1), hal = dark ? 'rgba(10,20,22,.8)' : 'rgba(255,255,255,.9)';
          g.textAlign = 'center'; g.textBaseline = 'middle';
          for (sd = 0; sd < 2; sd++) {
            g.save(); g.globalAlpha = pi.a * clamp((0.9 - goT) * 5, 0, 1);
            g.translate(cx, ty + th * (sd === 0 ? 0.62 : 0.38)); g.scale(pi.s, pi.s);
            label(t.go, 0, 0, fs, COL[sd], hal); g.restore();
          }
        }
        // result scrim over the table (the card itself is DOM)
        if (phase === 'over') {
          var rim = s * RIMK;
          g.globalAlpha = clamp(phaseT / 0.25, 0, 1);
          rr(g, tx - rim, ty - rim, s + 2 * rim, th + 2 * rim, RC * s + rim);
          g.fillStyle = dark ? 'rgba(10,20,22,.72)' : 'rgba(242,251,252,.7)'; g.fill();
          g.globalAlpha = 1;
        }
      }

      function advance(dt) {
        // puck look
        if (phase === 'goal') { var f = clamp(phaseT / 0.32, 0, 1); pAlpha = 1 - f; pScale = 1 - 0.45 * f; }
        else if (phase === 'over') pAlpha = 0;
        else { appear = Math.min(1, appear + dt / 0.3); pAlpha = Math.min(1, appear * 2.5); pScale = backOut(appear); }
        trX[trHead] = P.x; trY[trHead] = P.y; trV[trHead] = live ? Math.sqrt(P.vx * P.vx + P.vy * P.vy) : 0;
        trHead = (trHead + 1) % TRN; if (trLen < TRN) trLen++;
        heldA += ((holding ? 1 : 0) - heldA) * Math.min(1, dt * 14);
        var dec = Math.exp(-dt * 9); pulse[0] *= dec; pulse[1] *= dec;
        for (var i = 0; i < RN; i++) if (rAge[i] < RLIFE) rAge[i] += dt;
        var drag = Math.exp(-dt * 3.2), any = false;
        for (i = 0; i < SN; i++) {
          if (sLife[i] <= 0) continue;
          any = true; sLife[i] -= dt; sX[i] += sVX[i] * dt; sY[i] += sVY[i] * dt; sVX[i] *= drag; sVY[i] *= drag;
        }
        if (glow > 0) glow = Math.max(0, glow - dt / 1.3);
        if (goT >= 0) { goT += dt; if (goT > 1) goT = -1; }
        return any;
      }

      function calm(sparks) {
        if (phase !== 'play' || sparks || glow > 0 || goT >= 0 || appear < 1 || holding || ptr !== null) return false;
        if (P.vx || P.vy || Math.abs(heldA) > 0.01 || pulse[0] > 0.01 || pulse[1] > 0.01) return false;
        for (var i = 0; i < RN; i++) if (rAge[i] < RLIFE) return false;
        for (var sd = 0; sd < 2; sd++) if (Math.abs(M[sd].vx) + Math.abs(M[sd].vy) > 1e-4) return false;
        return Math.abs(aimX[1] - M[1].x) + Math.abs(aimY[1] - M[1].y) < 1e-4;
      }

      function resize() {
        W = Math.max(1, wrap.clientWidth); H = Math.max(1, wrap.clientHeight);
        c.fit(W, H); offX = wrap.offsetLeft; offY = wrap.offsetTop;
        var mg = 4, aw = Math.max(40, W - 2 * mg), ah = Math.max(60, H - 2 * mg);
        var w = aw / (1 + 2 * RIMK), h = ah - 2 * RIMK * w, L = h / w;
        if (L > 2.3) h = w * 2.3;
        else if (L < 1.3) { w = ah / (1.3 + 2 * RIMK); h = w * 1.3; }
        s = w; th = h; tx = (W - w) / 2; ty = (H - h) / 2;
        setLength(h / w);
        tb.width = Math.round(W * dpr); tb.height = Math.round(H * dpr);
        paintTable(); draw();
      }

      /* ---------- input: any finger steers your mallet (it stays in your half) ---------- */
      function aimAt(e) {
        var p = ctx.local(e);
        aimX[0] = (p.x - offX - tx) / s; aimY[0] = (p.y - offY - ty) / s;
      }
      ctx.on(cv, 'pointerdown', function (e) {
        if (phase === 'over') { if (phaseT > 0.7) { S.click(); ctx.buzz(10); startMatch(false); ctx.wake(); } return; }
        ptr = e.pointerId; holding = true;
        try { cv.setPointerCapture(ptr); } catch (er) {}
        aimAt(e); ctx.buzz(8); ctx.wake();
      });
      ctx.on(cv, 'pointermove', function (e) { if (e.pointerId === ptr) { aimAt(e); ctx.wake(); } });
      function up(e) { if (e.pointerId === ptr) { ptr = null; holding = false; ctx.wake(); } }
      ctx.on(cv, 'pointerup', up);
      ctx.on(cv, 'pointercancel', up);

      resize();
      startMatch(true); rejig();
      draw();
      // drag hint: from your mallet up to the puck
      ctx.hint(function () { return { x: offX + tx + s * 0.5, y: offY + ty + (len - HOME) * s }; },
        { kind: 'drag', dx: 0, dy: -Math.max(40, (len / 2 - HOME - 0.21) * s) });

      return {
        resize: resize,
        frame: function (dt) {
          clock += dt; phaseT += dt;
          if (phase === 'play') ai(dt); else { aiTx = 0.5; aiTy = HOME + 0.04; aimX[1] = M[1].x + (aiTx - M[1].x) * Math.min(1, dt * 3); aimY[1] = M[1].y + (aiTy - M[1].y) * Math.min(1, dt * 3); }
          var hitsBefore = hits[1];
          update(dt);
          if (hits[1] !== hitsBefore) rejig();
          var sparks = advance(dt);
          timeline();
          draw();
          quiet = calm(sparks) ? quiet + 1 : 0;
          return quiet < 12;
        },
        redraw: function () { paintTable(); draw(); },
        destroy: function () { ptr = null; },
        debug: function () {
          return {
            phase: phase, score: scores.slice(), hits: hits.slice(), goals: goals, matches: matches, ai: aiMode,
            puck: [+P.x.toFixed(3), +P.y.toFixed(3)], speed: +Math.sqrt(P.vx * P.vx + P.vy * P.vy).toFixed(2),
            you: [+M[0].x.toFixed(3), +M[0].y.toFixed(3)], cpu: [+M[1].x.toFixed(3), +M[1].y.toFixed(3)],
            table: [Math.round(s), Math.round(th)], len: +len.toFixed(2), holding: holding, heldA: +heldA.toFixed(2)
          };
        }
      };
    }
  };
})();
