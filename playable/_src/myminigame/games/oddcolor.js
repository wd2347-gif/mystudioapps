/* 다른 색 찾기 (oddcolor): my_mini/lib/games/list/oddcolor.dart 를 옮긴 것.
   같은 색 칸 가운데 살짝 다른 한 칸: 판 크기(2x2 → 3x3 → 두 단계마다 한 줄, 8x8 까지) · 색 차이(명도 24% 에서 12% 씩 줄고,
   4단계부터 가끔 채도) 공식, 맞힘(1.12배 + 흰 테 + 체크 + 빛) · 틀림(빨간 테 + X, 정답 칸 깜빡임) · 5단계마다 'N단계!' 알약,
   위 줄(단계 · 최고 기록 · 시계), 시간 막대, 아래 '색 차이' 까지 앱과 같다.
   플레이어블: 3-2-1 없이 판이 바로 보이고(힌트 = 다른 칸, 첫 터치 전에만), 첫 터치로 30초 시계가 돈다(앱 60초).
   맞히면 +1초, 틀리면 -3초. 시간 끝 → 결과 카드(새 기록이면 색종이) → 4초 뒤 새 판(카드를 누르면 바로). 막다른 곳이 없다. */
(function () {
  'use strict';

  var TX = {
    level: { ko: '단계', ja: 'レベル', en: 'Level' },
    levelN: { ko: '{0}단계!', ja: 'レベル{0}！', en: 'Level {0}!' },
    diff: { ko: '색 차이 {0}%', ja: '色の差 {0}%', en: 'Difference {0}%' },
    sec: { ko: '{0}초', ja: '{0}秒', en: '{0}s' },
    timeUp: { ko: '시간 끝!', ja: 'タイムアップ！', en: 'Time’s up!' },
    newBest: { ko: '새 기록!', ja: '新記録！', en: 'New best!' },
    cleared: { ko: '{0}단계까지 깼어요', ja: '{0}レベルまでクリア', en: 'Levels cleared: {0}' },
    misses: { ko: '실수 {0}번', ja: 'ミス{0}回', en: 'Misses: {0}' },
    finest: { ko: '가장 작은 색 차이 {0}%', ja: '見分けた最小の差 {0}%', en: 'Finest difference {0}%' },
    best: { ko: '최고 기록', ja: 'ベスト', en: 'Best' },
    again: { ko: '다시 하기', ja: 'もう一回', en: 'Play again' }
  };

  var TAU = Math.PI * 2, START = 30, RED = '#E5484D', GOOD = '#2FC85E', AMBER = '#FFB020';

  /* ---------- rules (OddColorBoard) ---------- */
  function hsl(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    var r = l, g = l, b = l;
    if (s) { var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); }
    return '#' + [r, g, b].map(function (v) { var x = Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16); return x.length < 2 ? '0' + x : x; }).join('').toUpperCase();
  }
  function sizeFor(st) { return st <= 1 ? 2 : Math.min(8, 3 + Math.floor((st - 1) / 2)); }
  function deltaFor(st) { return Math.max(0.03, 0.24 * Math.pow(0.88, Math.max(0, st - 1))); }
  function makeBoard(st) {
    var n = sizeFor(st), d = deltaFor(st), h = Math.random() * 360, s = 0.45 + Math.random() * 0.35, l = 0.4 + Math.random() * 0.2;
    var os = s, ol = l, coin = Math.random() < 0.5;
    if (st >= 4 && Math.random() < 0.3) {
      var dd = d * 2;
      os = Math.min(1, Math.max(0, s + dd <= 1 && (coin || s - dd < 0.1) ? s + dd : s - dd));
    } else {
      ol = Math.min(1, Math.max(0, l + d <= 0.88 && (coin || l - d < 0.12) ? l + d : l - d));
    }
    return { stage: st, n: n, odd: Math.floor(Math.random() * n * n), base: hsl(h, s, l), oddC: hsl(h, os, ol), delta: d };
  }

  /* ---------- small icons (Material rounded look) ---------- */
  function iconTimer(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.translate(-12, -12);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.arc(12, 13.5, 7.6, 0, TAU); g.stroke();
    g.fillRect(9.4, 2.6, 5.2, 2.4);
    g.beginPath(); g.moveTo(12, 13.5); g.lineTo(12, 9.4); g.moveTo(18.3, 6.7); g.lineTo(19.7, 5.3); g.stroke();
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
  function iconCheck(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.strokeStyle = col; g.lineWidth = s * 0.15; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-s * 0.3, s * 0.02); g.lineTo(-s * 0.1, s * 0.22); g.lineTo(s * 0.32, -s * 0.2); g.stroke(); g.restore();
  }
  function iconX(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.strokeStyle = col; g.lineWidth = s * 0.14; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-s * 0.24, -s * 0.24); g.lineTo(s * 0.24, s * 0.24); g.moveTo(s * 0.24, -s * 0.24); g.lineTo(-s * 0.24, s * 0.24); g.stroke(); g.restore();
  }
  // Icons.colorize_rounded: an eyedropper, tip to the bottom left
  function iconDropper(ctx, g, x, y, s, col) {
    g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillStyle = col;
    ctx.rrect(g, -s * 0.15, -s * 0.5, s * 0.3, s * 0.26, s * 0.12); g.fill();
    ctx.rrect(g, -s * 0.24, -s * 0.27, s * 0.48, s * 0.09, s * 0.04); g.fill();
    g.beginPath(); g.moveTo(-s * 0.1, -s * 0.18); g.lineTo(s * 0.1, -s * 0.18); g.lineTo(s * 0.1, s * 0.22); g.lineTo(0, s * 0.44); g.lineTo(-s * 0.1, s * 0.22); g.closePath(); g.fill();
    g.restore();
  }
  function iconReplay(g, x, y, s, col) {
    var r = s * 0.3;
    g.save(); g.translate(x, y); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = s * 0.12; g.lineCap = 'round';
    g.beginPath(); g.arc(0, s * 0.04, r, -Math.PI / 2 + 0.25, Math.PI * 1.02); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.2, -r + s * 0.04); g.lineTo(s * 0.06, -r - s * 0.14); g.lineTo(s * 0.06, -r + s * 0.22); g.closePath(); g.fill();
    g.restore();
  }

  GAMES['oddcolor'] = {
    name: { ko: '다른 색 찾기', ja: '違う色さがし', en: 'Odd Color' },
    tip: { ko: '살짝 다른 색 한 칸을 찾아요', ja: '少しだけ違う色のマスを見つけよう', en: 'Find the one tile that’s slightly off' },
    color: '#00C2C7',
    kind: 'brain',
    make: function (ctx) {
      var ax = 0, ay = 0, aw = 300, ah = 420, k = 1, pad = 14, R = 26, G = 260, gx = 0, gy = 0, hudH = 46, barH = 10;
      var board = makeBoard(1), boardT = 1, phase = 'ready', phaseT = 0, left = START, lastWhole = START;
      var cleared = 0, misses = 0, finest = 1, hit = -1, hitT = 0, wrong = -1, wrongT = 0, lock = 0;
      var flash = null, flashT = 9, popN = 0, popT = 9, numT = 9, res = null, again = null;

      function geo() {
        var n = board.n, gap = ctx.clamp(G * 0.11 / n, 3, 14);
        return { n: n, gap: gap, cell: (G - gap * (n - 1)) / n };
      }
      function tileCenter(i) {
        var q = geo();
        return { x: ax + gx + (i % q.n) * (q.cell + q.gap) + q.cell / 2, y: ay + gy + Math.floor(i / q.n) * (q.cell + q.gap) + q.cell / 2 };
      }
      function tileAt(p) {
        var q = geo(), x = p.x - ax - gx, y = p.y - ay - gy, sl = q.gap / 2 + 4;
        if (x < -sl || y < -sl || x > G + sl || y > G + sl) return -1;
        var c = ctx.clamp(Math.floor((x + q.gap / 2) / (q.cell + q.gap)), 0, q.n - 1), r = ctx.clamp(Math.floor((y + q.gap / 2) / (q.cell + q.gap)), 0, q.n - 1);
        return r * q.n + c;
      }
      function newBoard() { board = makeBoard(cleared + 1); boardT = 0; hit = -1; wrong = -1; }
      function addTime(s) { left = ctx.clamp(left + s, 0, START); lastWhole = Math.ceil(left); }

      function toReady() {
        cleared = 0; misses = 0; finest = 1; left = START; lastWhole = START; lock = 0; res = null; again = null;
        flash = null; popN = 0; phase = 'ready'; phaseT = 0; newBoard();
      }
      function finish() {
        if (phase !== 'play') return;
        phase = 'over'; phaseT = 0; lock = 0; left = 0;
        ctx.sfx.stamp(); ctx.haptic('heavy');
        // a 0 round is not recorded (same as the app)
        var b = cleared > 0 ? ctx.best(cleared) : { best: ctx.getBest(), isNew: false };
        res = { cleared: cleared, misses: misses, finest: finest, best: b.best, isNew: b.isNew && cleared > 0 };
      }
      function toResult() {
        phase = 'result'; phaseT = 0;
        if (res.isNew) { ctx.sfx.win(); ctx.sfx.sparkle(); ctx.haptic('success'); ctx.fx.burst(ax + aw / 2, ay + ah * 0.4, 80, ctx.PAL, { speed: 700 }); }
        else ctx.sfx.ding();
      }

      function tap(i) {
        var c = tileCenter(i);
        flashT = 0;
        if (i === board.odd) {
          cleared++; finest = Math.min(finest, board.delta); addTime(1); flash = { good: true, txt: '+1' }; numT = 0;
          if (cleared % 5 === 0) {
            ctx.sfx.sparkle(); ctx.sfx.note(3, 0.7); ctx.haptic('medium'); popN = cleared + 1; popT = 0;
            ctx.fx.stars(c.x, c.y, 10, ['#FFE066', '#FFFFFF', AMBER], { speed: 300 * k, size: 8 * k });
          } else { ctx.sfx.ding(); ctx.sfx.note(cleared % 3, 0.4); ctx.haptic('light'); }
          ctx.fx.ring(c.x, c.y, { r: geo().cell * 0.75, width: 5, color: '#FFFFFF', life: 0.3 });
          hit = i; hitT = 0; lock = 0.23;
        } else {
          misses++; addTime(-3); flash = { good: false, txt: '-3' };
          ctx.sfx.buzz(); ctx.haptic('error');
          wrong = i; wrongT = 0; lock = 0.95;
          if (left <= 0) finish();
        }
      }

      /* ---------- drawing ---------- */
      function hud(g) {
        var C = ctx.C, y0 = pad, lbl = ctx.t(TX.level), lv = String(cleared + 1);
        ctx.text(g, lbl, pad, y0 + 8 * k, { size: 12 * k, weight: 700, color: C.soft, align: 'left' });
        var ps = numT < 0.3 ? 1.3 - 0.3 * ctx.ease.outBack(numT / 0.3) : 1;
        g.save(); g.translate(pad, y0 + 31 * k); g.scale(ps, ps);
        ctx.text(g, lv, 0, 0, { size: 24 * k, weight: 900, color: C.ink, align: 'left' });
        g.restore();
        g.font = ctx.font(12 * k, 700); var lw = g.measureText(lbl).width;
        g.font = ctx.font(24 * k, 900); lw = Math.max(lw, g.measureText(lv).width);
        var sec = String(Math.ceil(left)), low = phase === 'play' && left <= 5;
        g.font = ctx.font(30 * k, 900); var tw = g.measureText(sec).width, cxr = aw - pad, tcy = y0 + 22 * k;
        var best = ctx.getBest();
        if (best !== null) {
          var bx = pad + lw + 12 * k, room = cxr - tw - 36 * k - bx - 22 * k;
          if (room > 16) {
            iconTrophy(ctx, g, bx + 9 * k, y0 + 31 * k, 18 * k, AMBER);
            ctx.text(g, 'Lv ' + best, bx + 21 * k, y0 + 31 * k, { size: 15 * k, weight: 800, color: C.soft, align: 'left', maxW: room, min: 9 });
          }
        }
        ctx.text(g, sec, cxr, tcy, { size: 30 * k, weight: 900, color: low ? RED : C.ink, align: 'right' });
        iconTimer(g, cxr - tw - 15 * k, tcy, 22 * k, low ? RED : C.soft);
        if (flash && flashT < 0.75) {
          var t = flashT / 0.75;
          ctx.text(g, ctx.f(TX.sec, flash.txt), cxr, y0 + 42 * k + 6 * k * t, { size: 15 * k, weight: 900, color: flash.good ? GOOD : RED, align: 'right', alpha: 1 - t });
        }
      }
      function timeBar(g) {
        var by = pad + hudH + 4 * k, bw = aw - pad * 2, fr = ctx.clamp(left / START, 0, 1);
        g.save(); ctx.rrect(g, pad, by, bw, barH, barH / 2); g.fillStyle = ctx.rgba(ctx.color, 0.15); g.fill(); g.clip();
        g.fillStyle = fr < 0.2 ? RED : ctx.color; g.fillRect(pad, by, bw * fr, barH);
        g.restore();
      }
      function tiles(g) {
        var q = geo(), n = q.n, cell = q.cell, gap = q.gap, rad = cell * (n <= 3 ? 0.18 : 0.22), d = ctx.dpr;
        var t = Math.min(1, boardT / 0.26), e = ctx.ease.outBack(t), sc = 0.9 + 0.1 * e, i, x, y;
        var ended = phase === 'over' || phase === 'result';
        g.save(); g.globalAlpha *= ctx.clamp(e, 0, 1) * (ended ? 0.55 : 1);
        g.translate(gx + G / 2, gy + G / 2); g.scale(sc, sc); g.translate(-G / 2, -G / 2);
        for (i = 0; i < n * n; i++) {
          if (i === hit || i === wrong || (wrong >= 0 && i === board.odd)) continue;
          x = (i % n) * (cell + gap); y = Math.floor(i / n) * (cell + gap);
          ctx.rrect(g, x, y, cell, cell, rad); g.fillStyle = i === board.odd ? board.oddC : board.base; g.fill();
        }
        if (wrong >= 0) {
          // the right tile blinks (white ring + green glow), the tapped one shakes with a red ring and an X
          var v = Math.min(1, wrongT / 0.9), on = Math.abs(Math.sin(v * Math.PI * 6)), o = board.odd;
          x = (o % n) * (cell + gap); y = Math.floor(o / n) * (cell + gap);
          g.save(); g.shadowColor = ctx.rgba(GOOD, (0.7 * on).toFixed(3)); g.shadowBlur = 16 * d;
          ctx.rrect(g, x, y, cell, cell, rad); g.fillStyle = board.oddC; g.fill(); g.restore();
          var bw = 3 + 3 * on;
          ctx.rrect(g, x + bw / 2, y + bw / 2, cell - bw, cell - bw, Math.max(0, rad - bw / 2));
          g.lineWidth = bw; g.strokeStyle = 'rgba(255,255,255,' + (0.3 + 0.7 * on).toFixed(3) + ')'; g.stroke();
          var st = Math.min(1, wrongT / 0.38), dx = st >= 1 ? 0 : Math.sin(st * Math.PI * 6) * 6 * (1 - st);
          x = (wrong % n) * (cell + gap) + dx; y = Math.floor(wrong / n) * (cell + gap);
          ctx.rrect(g, x, y, cell, cell, rad); g.fillStyle = board.base; g.fill();
          ctx.rrect(g, x + 1.5, y + 1.5, cell - 3, cell - 3, Math.max(0, rad - 1.5)); g.lineWidth = 3; g.strokeStyle = RED; g.stroke();
          iconX(g, x + cell / 2, y + cell / 2, Math.min(26 * k, cell * 0.55), '#FFFFFF');
        }
        if (hit >= 0) {
          var hs = 1 + 0.12 * ctx.ease.outBack(Math.min(1, hitT / 0.16)), col = hit === board.odd ? board.oddC : board.base;
          x = (hit % n) * (cell + gap) + cell / 2; y = Math.floor(hit / n) * (cell + gap) + cell / 2;
          g.save(); g.translate(x, y); g.scale(hs, hs);
          g.save(); g.shadowColor = ctx.rgba(col, 0.6); g.shadowBlur = 18 * d;
          ctx.rrect(g, -cell / 2, -cell / 2, cell, cell, rad); g.fillStyle = col; g.fill(); g.restore();
          ctx.rrect(g, -cell / 2 + 2, -cell / 2 + 2, cell - 4, cell - 4, Math.max(0, rad - 2)); g.lineWidth = 4; g.strokeStyle = '#FFFFFF'; g.stroke();
          iconCheck(g, 0, 0, Math.min(30 * k, cell * 0.62), '#FFFFFF');
          g.restore();
        }
        g.restore();
      }
      function footer(g) {
        var d = board.delta * 100;
        ctx.text(g, ctx.f(TX.diff, d.toFixed(board.delta < 0.1 ? 1 : 0)), aw / 2, gy + G + 19 * k, { size: 13 * k, weight: 700, color: ctx.C.soft, maxW: aw - pad * 2 });
      }
      function levelPop(g) {
        if (!popN || popT >= 1.1) return;
        var t = popT / 1.1, s = t < 0.25 ? ctx.ease.outBack(t / 0.25) : 1, o = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        var str = ctx.f(TX.levelN, popN), fs = 22 * k; g.font = ctx.font(fs, 900);
        var w = g.measureText(str).width + 36 * k, h = fs + 16 * k;
        g.save(); g.globalAlpha *= ctx.clamp(o, 0, 1); g.translate(gx + G / 2, gy + G * 0.4 + h / 2 - 20 * k * t); g.scale(Math.max(0.01, s), Math.max(0.01, s));
        g.save(); g.shadowColor = 'rgba(0,0,0,.33)'; g.shadowBlur = 14 * ctx.dpr; g.shadowOffsetY = 4 * ctx.dpr;
        ctx.rrect(g, -w / 2, -h / 2, w, h, h / 2); g.fillStyle = AMBER; g.fill(); g.restore();
        ctx.text(g, str, 0, 1, { size: fs, weight: 900, color: '#FFFFFF' });
        g.restore();
      }
      function overPill(g) {
        if (phase !== 'over') return;
        var ts = Math.min(aw * 0.1, 40), label = ctx.t(TX.timeUp);
        g.font = ctx.font(ts, 900);
        var rw = Math.min(aw - 24, g.measureText(label).width + ts * 1.3), rh = ts * 1.6;
        g.save(); g.translate(aw / 2, gy + G / 2); var os = ctx.ease.elasticOut(Math.min(1, phaseT / 0.6)); g.scale(Math.max(0.01, os), Math.max(0.01, os)); g.rotate(-0.05);
        ctx.rrect(g, -rw / 2, -rh / 2 + 4, rw, rh, rh / 2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
        ctx.rrect(g, -rw / 2, -rh / 2, rw, rh, rh / 2); g.fillStyle = ctx.shade(ctx.color, -0.1); g.fill();
        ctx.text(g, label, 0, 1, { size: ts, weight: 900, color: '#FFFFFF', shadow: 'rgba(0,0,0,.35)', blur: 4 * ctx.dpr, oy: 1.5 * ctx.dpr, maxW: rw - ts * 0.8 });
        g.restore();
      }
      // like the app's ResultView: icon circle, title, "levels cleared", big Lv in the game colour, best / misses, finest, play again
      function resultCard(g) {
        var C = ctx.C, t = Math.min(1, phaseT / 0.3), e = ctx.ease.outBack(t), cw = 300;
        var lines = res.cleared > 0 ? 2 : 1, ch = 18 + 52 + 12 + 28 + 22 + 50 + 20 * lines + 14 + 48 + 18;
        var s = Math.min(1.15, (aw - 20) / cw, (ah - 16) / ch);
        g.save(); ctx.rrect(g, ax, ay, aw, ah, R); g.fillStyle = 'rgba(0,0,0,' + (0.28 * t).toFixed(3) + ')'; g.fill(); g.restore();
        g.save(); g.globalAlpha = t; g.translate(ax + aw / 2, ay + ah / 2); g.scale(s * (0.9 + 0.1 * e), s * (0.9 + 0.1 * e)); g.translate(-cw / 2, -ch / 2);
        g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 24 * ctx.dpr; g.shadowOffsetY = 8 * ctx.dpr;
        ctx.rrect(g, 0, 0, cw, ch, 24); g.fillStyle = C.surface; g.fill(); g.restore();
        ctx.rrect(g, 0.5, 0.5, cw - 1, ch - 1, 24); g.lineWidth = 1; g.strokeStyle = C.hair; g.stroke();
        var y = 18 + 26, col = ctx.color, ic = 0.6 + 0.4 * ctx.ease.elasticOut(Math.min(1, phaseT / 0.65));
        g.save(); g.translate(cw / 2, y); g.scale(ic, ic);
        g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fillStyle = ctx.rgba(col, 0.16); g.fill();
        if (res.isNew) iconTrophy(ctx, g, 0, 0, 30, col); else iconDropper(ctx, g, 0, 0, 30, col);
        g.restore();
        y += 26 + 12 + 14;
        ctx.text(g, ctx.t(res.isNew ? TX.newBest : TX.timeUp), cw / 2, y, { size: 25, weight: 900, color: C.ink, maxW: cw - 36 });
        y += 14 + 16;
        ctx.text(g, ctx.f(TX.cleared, res.cleared), cw / 2, y, { size: 14.5, weight: 600, color: C.soft, maxW: cw - 36 });
        y += 12 + 26;
        var shown = Math.round(res.cleared * ctx.ease.outCubic(Math.min(1, phaseT / 0.8)));
        ctx.text(g, 'Lv ' + shown, cw / 2, y, { size: 46, weight: 900, color: col, maxW: cw - 36 });
        y += 26 + 12;
        var bestTxt = ctx.t(TX.best) + ' Lv ' + (res.best === null ? res.cleared : res.best) + '  ·  ' + ctx.f(TX.misses, res.misses);
        ctx.text(g, bestTxt, cw / 2, y, { size: 13.5, weight: 600, color: C.soft, maxW: cw - 32 });
        if (res.cleared > 0) {
          y += 20;
          var fn = res.finest * 100;
          ctx.text(g, ctx.f(TX.finest, fn.toFixed(res.finest < 0.1 ? 1 : 0)), cw / 2, y, { size: 13.5, weight: 600, color: C.soft, maxW: cw - 32 });
        }
        y += 10 + 14;
        var bw = cw - 36, bh = 48, bx = 18;
        ctx.rrect(g, bx, y, bw, bh, 18); g.fillStyle = col; g.fill();
        var ink = ctx.inkOn(col), label = ctx.t(TX.again);
        g.font = ctx.font(17, 800); var lw = Math.min(g.measureText(label).width, bw - 60), ix = cw / 2 - (lw + 28) / 2;
        iconReplay(g, ix + 10, y + bh / 2, 22, ink);
        ctx.text(g, label, ix + 28, y + bh / 2 + 1, { size: 17, weight: 800, color: ink, align: 'left', maxW: bw - 60 });
        g.restore();
        again = { x: ax + aw / 2, y: ay + ah / 2 + (y + bh / 2 - ch / 2) * s };
      }

      return {
        layout: function (W, H) {
          var maxW = Math.min(W - 32, 520);
          k = ctx.clamp(maxW / 340, 0.8, 1.25);
          pad = Math.round(14 * k); hudH = 52 * k; barH = Math.round(10 * k);
          var top = pad + hudH + 4 * k + barH + 12 * k, bottom = 36 * k;
          G = Math.floor(Math.max(120, Math.min(maxW - pad * 2, H - 12 - top - bottom)));
          aw = Math.round(Math.max(G + pad * 2, Math.min(maxW, 290 * k)));
          ah = Math.round(G + top + bottom);
          ax = Math.round((W - aw) / 2); ay = Math.max(0, Math.round((H - ah) / 2));
          gx = Math.round((aw - G) / 2); gy = Math.round(top);
          R = Math.round(26 * Math.min(1, k + 0.1));
        },

        update: function (dt) {
          phaseT += dt; boardT += dt; hitT += dt; wrongT += dt; flashT += dt; popT += dt; numT += dt;
          if (lock > 0) { lock -= dt; if (lock <= 0 && phase === 'play') newBoard(); }
          if (phase === 'play') {
            left = Math.max(0, left - dt);
            var whole = Math.ceil(left);
            if (whole < lastWhole) { lastWhole = whole; if (whole <= 5 && whole > 0) { ctx.sfx.tick(whole % 2 === 0); ctx.haptic(6); } }
            if (left <= 0) finish();
          } else if (phase === 'over' && phaseT > 1.0) toResult();
          else if (phase === 'result' && phaseT > 4.2) toReady();
        },

        draw: function (g) {
          var C = ctx.C;
          g.save(); g.translate(ax, ay);
          if (!ctx.dark) {
            g.save(); g.shadowColor = 'rgba(16,20,16,.10)'; g.shadowBlur = 22 * ctx.dpr; g.shadowOffsetY = 8 * ctx.dpr;
            ctx.rrect(g, 0, 0, aw, ah, R); g.fillStyle = C.surface; g.fill(); g.restore();
          }
          ctx.rrect(g, 0, 0, aw, ah, R); g.fillStyle = C.surface; g.fill();
          ctx.rrect(g, 0.5, 0.5, aw - 1, ah - 1, R); g.lineWidth = 1; g.strokeStyle = C.hair; g.stroke();
          hud(g); timeBar(g); tiles(g); footer(g); levelPop(g); overPill(g);
          g.restore();
          if (phase === 'result' && res) resultCard(g);
        },

        down: function (p) {
          if (phase === 'over') return;
          if (phase === 'result') { if (phaseT > 0.45) { ctx.sfx.click(); ctx.haptic('light'); toReady(); } return; }
          if (lock > 0) return;
          var i = tileAt(p);
          if (i < 0) return;
          if (phase === 'ready') { phase = 'play'; phaseT = 0; lastWhole = Math.ceil(left); }
          tap(i);
        },

        // the odd tile, only while the clock waits for the first tap (after that it would give the answer away)
        hint: function () {
          if (phase !== 'ready' || lock > 0 || boardT < 0.2) return null;
          return tileCenter(board.odd);
        },

        debug: function () {
          var o = tileCenter(board.odd), w = tileCenter((board.odd + 1) % (board.n * board.n));
          return { phase: phase, level: cleared + 1, cleared: cleared, misses: misses, left: Math.round(left * 10) / 10, n: board.n,
            delta: Math.round(board.delta * 1000) / 10, locked: lock > 0, best: ctx.getBest(), arena: { x: ax, y: ay, w: aw, h: ah },
            targets: phase === 'result' && again ? [{ x: Math.round(again.x), y: Math.round(again.y) }] : [{ x: Math.round(o.x), y: Math.round(o.y) }],
            wrong: { x: Math.round(w.x), y: Math.round(w.y) } };
        },

        destroy: function () { board = null; res = null; }
      };
    }
  };
})();
