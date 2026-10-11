/* 돌림판 (roulette): same drawing as the app's roulette.dart. Six names, a red pointer that kicks on every slice edge,
   the winning slice pops out with a white edge and a result pill + confetti. Ported from the first playable (10/11). */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var T = {
    ko: { q: '커피 누가 살까? ☕', spin: '돌리기', res: '{n}!' },
    ja: { q: 'コーヒー、誰がおごる？☕', spin: '回す', res: '{n}！' },
    en: { q: 'Who buys the coffee? ☕', spin: 'Spin', res: '{n}!' }
  };
  function elasticOut(x) { if (x <= 0) return 0; if (x >= 1) return 1; return Math.pow(2, -10 * x) * Math.sin((x - 0.1) * TAU / 0.4) + 1; }
  function mod(a, m) { return ((a % m) + m) % m; }

  GAMES['roulette'] = {
    name: { ko: '돌림판', ja: 'ルーレット', en: 'Spin Wheel' },
    tip: { ko: '돌리기를 눌러 한 명을 뽑아요', ja: '「回す」を押して、ひとりを決めよう', en: 'Tap Spin to pick one person' },
    cat: 'bet', who: '2+', accent: '#FFB020',
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx, SLOTS = ctx.SLOTS, FONT = ctx.FONT;
      var names = ctx.names, N = names.length, SEG = TAU / N;
      var root = ctx.el;
      root.innerHTML =
        '<div class="hl"><div class="q">' + ctx.esc(t.q) + '</div><div class="pill" aria-live="polite"></div></div>' +
        '<div class="ww"></div>';
      var hl = root.querySelector('.hl'), pill = root.querySelector('.pill'), ww = root.querySelector('.ww');
      var cvo = ctx.canvas(ww), cv = cvo.cv, g = cvo.g;
      var btn = ctx.button(t.spin, ctx.ICON.spin);
      root.appendChild(btn);
      var face = document.createElement('canvas'), fg = face.getContext('2d');
      var side = 0, dpr = ctx.dpr, R = 0, rim = 6, sizes = [];
      var rot = Math.random() * TAU, spinning = false, el = 0, dur = 0, from = 0, delta = 0, idle = true;
      var flap = 0, lastIdx = -1, lastPeg = -1, clock = 0, resultAt = -9, winner = -1, spins = 0;

      function idxAt(r) { return Math.floor(mod(-r, TAU) / SEG) % N; }

      // slices and white separators, cached; names are drawn each frame so the left half can flip upright
      function renderFace() {
        var s = Math.max(2, Math.round(R * 2 * dpr));
        face.width = face.height = s;
        var c = s / 2, r = s / 2;
        fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, s, s);
        for (var i = 0; i < N; i++) {
          var a0 = -Math.PI / 2 + i * SEG;
          fg.beginPath(); fg.moveTo(c, c); fg.arc(c, c, r, a0, a0 + SEG); fg.closePath();
          fg.fillStyle = SLOTS[i % SLOTS.length]; fg.fill();
        }
        fg.strokeStyle = 'rgba(255,255,255,.85)'; fg.lineWidth = Math.max(2, r * 0.012);
        for (var k = 0; k < N; k++) {
          var a = -Math.PI / 2 + k * SEG;
          fg.beginPath(); fg.moveTo(c, c); fg.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); fg.stroke();
        }
        // label sizes: shrink long names to fit (down to 60%)
        var base = Math.max(10, Math.min(36, R * 0.11)), maxW = R * 0.64;
        sizes = names.map(function (n) {
          g.font = '800 ' + base + 'px ' + FONT;
          var w = g.measureText(n).width;
          return w > maxW ? Math.max(base * maxW / w, Math.max(10, base * 0.6)) : base;
        });
      }

      function wedge(r, i) {
        var a0 = -Math.PI / 2 + i * SEG;
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a0, a0 + SEG); g.closePath();
      }

      function draw() {
        if (!side) return;
        var DARK = ctx.dark;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, side, side);
        var c = side / 2, r = R, rimColor = DARK ? '#3A4239' : '#2B2F2A';
        var pop = winner >= 0 && !spinning ? elasticOut(Math.min(1, (clock - resultAt) / 0.7)) : 0;
        // shadow + dark rim
        g.save();
        g.shadowColor = DARK ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.18)'; g.shadowBlur = r * 0.1; g.shadowOffsetY = r * 0.03;
        g.fillStyle = rimColor; g.beginPath(); g.arc(c, c, r + rim, 0, TAU); g.fill();
        g.restore();
        g.save(); g.translate(c, c); g.rotate(rot);
        g.drawImage(face, -r, -r, r * 2, r * 2);
        // result: the other slices darken, the winning one pops out with a white edge
        if (pop > 0) {
          g.fillStyle = 'rgba(0,0,0,' + (0.45 * Math.min(1, pop)).toFixed(3) + ')';
          for (var i = 0; i < N; i++) if (i !== winner) { wedge(r, i); g.fill(); }
          var p = Math.min(1.4, pop), rr = r * (1 + 0.05 * p);
          g.save();
          g.shadowColor = 'rgba(0,0,0,' + (0.3 * Math.min(1, p)).toFixed(3) + ')'; g.shadowBlur = r * 0.07;
          wedge(rr, winner); g.fillStyle = SLOTS[winner % SLOTS.length]; g.fill();
          g.restore();
          wedge(rr, winner); g.lineJoin = 'round'; g.lineWidth = Math.max(3, r * 0.018); g.strokeStyle = '#FFFFFF'; g.stroke();
        }
        // names along the radius; the left half is turned over so every name reads upright
        g.textBaseline = 'middle'; g.fillStyle = '#FFFFFF';
        g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = 3; g.shadowOffsetY = 1;
        var outer = r * 0.84;
        for (var j = 0; j < N; j++) {
          var mid = -Math.PI / 2 + (j + 0.5) * SEG, left = Math.cos(mid + rot) < 0;
          g.save(); g.rotate(left ? mid + Math.PI : mid);
          g.font = '800 ' + sizes[j].toFixed(1) + 'px ' + FONT;
          g.textAlign = left ? 'left' : 'right';
          g.fillText(names[j], left ? -outer : outer, 0);
          g.restore();
        }
        g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
        // small yellow lights on the rim (two per slice)
        var bulbR = Math.max(3, Math.min(6, r * 0.017));
        g.fillStyle = '#FFF3C4';
        for (var k = 0; k < N * 2; k++) {
          var a = k * SEG / 2 - Math.PI / 2;
          g.beginPath(); g.arc(Math.cos(a) * (r + rim * 0.15), Math.sin(a) * (r + rim * 0.15), bulbR, 0, TAU); g.fill();
        }
        g.restore();
        // centre: plain white circle in a dark ring
        g.fillStyle = rimColor; g.beginPath(); g.arc(c, c, r * 0.13, 0, TAU); g.fill();
        g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(c, c, r * 0.09, 0, TAU); g.fill();
        // red pointer at the top; it kicks when a slice edge passes
        g.save(); g.translate(c, c - r - rim * 0.6); g.rotate(flap);
        g.save();
        g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = r * 0.02 + 1; g.shadowOffsetY = r * 0.012;
        g.beginPath(); g.moveTo(0, r * 0.17); g.lineTo(-r * 0.075, -r * 0.01); g.lineTo(r * 0.075, -r * 0.01); g.closePath();
        g.fillStyle = '#E5484D'; g.fill();
        g.beginPath(); g.arc(0, 0, r * 0.07, 0, TAU); g.fill();
        g.restore();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(-r * 0.018, -r * 0.018, r * 0.022, 0, TAU); g.fill();
        g.restore();
      }

      function resize() {
        var w = ww.clientWidth;
        var h = root.clientHeight - hl.offsetHeight - btn.offsetHeight - 6 - 16;
        side = Math.max(120, Math.floor(Math.min(w, h, 560)));
        ww.style.height = side + 'px';
        cvo.fit(side, side);
        R = side * 0.45; rim = Math.max(6, R * 0.04);
        renderFace(); draw();
      }

      function spin() {
        if (spinning) return;
        S.click(); ctx.buzz();
        var pickI = ctx.rnd(N), f = 0.2 + Math.random() * 0.6;
        var target = -(pickI + f) * SEG;
        delta = TAU * (5 + ctx.rnd(2)) + mod(target - rot, TAU);
        from = rot; el = 0; dur = 4.3 + Math.random() * 0.8;
        spinning = true; idle = false; winner = -1; lastIdx = idxAt(rot);
        btn.classList.add('busy'); hl.classList.remove('won');
        ctx.wake();
      }
      function done() {
        spinning = false; resultAt = clock; btn.classList.remove('busy'); spins++;
        winner = idxAt(rot);
        var col = SLOTS[winner % SLOTS.length];
        pill.innerHTML = ctx.ICON.spark + '<span>' + ctx.esc(ctx.fmt(t.res, { n: names[winner] })) + '</span>';
        pill.style.background = col; pill.style.color = ctx.inkOn(col);
        pill.style.boxShadow = '0 6px 16px ' + ctx.rgba(col, 0.35);
        hl.classList.remove('won'); void hl.offsetWidth; hl.classList.add('won');
        S.bang(); S.win(); ctx.buzz([20, 40, 30]);
        ctx.burstAt(pill, 90, { speed: 700 });
        ctx.rain(50);
      }

      ctx.on(btn, 'click', spin);
      ctx.on(cv, 'pointerdown', function (e) { if (e.isPrimary !== false) spin(); });
      ctx.hint(btn);

      return {
        resize: resize,
        redraw: function () { renderFace(); draw(); },
        frame: function (dt) {
          clock += dt;
          if (spinning) {
            el += dt;
            var p = Math.min(1, el / dur), e = 1 - Math.pow(1 - p, 3);
            rot = from + delta * e;
            var idx = idxAt(rot);
            if (idx !== lastIdx) {
              lastIdx = idx;
              var speed = 3 * delta * Math.pow(1 - p, 2) / dur;
              flap = -Math.min(0.5, 0.18 + speed * 0.03);
              if (el - lastPeg > 0.035) { S.peg(); lastPeg = el; }
            }
            if (p >= 1) done();
          } else if (idle) {
            rot += dt * 0.25;
          }
          flap += (0 - flap) * Math.min(1, dt * 16);
          draw();
          return true;
        },
        debug: function () {
          return { spinning: spinning, spins: spins, winner: winner >= 0 ? names[winner] : null, slice: idxAt(rot) };
        }
      };
    }
  };
})();
