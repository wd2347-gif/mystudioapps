/* 반응속도 (reflex): my_mini/lib/games/list/reflex.dart 를 옮긴 것.
   큰 둥근 판: 빨강 '기다려요…'(숨 쉬는 손) → 1.5~4초 뒤 초록 '지금!'(바뀔 때 소리 · 진동 없음, 앱 규칙) → 누르면 파랑에 ms · 동물 등급.
   빨강일 때 누르면 노랑 '너무 빨라요!'(흔들림) 이고 그 번만 다시. 위 줄에 다섯 번 칸 + 최고 기록, 닿은 자리에 고리.
   다섯 번 → 결과(평균 · 가장 빠름 · 등급 한 줄, 번마다 등급 색 막대, 새 기록이면 띠 + 색종이). 시간 계산은 초록이 그려진 프레임부터 down 까지.
   플레이어블: 시작 단추 없이 바로 빨강, 첫 초록은 조금 빨리(1.4~2초). 초록에서 4초 동안 안 누르면 그 번은 조용히 다시 빨강,
   '너무 빨라요' · 기록 화면은 잠깐 뒤 스스로 넘어가고(누르면 바로), 결과는 5초 뒤 새 세트. 그림 글자(이모지) 대신 동물을 직접 그린다. */
(function () {
  'use strict';

  var TX = {
    wait: { ko: '기다려요…', ja: '待って…', en: 'Wait…' },
    waitSub: { ko: '초록이 되면 바로 톡!', ja: '緑になったらすぐタップ！', en: 'Tap as soon as it turns green!' },
    now: { ko: '지금!', ja: '今！', en: 'Tap!' },
    early: { ko: '너무 빨라요!', ja: '早すぎ！', en: 'Too soon!' },
    earlySub: { ko: '초록을 기다려요. 눌러서 다시', ja: '緑を待ってね。タップでやり直し', en: 'Wait for green. Tap to retry' },
    tapNext: { ko: '눌러서 다음', ja: 'タップで次へ', en: 'Tap for next' },
    tapResult: { ko: '눌러서 결과 보기', ja: 'タップで結果へ', en: 'Tap to see results' },
    summary: { ko: '평균 {0} · 가장 빠름 {1}', ja: '平均 {0}・最速 {1}', en: 'Average {0} · Fastest {1}' },
    newBest: { ko: '새 기록!', ja: '新記録！', en: 'New best!' },
    earlyCount: { ko: '너무 빨랐던 번 {0}', ja: 'フライング {0}回', en: 'Too soon: {0}' },
    best: { ko: '최고 기록', ja: 'ベスト', en: 'Best' },
    again: { ko: '다시 하기', ja: 'もう一回', en: 'Play again' }
  };
  var GRADE = [
    [{ ko: '번개', ja: '稲妻', en: 'Lightning' }, { ko: '번개 같은 손이에요!', ja: '稲妻みたいな速さ！', en: 'Lightning-fast hands!' }],
    [{ ko: '치타', ja: 'チーター', en: 'Cheetah' }, { ko: '치타만큼 빨라요!', ja: 'チーター並みの速さ！', en: 'Fast as a cheetah!' }],
    [{ ko: '고양이', ja: 'ネコ', en: 'Cat' }, { ko: '고양이처럼 날쌔요!', ja: 'ネコみたいにすばしこい！', en: 'Quick as a cat!' }],
    [{ ko: '토끼', ja: 'ウサギ', en: 'Bunny' }, { ko: '토끼처럼 재빨라요', ja: 'ウサギみたいに素早い', en: 'Speedy like a bunny' }],
    [{ ko: '펭귄', ja: 'ペンギン', en: 'Penguin' }, { ko: '펭귄처럼 뒤뚱, 조금 더!', ja: 'ペンギンみたいによちよち、もう少し！', en: 'Waddling penguin, a bit faster!' }],
    [{ ko: '거북이', ja: 'カメ', en: 'Turtle' }, { ko: '거북이처럼 느긋해요', ja: 'カメみたいにのんびり', en: 'Easygoing turtle' }],
    [{ ko: '나무늘보', ja: 'ナマケモノ', en: 'Sloth' }, { ko: '나무늘보… 졸려요?', ja: 'ナマケモノ…眠いの？', en: 'Sloth mode… sleepy?' }]
  ];
  var GRADE_COLOR = ['#FFB020', '#FF7A3D', '#2FC85E', '#00C2C7', '#3E9BFF', '#8C9BAB', '#A368FF'];
  var CUTS = [180, 220, 260, 310, 380, 500], TRIES = 5;
  var C_WAIT = '#E5484D', C_GO = '#2FC85E', C_EARLY = '#FFB020', C_SHOWN = '#3E6BFA', AMBER = '#FFB020';
  var TAU = Math.PI * 2;

  function grade(ms) { for (var i = 0; i < CUTS.length; i++) if (ms < CUTS[i]) return i; return CUTS.length; }

  /* ---------- pictures (drawn, no emoji) ---------- */
  function oval(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); }
  function bolt(g, u, col, shadow) {
    function p(dx, dy) {
      g.beginPath(); g.moveTo(0.18 * u + dx, -0.95 * u + dy); g.lineTo(-0.52 * u + dx, 0.12 * u + dy); g.lineTo(-0.02 * u + dx, 0.12 * u + dy);
      g.lineTo(-0.2 * u + dx, 0.95 * u + dy); g.lineTo(0.52 * u + dx, -0.18 * u + dy); g.lineTo(0.04 * u + dx, -0.18 * u + dy); g.closePath();
    }
    if (shadow) { p(0, u * 0.08); g.fillStyle = shadow; g.fill(); }
    p(0, 0); g.fillStyle = col; g.fill();
  }
  function eyes(g, s, dx, y, r, col) { g.fillStyle = col || '#2A1E16'; oval(g, -dx * s, y * s, r * s, r * 1.15 * s); g.fill(); oval(g, dx * s, y * s, r * s, r * 1.15 * s); g.fill(); }
  function blush(g, s, dx, y) { g.fillStyle = 'rgba(255,120,140,.35)'; oval(g, -dx * s, y * s, 0.07 * s, 0.045 * s); g.fill(); oval(g, dx * s, y * s, 0.07 * s, 0.045 * s); g.fill(); }
  // grade picture i (0 lightning, 1 cheetah, 2 cat, 3 bunny, 4 penguin, 5 turtle, 6 sloth), centred at (x, y), about s wide
  function animal(ctx, g, i, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s); s = 1; g.lineCap = 'round'; g.lineJoin = 'round';
    var ink = '#2A1E16';
    if (i === 0) {
      bolt(g, s * 0.5, '#FFC21A', 'rgba(184,134,11,.35)');
      g.lineWidth = s * 0.03; g.strokeStyle = '#E09A00'; g.stroke();
    } else if (i === 1) {
      g.fillStyle = '#F2B33D';
      oval(g, -0.3, -0.3, 0.11, 0.11); g.fill(); oval(g, 0.3, -0.3, 0.11, 0.11); g.fill();
      oval(g, 0, 0, 0.42, 0.38); g.fill();
      g.fillStyle = '#7A4E12';
      [[-0.18, -0.26], [0.02, -0.3], [0.2, -0.24], [-0.3, -0.05], [0.31, -0.03], [-0.28, 0.14], [0.27, 0.16]].forEach(function (q) { oval(g, q[0], q[1], 0.035, 0.03); g.fill(); });
      g.fillStyle = '#FFF1D6'; oval(g, 0, 0.15, 0.22, 0.15); g.fill();
      eyes(g, s, 0.14, -0.06, 0.045, ink);
      g.strokeStyle = ink; g.lineWidth = 0.035; g.beginPath();
      g.moveTo(-0.15, -0.01); g.quadraticCurveTo(-0.17, 0.1, -0.12, 0.17);
      g.moveTo(0.15, -0.01); g.quadraticCurveTo(0.17, 0.1, 0.12, 0.17); g.stroke();
      g.fillStyle = ink; g.beginPath(); g.moveTo(-0.06, 0.07); g.lineTo(0.06, 0.07); g.lineTo(0, 0.13); g.closePath(); g.fill();
    } else if (i === 2) {
      g.fillStyle = '#F7B955';
      g.beginPath(); g.moveTo(-0.38, -0.06); g.lineTo(-0.32, -0.46); g.lineTo(-0.08, -0.3); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0.38, -0.06); g.lineTo(0.32, -0.46); g.lineTo(0.08, -0.3); g.closePath(); g.fill();
      g.fillStyle = '#FF9EB1';
      g.beginPath(); g.moveTo(-0.3, -0.16); g.lineTo(-0.29, -0.36); g.lineTo(-0.17, -0.27); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0.3, -0.16); g.lineTo(0.29, -0.36); g.lineTo(0.17, -0.27); g.closePath(); g.fill();
      g.fillStyle = '#F7B955'; oval(g, 0, 0.04, 0.42, 0.36); g.fill();
      g.fillStyle = '#E39A2E'; [-0.1, 0, 0.1].forEach(function (q) { g.fillRect((q - 0.02), -0.3, 0.04, 0.12); });
      eyes(g, s, 0.15, 0.0, 0.05, ink); blush(g, s, 0.25, 0.14);
      g.fillStyle = '#FF7A93'; g.beginPath(); g.moveTo(-0.045, 0.08); g.lineTo(0.045, 0.08); g.lineTo(0, 0.12); g.closePath(); g.fill();
      g.strokeStyle = ink; g.lineWidth = 0.025; g.beginPath();
      g.moveTo(0, 0.12); g.quadraticCurveTo(-0.05, 0.19, -0.1, 0.14); g.moveTo(0, 0.12); g.quadraticCurveTo(0.05, 0.19, 0.1, 0.14);
      g.moveTo(-0.22, 0.08); g.lineTo(-0.46, 0.04); g.moveTo(-0.22, 0.13); g.lineTo(-0.46, 0.15);
      g.moveTo(0.22, 0.08); g.lineTo(0.46, 0.04); g.moveTo(0.22, 0.13); g.lineTo(0.46, 0.15); g.stroke();
    } else if (i === 3) {
      g.lineWidth = 0.035; g.strokeStyle = '#CFC6DA';
      [-1, 1].forEach(function (d) {
        g.save(); g.translate(d * 0.13, -0.2); g.rotate(d * 0.16);
        ctx.rrect(g, -0.09, -0.36, 0.18, 0.4, 0.09); g.fillStyle = '#FFFFFF'; g.fill(); g.stroke();
        ctx.rrect(g, -0.04, -0.3, 0.08, 0.28, 0.04); g.fillStyle = '#FFB3C7'; g.fill();
        g.restore();
      });
      oval(g, 0, 0.1, 0.36, 0.31); g.fillStyle = '#FFFFFF'; g.fill(); g.stroke();
      eyes(g, s, 0.13, 0.06, 0.045, ink); blush(g, s, 0.22, 0.18);
      g.fillStyle = '#FF8FA8'; oval(g, 0, 0.16, 0.04, 0.03); g.fill();
      g.strokeStyle = ink; g.lineWidth = 0.025; g.beginPath(); g.moveTo(0, 0.19); g.lineTo(0, 0.22);
      g.moveTo(0, 0.22); g.quadraticCurveTo(-0.04, 0.26, -0.07, 0.23); g.moveTo(0, 0.22); g.quadraticCurveTo(0.04, 0.26, 0.07, 0.23); g.stroke();
    } else if (i === 4) {
      g.fillStyle = '#2B3550'; oval(g, 0, 0, 0.42, 0.4); g.fill();
      g.fillStyle = '#FFFFFF'; oval(g, -0.13, 0.06, 0.17, 0.24); g.fill(); oval(g, 0.13, 0.06, 0.17, 0.24); g.fill();
      oval(g, 0, 0.17, 0.24, 0.17); g.fill();
      eyes(g, s, 0.12, 0.0, 0.045, '#1B2233'); blush(g, s, 0.22, 0.13);
      g.fillStyle = '#FFA526'; g.beginPath(); g.moveTo(-0.08, 0.09); g.lineTo(0.08, 0.09); g.lineTo(0, 0.18); g.closePath(); g.fill();
    } else if (i === 5) {
      g.fillStyle = '#8BD06F'; oval(g, 0.34, 0.02, 0.13, 0.12); g.fill();
      oval(g, -0.24, 0.24, 0.07, 0.06); g.fill(); oval(g, 0.16, 0.24, 0.07, 0.06); g.fill();
      g.beginPath(); g.moveTo(-0.38, 0.18); g.lineTo(-0.48, 0.14); g.lineTo(-0.38, 0.1); g.fill();
      g.beginPath(); g.moveTo(-0.4, 0.18); g.bezierCurveTo(-0.4, -0.28, 0.24, -0.28, 0.24, 0.18); g.closePath();
      g.fillStyle = '#5BAE4A'; g.fill();
      g.strokeStyle = '#3F8A33'; g.lineWidth = 0.03; g.beginPath();
      g.moveTo(-0.24, 0.17); g.lineTo(-0.18, -0.02); g.lineTo(0.02, -0.02); g.lineTo(0.08, 0.17);
      g.moveTo(-0.18, -0.02); g.lineTo(-0.12, -0.14); g.moveTo(0.02, -0.02); g.lineTo(-0.02, -0.14); g.stroke();
      g.fillStyle = '#4A9A3B'; g.fillRect(-0.4, 0.15, 0.64, 0.05);
      g.fillStyle = ink; oval(g, 0.38, -0.01, 0.025, 0.03); g.fill();
      g.strokeStyle = ink; g.lineWidth = 0.02; g.beginPath(); g.arc(0.37, 0.04, 0.04, 0.2, 1.5); g.stroke();
    } else {
      g.fillStyle = '#A88462'; oval(g, 0, 0, 0.42, 0.38); g.fill();
      g.fillStyle = '#EAD7B9'; oval(g, 0, 0.04, 0.33, 0.26); g.fill();
      g.fillStyle = '#6B4A33';
      [-1, 1].forEach(function (d) { g.save(); g.translate(d * 0.14, 0.03); g.rotate(d * -0.5); oval(g, 0, 0, 0.12, 0.065); g.fill(); g.restore(); });
      g.strokeStyle = '#F5E9D6'; g.lineWidth = 0.03; g.beginPath();
      g.arc(-0.14, 0.01, 0.045, 0.3, Math.PI - 0.3); g.moveTo(0.185, 0.01); g.arc(0.14, 0.01, 0.045, 0.3, Math.PI - 0.3); g.stroke();
      g.fillStyle = '#3A2A1E'; oval(g, 0, 0.12, 0.06, 0.04); g.fill();
      g.strokeStyle = '#3A2A1E'; g.lineWidth = 0.025; g.beginPath(); g.arc(0, 0.16, 0.06, 0.4, Math.PI - 0.4); g.stroke();
      g.fillStyle = '#8A6A4C'; [-0.12, 0, 0.12].forEach(function (q) { oval(g, q, -0.3, 0.05, 0.03); g.fill(); });
    }
    g.restore();
  }
  // Icons.pan_tool_rounded (open palm); tilt for front_hand
  function hand(ctx, g, x, y, s, col, tilt) {
    g.save(); g.translate(x, y); g.rotate(tilt || 0); g.scale(s, s); s = 1; g.fillStyle = col;
    [[-0.235, -0.36], [-0.08, -0.47], [0.075, -0.44], [0.23, -0.31]].forEach(function (f) { ctx.rrect(g, (f[0] - 0.065), f[1], 0.13, (0.2 - f[1]), 0.065); g.fill(); });
    ctx.rrect(g, -0.3, -0.08, 0.6, 0.52, [0.06, 0.06, 0.22, 0.24]); g.fill();
    g.save(); g.translate(-0.22, 0.24); g.rotate(-0.72); ctx.rrect(g, -0.07, -0.42, 0.14, 0.46, 0.07); g.fill(); g.restore();
    g.restore();
  }
  function iconTrophy(ctx, g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.translate(-12, -12);
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(7, 3.5); g.lineTo(17, 3.5); g.lineTo(17, 9.5); g.quadraticCurveTo(17, 14.6, 12, 14.6); g.quadraticCurveTo(7, 14.6, 7, 9.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(7, 5.6); g.lineTo(4.4, 5.6); g.quadraticCurveTo(3.9, 10.6, 7.6, 11.2); g.moveTo(17, 5.6); g.lineTo(19.6, 5.6); g.quadraticCurveTo(20.1, 10.6, 16.4, 11.2); g.stroke();
    g.fillRect(11, 14, 2, 3.6); ctx.rrect(g, 7.4, 17.4, 9.2, 3, 1.2); g.fill();
    g.restore();
  }
  function star(g, x, y, r) {
    g.beginPath();
    for (var i = 0; i < 10; i++) { var rr = i % 2 ? r * 0.48 : r, a = -Math.PI / 2 + i * Math.PI / 5; if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  function iconReplay(g, x, y, s, col) {
    var r = s * 0.3;
    g.save(); g.translate(x, y); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = s * 0.12; g.lineCap = 'round';
    g.beginPath(); g.arc(0, s * 0.04, r, -Math.PI / 2 + 0.25, Math.PI * 1.02); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.2, -r + s * 0.04); g.lineTo(s * 0.06, -r - s * 0.14); g.lineTo(s * 0.06, -r + s * 0.22); g.closePath(); g.fill();
    g.restore();
  }

  GAMES['reflex'] = {
    name: { ko: '반응속도', ja: '反応速度', en: 'Reaction Time' },
    tip: { ko: '초록으로 바뀌는 순간 톡!', ja: '緑に変わった瞬間にタップ！', en: 'Tap the moment it turns green' },
    color: '#E5484D',
    kind: 'brain',
    make: function (ctx) {
      var ax = 0, ay = 0, aw = 320, ah = 480, S = 320, big = 54, sub = 16, k = 1, R = 28;
      var phase = 'wait', phaseT = 0, delay = ctx.rand(1.4, 2.0), greenAt = 0, times = [], early = 0, last = 0, res = null, again = null;
      var ripples = [];

      function startWait(d) { phase = 'wait'; phaseT = 0; greenAt = 0; delay = d || ctx.rand(1.5, 4.0); }
      function newSet() { times = []; early = 0; res = null; again = null; startWait(ctx.rand(1.4, 2.4)); }
      function ripple(p, col) { ripples.push({ x: p.x - ax, y: p.y - ay, c: col, t: 0 }); if (ripples.length > 5) ripples.shift(); }
      function tooSoon(p) {
        early++; phase = 'early'; phaseT = 0; greenAt = 0;
        ctx.sfx.buzz(); ctx.haptic('error'); ripple(p, '#000000');
      }
      function finish() {
        var sum = 0, fast = 1e9;
        times.forEach(function (v) { sum += v; fast = Math.min(fast, v); });
        var avg = Math.round(sum / times.length), b = ctx.best(avg, true);
        res = { avg: avg, fast: fast, times: times.slice(), early: early, best: b.best, isNew: b.isNew, g: grade(avg) };
        phase = 'result'; phaseT = 0; again = null;
        ctx.sfx.stamp(); ctx.haptic('heavy');
        ctx.later(function () {
          ctx.sfx.win(); ctx.haptic('success');
          if (res && res.isNew) { ctx.sfx.sparkle(); ctx.fx.burst(ax + aw / 2, ay + ah * 0.3, 70, ctx.PAL, { speed: 680 }); }
        }, 260);
      }

      // simple line wrap into at most two lines (words for ko / en, punctuation or characters for ja)
      function wrap(g, str, maxW, px, wt) {
        g.font = ctx.font(px, wt);
        if (g.measureText(str).width <= maxW) return [str];
        var ja = ctx.lang === 'ja' || ctx.lang === 'zh-Hant', parts = ja ? (str.match(/[^、。…！？，]+[、。…！？，]*/g) || [str]) : str.split(' '), sep = ja ? '' : ' ', best = null;
        if (parts.length < 2) { parts = Array.from(str); sep = ''; }
        for (var i = 1; i < parts.length; i++) {
          var a = parts.slice(0, i).join(sep), b = parts.slice(i).join(sep), w = Math.max(g.measureText(a).width, g.measureText(b).width);
          if (!best || w < best.w) best = { w: w, l: [a, b] };
        }
        return best.l;
      }
      function lines(g, str, x, y, maxW, px, wt, col, lh) {
        var ls = wrap(g, str, maxW, px, wt), h = px * (lh || 1.3);
        ls.forEach(function (l, i) { ctx.text(g, l, x, y + (i - (ls.length - 1) / 2) * h, { size: px, weight: wt, color: col, maxW: maxW, min: px * 0.6 }); });
        return ls.length * h;
      }

      function bgColor() { return phase === 'wait' ? C_WAIT : phase === 'go' ? C_GO : phase === 'early' ? C_EARLY : C_SHOWN; }

      // top row: the five try slots + best
      function slots(g, ink) {
        var best = ctx.getBest(), bestW = 0, y = 12 * k, h = 30 * k, gap = 6 * k, fs = 13 * k, i;
        if (best !== null) { g.font = ctx.font(14 * k, 800); bestW = g.measureText(best + 'ms').width + 29 * k; }
        var ws = [], tot = 0;
        g.font = ctx.font(fs, 800);
        for (i = 0; i < TRIES; i++) { var s = i < times.length ? String(times[i]) : String(i + 1); ws.push(Math.max(h, g.measureText(s).width + 16 * k)); tot += ws[i] + (i ? gap : 0); }
        var room = aw - 24 * k - (bestW ? bestW + 8 * k : 0), sc = Math.min(1, room / tot);
        g.save(); g.translate(12 * k, y); g.scale(sc, sc);
        var x = 0;
        for (i = 0; i < TRIES; i++) {
          var has = i < times.length, cur = i === times.length && phase !== 'shown';
          ctx.rrect(g, x, 0, ws[i], h, h / 2);
          if (has) { g.fillStyle = ctx.rgba(ink, 0.22); g.fill(); }
          g.lineWidth = cur ? 2.2 : 1.4; g.strokeStyle = ctx.rgba(ink, cur ? 0.95 : 0.4);
          ctx.rrect(g, x + g.lineWidth / 2, g.lineWidth / 2, ws[i] - g.lineWidth, h - g.lineWidth, h / 2); g.stroke();
          ctx.text(g, has ? String(times[i]) : String(i + 1), x + ws[i] / 2, h / 2 + 0.5, { size: fs, weight: 800, color: ink, alpha: has ? 1 : 0.6 });
          x += ws[i] + gap;
        }
        g.restore();
        if (best !== null) {
          var bx = aw - 12 * k - bestW;
          iconTrophy(ctx, g, bx + 9 * k, y + h / 2, 18 * k, ink);
          ctx.text(g, best + 'ms', bx + 21 * k, y + h / 2 + 0.5, { size: 14 * k, weight: 800, color: ink, align: 'left' });
        }
        return y + h;
      }

      function message(g, ink, cx, cy) {
        var mw = aw - 32 * k, t, sc, h;
        if (phase === 'wait') {
          var x = (phaseT % 1.8) / 0.9, v = (1 - Math.cos(Math.PI * (x > 1 ? 2 - x : x))) / 2, b = 0.92 + 0.14 * v;
          var hs = big * 1.1, th = big * 0.7, tot = hs + big * 0.25 + th * 1.1 + 10 + sub * 1.3;
          var y = cy - tot / 2;
          g.save(); g.translate(cx, y + hs / 2); g.scale(b, b); hand(ctx, g, 0, 0, hs, ink, 0); g.restore();
          y += hs + big * 0.25;
          ctx.text(g, ctx.t(TX.wait), cx, y + th * 0.55, { size: th, weight: 900, color: ink, maxW: mw });
          y += th * 1.1 + 10;
          lines(g, ctx.t(TX.waitSub), cx, y + sub * 0.65, mw, sub, 700, ctx.rgba(ink, 0.88));
        } else if (phase === 'early') {
          t = Math.min(1, phaseT / 0.42);
          var dx = t >= 1 ? 0 : Math.sin(t * Math.PI * 7) * 14 * (1 - t), hs2 = big * 1.1, th2 = big * 0.72;
          h = hs2 + big * 0.2 + th2 * 1.1 + 10 + sub * 2.6;
          var y2 = cy - h / 2;
          g.save(); g.translate(dx, 0);
          hand(ctx, g, cx, y2 + hs2 / 2, hs2, ink, -0.18);
          y2 += hs2 + big * 0.2;
          ctx.text(g, ctx.t(TX.early), cx, y2 + th2 * 0.55, { size: th2, weight: 900, color: ink, maxW: mw });
          y2 += th2 * 1.1 + 10;
          lines(g, ctx.t(TX.earlySub), cx, y2 + sub * 1.3, mw, sub, 700, ctx.rgba(ink, 0.88));
          g.restore();
        } else {
          var gr = grade(last), as = big * 0.85, ns = big * 0.36;
          t = Math.min(1, phaseT / 0.52); sc = 0.5 + 0.5 * ctx.ease.elasticOut(t);
          h = as + 6 + big * 1.1 + 4 + ns * 1.2 + 18 + sub * 1.3;
          g.save(); g.translate(cx, cy); g.scale(sc, sc); g.translate(0, -h / 2);
          animal(ctx, g, gr, 0, as / 2, as);
          var y3 = as + 6;
          ctx.text(g, last + 'ms', 0, y3 + big * 0.55, { size: big, weight: 900, color: ink, maxW: mw });
          y3 += big * 1.1 + 4;
          ctx.text(g, ctx.t(GRADE[gr][0]), 0, y3 + ns * 0.6, { size: ns, weight: 900, color: ink, maxW: mw });
          y3 += ns * 1.2 + 18;
          ctx.text(g, ctx.t(times.length >= TRIES ? TX.tapResult : TX.tapNext), 0, y3 + sub * 0.65, { size: sub, weight: 700, color: ctx.rgba(ink, 0.88), maxW: mw });
          g.restore();
        }
      }

      function goMessage(g, ink, cx, cy) {
        var t = Math.min(1, phaseT / 0.26), sc = 0.6 + 0.4 * ctx.ease.outBack(t), is = big * 1.4, tot = is + big * 1.05;
        g.save(); g.translate(cx, cy); g.scale(sc, sc);
        g.save(); g.translate(0, -tot / 2 + is / 2); bolt(g, is * 0.42, ink); g.restore();
        ctx.text(g, ctx.t(TX.now), 0, -tot / 2 + is + big * 0.55, { size: big, weight: 900, color: ink, maxW: aw - 32 * k });
        g.restore();
      }

      // the result, like the app's ResultView: icon, grade line, summary, new best, a bar per try, best, play again
      function result(g) {
        var C = ctx.C, t = Math.min(1, phaseT / 0.25), cw = 300, n = res.times.length;
        var titleLs = wrap(g, ctx.t(GRADE[res.g][1]), cw - 50, 22, 900);
        var ch = 56 + 10 + titleLs.length * 27 + 6 + 20 + (res.isNew ? 46 : 0) + 12 + (24 + n * 26) + 12 + 18 + 16 + 48;
        var s = Math.min(1.2, (aw - 28) / cw, (ah - 28) / ch), maxT = 1;
        res.times.forEach(function (v) { maxT = Math.max(maxT, v); });
        g.save(); g.globalAlpha = t; g.translate(aw / 2, ah / 2); g.scale(s, s); g.translate(-cw / 2, -ch / 2);
        var y = 28, ic = 0.5 + 0.5 * ctx.ease.elasticOut(Math.min(1, phaseT / 0.65));
        g.save(); g.translate(cw / 2, y); g.scale(ic, ic);
        g.beginPath(); g.arc(0, 0, 28, 0, TAU); g.fillStyle = ctx.rgba(ctx.color, 0.16); g.fill();
        bolt(g, 15, ctx.color);
        g.restore();
        y += 28 + 10;
        titleLs.forEach(function (l, i) {
          g.font = ctx.font(22, 900);
          var w = Math.min(cw - 50, g.measureText(l).width), lx = cw / 2 - (w + (i ? 0 : 32)) / 2;
          if (!i) animal(ctx, g, res.g, lx + 13, y + 13, 28);
          ctx.text(g, l, lx + (i ? 0 : 32), y + 14, { size: 22, weight: 900, color: C.ink, align: 'left', maxW: cw - 50 });
          y += 27;
        });
        y += 6;
        ctx.text(g, ctx.f(TX.summary, res.avg + 'ms', res.fast + 'ms'), cw / 2, y + 9, { size: 15, weight: 600, color: C.soft, maxW: cw - 20 });
        y += 20;
        if (res.isNew) {
          var bt = ctx.t(TX.newBest), bs = 0.3 + 0.7 * ctx.ease.elasticOut(Math.min(1, phaseT / 0.8));
          g.font = ctx.font(18, 900); var bw = g.measureText(bt).width + 58;
          g.save(); g.translate(cw / 2, y + 12 + 17); g.scale(bs, bs);
          g.save(); g.shadowColor = ctx.rgba(AMBER, 0.45); g.shadowBlur = 16 * ctx.dpr; g.shadowOffsetY = 5 * ctx.dpr;
          ctx.rrect(g, -bw / 2, -17, bw, 34, 17); g.fillStyle = AMBER; g.fill(); g.restore();
          g.fillStyle = '#FFFFFF'; star(g, -bw / 2 + 25, 0, 10);
          ctx.text(g, bt, -bw / 2 + 40, 1, { size: 18, weight: 900, color: '#FFFFFF', align: 'left' });
          g.restore();
          y += 46;
        }
        y += 12;
        var ph = 24 + n * 26;
        ctx.rrect(g, 0, y, cw, ph, 20); g.fillStyle = ctx.dark ? '#21261F' : C.bg; g.fill();
        g.lineWidth = 1; g.strokeStyle = C.hair; ctx.rrect(g, 0.5, y + 0.5, cw - 1, ph - 1, 20); g.stroke();
        res.times.forEach(function (v, i) {
          var ry = y + 12 + i * 26 + 13, gi = grade(v), fast = v === res.fast, bx = 14 + 26, bmax = cw - 14 - 66 - bx;
          animal(ctx, g, gi, 14 + 10, ry, 20);
          var pr = ctx.ease.outCubic(Math.min(1, phaseT / (0.5 + i * 0.12)));
          ctx.rrect(g, bx, ry - 7, Math.max(8, bmax * pr * v / maxT), 14, 7); g.fillStyle = GRADE_COLOR[gi]; g.fill();
          ctx.text(g, v + 'ms', cw - 14, ry + 0.5, { size: 14, weight: fast ? 900 : 600, color: fast ? C.ink : C.soft, align: 'right' });
        });
        y += ph + 12;
        var line = ctx.t(TX.best) + ' ' + (res.best === null ? res.avg : res.best) + 'ms' + (res.early > 0 ? '  ·  ' + ctx.f(TX.earlyCount, res.early) : '');
        ctx.text(g, line, cw / 2, y + 9, { size: 13.5, weight: 600, color: C.soft, maxW: cw - 10 });
        y += 18 + 16;
        ctx.rrect(g, 0, y, cw, 48, 18); g.fillStyle = ctx.color; g.fill();
        var ink = ctx.inkOn(ctx.color), label = ctx.t(TX.again);
        g.font = ctx.font(17, 800); var lw = Math.min(g.measureText(label).width, cw - 60), ix = cw / 2 - (lw + 28) / 2;
        iconReplay(g, ix + 10, y + 24, 22, ink);
        ctx.text(g, label, ix + 28, y + 25, { size: 17, weight: 800, color: ink, align: 'left', maxW: cw - 60 });
        again = { x: ax + aw / 2, y: ay + ah / 2 + (y + 24 - ch / 2) * s };
        g.restore();
      }

      return {
        layout: function (W, H) {
          aw = Math.min(W - 32, 560); ah = Math.min(H - 12, Math.round(aw * 1.6));
          if (aw > ah * 0.95) aw = Math.round(ah * 0.95);
          ax = Math.round((W - aw) / 2); ay = Math.round((H - ah) / 2);
          S = Math.min(aw, ah); big = ctx.clamp(S * 0.17, 44, 110); sub = ctx.clamp(S * 0.05, 15, 24);
          k = ctx.clamp(aw / 340, 0.85, 1.3); R = Math.round(28 * Math.min(1, k + 0.1));
        },

        update: function (dt) {
          phaseT += dt;
          for (var i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt; if (ripples[i].t >= 0.65) ripples.splice(i, 1); }
          if (phase === 'wait' && phaseT >= delay) { phase = 'go'; phaseT = 0; greenAt = 0; } // no sound, no haptic (app rule)
          else if (phase === 'go' && phaseT > 4) startWait(ctx.rand(1.2, 2.4)); // nobody tapped: quietly try again
          else if (phase === 'early' && phaseT > 2.6) startWait();
          else if (phase === 'shown') {
            if (times.length >= TRIES) { if (phaseT > 1.6) finish(); }
            else if (phaseT > 2.4) startWait();
          } else if (phase === 'result' && phaseT > 5.2) newSet();
        },

        draw: function (g) {
          var C = ctx.C;
          g.save(); g.translate(ax, ay);
          if (phase === 'result') {
            if (!ctx.dark) {
              g.save(); g.shadowColor = 'rgba(16,20,16,.10)'; g.shadowBlur = 22 * ctx.dpr; g.shadowOffsetY = 8 * ctx.dpr;
              ctx.rrect(g, 0, 0, aw, ah, R); g.fillStyle = C.surface; g.fill(); g.restore();
            }
            ctx.rrect(g, 0, 0, aw, ah, R); g.fillStyle = C.surface; g.fill();
            ctx.rrect(g, 0.5, 0.5, aw - 1, ah - 1, R); g.lineWidth = 1; g.strokeStyle = C.hair; g.stroke();
            if (res) result(g);
            g.restore();
            return;
          }
          var bg = bgColor(), ink = ctx.inkOn(bg);
          if (phase === 'go' && !greenAt) greenAt = performance.now(); // time from the frame green is drawn
          if (!ctx.dark) {
            g.save(); g.shadowColor = ctx.rgba(bg, 0.3); g.shadowBlur = 22 * ctx.dpr; g.shadowOffsetY = 8 * ctx.dpr;
            ctx.rrect(g, 0, 0, aw, ah, R); g.fillStyle = bg; g.fill(); g.restore();
          }
          ctx.rrect(g, 0, 0, aw, ah, R); g.fillStyle = bg; g.fill();
          g.save(); g.clip();
          ripples.forEach(function (r) {
            var q = ctx.ease.outCubic(Math.min(1, r.t / 0.65)), a = (1 - q) * 0.45, mr = S * 0.5;
            g.beginPath(); g.arc(r.x, r.y, Math.max(0.1, mr * q), 0, TAU); g.lineWidth = 10 * (1 - q) + 2; g.strokeStyle = ctx.rgba(r.c, a.toFixed(3)); g.stroke();
            g.beginPath(); g.arc(r.x, r.y, Math.max(0.1, mr * 0.35 * q), 0, TAU); g.fillStyle = ctx.rgba(r.c, (a * 0.5).toFixed(3)); g.fill();
          });
          var top = slots(g, ink), cy = (top + ah) / 2;
          if (phase === 'go') goMessage(g, ink, aw / 2, cy);
          else message(g, ink, aw / 2, cy);
          g.restore();
          g.restore();
        },

        down: function (p) {
          var inside = p.x >= ax - 8 && p.x <= ax + aw + 8 && p.y >= ay - 8 && p.y <= ay + ah + 8;
          if (phase === 'result') {
            if (phaseT > 0.45) { ctx.sfx.click(); ctx.haptic('light'); newSet(); }
            return;
          }
          if (!inside) return;
          if (phase === 'wait') tooSoon(p);
          else if (phase === 'go') {
            if (!greenAt) { tooSoon(p); return; }
            var ms = Math.max(0, Math.round(performance.now() - greenAt)), gr = grade(ms);
            last = ms; if (times.length < TRIES) times.push(ms);
            if (gr <= 1) { ctx.sfx.sparkle(); ctx.sfx.hit(1); ctx.haptic('medium'); } else { ctx.sfx.ding(); ctx.haptic('light'); }
            ripple(p, '#FFFFFF');
            phase = 'shown'; phaseT = 0;
          } else if (phase === 'early') {
            if (phaseT < 0.35) return;
            ctx.sfx.click(); ctx.haptic('light'); startWait();
          } else if (phase === 'shown') {
            if (phaseT < 0.35) return;
            if (times.length >= TRIES) finish();
            else { ctx.sfx.click(); ctx.haptic('light'); startWait(); }
          }
        },

        // tap the panel the moment it is green (nothing while it is red); the replay button on the result
        hint: function () {
          if (phase === 'go' || phase === 'shown' || phase === 'early') return { x: ax + aw / 2, y: ay + ah * 0.82 };
          if (phase === 'result' && again && phaseT > 0.6) return { x: again.x, y: again.y };
          return null;
        },

        debug: function () {
          var c = { x: Math.round(ax + aw / 2), y: Math.round(ay + ah * 0.82) };
          return { phase: phase, tries: times.length, times: times.slice(), early: early, last: last, avg: res ? res.avg : null,
            grade: res ? res.g : null, best: ctx.getBest(), green: phase === 'go' && !!greenAt, arena: { x: ax, y: ay, w: aw, h: ah },
            targets: [phase === 'result' && again ? { x: Math.round(again.x), y: Math.round(again.y) } : c] };
        },

        destroy: function () { ripples.length = 0; res = null; }
      };
    }
  };
})();
