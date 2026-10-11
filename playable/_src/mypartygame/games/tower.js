/* 탑 쌓기 (tower): tower.dart solo run. A pastel slab slides left and right (TowerLogic.speed grows per floor); tap anywhere to drop it.
   What hangs over the slab below is cut off and falls as debris; a drop within tolerance snaps to 'Perfect!' with a white ring, gold
   dots and a combo (from the third in a row the slab grows back a little). The camera rises with the tower and the sky shifts colour.
   A miss crashes, shows the floors for a beat, then a new tower starts by itself (a tap on the card starts it at once). */
(function () {
  'use strict';
  var T = {
    ko: { tap: '아무 데나 눌러서 블록을 떨어뜨려요', perfect: '완벽!', f1: '{0}층', fn: '{0}층', crash: '와르르!', best: '최고 기록 {0}', newBest: '새 최고 기록!', sky: '하늘까지 닿았어요!' },
    ja: { tap: 'どこでもタップしてブロックを落とそう', perfect: 'パーフェクト！', f1: '{0}段', fn: '{0}段', crash: 'ガラガラ！', best: 'ベスト {0}', newBest: 'ベスト更新！', sky: '空まで届いた！' },
    en: { tap: 'Tap anywhere to drop the block', perfect: 'Perfect!', f1: '{0} floor', fn: '{0} floors', crash: 'Crash!', best: 'Best: {0}', newBest: 'New best!', sky: 'Sky high!' }
  };
  // TowerLogic: world width 100, slab height 9, first slab 56 wide
  var WW = 100, BH = 9, BASEW = 56, TOL = 1.8;
  function speed(level) { return Math.min(46 + level * 1.6, 120); }
  function drop(px, pw, x, w) {
    if (Math.abs(x - px) <= TOL && Math.abs(w - pw) < 0.001) return { x: px, w: pw, cutX: 0, cutW: 0, perfect: true, miss: false };
    if (Math.abs(x - px) <= TOL) { var nw = Math.min(w, pw); return { x: px, w: nw, cutX: px + nw, cutW: w - nw, perfect: true, miss: false }; }
    var left = Math.max(px, x), right = Math.min(px + pw, x + w);
    if (right - left <= 0) return { x: x, w: 0, cutX: x, cutW: w, perfect: false, miss: true };
    return { x: left, w: right - left, cutX: x < px ? x : right, cutW: w - (right - left), perfect: false, miss: false };
  }
  function grow(w, combo) { return combo >= 3 ? Math.min(BASEW, w + 3) : w; }
  function mix(a, b, k) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    var r = (x >> 16 & 255) + ((y >> 16 & 255) - (x >> 16 & 255)) * k, g = (x >> 8 & 255) + ((y >> 8 & 255) - (x >> 8 & 255)) * k, bl = (x & 255) + ((y & 255) - (x & 255)) * k;
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(bl) + ')';
  }
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // clouds (or stars in the dark): the app's Random(7) layout, fixed per game
  var CLOUDS = (function () {
    var seed = 7, out = [];
    function r() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    for (var i = 0; i < 9; i++) out.push([r(), r(), r()]);
    return out;
  })();
  var best = 0;

  GAMES['tower'] = {
    name: { ko: '탑 쌓기', ja: 'タワー積み', en: 'Stack Tower' },
    tip: { ko: '타이밍 맞춰 톡! 얼마나 높이 쌓을까', ja: 'タイミングよくタップ、どこまで積める？', en: 'Tap on time, how high can you go?' },
    cat: 'solo', who: '1', accent: '#FF7A3D',
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx, root = ctx.el;
      root.innerHTML =
        '<div class="sky"><div class="ov"><div class="hn">0</div><div class="hb"></div><div class="pp"></div></div>' +
        '<div class="tp">' + ctx.esc(t.tap) + '</div>' +
        '<div class="card"><div class="ct"></div><div class="cf"></div><div class="cb"></div></div></div>';
      var sky = root.querySelector('.sky'), hn = root.querySelector('.hn'), hb = root.querySelector('.hb'), pp = root.querySelector('.pp');
      var tp = root.querySelector('.tp'), card = root.querySelector('.card');
      var ct = root.querySelector('.ct'), cf = root.querySelector('.cf'), cb = root.querySelector('.cb');
      var c = ctx.canvas(sky), g = c.g;
      sky.insertBefore(c.cv, sky.firstChild);
      function floors(n) { return ctx.fmt(n === 1 ? t.f1 : t.fn, n); }

      var W = 0, H = 0, scale = 3, viewH = 150, offX = 0, offY = 0;
      var stack = [], debris = [], mv = null, dir = 1, combo = 0, cam = 0, shake = 0, ringAt = -1e9, now = 0, armAt = 0, hue0 = 0;
      var phase = 'play', run = 0, drops = 0, perfects = 0, runs = 0, newBest = false;

      function height() { return stack.length - 1; }
      function slabCol(level, a) {
        if (level === 0) return ctx.dark ? 'rgba(58,74,62,' + a + ')' : 'rgba(143,162,149,' + a + ')';
        return 'hsla(' + ((hue0 + level * 11) % 360) + ',62%,' + (ctx.dark ? 60 : 70) + '%,' + a + ')';
      }
      function spawn() {
        var top = stack[stack.length - 1], level = top.level + 1;
        dir = level % 2 ? 1 : -1;
        mv = { x: dir > 0 ? -top.w * 0.4 : WW - top.w * 0.6, w: top.w, level: level };
      }
      function paintTop() {
        hn.textContent = String(height());
        hn.classList.remove('pf-pop'); void hn.offsetWidth; hn.classList.add('pf-pop');
        hb.textContent = best > 0 ? ctx.fmt(t.best, floors(best)) : '';
      }
      function pill(text) {
        pp.textContent = text;
        pp.classList.remove('on'); void pp.offsetWidth; pp.classList.add('on');
      }
      function begin() {
        run++; runs++;
        stack = [{ x: (WW - BASEW) / 2, w: BASEW, level: 0 }];
        debris = []; combo = 0; cam = 0; shake = 0; ringAt = -1e9; newBest = false;
        hue0 = ctx.rnd(360);
        spawn(); armAt = now + 300; phase = 'play';
        card.classList.remove('on'); root.classList.remove('over');
        pp.classList.remove('on');
        tp.classList.add('on');
        paintTop(); ctx.wake();
      }

      function dropNow() {
        if (phase !== 'play' || now < armAt) return;
        var top = stack[stack.length - 1], m = mv, r = drop(top.x, top.w, m.x, m.w), y = m.level * BH;
        drops++;
        tp.classList.remove('on');
        if (r.miss) {
          debris.push({ x: m.x, y: y, w: m.w, level: m.level, vx: dir * 20, vy: 0, rot: 0, vr: (dir >= 0 ? 1 : -1) * (1.5 + Math.random() * 2) });
          shake = 1; S.lose(); ctx.buzz([40, 60, 40]);
          endRun();
          return;
        }
        if (r.cutW > 0.01) {
          var vx = r.cutX < r.x ? -14 : 14;
          debris.push({ x: r.cutX, y: y, w: r.cutW, level: m.level, vx: vx, vy: 0, rot: 0, vr: (vx >= 0 ? 1 : -1) * (1.5 + Math.random() * 2) });
        }
        if (r.perfect) {
          combo++; perfects++;
          var gw = grow(r.w, combo), nx = Math.max(0, Math.min(WW - gw, r.x - (gw - r.w) / 2));
          stack.push({ x: nx, w: gw, level: m.level });
          ringAt = now;
          pill(combo >= 2 ? t.perfect + ' ×' + combo : t.perfect);
          S.thud(); S.ding(); S.tone(660 * Math.pow(1.0595, Math.min(combo, 12) * 2), 0.16, 'triangle', 0.16, null, 0.04);
          if (combo >= 3) S.tone(2093, 0.18, 'sine', 0.08, 2637, 0.1);
          ctx.buzz(combo >= 3 ? [14, 30, 14] : 16);
          if (combo >= 2) {
            var sx = offX + ox() + (nx + gw / 2) * scale, sy2 = offY + sy(m.level * BH + BH / 2);
            ctx.burst(sx, sy2, 14 + Math.min(combo, 6) * 5, { speed: 420, size: 0.7, colors: ['#FFD43B', '#FFFFFF', '#FFB020', slabCol(m.level, 1)] });
          }
        } else {
          combo = 0;
          stack.push({ x: r.x, w: r.w, level: m.level });
          S.thud(); ctx.buzz(12);
          if (r.cutW > 4) S.whoosh();
        }
        if (best > 0 && height() === best + 1) { pill(t.newBest); S.tone(1568, 0.2, 'sine', 0.12, 2093, 0.06); }
        paintTop();
        spawn(); armAt = now + 90;
        ctx.wake();
      }

      function endRun() {
        phase = 'over'; root.classList.add('over');
        var h = height(), my = run;
        newBest = h > best && best > 0;
        if (h > best) best = h;
        ctx.later(function () {
          if (my !== run || phase !== 'over') return;
          phase = 'card';
          ct.textContent = newBest ? t.newBest : (h >= 25 ? t.sky : t.crash);
          cf.textContent = floors(h);
          cb.textContent = best > 0 && !newBest ? ctx.fmt(t.best, floors(best)) : '';
          card.classList.add('on');
          S.stamp(); ctx.buzz(20);
          if (newBest || h >= 25) { ctx.later(function () { S.win(); }, 200); ctx.burstAt(card, 70); }
        }, 1300);
        ctx.later(function () { if (my === run && (phase === 'card' || phase === 'over')) begin(); }, 3700);
        ctx.wake();
      }

      ctx.on(root, 'pointerdown', function () {
        if (phase === 'play') dropNow();
        else if (phase === 'card') { S.click(); ctx.buzz(10); begin(); }
      });

      function ox() { return (W - WW * scale) / 2 + Math.sin(now / 30) * shake * 6; }
      function sy(wy) { return H - H * 0.1 - (wy - cam) * scale; }

      function slab(x, w, level, wy, a, o) {
        var X = o + x * scale, Y = sy(wy + BH), Wd = w * scale, Hh = BH * scale, rad = Math.min(6, Hh * 0.25);
        rr(g, X, Y, Wd, Hh, rad); g.fillStyle = slabCol(level, a); g.fill();
        rr(g, X, Y, Wd, Hh * 0.28, rad); g.fillStyle = 'rgba(255,255,255,' + (0.32 * a).toFixed(3) + ')'; g.fill();
        g.fillStyle = 'rgba(0,0,0,' + (0.1 * a).toFixed(3) + ')'; g.fillRect(X + 2, Y + Hh * 0.86, Math.max(0, Wd - 4), Hh * 0.14);
      }

      function draw() {
        var dark = ctx.dark, k = Math.max(0, Math.min(1, cam / 400));
        g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
        var top = dark ? mix('#0F1A22', '#1A1230', k) : mix('#DFF2FF', '#F3E6FF', k);
        var bot = dark ? mix('#14211A', '#0E1420', k) : mix('#F2FBF0', '#E2F0FF', k);
        var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        // clouds drift slower than the camera
        g.fillStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.7)';
        for (var i = 0; i < CLOUDS.length; i++) {
          var cl = CLOUDS[i], x = cl[0] * W, y = ((cl[1] * H * 1.5 + cam * scale * 0.3) % (H * 1.5)) - H * 0.25;
          var rad = (dark ? 2 : 18) + cl[2] * (dark ? 2 : 22) * Math.min(1.4, W / 340);
          g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2);
          if (!dark) { g.moveTo(x + rad * 1.8, y + 4); g.arc(x + rad, y + 4, rad * 0.8, 0, Math.PI * 2); }
          g.fill();
        }
        var o = ox(), ground = sy(0);
        if (ground < H + 40) { g.fillStyle = dark ? '#1E2A20' : '#CFE8C6'; g.fillRect(0, ground, W, H + 40 - ground); }
        for (i = 0; i < stack.length; i++) {
          var st = stack[i], wy = st.level * BH;
          if (sy(wy) < -10 || sy(wy + BH) > H + 10) continue;
          slab(st.x, st.w, st.level, wy, 1, o);
        }
        // perfect ring and gold dots
        var rt = (now - ringAt) / 450;
        if (rt >= 0 && rt < 1 && stack.length > 1) {
          var s2 = stack[stack.length - 1], inf = 4 + rt * 18;
          var rx = o + s2.x * scale - inf, ry = sy(s2.level * BH + BH) - inf, rw = s2.w * scale + inf * 2, rh = BH * scale + inf * 2;
          rr(g, rx, ry, rw, rh, 10); g.lineWidth = 3 * (1 - rt) + 0.5; g.strokeStyle = 'rgba(255,255,255,' + (1 - rt).toFixed(3) + ')'; g.stroke();
          g.fillStyle = 'rgba(255,212,59,' + (1 - rt).toFixed(3) + ')';
          for (var d = 0; d < 6; d++) {
            var a = d * Math.PI / 3 + 0.4;
            g.beginPath(); g.arc(rx + rw / 2 + Math.cos(a) * rw * 0.55, ry + rh / 2 + Math.sin(a) * rh * 0.9, 3.2 * (1 - rt) + 1, 0, Math.PI * 2); g.fill();
          }
        }
        if (phase === 'play' && mv) slab(mv.x, mv.w, mv.level, mv.level * BH, 1, o);
        for (i = 0; i < debris.length; i++) {
          var db = debris[i], cx = o + (db.x + db.w / 2) * scale, cy = sy(db.y + BH / 2);
          g.save(); g.translate(cx, cy); g.rotate(db.rot); g.translate(-cx, -cy);
          slab(db.x, db.w, db.level, db.y, 0.9, o); g.restore();
        }
      }

      function resize() {
        W = Math.max(1, sky.clientWidth); H = Math.max(1, sky.clientHeight);
        c.fit(W, H); offX = sky.offsetLeft; offY = sky.offsetTop;
        scale = Math.min(W, 620) / WW; viewH = H / scale;
        draw();
      }

      resize();
      begin();
      ctx.hint(function () { return { x: offX + W / 2, y: offY + H * 0.66 }; }, { kind: 'tap' });

      return {
        resize: resize,
        frame: function (dt) {
          now += dt * 1000;
          if (phase === 'play' && mv) {
            mv.x += dir * speed(mv.level) * dt;
            var minX = -mv.w * 0.45, maxX = WW - mv.w * 0.55;
            if (mv.x > maxX) { mv.x = maxX; dir = -1; } else if (mv.x < minX) { mv.x = minX; dir = 1; }
          }
          for (var i = debris.length - 1; i >= 0; i--) {
            var d = debris[i];
            d.vy -= 260 * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.rot += d.vr * dt;
            if (d.y < cam - 200) debris.splice(i, 1);
          }
          var target = Math.max(0, stack.length * BH - viewH * (phase === 'play' ? 0.48 : 0.3));
          cam += (target - cam) * (1 - Math.exp(-dt * 4));
          shake = Math.max(0, shake - dt * 3);
          draw();
          return phase === 'play' || debris.length > 0 || Math.abs(cam - target) > 0.5 || shake > 0 || now - ringAt < 460;
        },
        redraw: draw,
        destroy: function () { run++; },
        debug: function () {
          return { phase: phase, height: height(), combo: combo, best: best, drops: drops, perfects: perfects, runs: runs,
            width: mv ? +mv.w.toFixed(1) : 0, debris: debris.length, scale: +scale.toFixed(2) };
        }
      };
    }
  };
})();
