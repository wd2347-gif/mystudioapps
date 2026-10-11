/* 폭탄 돌리기 (bomb): the app's grey bomb with a face. No names: start, pass the phone and tap the bomb on every pass;
   the fuse burns for a hidden 5.5 to 11 s, then BOOM (white flash to orange, shake, comic burst). Ported from the first playable (10/11).
   Change: after the boom, tapping the bomb also starts again (as well as the button), so a viewer never hits a dead end. */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var T = {
    ko: {
      idle: '시작하면 폰을 옆 사람에게 계속 넘겨요', run: '넘길 때 폭탄을 톡!', count: '넘긴 횟수 {n}',
      boom: '펑!', holder: '들고 있는 사람이 벌칙!', passed: '{n}번 넘겼어요', start: '시작', again: '다시 하기'
    },
    ja: {
      idle: 'スタートしたらスマホを隣へ回し続けて', run: '渡すときに爆弾をタップ！', count: 'パス {n}回',
      boom: 'ドカーン！', holder: '持っている人が罰ゲーム！', passed: '{n}回パスしました', start: 'スタート', again: 'もう一回'
    },
    en: {
      idle: 'Once it starts, keep passing the phone', run: 'Tap the bomb as you pass it!', count: 'Passes {n}',
      boom: 'BOOM!', holder: 'Whoever is holding it gets the forfeit!', passed: 'Passes: {n}', start: 'Start', again: 'Play again'
    }
  };

  function starPts(cx, cy, n, rx, ry, seed) {
    var d = '', s = seed;
    for (var i = 0; i < n * 2; i++) {
      s = (s * 9301 + 49297) % 233280;
      var k = i % 2 ? 0.62 + (s / 233280) * 0.1 : 1, a = -Math.PI / 2 + i * Math.PI / n;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rx * k).toFixed(1) + ' ' + (cy + Math.sin(a) * ry * k).toFixed(1);
    }
    return d + 'Z';
  }
  // comic burst behind the boom word (orange star with a dark red edge, yellow inside)
  function burstSvg(w) {
    return '<svg viewBox="0 0 230 170" aria-hidden="true"><path d="' + starPts(115, 85, 13, 115, 85, 7) + '" fill="#FF7A3D" stroke="#7A1C0C" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="' + starPts(115, 85, 11, 87, 61, 11) + '" fill="#FFE066"/>' +
      '<g font-weight="900" text-anchor="middle" letter-spacing="-1" style="font-family:inherit">' +
      '<text class="w1" x="115" y="85" dy=".35em" font-size="50" fill="none" stroke="#7A1C0C" stroke-width="8" stroke-linejoin="round">' + w + '</text>' +
      '<text class="w2" x="115" y="85" dy=".35em" font-size="50" fill="#FFFFFF">' + w + '</text></g></svg>';
  }

  GAMES['bomb'] = {
    name: { ko: '폭탄 돌리기', ja: '爆弾リレー', en: 'Hot Bomb' },
    tip: { ko: '언제 터질지 몰라요, 얼른 넘겨요!', ja: 'いつ爆発するか分からない、早く渡して！', en: 'It could blow any second, pass it on!' },
    cat: 'bet', who: '2+', accent: '#FF7A3D',
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx, rgba = ctx.rgba;
      var root = ctx.el;
      root.innerHTML =
        '<div class="top"><div class="cnt">' + ctx.ICON.swap + '<span></span></div></div>' +
        '<div class="bw" role="button" aria-label="' + ctx.esc(ctx.name) + '"><div class="burst">' + burstSvg(ctx.esc(t.boom)) + '</div></div>' +
        '<div class="msg" aria-live="polite"><div class="ml"></div><div class="ms"></div></div>';
      var big = ctx.button(t.start, ctx.ICON.fire);
      root.appendChild(big);
      var cnt = root.querySelector('.cnt'), cntText = cnt.querySelector('span'), bw = root.querySelector('.bw');
      var burstEl = root.querySelector('.burst'), ml = root.querySelector('.ml'), ms = root.querySelector('.ms');
      var cvo = ctx.canvas(bw), cv = cvo.cv, g = cvo.g;
      bw.insertBefore(cv, burstEl);
      var W = 0, H = 0, dpr = ctx.dpr, s = 0, ox = 0, oy = 0;
      var state = 'idle', fuse = 0, el = 0, nextTick = 0, hop = 0, alt = false, clock = 0, boomAt = -9, passes = 0, armed = false, booms = 0;
      var sparks = [], tip = { x: 0.8, y: 0.1 };
      var CX = 0.45, CY = 0.6, RAD = 0.32, MAXF = 11;

      function tension() { return state === 'run' ? Math.min(1, el / MAXF) : 0; }

      function render() {
        root.classList.toggle('run', state === 'run');
        cntText.textContent = ctx.fmt(t.count, { n: passes });
        if (state === 'idle') { ml.textContent = t.idle; ms.textContent = ''; }
        else if (state === 'run') { ml.textContent = t.run; ms.textContent = ''; }
        else { ml.textContent = t.holder; ms.textContent = passes > 0 ? ctx.fmt(t.passed, { n: passes }) : ''; }
        var label = state === 'boom' ? t.again : t.start;
        big.innerHTML = (state === 'boom' ? ctx.ICON.again : ctx.ICON.fire) + '<span>' + ctx.esc(label) + '</span>';
      }
      function start() {
        if (state === 'run') return;
        if (state === 'boom' && !armed) return;
        state = 'run'; fuse = 5.5 + Math.random() * 5.5; el = 0; nextTick = 0.6; passes = 0; hop = 1; sparks = []; armed = false;
        root.classList.remove('boomed', 'stamped', 'armed');
        S.go(); S.whoosh(0.12); ctx.buzz(); render(); ctx.wake();
      }
      function pass() {
        passes++; hop = 1;
        S.whoosh(); ctx.buzz(14);
        cntText.textContent = ctx.fmt(t.count, { n: passes });
        cnt.classList.remove('bump'); void cnt.offsetWidth; cnt.classList.add('bump');
      }
      function explode() {
        state = 'boom'; boomAt = clock; armed = false; booms++;
        S.boom(); ctx.buzz([40, 30, 120]); ctx.shake(); ctx.flash();
        sparks = [];
        var cols = ['#2B2F3A', '#FF7A3D', '#FFE066', '#8C9BAB'];
        for (var i = 0; i < 60; i++) {
          var a = Math.random() * TAU, sp = 0.2 + Math.random() * 0.9;
          sparks.push({ x: CX, y: CY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.9, c: cols[i % 4], r: 0.01 + Math.random() * 0.02 });
        }
        render();
        root.classList.remove('run'); root.classList.add('boomed');
        ctx.later(function () { root.classList.add('stamped'); S.stamp(); ctx.buzz(30); }, 480);
        ctx.later(function () { S.lose(); }, 760);
        ctx.later(function () { armed = true; root.classList.add('armed'); }, 1000);
        // never a dead end: back to a fresh bomb by itself after a beat (a tap restarts it sooner)
        var mine = booms;
        ctx.later(function () {
          if (state !== 'boom' || booms !== mine) return;
          state = 'idle'; armed = false; passes = 0; sparks = []; hop = 1;
          root.classList.remove('boomed', 'stamped', 'armed');
          S.swipe(); render(); ctx.wake();
        }, 3800);
      }
      function onArea(e) {
        if (e.isPrimary === false) return;
        if (state === 'idle') start();
        else if (state === 'run') pass();
        else if (armed) start();
      }

      function fitWord() {
        // keep the boom word inside the burst (long words like ドカーン！ get smaller)
        var w2 = burstEl.querySelector('.w2'), w1 = burstEl.querySelector('.w1');
        try {
          var len = w2.getComputedTextLength();
          if (len > 0) {
            var fs = Math.min(54, 50 * 168 / len);
            w1.setAttribute('font-size', fs.toFixed(1)); w2.setAttribute('font-size', fs.toFixed(1));
            w1.setAttribute('stroke-width', (fs * 0.16).toFixed(1));
          }
        } catch (er) {}
      }
      function resize() {
        W = bw.clientWidth; H = bw.clientHeight;
        cvo.fit(W, H);
        s = Math.max(90, Math.min(W * 0.95, H, 400));
        ox = (W - s) / 2; oy = (H - s) / 2;
        var bwid = Math.min(s * 0.82, 300);
        burstEl.style.width = bwid + 'px'; burstEl.style.height = (bwid * 170 / 230) + 'px';
        burstEl.style.left = (ox + s * 0.5) + 'px'; burstEl.style.top = (oy + s * 0.52) + 'px';
        fitWord();
        draw();
      }

      function drawSparks() {
        for (var i = 0; i < sparks.length; i++) {
          var p = sparks[i];
          g.globalAlpha = Math.max(0, Math.min(1, p.life / 0.6));
          g.fillStyle = p.c; g.beginPath(); g.arc(ox + p.x * s, oy + p.y * s, p.r * s, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
      }

      function draw() {
        if (!W) return;
        var DARK = ctx.dark;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        var c = { x: ox + CX * s, y: oy + CY * s }, r = RAD * s, now = clock;
        if (state === 'boom') {
          // smoke puffs spreading out, then debris
          var k = now - boomAt, seed = 3;
          g.fillStyle = 'rgba(140,155,171,' + Math.max(0, 0.45 * (1 - k / 2.2)).toFixed(3) + ')';
          for (var i = 0; i < 7; i++) {
            seed = (seed * 9301 + 49297) % 233280; var r1 = seed / 233280;
            seed = (seed * 9301 + 49297) % 233280; var r2 = seed / 233280;
            var a = i * TAU / 7 + r1, d = s * (0.05 + 0.18 * (1 - Math.exp(-k * 2)));
            g.beginPath(); g.arc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, s * (0.06 + 0.05 * r2) * (1 + k * 0.6), 0, TAU); g.fill();
          }
          drawSparks();
          return;
        }
        var T2 = tension(), running = state === 'run';
        var wobble = running ? Math.sin(now * (10 + 14 * T2)) * (0.03 + 0.11 * T2) + Math.sin(now * 23) * 0.015 * T2 : Math.sin(now * 1.6) * 0.02;
        var breathe = running ? 1 + 0.05 * hop : 1 + 0.015 * Math.sin(now * 2.2);
        // the bomb glows hotter as the fuse burns
        if (running) {
          var heat = (0.1 + 0.4 * T2) * (0.75 + 0.25 * hop), glow = r * (1.5 + 0.3 * T2);
          var gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, glow);
          gr.addColorStop(0, rgba('#FF7A3D', heat.toFixed(3))); gr.addColorStop(1, rgba('#FF7A3D', 0));
          g.fillStyle = gr; g.beginPath(); g.arc(c.x, c.y, glow, 0, TAU); g.fill();
        }
        // ground shadow
        g.fillStyle = DARK ? 'rgba(0,0,0,.4)' : 'rgba(0,0,0,.16)';
        g.beginPath(); g.ellipse(c.x, c.y + r * 1.04, r * 0.8 * (1 - 0.15 * hop), r * 0.12, 0, 0, TAU); g.fill();

        g.save();
        var px = c.x, py = c.y + r;
        g.translate(px, py - hop * r * 0.12); g.rotate(wobble); g.scale(breathe, 2 - breathe); g.translate(-px, -py);
        // fuse
        var na = -Math.PI * 0.31, neck = { x: c.x + Math.cos(na) * r * 0.98, y: c.y + Math.sin(na) * r * 0.98 }, tp = { x: ox + 0.8 * s, y: oy + 0.1 * s };
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(neck.x, neck.y); g.bezierCurveTo(neck.x + r * 0.2, neck.y - r * 0.5, tp.x - r * 0.55, tp.y + r * 0.25, tp.x, tp.y);
        g.strokeStyle = '#C9A877'; g.lineWidth = r * 0.1; g.stroke();
        g.strokeStyle = '#E9D3A8'; g.lineWidth = r * 0.035; g.stroke();
        if (DARK) {
          g.save(); g.shadowColor = 'rgba(255,255,255,.12)'; g.shadowBlur = r * 0.2;
          g.fillStyle = 'rgba(255,255,255,.04)'; g.beginPath(); g.arc(c.x, c.y, r * 1.04, 0, TAU); g.fill(); g.restore();
        }
        // body
        var bg = g.createRadialGradient(c.x - 0.4 * r, c.y - 0.5 * r, 0, c.x - 0.4 * r, c.y - 0.5 * r, r * 2);
        bg.addColorStop(0, '#5E6474'); bg.addColorStop(0.55, '#2B2F3A'); bg.addColorStop(1, '#15171C');
        g.fillStyle = bg; g.beginPath(); g.arc(c.x, c.y, r, 0, TAU); g.fill();
        // cap
        g.save(); g.translate(neck.x, neck.y); g.rotate(na + Math.PI / 2);
        var cw = r * 0.46, ch = r * 0.3, cg = g.createLinearGradient(-cw / 2, 0, cw / 2, 0);
        cg.addColorStop(0, '#9AA3B2'); cg.addColorStop(1, '#555C6A'); g.fillStyle = cg;
        rrect(-cw / 2, -ch / 2, cw, ch, r * 0.07); g.fill();
        g.restore();
        // shine
        g.save(); g.translate(c.x - r * 0.45, c.y - r * 0.48); g.rotate(-0.7);
        g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(0, 0, r * 0.25, r * 0.12, 0, 0, TAU); g.fill(); g.restore();
        g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(c.x - r * 0.2, c.y - r * 0.62, r * 0.05, 0, TAU); g.fill();
        if (DARK) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = r * 0.025; g.beginPath(); g.arc(c.x, c.y, r, 0, TAU); g.stroke(); }
        face(c, r, now, running, T2);
        g.restore();

        // fuse tip follows the wobbling bomb
        var dx = tp.x - px, dy = tp.y - py, sx = dx * breathe, sy = dy * (2 - breathe);
        var tx = px + sx * Math.cos(wobble) - sy * Math.sin(wobble), ty = py - hop * r * 0.12 + sx * Math.sin(wobble) + sy * Math.cos(wobble);
        tip.x = (tx - ox) / s; tip.y = (ty - oy) / s;
        if (running) {
          var fl = 0.8 + 0.4 * Math.sin(now * 40) * Math.sin(now * 17);
          g.save(); g.shadowColor = 'rgba(255,176,32,.9)'; g.shadowBlur = r * 0.25;
          g.fillStyle = 'rgba(255,176,32,.55)'; g.beginPath(); g.arc(tx, ty, r * 0.2 * fl, 0, TAU); g.fill(); g.restore();
          g.strokeStyle = '#FFE066'; g.lineWidth = r * 0.035; g.lineCap = 'round';
          for (var q = 0; q < 8; q++) {
            var ra = q * Math.PI / 4 + now * 3, len = r * (0.13 + 0.07 * Math.sin(now * 25 + q * 1.7)) * fl;
            g.beginPath(); g.moveTo(tx + Math.cos(ra) * r * 0.05, ty + Math.sin(ra) * r * 0.05); g.lineTo(tx + Math.cos(ra) * len, ty + Math.sin(ra) * len); g.stroke();
          }
          g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(tx, ty, r * 0.07, 0, TAU); g.fill();
        } else {
          g.fillStyle = '#8D6E4A'; g.beginPath(); g.arc(tx, ty, r * 0.05, 0, TAU); g.fill();
        }
        drawSparks();
      }
      function rrect(x, y, w, h, rad) {
        g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad);
        g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath();
      }
      function face(c, r, now, running, T2) {
        var eyeY = c.y - r * 0.05, eyes = [{ x: c.x - r * 0.34, y: eyeY }, { x: c.x + r * 0.16, y: eyeY }];
        g.fillStyle = 'rgba(255,122,154,.45)';
        eyes.forEach(function (e) { g.beginPath(); g.ellipse(e.x, e.y + r * 0.28, r * 0.12, r * 0.06, 0, 0, TAU); g.fill(); });
        if (!running) {
          // sleepy smile (^ ^)
          g.strokeStyle = '#FFFFFF'; g.lineWidth = r * 0.06; g.lineCap = 'round';
          eyes.forEach(function (e) { g.beginPath(); g.ellipse(e.x, e.y + r * 0.04, r * 0.11, r * 0.1, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); });
          g.beginPath(); g.ellipse(c.x - r * 0.09, c.y + r * 0.2, r * 0.1, r * 0.07, 0, 0.2, Math.PI - 0.2); g.stroke();
          return;
        }
        // scared eyes that grow and dart around as the fuse burns
        var ew = r * (0.24 + 0.06 * T2), eh = r * (0.3 + 0.1 * T2);
        var lx = Math.sin(now * (1.3 + 4 * T2)) * r * 0.045, ly = Math.cos(now * 0.9) * r * 0.03;
        eyes.forEach(function (e) {
          g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(e.x, e.y, ew / 2, eh / 2, 0, 0, TAU); g.fill();
          g.fillStyle = '#15171C'; g.beginPath(); g.arc(e.x + lx, e.y + ly, r * 0.075, 0, TAU); g.fill();
          g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(e.x + lx - r * 0.025, e.y + ly - r * 0.03, r * 0.022, 0, TAU); g.fill();
        });
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = r * 0.045; g.lineCap = 'round';
        g.beginPath(); g.moveTo(eyes[0].x - r * 0.1, eyes[0].y - eh * 0.62 - r * 0.02 * T2); g.lineTo(eyes[0].x + r * 0.08, eyes[0].y - eh * 0.72 - r * 0.06 * T2); g.stroke();
        g.beginPath(); g.moveTo(eyes[1].x - r * 0.08, eyes[1].y - eh * 0.72 - r * 0.06 * T2); g.lineTo(eyes[1].x + r * 0.1, eyes[1].y - eh * 0.62 - r * 0.02 * T2); g.stroke();
        g.fillStyle = '#FF5C7A'; g.beginPath();
        g.ellipse(c.x - r * 0.09, c.y + r * 0.27, r * (0.12 + 0.06 * T2) / 2, r * (0.1 + 0.12 * T2 + 0.03 * Math.sin(now * 12)) / 2, 0, 0, TAU); g.fill();
        if (T2 > 0.35) {
          var al = Math.min(1, (T2 - 0.35) / 0.3), dx2 = c.x + r * 0.62, dy2 = c.y - r * 0.42 + Math.sin(now * 3) * r * 0.03;
          g.fillStyle = 'rgba(159,216,255,' + al.toFixed(3) + ')';
          g.beginPath(); g.moveTo(dx2, dy2 - r * 0.14); g.quadraticCurveTo(dx2 + r * 0.09, dy2, dx2, dy2 + r * 0.06); g.quadraticCurveTo(dx2 - r * 0.09, dy2, dx2, dy2 - r * 0.14); g.fill();
        }
      }

      ctx.on(big, 'click', start);
      ctx.on(bw, 'pointerdown', onArea);
      render();
      // hint on the bomb body (it is drawn on the canvas, so give a point)
      ctx.hint(function () { return { x: bw.offsetLeft + ox + CX * s, y: bw.offsetTop + oy + CY * s }; });

      return {
        resize: resize,
        redraw: draw,
        frame: function (dt) {
          clock += dt;
          hop = Math.max(0, hop - dt * 5);
          for (var i = sparks.length - 1; i >= 0; i--) {
            var p = sparks[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= (1 - dt * 1.5); p.vy += dt * 0.9; p.life -= dt;
            if (p.life <= 0) sparks.splice(i, 1);
          }
          if (state === 'run') {
            el += dt;
            var T2 = tension();
            if (el >= nextTick) {
              alt = !alt; S.tick(alt); hop = Math.max(hop, 0.5);
              nextTick = el + (0.95 - 0.72 * T2) * (0.7 + 0.6 * Math.random());
            }
            for (var k = 0, n = 2 + Math.round(T2 * 3); k < n; k++) {
              var a = Math.random() * TAU, sp = 0.12 + Math.random() * 0.25;
              sparks.push({ x: tip.x, y: tip.y, vx: Math.cos(a) * sp, vy: (Math.sin(a) - 0.6) * sp, life: 0.25 + Math.random() * 0.3,
                c: Math.random() < 0.5 ? '#FFE066' : '#FF9F43', r: 0.006 + Math.random() * 0.008 });
            }
            if (sparks.length > 90) sparks.splice(0, sparks.length - 90);
            if (el >= fuse) explode();
          }
          draw();
          return state !== 'boom' || clock - boomAt < 2.4 || sparks.length > 0;
        },
        debug: function () { return { state: state, passes: passes, armed: armed, booms: booms }; }
      };
    }
  };
})();
