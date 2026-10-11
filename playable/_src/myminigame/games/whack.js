/* 두더지 잡기 (whack): my_mini/lib/games/list/whack.dart 를 옮긴 것(그림 · 색 · 판정 · 소리 순간이 앱과 같다).
   3x3 흙 둔덕에서 두더지가 쏙: 콩! 황금 두더지는 보너스, 토끼는 치면 감점 + 시간 감소, 연달아 맞히면 콤보 배수.
   플레이어블: 처음 닿기 전엔 구경 판(시간이 안 흐름, 힌트가 올라온 두더지를 가리킴) → 첫 터치로 30초 판 시작
   → '시간 끝!' → 결과 카드(새 기록이면 색종이) → 4초 뒤 다시 구경 판(결과 카드를 누르면 바로 새 판). 막다른 곳이 없다. */
(function () {
  'use strict';

  var TX = {
    go: { ko: '시작!', ja: 'スタート！', en: 'Go!' },
    combo: { ko: '{0} 콤보!', ja: '{0}コンボ！', en: '{0} combo!' },
    timeUp: { ko: '시간 끝!', ja: 'タイムアップ！', en: 'Time’s up!' },
    newBest: { ko: '새 기록!', ja: '新記録！', en: 'New best!' },
    summary: { ko: '두더지 {0}마리 · 최고 콤보 {1}', ja: 'もぐら{0}匹・最大コンボ{1}', en: '{0} moles · Best combo {1}' },
    score: { ko: '점수', ja: 'スコア', en: 'Score' },
    best: { ko: '최고 기록', ja: 'ベスト', en: 'Best' },
    again: { ko: '다시 하기', ja: 'もう一回', en: 'Play again' }
  };

  var TAU = Math.PI * 2;
  var ASPECT = 0.62, RISE = 0.14, FALL = 0.16, HIT = 0.34, DURATION = 30, BUNNY_PTS = 30, BUNNY_SEC = 3;
  var HUD_INK = '#3B2A1E';

  /* ---------- rules (WhackField). Units: arena width = 1, height = 1 / ASPECT ---------- */
  function newField(demo) {
    var f = { demo: demo, holes: [], elapsed: 0, penalty: 0, score: 0, combo: 0, bestCombo: 0, hits: 0, spawnIn: 0.45 };
    for (var i = 0; i < 9; i++) f.holes.push({ kind: 'mole', state: 'hidden', t: 0, stay: 1, cool: 0, escaped: false });
    return f;
  }
  function timeLeft(f) { return Math.max(0, DURATION - f.elapsed - f.penalty); }
  function isOver(f) { return !f.demo && timeLeft(f) <= 0; }
  function level(f) { return Math.min(1, Math.max(0, f.elapsed / DURATION)); }
  function spawnGap(f) { return f.demo ? 1.0 : 0.92 - 0.52 * level(f); }
  function stayTime(f) { return f.demo ? 1.3 : 1.1 - 0.5 * level(f); }
  function maxUp(f) { return f.demo ? 2 : 1 + Math.min(2, Math.floor(level(f) * 3)); }
  function mult(combo) { return 1 + Math.floor(Math.min(combo, 15) / 5); }
  function holeCenter(i) { return [0.2 + 0.3 * (i % 3), 0.68 + 0.31 * Math.floor(i / 3)]; }
  function holeAt(ux, uy) {
    for (var i = 0; i < 9; i++) {
      var c = holeCenter(i);
      if (Math.abs(ux - c[0]) <= 0.15 && uy >= c[1] - 0.23 && uy <= c[1] + 0.07) return i;
    }
    return -1;
  }
  function busy(h) { return h.state !== 'hidden' || h.cool > 0; }
  function hittable(h) {
    return h.state === 'rising' ? h.t >= RISE * 0.25 : h.state === 'up' ? true : h.state === 'falling' ? h.t <= FALL * 0.6 : false;
  }
  function upCount(f) { var n = 0; f.holes.forEach(function (h) { if (h.state !== 'hidden' && h.state !== 'hit') n++; }); return n; }
  function spawn(f) {
    if (upCount(f) >= maxUp(f)) return -1;
    var free = [];
    for (var i = 0; i < 9; i++) if (!busy(f.holes[i])) free.push(i);
    if (!free.length) return -1;
    var idx = free[Math.floor(Math.random() * free.length)], h = f.holes[idx], r = Math.random();
    var bunnyChance = f.demo ? 0.15 : (f.elapsed < 4 ? 0 : 0.12 + 0.1 * level(f));
    h.kind = r < 0.07 ? 'gold' : r < 0.07 + bunnyChance ? 'bunny' : 'mole';
    h.state = 'rising'; h.t = 0; h.escaped = false;
    h.stay = stayTime(f) * (0.85 + 0.3 * Math.random()) * (h.kind === 'gold' ? 0.7 : h.kind === 'bunny' ? 1.25 : 1);
    return idx;
  }
  // returns how many moles escaped this step (that breaks the combo)
  function step(f, dt) {
    var escaped = 0;
    if (!f.demo) f.elapsed += dt;
    f.holes.forEach(function (h) {
      h.t += dt;
      if (h.state === 'hidden') { if (h.cool > 0) h.cool -= dt; }
      else if (h.state === 'rising') { if (h.t >= RISE) { h.state = 'up'; h.t = 0; } }
      else if (h.state === 'up') {
        if (h.t >= h.stay) { h.state = 'falling'; h.t = 0; if (h.kind !== 'bunny' && !f.demo) { h.escaped = true; escaped++; } }
      } else if (h.state === 'falling') { if (h.t >= FALL) { h.state = 'hidden'; h.t = 0; h.cool = 0.25; } }
      else if (h.state === 'hit') { if (h.t >= HIT) { h.state = 'hidden'; h.t = 0; h.cool = 0.3; } }
    });
    if (escaped) f.combo = 0;
    if (isOver(f)) return escaped;
    f.spawnIn -= dt;
    if (f.spawnIn <= 0) {
      f.spawnIn = spawnGap(f) * (0.75 + 0.5 * Math.random());
      spawn(f);
      if (!f.demo && level(f) > 0.45 && Math.random() < 0.25 + 0.3 * level(f)) spawn(f);
    }
    return escaped;
  }
  function whack(f, i) {
    if (isOver(f)) return null;
    var h = f.holes[i];
    if (!hittable(h)) return null;
    h.state = 'hit'; h.t = 0;
    if (h.kind === 'bunny') {
      f.combo = 0; f.score = Math.max(0, f.score - BUNNY_PTS); f.penalty += BUNNY_SEC;
      return { kind: 'bunny', points: -BUNNY_PTS, combo: 0, mult: 1 };
    }
    f.combo++; f.bestCombo = Math.max(f.bestCombo, f.combo); f.hits++;
    var pts = (h.kind === 'gold' ? 50 : 10) * mult(f.combo);
    f.score += pts;
    return { kind: h.kind, points: pts, combo: f.combo, mult: mult(f.combo) };
  }
  function hideAll(f) { f.holes.forEach(function (h) { if (h.state === 'rising' || h.state === 'up') { h.state = 'falling'; h.t = 0; } }); }

  /* ---------- drawing (same shapes and colours as the app's painters) ---------- */
  function oval(g, x, y, w, h) { g.beginPath(); g.ellipse(x, y, Math.max(0.01, w / 2), Math.max(0.01, h / 2), 0, 0, TAU); }
  function star(g, x, y, r, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
    for (var i = 0; i < 10; i++) { var rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5; if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill(); g.restore();
  }

  var KINDS = {
    mole: ['#A26C47', '#7C4E31', '#EBC8A2', '#4A2E1C'],
    gold: ['#FFD84D', '#F0A114', '#FFF3C4', '#9A5B00'],
    bunny: ['#FFFFFF', '#E9E4F0', '#FFFFFF', '#7A6E86']
  };

  // one critter; (cx, baseY) is the bottom centre of the body, s the body width; face 0 normal, 1 bonked, 2 teasing, 3 crying
  function drawCritter(ctx, g, cx, baseY, s, kind, face, squash) {
    var bh = s * 1.12 * squash, top = baseY - bh, col = KINDS[kind], out = col[3];
    g.lineJoin = 'round'; g.lineCap = 'butt';
    if (kind === 'bunny') {
      [-1, 1].forEach(function (side) {
        g.save(); g.translate(cx + side * s * 0.2, top + s * 0.08); g.rotate(side * (face === 1 || face === 3 ? 0.5 : 0.14));
        ctx.rrect(g, -s * 0.12, -s * 0.66, s * 0.24, s * 0.72, s * 0.12);
        g.fillStyle = '#FFFFFF'; g.fill(); g.lineWidth = s * 0.04; g.strokeStyle = out; g.stroke();
        ctx.rrect(g, -s * 0.055, -s * 0.56, s * 0.11, s * 0.5, s * 0.06); g.fillStyle = '#FFB3C7'; g.fill();
        g.restore();
      });
    }
    var L = cx - s / 2, B = baseY + s * 0.5;
    ctx.rrect(g, L, top, s, B - top, [s / 2, s / 2, s * 0.2, s * 0.2]);
    var gr = g.createLinearGradient(L, top, L + s, B); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
    g.fillStyle = gr; g.fill(); g.lineWidth = s * 0.04; g.strokeStyle = out; g.stroke();
    if (kind !== 'bunny') { oval(g, cx - s * 0.2, top + s * 0.2, s * 0.18, s * 0.1); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); }
    if (kind === 'gold') {
      g.beginPath();
      g.moveTo(cx - s * 0.22, top + s * 0.02); g.lineTo(cx - s * 0.26, top - s * 0.2); g.lineTo(cx - s * 0.11, top - s * 0.08);
      g.lineTo(cx, top - s * 0.26); g.lineTo(cx + s * 0.11, top - s * 0.08); g.lineTo(cx + s * 0.26, top - s * 0.2); g.lineTo(cx + s * 0.22, top + s * 0.02);
      g.closePath(); g.fillStyle = '#FFE27A'; g.fill(); g.stroke();
      g.beginPath(); g.arc(cx, top - s * 0.07, s * 0.035, 0, TAU); g.fillStyle = '#FF4D6D'; g.fill();
    }
    var my = top + bh * 0.62;
    oval(g, cx, my, s * 0.62, s * 0.4); g.fillStyle = col[2]; g.fill();
    if (kind === 'bunny') { g.lineWidth = s * 0.025; g.stroke(); }
    [-1, 1].forEach(function (side) { oval(g, cx + side * s * 0.3, top + bh * 0.52, s * 0.14, s * 0.08); g.fillStyle = 'rgba(255,127,160,.55)'; g.fill(); });
    var ey = top + bh * 0.36;
    g.strokeStyle = '#231815'; g.lineWidth = s * 0.045; g.lineCap = 'round';
    [-1, 1].forEach(function (side) {
      var ex = cx + side * s * 0.17;
      if (face === 1 || face === 3) {
        var d = s * 0.055;
        g.beginPath(); g.moveTo(ex - d, ey - d); g.lineTo(ex + d, ey + d); g.moveTo(ex - d, ey + d); g.lineTo(ex + d, ey - d); g.stroke();
      } else if (face === 2) {
        g.beginPath(); g.ellipse(ex, ey + s * 0.02, s * 0.06, s * 0.05, 0, Math.PI, TAU); g.stroke();
      } else {
        g.beginPath(); g.arc(ex, ey, s * 0.062, 0, TAU); g.fillStyle = '#231815'; g.fill();
        g.beginPath(); g.arc(ex - s * 0.02, ey - s * 0.022, s * 0.022, 0, TAU); g.fillStyle = '#FFFFFF'; g.fill();
      }
    });
    var ny = my - s * 0.08;
    oval(g, cx, ny, kind === 'bunny' ? s * 0.1 : s * 0.17, kind === 'bunny' ? s * 0.07 : s * 0.12); g.fillStyle = '#FF6F91'; g.fill();
    g.beginPath(); g.arc(cx - s * 0.025, ny - s * 0.02, s * 0.018, 0, TAU); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    g.strokeStyle = out; g.lineWidth = s * 0.03;
    if (face === 1 || face === 3) {
      oval(g, cx, my + s * 0.09, s * 0.11, s * 0.12); g.fillStyle = '#7A2E2E'; g.fill();
    } else if (face === 2) {
      g.beginPath(); g.ellipse(cx, my + s * 0.04, s * 0.1, s * 0.05, 0, 0, Math.PI); g.stroke();
      oval(g, cx + s * 0.03, my + s * 0.12, s * 0.1, s * 0.12); g.fillStyle = '#FF5C7A'; g.fill();
    } else if (kind === 'bunny') {
      g.beginPath(); g.ellipse(cx - s * 0.045, my + s * 0.02, s * 0.045, s * 0.04, 0, 0, Math.PI); g.stroke();
      g.beginPath(); g.ellipse(cx + s * 0.045, my + s * 0.02, s * 0.045, s * 0.04, 0, 0, Math.PI); g.stroke();
    } else {
      g.fillStyle = '#FFFFFF';
      ctx.rrect(g, cx - s * 0.06, my, s * 0.055, s * 0.08, s * 0.015); g.fill();
      ctx.rrect(g, cx + s * 0.005, my, s * 0.055, s * 0.08, s * 0.015); g.fill();
    }
    if (kind !== 'bunny') {
      g.strokeStyle = ctx.rgba(out, 0.6); g.lineWidth = s * 0.018; g.beginPath();
      [-1, 1].forEach(function (side) {
        for (var k = -1; k <= 1; k++) { g.moveTo(cx + side * s * 0.2, my + k * s * 0.04); g.lineTo(cx + side * s * 0.42, my + k * s * 0.07 - s * 0.01); }
      });
      g.stroke();
    }
    if (face === 3) [-1, 1].forEach(function (side) { oval(g, cx + side * s * 0.24, ey + s * 0.12, s * 0.06, s * 0.1); g.fillStyle = '#7CC8FF'; g.fill(); });
  }

  // toy mallet; (px, py) is where the head lands, raise 0 = struck down
  function drawMallet(ctx, g, px, py, w, raise, alpha) {
    var len = w * 0.24;
    g.save(); g.globalAlpha *= Math.max(0, Math.min(1, alpha));
    g.translate(px + 0.82 * len, py + 0.57 * len); g.rotate(-0.963 + raise);
    g.lineWidth = w * 0.008; g.strokeStyle = '#6B2A1A';
    ctx.rrect(g, -w * 0.016, -len, w * 0.032, len + w * 0.02, w * 0.016); g.fillStyle = '#F2C27B'; g.fill(); g.stroke();
    var hw = w * 0.2, hh = w * 0.115, hx = -hw / 2, hy = -len - hh / 2;
    var gr = g.createLinearGradient(0, hy, 0, hy + hh); gr.addColorStop(0, '#FF6B7A'); gr.addColorStop(1, '#E02E45');
    ctx.rrect(g, hx, hy, hw, hh, w * 0.035); g.fillStyle = gr; g.fill();
    g.fillStyle = '#FFD34D'; g.fillRect(hx + w * 0.02, hy, w * 0.028, hh); g.fillRect(hx + hw - w * 0.048, hy, w * 0.028, hh);
    ctx.rrect(g, hx + w * 0.05, hy + w * 0.015, hw - w * 0.1, w * 0.022, w * 0.011); g.fillStyle = 'rgba(255,255,255,.4)'; g.fill();
    ctx.rrect(g, hx, hy, hw, hh, w * 0.035); g.stroke();
    g.restore();
  }

  // static part of a hole (cached in the background layer)
  function drawMound(g, cx, cy, w) {
    var rx = 0.115 * w, ry = 0.042 * w;
    oval(g, cx, cy + ry * 1.5, rx * 2.9, ry * 2.6); g.fillStyle = 'rgba(0,0,0,.133)'; g.fill();
    oval(g, cx, cy + ry * 0.55, rx * 2.7, ry * 3.7); g.fillStyle = '#9C6B3E'; g.fill();
    oval(g, cx, cy + ry * 0.05, rx * 2.4, ry * 2.9); g.fillStyle = '#BC8752'; g.fill();
    oval(g, cx, cy, rx * 2, ry * 2); g.fillStyle = '#3A2214'; g.fill();
    oval(g, cx, cy + ry * 0.3, rx * 1.7, ry * 1.3); g.fillStyle = '#24140B'; g.fill();
  }
  function drawHoleFront(ctx, g, cx, cy, w, kind, rise, face, squash) {
    var rx = 0.115 * w, ry = 0.042 * w, s = 0.165 * w;
    if (kind && rise > 0) {
      var extra = kind === 'bunny' ? s * 0.62 : kind === 'gold' ? s * 0.28 : 0;
      var base = cy + ry * 0.6 + (1 - rise) * (s * 1.12 + ry * 1.6 + extra);
      g.save();
      g.beginPath(); g.rect(cx - rx * 1.8, cy - s * 2.4, rx * 3.6, s * 2.4); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.clip();
      drawCritter(ctx, g, cx, base, s, kind, face, squash);
      g.restore();
    }
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0.08, Math.PI - 0.08);
    g.lineWidth = ry * 0.55; g.lineCap = 'round'; g.strokeStyle = '#C99460'; g.stroke();
  }

  // sky, sun, clouds, hills, grass stripes, tufts and flowers
  function drawField(g, w, h) {
    var gr = g.createLinearGradient(0, 0, 0, h * 0.32); gr.addColorStop(0, '#7FCBFF'); gr.addColorStop(1, '#D3F0FF');
    g.fillStyle = gr; g.fillRect(0, 0, w, h * 0.32);
    g.fillStyle = 'rgba(255,242,176,.333)'; g.beginPath(); g.arc(w * 0.86, h * 0.13, w * 0.07, 0, TAU); g.fill();
    g.fillStyle = '#FFE680'; g.beginPath(); g.arc(w * 0.86, h * 0.13, w * 0.05, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.92)';
    [[0.18, 0.15, 1], [0.55, 0.19, 0.8]].forEach(function (q) {
      var ox = w * q[0], oy = h * q[1], r = w * 0.05 * q[2];
      g.beginPath(); g.arc(ox, oy, r, 0, TAU); g.fill();
      g.beginPath(); g.arc(ox + r * 1.1, oy + r * 0.25, r * 0.8, 0, TAU); g.fill();
      g.beginPath(); g.arc(ox - r, oy + r * 0.3, r * 0.7, 0, TAU); g.fill();
      g.beginPath(); var x0 = ox - r * 1.6, x1 = ox + r * 1.8, y0 = oy, y1 = oy + r * 0.85, rr = r * 0.4;
      g.moveTo(x0 + rr, y0); g.arcTo(x1, y0, x1, y1, rr); g.arcTo(x1, y1, x0, y1, rr); g.arcTo(x0, y1, x0, y0, rr); g.arcTo(x0, y0, x1, y0, rr); g.fill();
    });
    g.beginPath(); g.moveTo(0, h * 0.27); g.quadraticCurveTo(w * 0.3, h * 0.2, w * 0.62, h * 0.26); g.quadraticCurveTo(w * 0.85, h * 0.3, w, h * 0.24);
    g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = '#93DB6A'; g.fill();
    var fr = g.createLinearGradient(0, h * 0.27, 0, h); fr.addColorStop(0, '#79D45A'); fr.addColorStop(1, '#4DB548');
    g.beginPath(); g.moveTo(0, h * 0.33); g.quadraticCurveTo(w * 0.5, h * 0.27, w, h * 0.33); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = fr; g.fill();
    g.fillStyle = 'rgba(255,255,255,.06)';
    for (var i = 0; i < 4; i++) g.fillRect(0, h * (0.4 + i * 0.16), w, h * 0.07);
    g.strokeStyle = '#3E9E3E'; g.lineWidth = w * 0.008; g.lineCap = 'round'; g.beginPath();
    [[0.06, 0.37], [0.35, 0.36], [0.65, 0.37], [0.94, 0.4], [0.07, 0.56], [0.93, 0.6], [0.35, 0.52], [0.65, 0.71], [0.06, 0.78], [0.94, 0.8], [0.35, 0.93], [0.66, 0.95], [0.5, 0.47]].forEach(function (q) {
      var x = w * q[0], y = h * q[1];
      g.moveTo(x, y); g.lineTo(x - w * 0.012, y - w * 0.025); g.moveTo(x, y); g.lineTo(x, y - w * 0.032); g.moveTo(x, y); g.lineTo(x + w * 0.012, y - w * 0.025);
    });
    g.stroke();
    [[0.08, 0.47, '#FFFFFF'], [0.92, 0.5, '#FFD1E0'], [0.5, 0.66, '#FFFFFF'], [0.08, 0.89, '#FFE680'], [0.92, 0.9, '#FFFFFF']].forEach(function (q) {
      var x = w * q[0], y = h * q[1];
      g.fillStyle = q[2];
      for (var k = 0; k < 5; k++) { var a = k * TAU / 5; g.beginPath(); g.arc(x + Math.cos(a) * w * 0.012, y + Math.sin(a) * w * 0.012, w * 0.009, 0, TAU); g.fill(); }
      g.fillStyle = '#FFB020'; g.beginPath(); g.arc(x, y, w * 0.007, 0, TAU); g.fill();
    });
  }

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

  GAMES['whack'] = {
    name: { ko: '두더지 잡기', ja: 'もぐらたたき', en: 'Mole Bop' },
    tip: { ko: '두더지는 콩, 토끼는 꾹 참아요', ja: 'もぐらはポカッ、うさぎはガマン', en: 'Bonk the moles, spare the bunny' },
    color: '#8D6E4A',
    kind: 'arcade',
    make: function (ctx) {
      var ax = 0, ay = 0, aw = 300, ah = 484, k = 1, R = 26, bg = null;
      var f = newField(true), phase = 'ready', phaseT = 0, goT = 9, comboT = 9, comboShown = 0;
      var shakeT = 0, flashT = 0, lastSec = 99, res = null, again = null, hintHole = -1;
      var dust = [], drops = [], mallets = [], rings = [];

      function A(ux, uy) { return { x: ax + ux * aw, y: ay + uy * aw }; }

      function startRound() {
        // the demo field becomes the real one: a mole that is up right now can be hit by this very tap
        f.demo = false; f.elapsed = 0; f.penalty = 0; f.score = 0; f.combo = 0; f.bestCombo = 0; f.hits = 0; f.spawnIn = 0.35;
        phase = 'play'; phaseT = 0; goT = 0; lastSec = 99; comboShown = 0; res = null;
        ctx.sfx.beep(true);
      }
      function toReady() { f = newField(true); phase = 'ready'; phaseT = 0; res = null; again = null; comboShown = 0; hintHole = -1; }
      function end() {
        phase = 'over'; phaseT = 0; hideAll(f);
        ctx.sfx.stamp(); ctx.haptic('heavy');
        var b = f.score > 0 ? ctx.best(f.score) : { best: ctx.getBest(), isNew: false };
        res = { score: f.score, hits: f.hits, combo: f.bestCombo, best: b.best, isNew: b.isNew };
      }
      function toResult() {
        phase = 'result'; phaseT = 0;
        if (res.isNew) { ctx.sfx.win(); ctx.sfx.sparkle(); ctx.haptic('success'); ctx.fx.burst(ax + aw / 2, ay + ah * 0.42, 90, ctx.PAL, { speed: 720 }); }
        else ctx.sfx.ding();
      }

      function puff(ux, uy) {
        for (var i = 0; i < 7; i++) {
          var a = Math.PI + i / 6 * Math.PI + (Math.random() - 0.5) * 0.3, sp = 0.25 + 0.2 * Math.random();
          dust.push({ x: ux, y: uy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, s: 0.02 + 0.012 * Math.random(), t: 0 });
        }
      }
      function onHit(i, r) {
        var c = holeCenter(i), hx = c[0], hy = c[1] - 0.15, P = A(hx, hy);
        mallets.push({ x: hx, y: hy, t: 0 });
        if (r.kind === 'bunny') {
          ctx.sfx.buzz(); ctx.sfx.boing(); ctx.haptic('error');
          shakeT = 0.32; flashT = 0.4; comboShown = 0;
          ctx.fx.text(P.x, P.y - 0.04 * aw, '-' + BUNNY_PTS, { color: '#FF5C6C', size: 0.085 * aw, rise: 0.22 * aw });
          var T2 = A(0.5, 0.22);
          ctx.fx.text(T2.x, T2.y, '-' + BUNNY_SEC + 's', { color: '#FF5C6C', size: 0.07 * aw, rise: 0.22 * aw });
          for (var d = 0; d < 6; d++) { var a = -Math.PI / 2 + (d - 2.5) * 0.45; drops.push({ x: hx, y: hy, vx: Math.cos(a) * 0.45, vy: Math.sin(a) * 0.55, t: 0 }); }
        } else if (r.kind === 'gold') {
          ctx.sfx.hit(2); ctx.sfx.coin(); ctx.sfx.sparkle(); ctx.haptic('medium');
          rings.push({ x: hx, y: hy, c: '#FFD34D', r: 0.2, t: 0 });
          ctx.fx.stars(P.x, P.y, 12, ['#FFD34D', '#FFFFFF', '#FFB020'], { speed: 0.9 * aw, size: 0.026 * aw, gravity: 1.3 * aw });
          ctx.fx.text(P.x, P.y - 0.05 * aw, '+' + r.points, { color: '#FFD34D', size: 0.1 * aw, rise: 0.22 * aw });
        } else {
          ctx.sfx.hit(r.mult >= 2 ? 2 : 1); ctx.haptic(r.mult >= 2 ? 'medium' : 'light');
          rings.push({ x: hx, y: hy, c: '#FFFFFF', r: 0.14, t: 0 });
          ctx.fx.stars(P.x, P.y, 7, ['#FFE066', '#FFFFFF'], { speed: 0.7 * aw, size: 0.026 * aw, gravity: 1.3 * aw });
          ctx.fx.text(P.x, P.y - 0.05 * aw, '+' + r.points, { color: '#FFFFFF', size: 0.08 * aw, rise: 0.22 * aw });
        }
        if (r.combo >= 2) ctx.sfx.note(Math.min(3, Math.floor((r.combo - 2) / 2)), 0.45);
        if (r.combo >= 3) { comboShown = r.combo; comboT = 0; }
        if (r.combo >= 5 && r.combo % 5 === 0 && r.combo <= 15) { ctx.sfx.sparkle(); ctx.haptic('medium'); }
      }

      function hud(g) {
        var left = timeLeft(f), m = mult(f.combo), low = phase === 'play' && left <= 10, best = ctx.getBest();
        var h = 36 * k, pad = 12 * k, y = 10 * k, gap = 8 * k;
        var sTxt = ctx.comma(f.score), tTxt = left < 10 ? left.toFixed(1) : String(Math.ceil(left)), bTxt = best === null ? '-' : ctx.comma(best);
        g.font = ctx.font(22 * k, 900); var sw = g.measureText(sTxt).width + (m > 1 ? 40 * k : 0);
        g.font = ctx.font(20 * k, 900); var tw = 22 * k + g.measureText(left < 10 ? '0.0' : '00').width;
        g.font = ctx.font(16 * k, 800); var bw = 22 * k + g.measureText(bTxt).width;
        var w1 = sw + pad * 2, w2 = tw + pad * 2, w3 = bw + pad * 2, room = aw - 20 * k;
        var sc = Math.min(1, room / (w1 + w2 + w3 + gap * 2));
        g.save(); g.translate(10 * k, y); g.scale(sc, sc);
        var full = room / sc;
        function pill(x, w) {
          g.save(); g.shadowColor = 'rgba(0,0,0,.13)'; g.shadowBlur = 8; g.shadowOffsetY = 2;
          ctx.rrect(g, x, 0, w, h, h / 2); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill(); g.restore();
        }
        pill(0, w1);
        ctx.text(g, sTxt, pad, h / 2 + 1, { size: 22 * k, weight: 900, color: HUD_INK, align: 'left' });
        if (m > 1) {
          var bx = w1 - pad - 34 * k;
          ctx.rrect(g, bx, h / 2 - 11 * k, 34 * k, 22 * k, 8 * k); g.fillStyle = '#FF7A3D'; g.fill();
          ctx.text(g, '×' + m, bx + 17 * k, h / 2 + 1, { size: 13 * k, weight: 900, color: '#FFFFFF' });
        }
        var x2 = (full - w2) / 2;
        pill(x2, w2);
        iconTimer(g, x2 + pad + 9 * k, h / 2, 18 * k, low ? '#E5484D' : HUD_INK);
        ctx.text(g, tTxt, x2 + pad + 22 * k, h / 2 + 1, { size: 20 * k, weight: 900, color: low ? '#E5484D' : HUD_INK, align: 'left' });
        var x3 = full - w3;
        pill(x3, w3);
        iconTrophy(ctx, g, x3 + pad + 9 * k, h / 2, 18 * k, '#E0A526');
        ctx.text(g, bTxt, x3 + pad + 22 * k, h / 2 + 1, { size: 16 * k, weight: 800, color: HUD_INK, align: 'left' });
        g.restore();
      }

      // result card, like the app's ResultView (title, summary, score / best boxes, "play again" in the game colour)
      function resultCard(g) {
        var t = Math.min(1, phaseT / 0.3), e = ctx.ease.outBack(t), C = ctx.C;
        g.fillStyle = 'rgba(0,0,0,' + (0.3 * t).toFixed(3) + ')'; g.fillRect(0, 0, aw, ah);
        var cw = Math.min(aw - 24, 320), pad = 18, ch = 250, cx = (aw - cw) / 2, cy = (ah - ch) / 2;
        g.save(); g.globalAlpha = t; g.translate(aw / 2, ah / 2); g.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e); g.translate(-aw / 2, -ah / 2);
        g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
        ctx.rrect(g, cx, cy, cw, ch, 24); g.fillStyle = C.surface; g.fill(); g.restore();
        g.lineWidth = 1; g.strokeStyle = C.hair; ctx.rrect(g, cx + 0.5, cy + 0.5, cw - 1, ch - 1, 24); g.stroke();
        var y = cy + pad + 16;
        ctx.text(g, ctx.t(res.isNew ? TX.newBest : TX.timeUp), aw / 2, y, { size: 26, weight: 900, color: C.ink, maxW: cw - pad * 2 });
        y += 28;
        ctx.text(g, ctx.f(TX.summary, res.hits, res.combo), aw / 2, y, { size: 14, weight: 600, color: C.soft, maxW: cw - pad * 2 });
        y += 18;
        var bw = (cw - pad * 2 - 10) / 2, bh = 72;
        [[TX.score, ctx.comma(res.score), res.isNew], [TX.best, res.best === null ? '-' : ctx.comma(res.best), false]].forEach(function (b, i) {
          var bx = cx + pad + i * (bw + 10);
          ctx.rrect(g, bx, y, bw, bh, 16);
          g.fillStyle = b[2] ? ctx.rgba(ctx.color, 0.14) : C.surface; g.fill();
          g.lineWidth = 1.4; g.strokeStyle = b[2] ? ctx.color : C.hair; g.stroke();
          ctx.text(g, ctx.t(b[0]), bx + bw / 2, y + 20, { size: 13, weight: 700, color: C.soft, maxW: bw - 16 });
          ctx.text(g, b[1], bx + bw / 2, y + 48, { size: 27, weight: 900, color: C.ink, maxW: bw - 16 });
        });
        y += bh + 16;
        var btnW = cw - pad * 2, btnH = 50, bx2 = cx + pad;
        ctx.rrect(g, bx2, y, btnW, btnH, 18); g.fillStyle = ctx.color; g.fill();
        var ink = ctx.inkOn(ctx.color), label = ctx.t(TX.again);
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
          bg = ctx.layer(aw, ah, function (c) {
            drawField(c, aw, ah);
            for (var i = 0; i < 9; i++) { var hc = holeCenter(i); drawMound(c, hc[0] * aw, hc[1] * aw, aw); }
          });
        },

        update: function (dt) {
          phaseT += dt;
          if (phase === 'ready') step(f, dt);
          else if (phase === 'play') {
            goT += dt;
            if (step(f, dt)) comboShown = 0;
            var sec = Math.ceil(timeLeft(f));
            if (sec < lastSec) {
              lastSec = sec;
              if (sec <= 10 && sec > 0) { ctx.sfx.tick(sec % 2 === 0); if (sec <= 3) ctx.sfx.beep(false); }
            }
            if (isOver(f)) end();
          } else if (phase === 'over') {
            step(f, dt);
            if (phaseT > 1.7) toResult();
          } else if (phase === 'result' && phaseT > 4.2) toReady();
          comboT += dt;
          if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
          if (flashT > 0) flashT = Math.max(0, flashT - dt);
          var i, p, damp = Math.pow(0.02, dt);
          for (i = dust.length - 1; i >= 0; i--) { p = dust[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= damp; p.vy *= damp; if (p.t >= 0.4) dust.splice(i, 1); }
          for (i = drops.length - 1; i >= 0; i--) { p = drops[i]; p.t += dt; p.vy += 1.3 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t >= 0.6) drops.splice(i, 1); }
          for (i = mallets.length - 1; i >= 0; i--) { mallets[i].t += dt; if (mallets[i].t >= 0.32) mallets.splice(i, 1); }
          for (i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t >= 0.3) rings.splice(i, 1); }
        },

        draw: function (g) {
          var w = aw, h = ah, i;
          g.save();
          g.translate(ax, ay);
          if (!ctx.dark) {
            g.save(); g.shadowColor = 'rgba(16,20,16,.16)'; g.shadowBlur = 22; g.shadowOffsetY = 8;
            ctx.rrect(g, 0, 0, w, h, R); g.fillStyle = '#4DB548'; g.fill(); g.restore();
          }
          ctx.rrect(g, 0, 0, w, h, R); g.clip();
          g.save();
          if (shakeT > 0) { var sk = shakeT / 0.32; g.translate(Math.sin(shakeT * 90) * w * 0.018 * sk, Math.cos(shakeT * 70) * w * 0.008 * sk); }
          if (bg) g.drawImage(bg, 0, 0, w, h);
          for (i = 0; i < 9; i++) {
            var hole = f.holes[i], c = holeCenter(i), rise = 0, face = 0, squash = 1;
            if (hole.state === 'rising') rise = ctx.ease.outBack(Math.min(1, hole.t / RISE));
            else if (hole.state === 'up') { rise = 1 + Math.sin(hole.t * 9) * 0.015; if (hole.kind !== 'bunny' && hole.t > hole.stay - 0.28 && !f.demo) face = 2; }
            else if (hole.state === 'falling') { rise = 1 - ctx.ease.inQuad(Math.min(1, hole.t / FALL)); if (hole.escaped) face = 2; }
            else if (hole.state === 'hit') {
              face = hole.kind === 'bunny' ? 3 : 1;
              if (hole.t < 0.09) { rise = 1; squash = 1 - 0.28 * ctx.ease.outQuad(hole.t / 0.09); }
              else { squash = 0.72 + 0.28 * Math.min(1, (hole.t - 0.09) / 0.12); rise = 1 - ctx.ease.inQuad(ctx.clamp((hole.t - 0.12) / 0.22, 0, 1)); }
            }
            drawHoleFront(ctx, g, c[0] * w, c[1] * w, w, hole.state === 'hidden' ? null : hole.kind, rise, face, squash);
            if (hole.kind === 'gold' && rise > 0.6 && hole.state !== 'hit') {
              var ph = hole.t * 6; g.fillStyle = 'rgba(255,255,255,.85)';
              star(g, c[0] * w - w * 0.1, c[1] * w - w * 0.17, w * 0.016 * (0.6 + 0.4 * Math.sin(ph)), ph);
              star(g, c[0] * w + w * 0.11, c[1] * w - w * 0.12, w * 0.013 * (0.6 + 0.4 * Math.cos(ph)), -ph);
            }
          }
          rings.forEach(function (r) {
            var q = r.t / 0.3;
            g.beginPath(); g.arc(r.x * w, r.y * w, Math.max(0.1, w * r.r * ctx.ease.outCubic(q)), 0, TAU);
            g.lineWidth = Math.max(0.1, w * 0.014 * (1 - q)); g.strokeStyle = ctx.rgba(r.c, (0.9 * (1 - q)).toFixed(3)); g.stroke();
          });
          dust.forEach(function (p) {
            var q = p.t / 0.4; g.fillStyle = 'rgba(201,162,122,' + (0.7 * (1 - q)).toFixed(3) + ')';
            g.beginPath(); g.arc(p.x * w, p.y * w, p.s * w * (1 + q * 1.4), 0, TAU); g.fill();
          });
          drops.forEach(function (p) {
            var q = p.t / 0.6; g.fillStyle = 'rgba(124,200,255,' + (1 - q).toFixed(3) + ')';
            oval(g, p.x * w, p.y * w, 0.018 * w, 0.018 * w * 1.4); g.fill();
          });
          mallets.forEach(function (m) {
            var t = m.t, raise = t < 0.05 ? 0.9 * (1 - ctx.ease.inQuad(t / 0.05)) : t < 0.13 ? 0.1 * Math.sin((t - 0.05) / 0.08 * Math.PI) : 0;
            drawMallet(ctx, g, m.x * w, m.y * w, w, raise, t < 0.2 ? 1 : 1 - (t - 0.2) / 0.12);
          });
          if (comboShown >= 3 && comboT < 1.1 && phase === 'play') {
            var t = comboT, sc = t < 0.15 ? 1.6 - 0.6 * (t / 0.15) : 1;
            g.save(); g.translate(w / 2, h * 0.255); g.scale(sc, sc);
            ctx.text(g, ctx.f(TX.combo, comboShown), 0, 0, { size: w * 0.075, weight: 900, color: comboShown >= 10 ? '#FFD34D' : '#FFFFFF',
              shadow: 'rgba(0,0,0,.53)', blur: 6, oy: 2, alpha: t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.3) : 1 });
            g.restore();
          }
          if (phase === 'play' && goT < 0.7) {
            g.save(); g.translate(w / 2, h * 0.5); var gs = 0.6 + 0.4 * ctx.ease.elasticOut(Math.min(1, goT / 0.4)); g.scale(gs, gs);
            ctx.text(g, ctx.t(TX.go), 0, 0, { size: w * 0.16, weight: 900, color: '#FFE066', shadow: 'rgba(0,0,0,.53)', blur: 6, oy: 2,
              alpha: goT > 0.45 ? Math.max(0, 1 - (goT - 0.45) / 0.25) : 1 });
            g.restore();
          }
          if (phase === 'over') {
            var ts = w * 0.12, label = ctx.t(TX.timeUp);
            g.font = ctx.font(ts, 900);
            var rw = g.measureText(label).width + w * 0.12, rh = ts + w * 0.07;
            g.save(); g.translate(w / 2, h * 0.5); var os = ctx.ease.elasticOut(Math.min(1, phaseT / 0.6)); g.scale(os, os); g.rotate(-0.05);
            ctx.rrect(g, -rw / 2, -rh / 2 + w * 0.012, rw, rh, rh / 2); g.fillStyle = 'rgba(0,0,0,.333)'; g.fill();
            ctx.rrect(g, -rw / 2, -rh / 2, rw, rh, rh / 2); g.fillStyle = '#8D6E4A'; g.fill();
            ctx.text(g, label, 0, 1, { size: ts, weight: 900, color: '#FFFFFF', shadow: 'rgba(0,0,0,.53)', blur: 6, oy: 2 });
            g.restore();
          }
          g.restore();
          if (flashT > 0) { g.fillStyle = 'rgba(255,59,78,' + (0.28 * flashT / 0.4).toFixed(3) + ')'; g.fillRect(0, 0, w, h); }
          if (phase !== 'result') hud(g);
          else resultCard(g);
          g.restore();
        },

        down: function (p) {
          var ux = (p.x - ax) / aw, uy = (p.y - ay) / aw;
          if (ux < -0.02 || ux > 1.02 || uy < -0.02 || uy > 1 / ASPECT + 0.02) return;
          if (phase === 'over') return;
          if (phase === 'result') { if (phaseT > 0.45) { toReady(); startRound(); } return; }
          if (phase === 'ready') startRound();
          var i = holeAt(ux, uy);
          if (i >= 0) { var r = whack(f, i); if (r) { onHit(i, r); return; } }
          f.combo = 0; comboShown = 0;
          mallets.push({ x: ux, y: uy, t: 0 });
          puff(ux, uy + 0.02);
          ctx.sfx.place(0.45); ctx.haptic('light');
        },

        // the mole the finger should go for (kept while it stays up); the replay button on the result card
        hint: function () {
          if (phase === 'ready' || phase === 'play') {
            if (hintHole < 0 || !hittable(f.holes[hintHole]) || f.holes[hintHole].kind === 'bunny') {
              for (var i = 0; i < 9; i++) if (hittable(f.holes[i]) && f.holes[i].kind !== 'bunny') { hintHole = i; break; }
            }
            // nothing up for a moment: stay where the last mole was (the middle hole at first)
            var c = holeCenter(hintHole < 0 ? 4 : hintHole);
            return A(c[0], c[1] - 0.12);
          }
          return phase === 'result' && again && phaseT > 0.45 ? { x: again.x, y: again.y } : null;
        },

        debug: function () {
          var targets = [];
          f.holes.forEach(function (h, i) { if (hittable(h)) { var c = holeCenter(i), P = A(c[0], c[1] - 0.12); targets.push({ i: i, kind: h.kind, x: Math.round(P.x), y: Math.round(P.y) }); } });
          return { phase: phase, score: f.score, left: Math.round(timeLeft(f) * 10) / 10, combo: f.combo, hits: f.hits, best: ctx.getBest(),
            arena: { x: ax, y: ay, w: aw, h: ah }, targets: targets };
        },

        destroy: function () { bg = null; dust.length = drops.length = mallets.length = rings.length = 0; }
      };
    }
  };
})();
