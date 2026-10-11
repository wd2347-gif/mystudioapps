/* 손가락 뽑기 (finger): the app's Chwazi-style picker (finger.dart, "pick one" mode) on its full-bleed dark purple board.
   Every finger gets a breathing ring in a player colour (pop on touch). With one finger or a mouse, two or three friends'
   rings fade in so there is someone to pick. Hold still 2 s: beep, beep, beep with a big faint 3, 2, 1 while the rings
   spin and shrink, then one is picked: its colour floods the board, white ring + star, "Picked!", fanfare and confetti.
   Lifting all fingers shows the result for a beat and goes back to the start; still holding, a new round starts by itself.
   Real multi-touch keeps working (each finger its own ring, friends step aside when a second real finger lands). */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var HOLD = 2.0, BEAT = 0.6, MAXF = 10;
  var T = {
    ko: { hint: '모두 손가락을 화면에 올려요', more: '한 명 더 올려요!', hold: '그대로 가만히…', picked: '당첨!',
      lift: '손가락을 모두 떼면 다시 해요', again: '다시 하려면 손가락을 올려요', you: '나' },
    ja: { hint: 'みんな指を置いてね', more: 'もう1人！', hold: 'そのまま動かないで…', picked: '当たり！',
      lift: '指を全部離すともう一回', again: 'もう一回なら指を置いてね', you: 'あなた' },
    en: { hint: 'Everyone, put a finger on the screen', more: 'One more finger!', hold: 'Hold still…', picked: 'Picked!',
      lift: 'Lift all fingers to play again', again: 'Put fingers down to play again', you: 'You' }
  };
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#FFC233" d="M12 2.6l2.75 5.86 6.4.78-4.72 4.4 1.22 6.33L12 16.83l-5.65 3.14 1.22-6.33-4.72-4.4 6.4-.78z"/></svg>';
  var TOUCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#FFFFFF" d="M9 11.2V5.5a2 2 0 0 1 4 0v4.3l4.2.9c1.1.24 1.86 1.27 1.75 2.4l-.5 5.3A3 3 0 0 1 15.47 21h-4.2a3 3 0 0 1-2.3-1.08l-3.6-4.3a1.6 1.6 0 0 1 2.3-2.2L9 14.6z"/></svg>';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOutBack(x) { var c = 1.70158; x -= 1; return 1 + (c + 1) * x * x * x + c * x * x; }
  function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function easeOut(x) { return 1 - (1 - x) * (1 - x) * (1 - x * 0.4); }
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function darker(hex, k) { var c = rgb(hex); return 'rgb(' + Math.round(c[0] * (1 - k)) + ',' + Math.round(c[1] * (1 - k)) + ',' + Math.round(c[2] * (1 - k)) + ')'; }

  GAMES['finger'] = {
    name: { ko: '손가락 뽑기', ja: '指ルーレット', en: 'Finger Picker' },
    tip: { ko: '손가락을 올리고 기다리면 한 명이 뽑혀요', ja: '指を置いて待つと、ひとりが選ばれる', en: 'Hold a finger down and one gets picked' },
    cat: 'bet', who: '2+', accent: '#FF5C7A', full: true,
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx, SLOTS = ctx.SLOTS, FONT = ctx.FONT, rgba = ctx.rgba;
      var root = ctx.el;
      root.innerHTML =
        '<div class="idle"><div class="ic"><i>' + TOUCH + '</i></div><div class="it">' + ctx.esc(t.hint) + '</div></div>' +
        '<div class="top"><div class="st"></div><div class="pill">' + STAR + '<span></span></div></div>' +
        '<div class="bot"><span></span></div>';
      var cvo = ctx.canvas(root), cv = cvo.cv, g = cvo.g;
      root.insertBefore(cv, root.firstChild);
      var idleEl = root.querySelector('.idle'), icEl = root.querySelector('.ic'), stEl = root.querySelector('.st');
      var pillEl = root.querySelector('.pill'), pillText = pillEl.querySelector('span'), botEl = root.querySelector('.bot');
      var botText = botEl.querySelector('span');
      var bg = document.createElement('canvas'), dpr = ctx.dpr;
      var W = 0, H = 0, R = 40, K = 1;

      var fingers = [];   // rings on the board: { id, x, y, c, born, friend, name, seed }
      var ghosts = [];    // lifted rings fading out: { x, y, c, lifted }
      var down = {}, downN = 0;   // every pointer touching now (also ones not on the board): id -> { x, y, at }
      var phase = 'idle'; // idle | wait | countdown | reveal | done
      var now = 0, changedAt = 0, cdStart = 0, beats = 0, pickAt = 0, doneAt = 0, finale = false;
      var chosen = null, picked = [], outro = null, events = [], picks = 0, rehints = 0, touched = false, statusKey = '';
      var seed = 0;

      function at(time, fn) { events.push({ t: time, fn: fn }); }
      function realN() { var n = 0; for (var i = 0; i < fingers.length; i++) if (!fingers[i].friend) n++; return n; }
      function friendsN() { var n = 0; for (var i = 0; i < fingers.length; i++) if (fingers[i].friend) n++; return n; }
      function visible() { return fingers.filter(function (f) { return now >= f.born; }); }
      function freeColour() {
        var used = {}; fingers.forEach(function (f) { used[f.c] = 1; });
        var c = 0; while (used[c]) c++;
        return c;
      }
      function col(f) { return SLOTS[f.c % SLOTS.length]; }

      function renderBg() {
        bg.width = Math.max(1, Math.round(W * dpr)); bg.height = Math.max(1, Math.round(H * dpr));
        var b = bg.getContext('2d');
        b.setTransform(dpr, 0, 0, dpr, 0, 0);
        // RadialGradient(center: Alignment(0, -0.35), radius: 1.2 of the shortest side)
        var cx = W / 2, cy = H / 2 - 0.35 * H / 2, rad = 1.2 * Math.min(W, H);
        var gr = b.createRadialGradient(cx, cy, 0, cx, cy, rad);
        gr.addColorStop(0, '#2A2140'); gr.addColorStop(1, '#120F19');
        b.fillStyle = gr; b.fillRect(0, 0, W, H);
      }

      // the app's _ring: soft glow, tinted fill, thick colour ring, thin white inner ring (+ spinning arcs in the countdown)
      function ring(x, y, r, c, a, spin) {
        if (r <= 1 || a <= 0) return;
        var gr = g.createRadialGradient(x, y, 0, x, y, r * 1.95);
        gr.addColorStop(0, rgba(c, 0.45 * a)); gr.addColorStop(0.38, rgba(c, 0.42 * a)); gr.addColorStop(0.59, rgba(c, 0.22 * a));
        gr.addColorStop(0.8, rgba(c, 0.06 * a)); gr.addColorStop(1, rgba(c, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 1.95, 0, TAU); g.fill();
        g.fillStyle = rgba(c, 0.32 * a); g.beginPath(); g.arc(x, y, r * 0.8, 0, TAU); g.fill();
        g.lineWidth = r * 0.17; g.strokeStyle = rgba(c, a); g.beginPath(); g.arc(x, y, r * 0.86, 0, TAU); g.stroke();
        g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,' + (0.35 * a).toFixed(3) + ')'; g.beginPath(); g.arc(x, y, r * 0.62, 0, TAU); g.stroke();
        if (spin != null) {
          g.lineWidth = 3.5; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,' + (0.85 * a).toFixed(3) + ')';
          for (var i = 0; i < 3; i++) { g.beginPath(); g.arc(x, y, r * 1.22, spin + i * TAU / 3, spin + i * TAU / 3 + 1.1); g.stroke(); }
          g.lineCap = 'butt';
        }
      }
      function label(text, x, y, a) {
        if (!text || a <= 0) return;
        g.font = '800 ' + Math.round(13 * K) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(0,0,0,' + (0.35 * a).toFixed(3) + ')'; g.fillText(text, x, y + 1.5);
        g.fillStyle = 'rgba(255,255,255,' + (0.88 * a).toFixed(3) + ')'; g.fillText(text, x, y);
      }
      function star(x, y, rad) {
        g.beginPath();
        for (var i = 0; i < 10; i++) {
          var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? rad * 0.42 : rad;
          if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.closePath(); g.fillStyle = '#FFFFFF'; g.fill();
      }
      // a friend's finger trembles a little, like a real fingertip
      function px(f) { return f.friend ? f.x + Math.sin(now * 1.3 + f.seed) * 1.6 : f.x; }
      function py(f) { return f.friend ? f.y + Math.cos(now * 1.7 + f.seed * 1.3) * 1.6 : f.y; }
      function tag(f) { return f.friend ? f.name : (friendsN() || picked.some(function (q) { return q.friend; }) ? t.you : ''); }

      function draw() {
        if (!W) return;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.drawImage(bg, 0, 0, W, H);
        if (outro) {
          var oa = 1 - (now - outro.t0) / 0.4;
          if (oa > 0) { g.fillStyle = rgba(outro.c, oa.toFixed(3)); g.fillRect(0, 0, W, H); } else outro = null;
        }
        var r = R, i, f;
        // countdown number under the rings, big and faint
        if (phase === 'countdown' && beats >= 1 && beats <= 3) {
          var local = ((now - cdStart) % BEAT) / BEAT, s = 1.25 - 0.25 * easeOut(local);
          g.save(); g.translate(W / 2, H / 2); g.scale(s, s);
          g.font = '900 ' + Math.round(Math.min(W, H) * 0.42) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = 'rgba(255,255,255,.16)'; g.fillText(String(4 - beats), 0, 0);
          g.restore();
        }
        if (phase !== 'reveal' && phase !== 'done') {
          for (i = 0; i < ghosts.length; i++) {
            f = ghosts[i];
            var q = clamp((now - f.lifted) / 0.3, 0, 1);
            ring(f.x, f.y, r * (1 + 0.4 * q), SLOTS[f.c % SLOTS.length], 1 - q);
          }
          var cd = phase === 'countdown' ? clamp((now - cdStart) / (BEAT * 3), 0, 1) : -1;
          for (i = 0; i < fingers.length; i++) {
            f = fingers[i];
            if (now < f.born) continue;
            var born = clamp((now - f.born) / 0.35, 0, 1), sc = easeOutBack(born) * (1 + 0.05 * Math.sin(now * 5 + f.seed));
            if (cd >= 0) sc *= 1 - 0.22 * cd;
            var x = px(f), y = py(f);
            ring(x, y, r * sc, col(f), Math.min(1, born * 2), cd >= 0 ? now * (5 + 7 * cd) : null);
            label(tag(f), x, y + r * 1.32 + 10 * K, born * (cd >= 0 ? 1 - 0.5 * cd : 1));
          }
          return;
        }
        // result ("pick one"): the others fade, the chosen colour floods out from its finger
        var since = now - pickAt, fade = clamp(1 - since / 0.4, 0, 1);
        for (i = 0; i < picked.length; i++) {
          f = picked[i];
          if (f === chosen || fade <= 0) continue;
          ring(px(f), py(f), r * (1 - 0.3 * (1 - fade)), col(f), fade);
          label(tag(f), px(f), py(f) + r * 1.32 + 10 * K, fade);
        }
        if (!chosen) return;
        var c = col(chosen), cx = chosen.x, cy = chosen.y;
        var p = easeInOutCubic(clamp((since - 0.05) / 0.75, 0, 1));
        var far = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy));
        g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r + (far - r) * p, 0, TAU); g.fill();
        var pulse = 1 + 0.06 * Math.sin(now * 4), pop = 1 + 0.35 * Math.sin(Math.PI * clamp(since / 0.45, 0, 1));
        var rr = r * 1.1 * pulse * pop;
        g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(cx, cy, rr * 1.35, 0, TAU); g.fill();
        g.fillStyle = darker(c, 0.35); g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fill();
        g.lineWidth = rr * 0.16; g.strokeStyle = '#FFFFFF'; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke();
        star(cx, cy + rr * 0.04, rr * 0.5);
        label(tag(chosen), cx, cy + rr * 1.35 + 12 * K, clamp(since / 0.3, 0, 1));
      }

      // DOM text: idle call-out, status line / result pill at the top, a dark pill at the bottom
      function paint() {
        var vis = 0; for (var i = 0; i < fingers.length; i++) if (now >= fingers[i].born) vis++;
        var st = '', bot = '';
        if (phase === 'wait' || phase === 'countdown') st = vis < 2 ? t.more : t.hold;
        if (phase === 'reveal' && finale) bot = t.lift;
        if (phase === 'done') bot = t.again;
        var res = (phase === 'reveal' || phase === 'done') && finale && chosen;
        var key = phase + '|' + st + '|' + bot + '|' + (res ? pickAt : '') + '|' + touched;
        if (key === statusKey) return;
        statusKey = key;
        idleEl.classList.toggle('on', phase === 'idle');
        icEl.classList.toggle('hand', touched);
        stEl.textContent = st; stEl.classList.toggle('on', !!st && !res);
        if (res) {
          if (!pillEl.classList.contains('on')) {
            pillText.textContent = t.picked; pillText.style.color = darker(col(chosen), 0.25);
            pillEl.classList.add('on');
          }
        } else pillEl.classList.remove('on');
        if (bot) botText.textContent = bot;
        botEl.classList.toggle('on', !!bot);
      }

      function softPop(i) { var f = 760 + i * 140; S.tone(f, 0.07, 'sine', 0.13, f * 0.5); }
      function place() {
        var mx = R * 1.5, top = 54 * K + R, bot = H - 64 * K - R * 1.4, best = null, bestD = -1;
        for (var k = 0; k < 40; k++) {
          var x = mx + Math.random() * Math.max(1, W - mx * 2), y = top + Math.random() * Math.max(1, bot - top), d = 1e9;
          for (var j = 0; j < fingers.length; j++) d = Math.min(d, Math.hypot(fingers[j].x - x, fingers[j].y - y));
          if (d > R * 3.2) return { x: x, y: y };
          if (d > bestD) { bestD = d; best = { x: x, y: y }; }
        }
        return best;
      }
      function addFriends() {
        var n = 2 + ctx.rnd(2), names = ctx.names.slice().sort(function () { return Math.random() - 0.5; });
        for (var i = 0; i < n; i++) {
          var p = place(), f = { id: -1 - i, x: p.x, y: p.y, c: freeColour(), born: now + 0.22 + 0.2 * i, friend: true, name: names[i], seed: seed++ };
          fingers.push(f);
          (function (f, i) { at(f.born, function () { if (fingers.indexOf(f) >= 0) { softPop(i); paint(); } }); })(f, i);
        }
      }
      function dropFriends() {
        fingers = fingers.filter(function (f) {
          if (!f.friend) return true;
          if (now >= f.born) ghosts.push({ x: f.x, y: f.y, c: f.c, lifted: now });
          return false;
        });
      }
      function addReal(id, x, y) {
        fingers.push({ id: id, x: x, y: y, c: freeColour(), born: now, friend: false, name: '', seed: seed++ });
      }
      function clearResult() {
        if (chosen) outro = { c: col(chosen), t0: now };
        fingers = []; ghosts = []; picked = []; chosen = null; finale = false; events = [];
      }

      function pick() {
        var list = visible();
        if (list.length < 2) { phase = 'wait'; changedAt = now; return; }
        chosen = list[ctx.rnd(list.length)]; picked = list; pickAt = now; finale = false; phase = 'reveal'; picks++;
        S.stamp(); ctx.buzz(30);
        var me = chosen;
        at(now + 0.22, function () {
          if (chosen !== me) return;
          S.win(); finale = true; ctx.buzz([20, 40, 30]);
          ctx.burst(me.x, me.y, 70, { ring: true, speed: 560, colors: [col(me), '#FFFFFF', '#FFE066', '#FFC233'] });
          paint();
        });
      }
      // still holding after the result: a fresh round with the same fingers (and new friends for a single finger)
      function again() {
        clearResult();
        var ids = Object.keys(down);
        if (!ids.length) { phase = 'idle'; return; }
        ids.slice(0, MAXF).forEach(function (k) { addReal(+k, down[k].x, down[k].y); });
        if (realN() === 1) addFriends();
        phase = 'wait'; changedAt = now;
        S.pop(); ctx.buzz(12);
      }

      function onDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        var p = ctx.local(e);
        if (!down[e.pointerId]) downN++;
        down[e.pointerId] = { x: p.x, y: p.y, at: now };
        touched = true;
        ctx.wake();
        if (phase === 'reveal') { paint(); return; }  // fingers put down during the result do not count
        if (phase === 'done') clearResult();
        if (realN() >= MAXF) return;
        if (realN() >= 1 && friendsN()) dropFriends();   // a second real finger: the friends step aside
        addReal(e.pointerId, p.x, p.y);
        changedAt = now;
        S.pop(0.35 + Math.random() * 0.3); ctx.buzz(12);
        if (realN() === 1 && !friendsN()) addFriends();
        phase = 'wait';
        paint();
      }
      function onMove(e) {
        var d = down[e.pointerId];
        if (!d) return;
        var p = ctx.local(e);
        d.x = p.x; d.y = p.y;
        if (phase === 'wait' || phase === 'countdown') {
          for (var i = 0; i < fingers.length; i++) if (fingers[i].id === e.pointerId && !fingers[i].friend) { fingers[i].x = p.x; fingers[i].y = p.y; }
        }
      }
      function onUp(e) {
        var d = down[e.pointerId];
        if (!d) return;
        delete down[e.pointerId]; downN--;
        ctx.wake();
        if (phase === 'reveal' || phase === 'done') {
          if (downN <= 0 && phase === 'reveal') { phase = 'done'; doneAt = Math.max(now, pickAt + 1.0); paint(); }
          return;
        }
        var f = null;
        for (var i = 0; i < fingers.length; i++) if (fingers[i].id === e.pointerId && !fingers[i].friend) f = fingers[i];
        if (!f) return;
        fingers.splice(fingers.indexOf(f), 1);
        ghosts.push({ x: f.x, y: f.y, c: f.c, lifted: now });
        changedAt = now;
        S.tone(520, 0.05, 'sine', 0.08, 380); ctx.buzz(8);
        var real = realN();
        if (!real) {
          dropFriends(); phase = 'idle';
          // a quick tap instead of a hold: point at the circle again (twice at most)
          if (now - d.at < 0.7 && !picks && rehints < 2) { rehints++; ctx.hint(icEl, { kind: 'hold', delay: 700 }); }
        } else {
          if (real === 1 && !friendsN()) addFriends();
          phase = 'wait';
        }
        paint();
      }
      ctx.on(cv, 'pointerdown', onDown);
      ctx.on(cv, 'pointermove', onMove);
      ctx.on(cv, 'pointerup', onUp);
      ctx.on(cv, 'pointercancel', onUp);
      ctx.hint(icEl, { kind: 'hold' });

      function step() {
        if (events.length) {
          var due = events.filter(function (ev) { return ev.t <= now; });
          if (due.length) { events = events.filter(function (ev) { return ev.t > now; }); due.forEach(function (ev) { ev.fn(); }); }
        }
        ghosts = ghosts.filter(function (q) { return now - q.lifted <= 0.4; });
        if (phase === 'wait') {
          if (visible().length >= 2 && now - changedAt >= HOLD) {
            cdStart = now; beats = 1; phase = 'countdown';
            S.beep(); ctx.buzz(15); paint();
          }
        } else if (phase === 'countdown') {
          var b = Math.floor((now - cdStart) / BEAT) + 1;
          if (b !== beats) {
            beats = b;
            if (b <= 3) { S.beep(); ctx.buzz(15); } else pick();
            paint();
          }
        } else if (phase === 'reveal') {
          if (now - pickAt > 2.6) { again(); paint(); }
        } else if (phase === 'done') {
          if (now - doneAt > 1.6) { clearResult(); phase = 'idle'; paint(); }
        }
        paint();
      }

      return {
        resize: function () {
          cvo.fit();
          W = cvo.w; H = cvo.h;
          K = clamp(Math.min(W, H) / 390, 1, 1.35);
          R = clamp(Math.min(W, H) * 0.11, 38, 62);
          root.style.setProperty('--k', K.toFixed(3));
          renderBg(); draw();
        },
        redraw: draw,
        frame: function (dt) {
          now += dt;
          step();
          draw();
          return phase !== 'idle' || fingers.length > 0 || ghosts.length > 0 || !!outro || events.length > 0;
        },
        destroy: function () { events = []; },
        debug: function () {
          return { phase: phase, rings: visible().length, real: realN(), friends: friendsN(), beats: phase === 'countdown' ? beats : 0,
            picks: picks, chosen: chosen ? (chosen.friend ? chosen.name : 'you') : null, down: downN };
        }
      };
    }
  };
})();
