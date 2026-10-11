/* 연타 줄다리기 (tapwar): the app's tap tug of war (tapwar.dart) against the computer. Top half pink (computer, its words
   turned 180 degrees), bottom half blue (you), a vertical rope with a red bow between two fists, faint arrows flowing to each
   side. Every tap in your half pops a white ripple and pulls the bow your way; the computer taps at a human, beatable pace.
   Bow over your line wins the round, best of three, then trophy + confetti and a new match starts by itself. */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var TOP = '#FF5C7A', BOT = '#3E9BFF', GOLD = '#FFE066';
  var STEP = 1 / 16, ROUND_T = 10, COUNT_STEP = 0.6, NEXT_GUARD = 1.2;
  var CONF = ['#FFE066', '#FFFFFF', '#7CE0B5', '#FFB3C7', '#B9A6FF'];
  var T = {
    ko: { tap: '연타!', pull: '당겨요!', almost: '조금만 더!', hold: '버텨요!', tie: '비겼어요!', retry: '눌러서 다시 해요',
      mwin: '최종 승리!', mlose: '아까워요! 다음엔 꼭', next: '눌러서 다음 판', start: '눌러서 시작', round: '{0}라운드',
      win: '이겼어요!', lose: '졌어요', again: '다시 하기', cpu: '컴퓨터', you: '나' },
    ja: { tap: '連打！', pull: '引け！', almost: 'あと少し！', hold: '踏ん張れ！', tie: '引き分け！', retry: 'タップでもう一度',
      mwin: '最終勝利！', mlose: '惜しい！次こそ', next: 'タップで次のラウンド', start: 'タップでスタート', round: 'ラウンド{0}',
      win: '勝ち！', lose: '負け…', again: 'もう一回', cpu: 'コンピューター', you: 'あなた' },
    en: { tap: 'TAP!', pull: 'PULL!', almost: 'Almost!', hold: 'Hold on!', tie: 'Tie!', retry: 'Tap to replay',
      mwin: 'You win the match!', mlose: 'So close! Next time', next: 'Tap for next round', start: 'Tap to start', round: 'Round {0}',
      win: 'You win!', lose: 'You lose', again: 'Play again', cpu: 'Computer', you: 'You' }
  };
  var TIMER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.6M9.5 2.8h5M18.6 6.4l1.4-1.4"/></svg>';
  var HEART = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path transform="translate(-.8 .2) rotate(-7 12 21)" d="M12 5.1C10.9 3.8 9.2 3 7.5 3 4.4 3 2 5.4 2 8.5c0 3.8 3.4 6.9 8.6 11.5l1.4 1.3-.8-4.9 1.9-3.8-2.5-3z"/>' +
    '<path transform="translate(.8 .2) rotate(7 12 21)" d="M12 5.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5L12 21.3l-.8-4.9 1.9-3.8-2.5-3z"/></svg>';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mod(a, m) { return ((a % m) + m) % m; }
  // Color.lerp toward white ('w') or black: returns #RRGGBB
  function lerp(hex, to, k) {
    var n = parseInt(hex.slice(1), 16), e = to === 'w' ? 255 : 0;
    return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { return ('0' + Math.round(v + (e - v) * k).toString(16)).slice(-2); }).join('');
  }
  function elasticOut(x) { if (x <= 0) return 0; if (x >= 1) return 1; return Math.pow(2, -10 * x) * Math.sin((x - 0.075) * TAU / 0.3) + 1; }

  GAMES['tapwar'] = {
    name: { ko: '연타 줄다리기', ja: '連打つなひき', en: 'Tap Tug of War' },
    tip: { ko: '내 쪽을 마구 두드려 줄을 당겨요', ja: '自分の側を連打してロープを引こう', en: 'Tap your half fast to pull the rope' },
    cat: 'duel', accent: '#D9363E', full: true,
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx;
      var root = ctx.el;
      function half(side) {
        return '<div class="h h' + side + '"><div class="in">' +
          '<div class="blk"><div class="sc"><i></i><i></i><b></b></div><div class="big"><span></span></div><div class="sm"></div></div>' +
          '<div class="mb"><div class="ico"></div><div class="mt"><span></span></div><div class="sc"><i></i><i></i><b></b></div>' +
          (side ? '<button class="again" type="button">' + ctx.ICON.again + '<span>' + ctx.esc(t.again) + '</span></button>' : '') +
          '</div></div></div>';
      }
      root.innerHTML = half(0) + half(1) + '<span class="tag t0">' + ctx.esc(t.cpu) + '</span><span class="tag t1">' + ctx.esc(t.you) + '</span>';
      var cvo = ctx.canvas(root), g = cvo.g;
      root.insertBefore(cvo.cv, root.firstChild);
      var dpr = ctx.dpr, bg = document.createElement('canvas');
      var H2 = [0, 1].map(function (s) {
        var h = root.querySelector('.h' + s);
        return {
          blk: h.querySelector('.blk'), dots: h.querySelectorAll('.blk .sc i'), score: h.querySelector('.blk .sc b'),
          big: h.querySelector('.big'), bigText: h.querySelector('.big span'), sm: h.querySelector('.sm'),
          mb: h.querySelector('.mb'), ico: h.querySelector('.ico'), mt: h.querySelector('.mt'), mtText: h.querySelector('.mt span'),
          mdots: h.querySelectorAll('.mb .sc i'), mscore: h.querySelector('.mb .sc b'), key: '', mkey: ''
        };
      });
      var againBtn = root.querySelector('.again'), tag0 = root.querySelector('.t0'), tag1 = root.querySelector('.t1');

      var W = 0, H = 0, G = null, bgKey = '';
      var stage = 'idle', wins = [0, 0], roundNo = 1, matchNo = 1;
      var p = 0, shown = 0, wiggle = 0, roundWinner = -1, tie = false, canRestart = false, lean = 0;
      var now = 0, countStart = 0, countAt = 0, countShown = 0, pullStart = 0, overAt = 0, lastTickSec = -1;
      var lastTap = [-10, -10], flow = [0, 0], sparks = [[], []], lastPop = -1, lastBuzz = -1, lastCpuSnd = -1, sparkSeed = 0;
      var aiNext = 0, myTaps = 0, cpuTaps = 0, rounds = 0, hinted = false, autoId = 0;

      // the app's _Geo: k is the scale against a 390 px phone
      function geo(w, h) {
        var hh = h / 2, k = clamp(Math.min(w / 390, hh / 340), 0.8, 1.7), pad = Math.max(16, hh * 0.06), grip = hh * 0.11;
        var room = hh - pad - 100 * k - 10 * k - grip - 40 * k;
        return { k: k, reach: Math.max(36 * k, Math.min(hh * 0.36, room)), grip: grip, lineHalf: Math.max(70 * k, w * 0.14), pad: pad };
      }
      function sideColour(side) { var b = side ? BOT : TOP; return ctx.dark ? lerp(b, 'k', 0.14) : b; }

      // both halves' gradients (light at the centre line, darker at each player's own edge; the losing half darkens)
      function renderBg() {
        var lost = roundWinner >= 0 ? 1 - roundWinner : -1, key = W + 'x' + H + '|' + lost + '|' + ctx.dark;
        if (key === bgKey) return;
        bgKey = key;
        bg.width = Math.max(1, Math.round(W * dpr)); bg.height = Math.max(1, Math.round(H * dpr));
        var b = bg.getContext('2d'); b.setTransform(dpr, 0, 0, dpr, 0, 0);
        for (var s = 0; s < 2; s++) {
          var c = sideColour(s), y0 = H / 2, y1 = s ? H : 0;
          var gr = b.createLinearGradient(0, y0, 0, y1);
          gr.addColorStop(0, lerp(c, 'w', 0.18)); gr.addColorStop(1, lerp(c, 'k', lost === s ? 0.35 : 0.08));
          b.fillStyle = gr; b.fillRect(0, s ? H / 2 : 0, W, H / 2);
        }
      }
      // draw in a half's own frame: origin at the centre line, y grows toward that player's edge
      function inHalf(side, fn) {
        g.save();
        g.beginPath(); g.rect(0, side ? H / 2 : 0, W, H / 2); g.clip();
        if (side) g.translate(0, H / 2); else { g.translate(W, H / 2); g.rotate(Math.PI); }
        fn(H / 2);
        g.restore();
      }
      function arrows(side) {
        var k = G.k, cx = W / 2, gapX = 96 * k, gapY = 58 * k, aw = 13 * k, ah = 8 * k, shift = mod(flow[side], 1) * gapY;
        inHalf(side, function (hh) {
          g.strokeStyle = 'rgba(255,255,255,.11)'; g.lineWidth = 4 * k; g.lineCap = 'round'; g.lineJoin = 'round';
          g.beginPath();
          for (var i = 0; ; i++) {
            var dx = 78 * k + i * gapX;
            if (dx > cx - 22 * k) break;
            for (var j = 0; j < 2; j++) {
              var x = j ? cx + dx : cx - dx;
              for (var y = -gapY + shift; y < hh + gapY; y += gapY) { g.moveTo(x - aw, y - ah); g.lineTo(x, y); g.lineTo(x + aw, y - ah); }
            }
          }
          g.stroke();
        });
      }
      function drawSparks(side) {
        var list = sparks[side], k = G.k;
        if (!list.length) return;
        inHalf(side, function () {
          g.lineWidth = 3 * k;
          for (var i = 0; i < list.length; i++) {
            var s = list[i], u = (now - s.born) / 0.6;
            if (u < 0 || u > 1) continue;
            g.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - u)).toFixed(3) + ')';
            g.beginPath(); g.arc(s.x, s.y, (14 + 40 * u) * k, 0, TAU); g.stroke();
            g.fillStyle = 'rgba(255,255,255,' + (0.9 * (1 - u)).toFixed(3) + ')';
            var d = (18 + 46 * (1 - (1 - u) * (1 - u))) * k, rr = (4 * (1 - u) + 1) * k;
            g.beginPath();
            for (var j = 0; j < 6; j++) {
              var a = j * Math.PI / 3 + s.seed * 0.7, x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d;
              g.moveTo(x + rr, y); g.arc(x, y, rr, 0, TAU);
            }
            g.fill();
          }
        });
      }
      function confetti(side) {
        var age = now - overAt, k = G.k;
        if (age < 0) return;
        var fade = clamp(age / 0.4, 0, 1);
        inHalf(side, function (hh) {
          var span = hh + 40 * k;
          for (var i = 0; i < 28; i++) {
            var a = (i * 0.618034) % 1, b = (i * 0.381966 + 0.27) % 1, speed = (70 + 90 * b) * k;
            var y = mod(age * speed + a * span, span) - 20 * k, x = a * W + Math.sin(age * 2 + i) * 14 * k;
            // in the half's own frame (y = 0 at the centre line) the confetti falls toward that player's edge
            g.save(); g.translate(x, y); g.rotate(age * (2 + 3 * b) + i);
            g.globalAlpha = 0.9 * fade; g.fillStyle = CONF[i % CONF.length];
            g.fillRect(-5 * k, -3 * k, 10 * k, 6 * k);
            g.restore();
          }
        });
      }
      function rr(x, y, w, h, r) {
        g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
      }
      // a fist around the rope (four knuckles), the app's _paintFist
      function fist(x, y, up, s) {
        g.save(); g.translate(x, y); if (up) g.rotate(Math.PI); g.scale(s, s);
        g.fillStyle = '#FFD2AE'; rr(-15, 8, 30, 30, 10); g.fill(); rr(-21, -16, 42, 30, 13); g.fill();
        g.strokeStyle = '#E9A97F'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath();
        for (var i = 0; i < 3; i++) { var kx = -10.5 + i * 10.5; g.moveTo(kx, -14); g.lineTo(kx, -4); }
        g.stroke();
        g.fillStyle = '#FFC79E'; rr(-24, -6, 18, 12, 6); g.fill();
        g.restore();
      }
      function rope() {
        var k = G.k, cx = W / 2, cy = H / 2, reach = G.reach, wig = wiggle, my = cy + shown * reach, i, y;
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();
        for (var x = 12; x < W; x += 22) { g.moveTo(x, cy); g.lineTo(x + 10, cy); }
        g.stroke();
        if (stage === 'matchOver') return;
        g.strokeStyle = '#FFFFFF'; g.lineWidth = 5 * k; g.fillStyle = '#FFFFFF';
        for (i = -1; i <= 1; i += 2) {
          y = cy + i * reach;
          g.beginPath(); g.moveTo(cx - G.lineHalf, y); g.lineTo(cx + G.lineHalf, y); g.stroke();
          g.beginPath(); g.arc(cx - G.lineHalf, y, 6 * k, 0, TAU); g.arc(cx + G.lineHalf, y, 6 * k, 0, TAU); g.fill();
        }
        var top = cy - reach - G.grip, bottom = cy + reach + G.grip;
        function xAt(yy) { return cx + Math.sin(yy * 0.03 / k + now * 22) * 7 * k * wig; }
        var path = function (ox, oy) {
          g.beginPath(); g.moveTo(xAt(top) + ox, top + oy);
          if (wig > 0.01) for (var yy = top; yy <= bottom; yy += 6) g.lineTo(xAt(yy) + ox, yy + oy);
          g.lineTo(xAt(bottom) + ox, bottom + oy);
        };
        g.lineCap = 'round';
        path(2 * k, 3 * k); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 16 * k; g.stroke();
        path(0, 0); g.strokeStyle = '#E3B577'; g.lineWidth = 14 * k; g.stroke();
        var pitch = 12 * k, slide = mod(shown * reach, pitch);
        g.strokeStyle = '#B5813F'; g.lineWidth = 3 * k; g.beginPath();
        for (y = top + slide; y <= bottom - 4 * k; y += pitch) { var tx = xAt(y); g.moveTo(tx - 6 * k, y - 4 * k); g.lineTo(tx + 6 * k, y + 4 * k); }
        g.stroke();
        // the red bow in the middle of the rope
        var rx = xAt(my), bw = 26 * k, bh = 14 * k;
        function bow(ox, oy) {
          g.beginPath();
          g.moveTo(rx + ox, my + oy); g.lineTo(rx - bw + ox, my - bh + oy); g.lineTo(rx - bw + ox, my + bh + oy); g.closePath();
          g.moveTo(rx + ox, my + oy); g.lineTo(rx + bw + ox, my - bh + oy); g.lineTo(rx + bw + ox, my + bh + oy); g.closePath();
        }
        bow(k, 3 * k); g.fillStyle = 'rgba(0,0,0,.2)'; g.fill();
        bow(0, 0); g.fillStyle = '#E5484D'; g.fill();
        g.fillStyle = '#C8363B'; g.beginPath(); g.arc(rx, my, 9 * k, 0, TAU); g.fill();
        if (roundWinner >= 0) {
          g.strokeStyle = GOLD; g.lineWidth = 4 * k; g.beginPath(); g.arc(rx, my, (22 + 6 * Math.sin(now * 8)) * k, 0, TAU); g.stroke();
        }
        fist(xAt(top), top, true, k);
        fist(xAt(bottom), bottom, false, k);
      }
      function draw() {
        if (!W) return;
        renderBg();
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.drawImage(bg, 0, 0, W, H);
        if (stage !== 'matchOver') { arrows(0); arrows(1); }
        drawSparks(0); drawSparks(1);
        if (stage === 'matchOver' && roundWinner >= 0) confetti(roundWinner);
        rope();
      }

      // ---- words: each half shows the score row, one big word and one small line, near its own edge
      // FittedBox(scaleDown): one line that shrinks to the width it has (measured on text change only)
      function fit(el, maxW) {
        var w = el.offsetWidth;
        el.dataset.fs = w > maxW && w && maxW ? (maxW / w).toFixed(3) : '1';
      }
      function scoreRow(dots, label, side) {
        var mine = wins[side], theirs = wins[1 - side];
        for (var i = 0; i < 2; i++) dots[i].classList.toggle('on', i < mine);
        label.textContent = mine + ' : ' + theirs;
      }
      function texts() {
        for (var s = 0; s < 2; s++) {
          var h = H2[s], big = '', small = '', hurry = false, timer = false, mine = s ? 1 : -1, won = roundWinner === s;
          if (stage === 'idle') { big = t.tap; small = t.start; }
          else if (stage === 'count') { big = String(countShown); small = ctx.fmt(t.round, roundNo); }
          else if (stage === 'pull') {
            big = now - pullStart < 0.9 ? t.pull : lean === mine ? t.almost : lean === -mine ? t.hold : t.tap;
            var sec = clamp(lastTickSec, 1, ROUND_T); hurry = sec <= 3; timer = true; small = String(sec);
          } else if (stage === 'roundOver') {
            // each half speaks to its own player (the computer's half says "You win!" when the computer won)
            big = tie ? t.tie : won ? t.win : t.lose;
            small = tie ? t.retry : t.next;
          }
          var key = stage + '|' + big + '|' + small + '|' + hurry + '|' + wins.join();
          if (key !== h.key) {
            h.key = key;
            h.blk.style.display = stage === 'matchOver' ? 'none' : '';
            h.bigText.textContent = big;
            h.sm.innerHTML = (timer ? TIMER : '') + '<span>' + ctx.esc(small) + '</span>';
            h.sm.classList.toggle('hurry', hurry);
            scoreRow(h.dots, h.score, s);
            fit(h.bigText, h.big.clientWidth);
          }
          var mkey = stage === 'matchOver' ? 'm|' + won + '|' + wins.join() + '|' + canRestart : '';
          if (mkey !== h.mkey) {
            h.mkey = mkey;
            h.mb.classList.toggle('on', !!mkey);
            h.mb.classList.toggle('won', won);
            if (mkey) {
              h.ico.innerHTML = won ? ctx.ICON.trophy : HEART;
              h.mtText.textContent = won ? t.mwin : t.mlose;
              scoreRow(h.mdots, h.mscore, s);
              fit(h.mtText, h.mt.clientWidth);
              // centre it a bit toward the player (the app's Alignment(0, 0.15)) and shrink it if the half is short
              var mh = h.mb.offsetHeight || 1, hh = H / 2, sc = Math.min(1, (hh - 14) / mh);
              h.mb.style.top = clamp(hh * 0.575 - mh * sc / 2, 7, hh - 7 - mh * sc).toFixed(1) + 'px';
              h.mb.style.transform = 'scale(' + sc.toFixed(3) + ')';
            }
          }
        }
        againBtn.classList.toggle('on', stage === 'matchOver' && canRestart);
      }
      // per-frame bumps (transform only, no layout reads)
      function bumps() {
        for (var s = 0; s < 2; s++) {
          var h = H2[s], sc = 1;
          if (stage === 'pull') sc += 0.14 * Math.exp(-(now - lastTap[s]) * 14);
          else if (stage === 'count') sc = 1.3 + 0.45 * Math.exp(-(now - countAt) * 9);
          sc *= +(h.bigText.dataset.fs || 1);
          h.bigText.style.transform = 'scale(' + sc.toFixed(3) + ')';
          if (stage === 'pull' && h.sm.classList.contains('hurry')) {
            h.sm.style.transform = 'scale(' + (1.2 + 0.25 * Math.exp(-mod(now - pullStart, 1) * 7)).toFixed(3) + ')';
          } else if (h.sm.style.transform) h.sm.style.transform = '';
          if (stage === 'matchOver') {
            var age = clamp(now - overAt, 0, 10), pop = elasticOut(clamp(age / 0.7, 0, 1)), sway = roundWinner === s ? Math.sin(now * 3) * 0.08 : 0;
            h.ico.style.transform = 'rotate(' + sway.toFixed(3) + 'rad) scale(' + (0.2 + 0.8 * pop).toFixed(3) + ')';
            h.mtText.style.transform = 'scale(' + (+(h.mtText.dataset.fs || 1)).toFixed(3) + ')';
          }
        }
      }

      // ---- the match
      function startCount() {
        ctx.clear(autoId);
        S.beep(); ctx.buzz(12);
        p = 0; lean = 0; roundWinner = -1; tie = false; countStart = now; countAt = now; countShown = 3; stage = 'count';
        texts(); ctx.wake();
      }
      function newMatch() {
        if (stage !== 'matchOver') return;
        wins = [0, 0]; roundNo = 1; matchNo++; canRestart = false; shown = 0;
        startCount();
      }
      function pull(side, x, y) {
        p += side ? STEP : -STEP;
        wiggle = Math.min(1, wiggle + 0.35);
        lastTap[side] = now;
        sparks[side].push({ x: x, y: y, born: now, seed: sparkSeed++ });
        if (sparks[side].length > 24) sparks[side].shift();
        if (side) {
          myTaps++;
          if (now - lastPop > 0.05) { lastPop = now; S.pop(); }
          if (now - lastBuzz > 0.04) { lastBuzz = now; ctx.buzz(8); }
        } else {
          cpuTaps++;
          if (now - lastCpuSnd > 0.07) { lastCpuSnd = now; var f = 420 + Math.random() * 160; S.tone(f, 0.05, 'sine', 0.07, f * 0.55); }
        }
        if (p <= -1 + 1e-9) endRound(0);
        else if (p >= 1 - 1e-9) endRound(1);
        else {
          // near a line (3/4) the words change, and only let go a bit further back (5/8) so they do not flicker
          var l = lean !== 0 && p * lean >= 0.625 ? lean : p <= -0.75 ? -1 : p >= 0.75 ? 1 : 0;
          if (l !== lean) { if (l) S.whoosh(); lean = l; }
        }
      }
      function endRound(winner) {
        p = clamp(p, -1, 1); overAt = now; rounds++;
        ctx.hint(null);
        if (winner < 0) {
          tie = true; stage = 'roundOver'; S.bump(); ctx.buzz(30);
          autoId = ctx.later(startCount, 2400);
          texts(); return;
        }
        wins[winner]++;
        var match = wins[winner] >= 2, rx = W / 2, ry = H / 2 + clamp(p, -1, 1) * G.reach;
        roundWinner = winner; canRestart = false; stage = match ? 'matchOver' : 'roundOver';
        S.stamp();
        if (winner === 1) {
          ctx.later(S.win, 180); ctx.buzz([20, 40, 30]);
          ctx.burst(rx, ry, 46, { ring: true, speed: 480, colors: CONF.concat([BOT]) });
          if (match) ctx.later(function () { ctx.burst(W / 2, H * 0.71, 90, { speed: 720, colors: CONF.concat([BOT]) }); }, 120);
        } else { ctx.later(S.lose, 180); ctx.buzz(40); }
        if (match) {
          ctx.later(function () { canRestart = true; texts(); }, 1000);
          autoId = ctx.later(newMatch, 3600);
        } else {
          roundNo++;
          autoId = ctx.later(startCount, 2400);
        }
        texts();
      }

      ctx.on(root, 'pointerdown', function (e) {
        if (e.target.closest && e.target.closest('.again')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        var q = ctx.local(e), side = q.y < H / 2 ? 0 : 1;
        if (stage === 'idle') { startCount(); return; }
        if (stage === 'roundOver') { if (now - overAt > NEXT_GUARD) startCount(); return; }
        // after a match: the button works after 1 s, a tap anywhere after 2.2 s (so mashing does not skip the trophy)
        if (stage === 'matchOver') { if (canRestart && now - overAt > 2.2) { ctx.click(); newMatch(); } return; }
        if (stage !== 'pull' || side !== 1) return;  // the top half belongs to the computer
        pull(1, q.x, q.y - H / 2);
        ctx.wake();
      });
      ctx.on(againBtn, 'click', function () { if (canRestart) { ctx.click(); newMatch(); } });
      function hintAt() { return { x: W * 0.25, y: H * 0.5 + H * 0.5 * 0.4 }; }
      ctx.hint(hintAt, { kind: 'tap' });

      function step(dt) {
        shown += (p - shown) * (1 - Math.exp(-dt * 14));
        wiggle *= Math.exp(-dt * 5);
        for (var s = 0; s < 2; s++) {
          var hot = stage === 'pull' ? Math.exp(-(now - lastTap[s]) * 4) : 0;
          flow[s] += dt * (0.3 + 4 * hot);
          var list = sparks[s];
          while (list.length && now - list[0].born > 0.6) list.shift();
        }
        if (stage === 'count') {
          var c = 3 - Math.floor((now - countStart) / COUNT_STEP);
          if (c <= 0) {
            S.go(); ctx.buzz(20);
            stage = 'pull'; pullStart = now; lastTickSec = ROUND_T; lean = 0; myTaps = 0;
            aiNext = now + 0.22 + Math.random() * 0.15;
            texts();
          } else if (c !== countShown) { S.beep(); countShown = c; countAt = now; texts(); }
        } else if (stage === 'pull') {
          var left = ROUND_T - (now - pullStart);
          if (left <= 0) { endRound(p < -1e-9 ? 0 : p > 1e-9 ? 1 : -1); return; }
          var sec = Math.ceil(left);
          if (sec !== lastTickSec) { if (sec <= 3) S.tick(sec === 1); lastTickSec = sec; texts(); }
          // a first-time viewer who has not tapped yet gets the hand again once
          if (!hinted && !myTaps && now - pullStart > 1.0) { hinted = true; ctx.hint(hintAt, { kind: 'tap', delay: 0 }); }
          // the computer: a slightly varying human pace that speeds up when you lead and eases off when it leads
          if (now >= aiNext) {
            var hw = H / 2, x = Math.random() < 0.5 ? W * (0.08 + Math.random() * 0.3) : W * (0.62 + Math.random() * 0.3);
            pull(0, x, hw * (0.25 + Math.random() * 0.6));
            if (stage === 'pull') {
              var base = roundNo === 1 && matchNo === 1 ? 3.6 : 4.3;
              var rate = clamp(base + 0.9 * p + (Math.random() - 0.5) * 1.2, 2.6, 6.2);
              aiNext = now + 1 / rate + (Math.random() < 0.08 ? 0.18 + Math.random() * 0.14 : 0);
            }
          }
        }
      }

      texts();
      return {
        resize: function () {
          cvo.fit(); W = cvo.w; H = cvo.h; G = geo(W, H);
          root.style.setProperty('--k', G.k.toFixed(3));
          root.style.setProperty('--pad', G.pad.toFixed(1) + 'px');
          // the side tags must stay clear of the white lines' end dots
          var room = W / 2 - G.lineHalf - 6 * G.k - 16;
          [tag0, tag1].forEach(function (el) { var w = el.offsetWidth || 1; el.style.transform = w > room ? 'scale(' + (room / w).toFixed(3) + ')' : ''; });
          H2.forEach(function (h) { h.key = ''; h.mkey = ''; });
          texts(); bumps(); draw();
        },
        redraw: function () { bgKey = ''; draw(); },
        frame: function (dt) {
          now += dt;
          step(dt);
          bumps();
          draw();
          return true;
        },
        destroy: function () { stage = 'gone'; },
        debug: function () {
          return { stage: stage, p: +p.toFixed(3), wins: { cpu: wins[0], you: wins[1] }, round: roundNo, match: matchNo,
            myTaps: myTaps, cpuTaps: cpuTaps, rounds: rounds, winner: roundWinner < 0 ? null : roundWinner ? 'you' : 'cpu', tie: tie };
        }
      };
    }
  };
})();
