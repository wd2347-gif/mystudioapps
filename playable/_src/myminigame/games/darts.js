/* 다트 꽂기 (darts): my_mini/lib/games/list/darts.dart 를 옮긴 것(남색 바탕 · 나무 과녁 · 빨강/노랑 다트 · 회색 다트 · 사과 · 쪼개지는 과녁 · 단계별 도는 버릇이 앱과 같다).
   플레이어블: 처음 화면부터 1단계 과녁이 돌고(회색 다트 둘 · 사과 하나) 아래에 다트가 기다린다. 톡 누르면 바로 던지며 판 시작.
   다 꽂으면 과녁이 쪼개지고 다음 단계(방향 · 빠르기 · 버릇이 바뀐다). 꽂힌 다트에 부딪히면 '튕겨 나갔어요!' → 결과 카드 → 4초 뒤 1단계부터.
   한 판의 첫 다트만은 봐준다(바로 튕겨 끝나지 않게, 가장 가까운 빈자리에 꽂힌다). */
(function () {
  'use strict';

  var TX = {
    stage: { ko: '{0}단계', ja: 'ステージ{0}', en: 'Stage {0}' },
    boss: { ko: '보스!', ja: 'ボス！', en: 'Boss!' },
    clear: { ko: '클리어!', ja: 'クリア！', en: 'Cleared!' },
    bounced: { ko: '튕겨 나갔어요!', ja: 'はじかれた！', en: 'Bounced off!' },
    summary: { ko: '{0}단계 · 다트 {1}개 · 사과 {2}개', ja: 'ステージ{0}・ダーツ{1}本・リンゴ{2}個', en: 'Stage {0} · Darts: {1} · Apples: {2}' },
    newBest: { ko: '새 기록!', ja: '新記録！', en: 'New best!' },
    score: { ko: '점수', ja: 'スコア', en: 'Score' },
    best: { ko: '최고 기록', ja: 'ベスト', en: 'Best' },
    again: { ko: '다시 하기', ja: 'もう一回', en: 'Play again' }
  };

  var TAU = Math.PI * 2, PI = Math.PI;
  var ASPECT = 0.56, CX = 0.5, CY = 0.62, THROW_Y = 1.43, LEN = 0.2, EMBED = 0.03, FLY = 4.6, REACH = 0.032, APPLE_R = 0.034;
  var RED = '#FF5C6C';
  var PALS = [['#FFF1DA', '#FF6B6B', '#2EC4B6'], ['#FFF1DA', '#4D96FF', '#FFB020'], ['#FFF1DA', '#2FC85E', '#FF5C7A'], ['#FFF1DA', '#A368FF', '#00C2C7']];

  /* ---------- rules (DartsStage / DartsTarget) ---------- */
  function norm(a) { a %= TAU; return a < 0 ? a + TAU : a; }
  function angGap(a, b) { var d = norm(a - b); return d > PI ? TAU - d : d; }
  function tanh(x) { var e = Math.exp(2 * x); return (e - 1) / (e + 1); }
  function stageOf(n) {
    var boss = n % 5 === 0;
    return {
      n: n, boss: boss,
      spin: boss ? 'boss' : n <= 2 ? 'steady' : ['wave', 'stopGo', 'reverse', 'steady'][(n - 3) % 4],
      darts: boss ? Math.min(10, 8 + Math.floor(n / 15)) : Math.min(9, 5 + Math.floor((n - 1) / 3)),
      preset: Math.min(4, Math.max(2, Math.floor(n / 2))),
      apples: boss ? 2 : n === 1 || Math.random() < 0.6 ? 1 : 0,
      speed: Math.min(3.6, 1.6 + 0.11 * (n - 1)), dir: n % 2 ? 1 : -1, radius: boss ? 0.235 : 0.2
    };
  }
  function newTarget(n) {
    var st = stageOf(n), T = { st: st, rot: Math.random() * TAU, time: 0, stuck: [], preset: [], apples: [], thrown: 0 };
    T.minGap = REACH / st.radius; T.appleGap = (APPLE_R + 0.012) / st.radius;
    var taken = [];
    function free(a, gp) { for (var i = 0; i < taken.length; i++) if (angGap(a, taken[i]) < gp) return false; return true; }
    function put(list, gp, flag) {
      for (var k = 0; k < 300; k++) { var a = Math.random() * TAU; if (free(a, gp)) { list.push(a); if (flag) T.preset.push(true); taken.push(a); return; } }
    }
    for (var i = 0; i < st.preset; i++) put(T.stuck, T.minGap * 1.8, true);
    for (var j = 0; j < st.apples; j++) put(T.apples, Math.max(T.minGap, T.appleGap) * 1.6, false);
    return T;
  }
  function omega(T, t) {
    var s = T.st, k = 1;
    if (s.spin === 'wave') k = 0.35 + 0.95 * (0.5 + 0.5 * Math.sin(t * 1.7));
    else if (s.spin === 'stopGo') { var c = t % 2.1; k = c >= 1.4 ? 0 : (c < 0.12 ? c / 0.12 : 1) * 1.3; }
    else if (s.spin === 'reverse') k = tanh(5 * Math.sin(t * 1.45)) * 1.1;
    else if (s.spin === 'boss') k = 1.15 * Math.sin(t * 1.05) + 0.55 * Math.sin(t * 2.6 + 1) + 0.25;
    return k * s.speed * s.dir;
  }
  function spinStep(T, dt) { T.time += dt; T.rot = norm(T.rot + omega(T, T.time) * dt); }
  function blockedAt(T, a, m) { for (var i = 0; i < T.stuck.length; i++) if (angGap(a, T.stuck[i]) < T.minGap * (m || 1)) return true; return false; }

  /* ---------- painters (darts.dart _drawDart / _drawApple / _drawTarget) ---------- */
  function circ(g, x, y, r, col) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = col; g.fill(); }
  function rr(g, x0, y0, x1, y1, r) {
    g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x1, y0, x1, y1, r); g.arcTo(x1, y1, x0, y1, r); g.arcTo(x0, y1, x0, y0, r); g.arcTo(x0, y0, x1, y0, r); g.closePath();
  }
  // tip at (0, 0), tail along +x
  function paintDart(g, L, enemy) {
    var body = enemy ? '#8C9BAB' : '#FF4D5E', dark = enemy ? '#5E6B7A' : '#C72C3E', fin = enemy ? '#B8C3CF' : '#FFD34D', finD = enemy ? '#8592A0' : '#FF9F1C';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.2, -L * 0.035); g.lineTo(L * 0.2, L * 0.035); g.closePath(); g.fillStyle = '#D9DEE5'; g.fill();
    g.beginPath(); g.moveTo(L * 0.04, 0); g.lineTo(L * 0.2, 0); g.lineWidth = L * 0.012; g.strokeStyle = 'rgba(255,255,255,.6)'; g.stroke();
    rr(g, L * 0.18, -L * 0.06, L * 0.48, L * 0.06, L * 0.05); g.fillStyle = body; g.fill();
    g.fillStyle = dark; for (var i = 0; i < 3; i++) g.fillRect(L * (0.24 + i * 0.07), -L * 0.06, L * 0.025, L * 0.12);
    rr(g, L * 0.2, -L * 0.045, L * 0.46, -L * 0.02, L * 0.0125); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    g.fillStyle = '#F2F2F2'; g.fillRect(L * 0.48, -L * 0.018, L * 0.32, L * 0.036);
    [-1, 1].forEach(function (s) {
      g.beginPath(); g.moveTo(L * 0.62, 0); g.lineTo(L * 0.82, s * L * 0.13); g.lineTo(L, s * L * 0.13); g.lineTo(L * 0.92, 0); g.closePath();
      g.fillStyle = s < 0 ? fin : finD; g.fill();
    });
  }
  function paintApple(g, r, half) {
    if (half) { g.save(); g.beginPath(); if (half < 0) g.rect(-r * 2, -r * 2, r * 2, r * 4); else g.rect(0, -r * 2, r * 2, r * 4); g.clip(); }
    circ(g, -r * 0.32, 0, r * 0.82, '#E5394B'); circ(g, r * 0.32, 0, r * 0.82, '#E5394B'); circ(g, 0, r * 0.15, r * 0.8, '#E5394B');
    if (half) { g.beginPath(); g.ellipse(half * r * 0.02, r * 0.05, r * 0.25, r * 0.75, 0, 0, TAU); g.fillStyle = '#FFF1D6'; g.fill(); }
    else circ(g, -r * 0.45, -r * 0.25, r * 0.2, 'rgba(255,255,255,.5)');
    g.beginPath(); g.moveTo(0, -r * 0.55); g.lineTo(r * 0.1, -r * 1.05); g.lineWidth = r * 0.16; g.lineCap = 'round'; g.strokeStyle = '#6B4226'; g.stroke();
    g.beginPath(); g.moveTo(r * 0.1, -r * 0.9); g.quadraticCurveTo(r * 0.55, -r * 1.35, r * 0.85, -r * 0.95); g.quadraticCurveTo(r * 0.45, -r * 0.7, r * 0.1, -r * 0.9);
    g.closePath(); g.fillStyle = '#3FBF5A'; g.fill();
    if (half) g.restore();
  }
  function paintTarget(g, r, n, boss) {
    var pal = boss ? ['#FFE9B0', '#E5484D', '#2B2B3A'] : PALS[(n - 1) % PALS.length], i;
    circ(g, 0, 0, r, boss ? '#FFB020' : '#5B3A26'); circ(g, 0, 0, r * 0.9, boss ? '#B86E00' : '#3A2418');
    for (i = 0; i < 12; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 0.86, i * TAU / 12, (i + 1) * TAU / 12); g.closePath(); g.fillStyle = i % 2 ? pal[1] : pal[0]; g.fill(); }
    g.beginPath(); g.arc(0, 0, r * 0.56, 0, TAU); g.lineWidth = r * 0.09; g.strokeStyle = pal[2]; g.stroke();
    circ(g, 0, 0, r * 0.26, pal[2]); circ(g, 0, 0, r * 0.14, boss ? '#FFD34D' : '#E5394B');
    for (i = 0; i < 12; i++) { var a = i * TAU / 12 + TAU / 24; circ(g, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.025, boss ? '#FFF3C4' : '#B98552'); }
    if (boss) {
      g.strokeStyle = '#1B1B26'; g.lineWidth = r * 0.045; g.lineCap = 'round';
      [-1, 1].forEach(function (s) {
        circ(g, s * r * 0.36, -r * 0.12, r * 0.11, '#FFFFFF'); circ(g, s * r * 0.33, -r * 0.09, r * 0.055, '#1B1B26');
        g.beginPath(); g.moveTo(s * r * 0.5, -r * 0.3); g.lineTo(s * r * 0.22, -r * 0.22); g.stroke();
      });
      g.beginPath(); g.ellipse(0, r * 0.42, r * 0.18, r * 0.11, 0, PI + 0.3, TAU - 0.3); g.stroke();
    }
  }

  function iconTrophy(ctx, g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.translate(-12, -12);
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(7, 3.5); g.lineTo(17, 3.5); g.lineTo(17, 9.5); g.quadraticCurveTo(17, 14.6, 12, 14.6); g.quadraticCurveTo(7, 14.6, 7, 9.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(7, 5.6); g.lineTo(4.4, 5.6); g.quadraticCurveTo(3.9, 10.6, 7.6, 11.2); g.moveTo(17, 5.6); g.lineTo(19.6, 5.6); g.quadraticCurveTo(20.1, 10.6, 16.4, 11.2); g.stroke();
    g.fillRect(11, 14, 2, 3.6); ctx.rrect(g, 7.4, 17.4, 9.2, 3, 1.2); g.fill();
    g.restore();
  }

  GAMES['darts'] = {
    name: { ko: '다트 꽂기', ja: 'ダーツスピン', en: 'Dart Spin' },
    tip: { ko: '톡 눌러 던져요: 꽂힌 다트는 피해요!', ja: 'タップで投げよう：刺さったダーツをよけて！', en: 'Tap to throw: miss the stuck darts!' },
    color: '#8C9BAB',
    kind: 'arcade',
    make: function (ctx) {
      var ax = 0, ay = 0, aw = 300, ah = 536, k = 1, R = 26, bgN = null, bgB = null, S = {};
      var T = newTarget(1), phase = 'ready', phaseT = 0, score = 0, darts = 0, apples = 0, first = true, res = null, again = null;
      var flying = [], pieces = [], bounce = null, cool = 0, reload = 1, clearT = 0, appearT = 0.5, knock = 0, shakeT = 0, flashT = 0, flashCol = '#FFFFFF', twT = 0;

      function sprites() {
        var L = LEN * aw, l = 0.075 * aw, ar = APPLE_R * aw;
        function dart(len, enemy) { return ctx.layer(len + 2, len * 0.3, function (c) { c.translate(1, len * 0.15); paintDart(c, len, enemy); }); }
        S.dart = dart(L, false); S.enemy = dart(L, true); S.small = dart(l, false);
        var s = Math.ceil(ar * 2.6);
        S.apple = ctx.layer(s, s, function (c) { c.translate(s / 2, s / 2 + ar * 0.12); paintApple(c, ar, 0); });
        targetSprite();
      }
      function targetSprite() {
        var r = T.st.radius * aw, s = Math.ceil(r * 2 + 4);
        S.target = ctx.layer(s, s, function (c) { c.translate(s / 2, s / 2); paintTarget(c, r, T.st.n, T.st.boss); });
        S.tr = r; S.ts = s;
      }
      function bgLayer(boss) {
        return ctx.layer(aw, ah, function (c, w, h) {
          var gr = c.createLinearGradient(0, 0, 0, h);
          gr.addColorStop(0, boss ? '#4A2A3E' : '#353B5E'); gr.addColorStop(1, boss ? '#1E1420' : '#1A1D30');
          c.fillStyle = gr; c.fillRect(0, 0, w, h);
          var rg = c.createRadialGradient(CX * w, CY * w, 0, CX * w, CY * w, w * 0.55);
          rg.addColorStop(0, 'rgba(255,255,255,.12)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = rg; c.fillRect(0, 0, w, h);
        });
      }
      function dartAt(g, img, x, y, ang, len, a) {
        g.save(); g.translate(x, y); g.rotate(ang); if (a < 1) g.globalAlpha *= Math.max(0, a);
        g.drawImage(img, -1, -len * 0.15, len + 2, len * 0.3); g.restore();
      }

      function stab(i) {
        var f = [205, 228, 252][i % 3];
        ctx.sfx.tone(f * 1.25, 0.13, 'sine', 0.5, f * 0.85); ctx.sfx.tone(f * 2.21, 0.05, 'triangle', 0.12, f * 1.9);
        ctx.sfx.noise(0.03, 0.22, 4500, 900, 'bandpass');
      }
      function setTarget(n) {
        T = newTarget(n); targetSprite(); appearT = 0; reload = 1; cool = 0;
        ctx.sfx.noise(0.22, 0.16, 600, 3200, 'bandpass', 0.06);
      }
      function toReady() {
        T = newTarget(1); targetSprite(); phase = 'ready'; phaseT = 0; appearT = 0; score = 0; darts = 0; apples = 0; first = true;
        flying.length = 0; pieces.length = 0; bounce = null; res = null; again = null; reload = 1; cool = 0;
      }
      function startRound() { phase = 'play'; phaseT = 0; score = 0; darts = 0; apples = 0; first = true; }
      function throwDart() {
        if (appearT < 0.2 || cool > 0 || T.st.darts - T.thrown - flying.length <= 0) return false;
        flying.push(THROW_Y); cool = 0.08; reload = 0;
        ctx.sfx.swish(); ctx.haptic('light');
        return true;
      }

      function land() {
        var a = norm(PI / 2 - T.rot), contactY = CY + T.st.radius;
        if (blockedAt(T, a) && first) {
          // first dart of a round: slide to the nearest free spot instead of ending at once
          for (var d = 0.02; d < 1.2; d += 0.02) { if (!blockedAt(T, a + d)) { a = norm(a + d); break; } if (!blockedAt(T, a - d)) { a = norm(a - d); break; } }
        }
        first = false;
        if (blockedAt(T, a)) {
          bounce = { x: CX, y: contactY, vx: (Math.random() < 0.5 ? 1 : -1) * (0.35 + 0.3 * Math.random()), vy: 0.9, spin: (Math.random() < 0.5 ? 1 : -1) * 13, rot: PI / 2 };
          flying.length = 0;
          ctx.sfx.hit(3); ctx.sfx.buzz(); ctx.haptic('error');
          shakeT = 0.35; flashT = 0.3; flashCol = '#FF3B4E';
          end();
          return;
        }
        var apple = -1;
        for (var i = 0; i < T.apples.length; i++) if (angGap(a, T.apples[i]) < T.appleGap) { apple = T.apples.splice(i, 1)[0]; break; }
        T.stuck.push(a); T.preset.push(false); T.thrown++;
        darts++; score += 1; knock = 0.016;
        stab(T.thrown); ctx.haptic('medium');
        for (var c = 0; c < 5; c++) {
          var an = PI / 2 + (Math.random() - 0.5) * 1.6, sp = 0.35 + 0.35 * Math.random();
          pieces.push({ k: 3, x: CX, y: contactY, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6 - 0.2, spin: (Math.random() - 0.5) * 20, rot: 0, life: 0.5, c: c % 2 ? '#B98552' : '#E8C99A', s: 0.008 + 0.006 * Math.random(), t: 0 });
        }
        if (apple >= 0) {
          apples++; score += 5;
          var sa = apple + T.rot, px = CX + Math.cos(sa) * (T.st.radius + APPLE_R * 0.8), py = CY + Math.sin(sa) * (T.st.radius + APPLE_R * 0.8);
          [-1, 1].forEach(function (s) { pieces.push({ k: 2, x: px, y: py, vx: s * (0.4 + 0.2 * Math.random()), vy: -0.5, spin: s * 6, rot: 0, half: s, life: 1.4, t: 0 }); });
          for (var j = 0; j < 10; j++) {
            var b = Math.random() * TAU, v = 0.3 + 0.4 * Math.random();
            pieces.push({ k: 3, x: px, y: py, vx: Math.cos(b) * v, vy: Math.sin(b) * v - 0.2, spin: 0, rot: 0, life: 0.6, c: j % 2 ? '#FFF1D6' : '#FF4D5E', s: 0.007 + 0.006 * Math.random(), t: 0 });
          }
          ctx.fx.text(ax + px * aw, ay + (py - 0.05) * aw, '+5', { color: '#FFE066', size: 0.075 * aw, rise: 0.18 * aw, life: 0.9 });
          ctx.sfx.pop(1.3); ctx.sfx.coin(); ctx.haptic('medium');
        }
        if (T.thrown >= T.st.darts) clear();
      }
      function clear() {
        phase = 'clear'; clearT = 0;
        if (T.st.boss) { score += 10; ctx.fx.text(ax + CX * aw, ay + CY * aw, '+10', { color: '#FFD34D', size: 0.11 * aw, rise: 0.18 * aw, life: 0.9 }); ctx.sfx.win(); }
        else ctx.sfx.sparkle();
        ctx.sfx.noise(0.45, 0.6, 2600, 120); ctx.sfx.tone(150, 0.3, 'sine', 0.4, 60); ctx.sfx.ding();
        ctx.haptic('success'); flashT = 0.22; flashCol = '#FFFFFF'; shakeT = 0.2;
        ctx.fx.stars(ax + CX * aw, ay + CY * aw, 12, ['#FFE066', '#FFFFFF', '#FFB020'], { speed: 0.9 * aw, size: 0.03 * aw, gravity: 1.3 * aw });
        var r = T.st.radius, i, dir;
        for (i = 0; i < 6; i++) {
          var mid = i * TAU / 6 + TAU / 12 + T.rot, s = 0.55 + 0.35 * Math.random();
          pieces.push({ k: 0, x: CX, y: CY, vx: Math.cos(mid) * s, vy: Math.sin(mid) * s - 0.45, spin: (Math.random() - 0.5) * 6, rot: T.rot, a0: i * TAU / 6, life: 1.4, t: 0, img: S.target, ts: S.ts, r: r * aw });
        }
        for (i = 0; i < T.stuck.length; i++) {
          var sa = T.stuck[i] + T.rot; dir = [Math.cos(sa), Math.sin(sa)];
          var v = 0.7 + 0.5 * Math.random();
          pieces.push({ k: 1, x: CX + dir[0] * (r - EMBED), y: CY + dir[1] * (r - EMBED), vx: dir[0] * v, vy: dir[1] * v - 0.3, spin: (Math.random() - 0.5) * 16, rot: sa, enemy: T.preset[i], life: 1.6, t: 0 });
        }
        T.apples.forEach(function (a) {
          var sa2 = a + T.rot, d = [Math.cos(sa2), Math.sin(sa2)];
          [-1, 1].forEach(function (s) { pieces.push({ k: 2, x: CX + d[0] * (r + APPLE_R * 0.8), y: CY + d[1] * (r + APPLE_R * 0.8), vx: d[0] * 0.8 + s * 0.2, vy: d[1] * 0.8 - 0.3, spin: s * 5, rot: 0, half: s, life: 1.4, t: 0 }); });
        });
      }
      function end() {
        phase = 'over'; phaseT = 0;
        var b = score > 0 ? ctx.best(score) : { best: ctx.getBest(), isNew: false };
        res = { score: score, stage: T.st.n, darts: darts, apples: apples, best: b.best, isNew: b.isNew };
        ctx.later(function () { if (phase === 'over') ctx.sfx.lose(); }, 450);
      }
      function toResult() {
        phase = 'result'; phaseT = 0; ctx.sfx.stamp();
        if (res.isNew) { ctx.sfx.win(); ctx.sfx.sparkle(); ctx.haptic('success'); ctx.fx.burst(ax + aw / 2, ay + ah * 0.42, 90, ctx.PAL, { speed: 720 }); }
      }
      function safeNow() {
        if (phase !== 'ready' && phase !== 'play') return false;
        if (flying.length || cool > 0 || appearT < 0.2) return false;
        var ft = (THROW_Y - CY - T.st.radius) / FLY, a = norm(PI / 2 - (T.rot + omega(T, T.time) * ft));
        return !blockedAt(T, a, 1.35);
      }

      function hud(g) {
        var best = ctx.getBest(), x = 12 * k, y = 10 * k;
        ctx.text(g, String(score), x, y + 17 * k, { size: 34 * k, weight: 900, color: '#FFFFFF', align: 'left' });
        iconTrophy(ctx, g, x + 8 * k, y + 44 * k, 15 * k, '#FFD34D');
        ctx.text(g, best === null ? '-' : String(Math.round(best)), x + 18 * k, y + 44 * k, { size: 13 * k, weight: 800, color: 'rgba(255,255,255,.8)', align: 'left' });
        ctx.text(g, T.st.boss ? ctx.t(TX.boss) : ctx.f(TX.stage, T.st.n), aw / 2, y + 17 * k, { size: 15 * k, weight: 900, color: T.st.boss ? '#FFB020' : '#FFFFFF', maxW: aw * 0.34 });
        var label = String(apples);
        g.font = ctx.font(15 * k, 900);
        var pw = 18 * k + 4 * k + g.measureText(label).width + 18 * k, ph = 26 * k, px = aw - 12 * k - pw;
        ctx.rrect(g, px, y + 4 * k, pw, ph, ph / 2); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill();
        var ar = 16 * k * 0.42; g.drawImage(S.apple, px + 9 * k + 8 * k - ar * 1.3, y + 4 * k + ph / 2 + 1.3 * k - ar * 1.3 - ar * 0.12, ar * 2.6, ar * 2.6);
        ctx.text(g, label, px + 9 * k + 20 * k, y + 4 * k + ph / 2 + 1, { size: 15 * k, weight: 900, color: '#FFFFFF', align: 'left' });
      }

      function resultCard(g) {
        var t = Math.min(1, phaseT / 0.3), e = ctx.ease.outBack(t), C = ctx.C, col = RED;
        g.fillStyle = 'rgba(0,0,0,' + (0.3 * t).toFixed(3) + ')'; g.fillRect(0, 0, aw, ah);
        var cw = Math.min(aw - 24, 320), pad = 18, ch = 250, cx = (aw - cw) / 2, cy = (ah - ch) / 2;
        g.save(); g.globalAlpha = t; g.translate(aw / 2, ah / 2); g.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e); g.translate(-aw / 2, -ah / 2);
        g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
        ctx.rrect(g, cx, cy, cw, ch, 24); g.fillStyle = C.surface; g.fill(); g.restore();
        g.lineWidth = 1; g.strokeStyle = C.hair; ctx.rrect(g, cx + 0.5, cy + 0.5, cw - 1, ch - 1, 24); g.stroke();
        var y = cy + pad + 16;
        ctx.text(g, ctx.t(res.isNew ? TX.newBest : TX.bounced), aw / 2, y, { size: 26, weight: 900, color: C.ink, maxW: cw - pad * 2 });
        y += 28;
        ctx.text(g, ctx.f(TX.summary, res.stage, res.darts, res.apples), aw / 2, y, { size: 14, weight: 600, color: C.soft, maxW: cw - pad * 2 });
        y += 18;
        var bw = (cw - pad * 2 - 10) / 2, bh = 72;
        [[TX.score, String(res.score), res.isNew], [TX.best, res.best === null ? '-' : String(Math.round(res.best)), false]].forEach(function (b, i) {
          var bx = cx + pad + i * (bw + 10);
          ctx.rrect(g, bx, y, bw, bh, 16); g.fillStyle = b[2] ? ctx.rgba(col, 0.12) : C.surface; g.fill();
          g.lineWidth = 1.4; g.strokeStyle = b[2] ? col : C.hair; g.stroke();
          ctx.text(g, ctx.t(b[0]), bx + bw / 2, y + 20, { size: 13, weight: 700, color: C.soft, maxW: bw - 16 });
          ctx.text(g, b[1], bx + bw / 2, y + 48, { size: 27, weight: 900, color: C.ink, maxW: bw - 16 });
        });
        y += bh + 16;
        var btnW = cw - pad * 2, btnH = 50;
        ctx.rrect(g, cx + pad, y, btnW, btnH, 18); g.fillStyle = col; g.fill();
        var ink = ctx.inkOn(col), label = ctx.t(TX.again);
        g.font = ctx.font(17, 800); var lw = g.measureText(label).width, ix = aw / 2 - (lw + 26) / 2;
        g.fillStyle = ink; g.beginPath(); g.moveTo(ix + 3, y + btnH / 2 - 8); g.lineTo(ix + 16, y + btnH / 2); g.lineTo(ix + 3, y + btnH / 2 + 8); g.closePath(); g.fill();
        ctx.text(g, label, ix + 26, y + btnH / 2 + 1, { size: 17, weight: 800, color: ink, align: 'left', maxW: btnW - 50 });
        again = { x: ax + aw / 2, y: ay + y + btnH / 2 };
        g.restore();
      }

      return {
        layout: function () {
          var r = ctx.fit(ASPECT, { maxW: 520 });
          ax = r.x; ay = r.y; aw = r.w; ah = r.h;
          k = ctx.clamp(aw / 340, 0.75, 1.3); R = Math.round(26 * Math.min(1, k + 0.1));
          bgN = bgLayer(false); bgB = null;
          sprites();
        },

        update: function (dt) {
          phaseT += dt; appearT += dt; twT += dt;
          reload = Math.min(1, reload + dt / 0.12);
          if (cool > 0) cool -= dt;
          if (phase === 'ready' || phase === 'over') spinStep(T, dt);
          else if (phase === 'play') {
            spinStep(T, dt);
            var cy = CY + T.st.radius;
            for (var i = 0; i < flying.length; i++) flying[i] -= FLY * dt;
            while (flying.length && flying[0] <= cy && phase === 'play') { flying.shift(); land(); }
          } else if (phase === 'clear') { clearT += dt; if (clearT > 0.95) { setTarget(T.st.n + 1); phase = 'play'; } }
          if (phase === 'over' && phaseT > 1.6) toResult();
          else if (phase === 'result' && phaseT > 4.2) toReady();
          for (var j = pieces.length - 1; j >= 0; j--) {
            var p = pieces[j]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.k === 3 ? 1.6 : 2.6) * dt; p.rot += p.spin * dt;
            if (p.t > p.life) pieces.splice(j, 1);
          }
          if (bounce) { bounce.x += bounce.vx * dt; bounce.y += bounce.vy * dt; bounce.vy += 2.6 * dt; bounce.rot += bounce.spin * dt; }
          knock *= Math.exp(-dt * 16);
          if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
          if (flashT > 0) flashT = Math.max(0, flashT - dt);
        },

        draw: function (g) {
          var w = aw, h = ah, i, L = LEN * w;
          g.save(); g.translate(ax, ay);
          if (!ctx.dark) {
            g.save(); g.shadowColor = 'rgba(16,20,16,.16)'; g.shadowBlur = 22; g.shadowOffsetY = 8;
            ctx.rrect(g, 0, 0, w, h, R); g.fillStyle = '#1A1D30'; g.fill(); g.restore();
          }
          ctx.rrect(g, 0, 0, w, h, R); g.clip();
          if (T.st.boss && !bgB) bgB = bgLayer(true);
          g.drawImage(T.st.boss ? bgB : bgN, 0, 0, w, h);
          for (i = 0; i < 14; i++) {
            g.fillStyle = 'rgba(255,255,255,' + (0.08 + 0.12 * (0.5 + 0.5 * Math.sin(twT * 2 + i))).toFixed(3) + ')';
            g.beginPath(); g.arc(((i * 0.37 + 0.11) % 1) * w, ((i * 0.53 + 0.07) % 1) * h, w * (0.004 + 0.003 * (i % 3)), 0, TAU); g.fill();
          }
          g.save();
          if (shakeT > 0) { var sk = shakeT / 0.35; g.translate(Math.sin(shakeT * 80) * w * 0.02 * sk, Math.cos(shakeT * 65) * w * 0.012 * sk); }
          var r = T.st.radius * w, cx = CX * w, cy = (CY - knock) * w;
          if (phase !== 'clear') {
            var ap = appearT < 0.5 ? ctx.ease.elasticOut(Math.min(1, appearT / 0.5)) : 1;
            g.save(); g.translate(cx, cy); g.scale(Math.max(0.01, ap), Math.max(0.01, ap));
            circ(g, 0, r * 0.06, r, 'rgba(0,0,0,.2)');
            for (i = 0; i < T.stuck.length; i++) {
              var sa = T.stuck[i] + T.rot;
              dartAt(g, T.preset[i] ? S.enemy : S.dart, Math.cos(sa) * (r - EMBED * w), Math.sin(sa) * (r - EMBED * w), sa, L, 1);
            }
            var ar = APPLE_R * w;
            for (i = 0; i < T.apples.length; i++) {
              var aa = T.apples[i] + T.rot, d = r + ar * 0.8;
              g.save(); g.translate(Math.cos(aa) * d, Math.sin(aa) * d); g.rotate(aa + PI / 2); g.drawImage(S.apple, -ar * 1.3, -ar * 1.3 - ar * 0.12, ar * 2.6, ar * 2.6); g.restore();
            }
            g.save(); g.rotate(T.rot); g.drawImage(S.target, -S.ts / 2, -S.ts / 2, S.ts, S.ts); g.restore();
            g.beginPath(); g.arc(0, 0, r * 0.8, PI * 1.1, PI * 1.45); g.lineWidth = r * 0.05; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.25)'; g.stroke();
            g.restore();
          }
          for (i = 0; i < pieces.length; i++) {
            var p = pieces[i], al = Math.max(0, Math.min(1, 1 - (p.t - p.life * 0.6) / (p.life * 0.4))), ox = p.x * w, oy = p.y * w;
            if (p.k === 0) {
              // a slice of the old target (its own sprite: the next target may already have other colours)
              var mid = p.a0 + TAU / 12, ccx = Math.cos(mid) * p.r * 0.5, ccy = Math.sin(mid) * p.r * 0.5;
              g.save(); g.translate(ox, oy); g.rotate(p.rot); g.translate(ccx, ccy); g.rotate(p.t * p.spin); g.translate(-ccx, -ccy);
              g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, p.r * 1.02, p.a0, p.a0 + TAU / 6); g.closePath(); g.clip();
              g.drawImage(p.img, -p.ts / 2, -p.ts / 2, p.ts, p.ts); g.restore();
            } else if (p.k === 1) dartAt(g, p.enemy ? S.enemy : S.dart, ox, oy, p.rot, L, al);
            else if (p.k === 2) { g.save(); g.translate(ox, oy); g.rotate(p.rot); paintApple(g, APPLE_R * w, p.half); g.restore(); }
            else { g.save(); g.translate(ox, oy); g.rotate(p.rot); g.globalAlpha = al; g.fillStyle = p.c; g.fillRect(-p.s * w * 0.8, -p.s * w * 0.5, p.s * w * 1.6, p.s * w); g.restore(); }
          }
          for (i = 0; i < flying.length; i++) {
            var fy = flying[i] * w;
            dartAt(g, S.dart, w / 2, fy, PI / 2, L, 1);
            var tg = g.createLinearGradient(0, fy + L, 0, fy + L * 1.6);
            tg.addColorStop(0, 'rgba(255,255,255,.35)'); tg.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = tg; g.fillRect(w / 2 - L * 0.02, fy + L, L * 0.04, L * 0.6);
          }
          var left = T.st.darts - T.thrown - flying.length;
          if ((phase === 'play' || phase === 'ready') && left > 0) {
            var kq = ctx.ease.outCubic(reload);
            dartAt(g, S.dart, w / 2, (THROW_Y + (1 - kq) * 0.12) * w, PI / 2, L, 0.4 + 0.6 * kq);
          }
          if (bounce) dartAt(g, S.dart, bounce.x * w, bounce.y * w, bounce.rot, L, 1);
          if (phase !== 'result') {
            var sl = 0.075 * w;
            for (i = 0; i < T.st.darts; i++) dartAt(g, S.small, w * 0.06, h - w * 0.07 - i * w * 0.042, 0, sl, i >= left ? 0.22 : 1);
          }
          var banner = null, bt = 0, bcol = '#FFFFFF';
          if ((phase === 'play' || phase === 'ready') && appearT < 1) { banner = T.st.boss ? ctx.t(TX.boss) : ctx.f(TX.stage, T.st.n); bt = appearT; bcol = T.st.boss ? '#FFB020' : '#FFFFFF'; }
          else if (phase === 'clear') { banner = ctx.t(TX.clear); bt = clearT; bcol = '#FFE066'; }
          else if (phase === 'over') { banner = ctx.t(TX.bounced); bt = phaseT; bcol = '#FF6B7A'; }
          if (banner) {
            var fade = phase === 'over' ? 1 : bt > 0.7 ? Math.max(0, 1 - (bt - 0.7) / 0.3) : 1, bs = 0.6 + 0.4 * ctx.ease.elasticOut(Math.min(1, bt / 0.45));
            g.save(); g.translate(w / 2, phase === 'over' ? h * 0.7 : h * 0.62); g.scale(bs, bs);
            ctx.text(g, banner, 0, 0, { size: w * 0.11, weight: 900, color: bcol, shadow: 'rgba(0,0,0,.6)', blur: 10, oy: 3, alpha: fade, maxW: w * 0.92 });
            g.restore();
          }
          g.restore();
          if (flashT > 0) { g.globalAlpha = 0.45 * Math.min(1, flashT / 0.3); g.fillStyle = flashCol; g.fillRect(0, 0, w, h); g.globalAlpha = 1; }
          if (phase === 'result') resultCard(g); else hud(g);
          g.restore();
        },

        down: function (p) {
          var ux = (p.x - ax) / aw, uy = (p.y - ay) / aw;
          if (ux < -0.03 || ux > 1.03 || uy < -0.03 || uy > 1 / ASPECT + 0.03) return;
          if (phase === 'result') { if (phaseT > 0.45) { toReady(); startRound(); ctx.sfx.click(); ctx.haptic('light'); } return; }
          if (phase === 'ready') startRound();
          if (phase === 'play') throwDart();
        },
        key: function (e) { if (e.key === ' ' || e.key === 'ArrowUp') this.down({ id: 0, x: ax + aw / 2, y: ay + ah * 0.8 }); },

        // just above the waiting dart (tap anywhere throws it); the replay button on the result card
        hint: function () {
          if (phase === 'ready' || phase === 'play') return { x: ax + aw / 2, y: ay + 1.27 * aw };
          return phase === 'result' && again && phaseT > 0.45 ? { x: again.x, y: again.y } : null;
        },

        debug: function () {
          var h = this.hint();
          return { phase: phase, stage: T.st.n, spin: T.st.spin, score: score, darts: darts, apples: apples, left: T.st.darts - T.thrown,
            stuck: T.stuck.length, safe: safeNow(), best: ctx.getBest(), arena: { x: ax, y: ay, w: aw, h: ah },
            targets: h ? [{ x: Math.round(h.x), y: Math.round(h.y) }] : [] };
        },

        destroy: function () { bgN = bgB = null; S = {}; pieces.length = flying.length = 0; }
      };
    }
  };
})();
