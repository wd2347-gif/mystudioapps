/* 피아노 건반 (tiles): my_mini/lib/games/list/tiles.dart 의 '무한' 모드를 옮긴 것(네 줄 · 검은 건반 · 마림바 가락 도 미 솔 높은 도 · 색 물결 · 음표 · 25개마다 바탕 빛깔이 같다).
   플레이어블: 처음 화면은 '시작' 건반이 기다리는 판(힌트가 가리킨다). 누르면 판이 내려가기 시작하고 점점 빨라진다.
   흰 칸을 누르거나 검은 건반을 놓치면 빨갛게 깜빡 → 결과 카드 → 몇 초 뒤 다시 '시작' 판(카드를 누르면 바로).
   손가락이 조금 빗나가도 맨 아래 검은 건반으로 쳐 준다(작은 화면에서 억울하지 않게). */
(function () {
  'use strict';

  var TX = {
    start: { ko: '시작', ja: 'スタート', en: 'Start' },
    missed: { ko: '놓쳤어요!', ja: '逃した！', en: 'Missed one!' },
    wrong: { ko: '앗, 흰 칸!', ja: 'あっ、白いところ！', en: 'Oops, white tile!' },
    tilesN: { ko: '건반 {0}개', ja: '{0}枚', en: 'Tiles: {0}' },
    newBest: { ko: '새 기록!', ja: '新記録！', en: 'New best!' },
    score: { ko: '점수', ja: 'スコア', en: 'Score' },
    best: { ko: '최고 기록', ja: 'ベスト', en: 'Best' },
    again: { ko: '다시 하기', ja: 'もう一回', en: 'Play again' }
  };

  var TAU = Math.PI * 2, ASPECT = 0.56, LANES = 4, ROWS = 4;
  var MELODY = [0, 1, 2, 3, 2, 1, 2, 0, 1, 2, 3, 3, 2, 1, 0, 0];
  var ACCENTS = ['#3E9BFF', '#FF5C7A', '#FFB020', '#2FC85E', '#A368FF', '#00C2C7'];
  var TINTS = ['#F4F7FF', '#FFF4F7', '#F2FFF6', '#FFFAEE', '#F7F2FF', '#EFFCFF'];
  var INK = '#2B3140', RED = '#FF3B5C';

  function speedFor(n) { return Math.min(9, 2.6 + 0.045 * n); }
  function newBoard() { var b = { lanes: [], scroll: 0, next: 0, started: false, over: false, time: 0, missedRow: -1, wrongLane: -1, wrongRow: -1 }; laneOf(b, 8); return b; }
  function laneOf(b, row) {
    while (b.lanes.length <= row) {
      if (!b.lanes.length) b.lanes.push(Math.floor(Math.random() * LANES));
      else { var l = Math.floor(Math.random() * (LANES - 1)); if (l >= b.lanes[b.lanes.length - 1]) l++; b.lanes.push(l); }
    }
    return b.lanes[row];
  }
  // TilesBoard.tap, with a little slack around the lowest black tile
  function tap(b, lane, rowPos) {
    if (b.over) return 'ignore';
    if (!b.started) {
      if (lane === laneOf(b, 0) && rowPos > -0.3 && rowPos < 1.3) { b.started = true; b.next = 1; return 'hit'; }
      return 'ignore';
    }
    if (lane === laneOf(b, b.next) && rowPos >= b.next - 0.3 && rowPos < b.next + 1.3) { b.next++; return 'hit'; }
    var row = Math.floor(rowPos);
    if (row < 0 || lane === laneOf(b, row)) return 'ignore';
    b.over = true; b.wrongLane = lane; b.wrongRow = row;
    return 'wrong';
  }

  function drawNote(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath(); g.ellipse(0, 0, s / 2, s * 0.36, -0.4, 0, TAU); g.fill();
    g.fillRect(s * 0.36, -s * 2, s * 0.14, s * 2);
    g.beginPath(); g.moveTo(s * 0.5, -s * 2); g.quadraticCurveTo(s * 1.25, -s * 1.6, s, -s * 0.9); g.quadraticCurveTo(s * 0.95, -s * 1.35, s * 0.5, -s * 1.45); g.closePath(); g.fill();
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

  GAMES['tiles'] = {
    name: { ko: '피아노 건반', ja: 'タップタイル', en: 'Tap Tiles' },
    tip: { ko: '검은 건반만 아래부터 톡톡', ja: '黒い鍵盤だけ下から順にタップ', en: 'Tap only the black tiles, from the bottom up' },
    color: '#2B3140',
    kind: 'arcade',
    make: function (ctx) {
      var ax = 0, ay = 0, aw = 300, ah = 536, k = 1, R = 22, cw = 75, rh = 134, tile = null;
      var b = newBoard(), phase = 'ready', phaseT = 0, view = 0, res = null, again = null;
      var splashes = [], notes = [], milestone = 0, mileT = 9, tint = 0, tintT = 9, nudgeT = 9;

      function rowBottom(row) { return ah - (row - view) * rh; }
      function tileCenter(row) { var l = laneOf(b, row); return { x: ax + (l + 0.5) * cw, y: ay + rowBottom(row) - rh / 2 }; }

      function toReady() {
        b = newBoard(); phase = 'ready'; phaseT = 0; view = 0; res = null; again = null;
        splashes.length = notes.length = 0; milestone = 0; mileT = 9; tint = 0; tintT = 9;
      }
      function fail() {
        if (phase === 'over') return;
        phase = 'over'; phaseT = 0;
        ctx.sfx.buzz(); ctx.haptic('error');
        var n = b.next, r = n > 0 ? ctx.best(n) : { best: ctx.getBest(), isNew: false };
        res = { score: n, best: r.best, isNew: r.isNew, missed: b.missedRow >= 0 };
        ctx.later(function () { if (phase === 'over') ctx.sfx.lose(); }, 450);
      }
      function toResult() {
        phase = 'result'; phaseT = 0; ctx.sfx.stamp();
        if (res.isNew) { ctx.sfx.win(); ctx.sfx.sparkle(); ctx.haptic('success'); ctx.fx.burst(ax + aw / 2, ay + ah * 0.42, 90, ctx.PAL, { speed: 720 }); }
      }
      function hit(row, lane, px, py, rowPos) {
        var col = ACCENTS[Math.floor(row / 4) % ACCENTS.length];
        splashes.push({ row: row, lane: lane, ax: (px - lane * cw) / cw, ay: 1 - Math.max(0, Math.min(1, rowPos - row)), c: col, t: 0 });
        ctx.sfx.note(MELODY[row % MELODY.length], 0.95); ctx.haptic('light');
        for (var i = 0; i < 2; i++) {
          notes.push({ x: (lane + 0.3 + 0.4 * Math.random()) / LANES, y: 1 - (row + 0.5 - view) / ROWS, vx: (Math.random() - 0.5) * 0.25, vy: -0.5 - Math.random() * 0.35,
            c: ACCENTS[(row + i * 2) % ACCENTS.length], s: 0.035 + Math.random() * 0.02, spin: (Math.random() - 0.5) * 1.5, t: 0 });
        }
        if (b.next > 1 && b.next % 25 === 0) { milestone = b.next; mileT = 0; tint++; tintT = 0; ctx.sfx.sparkle(); }
      }

      function hud(g) {
        var best = ctx.getBest(), y = 10 * k, cx = aw / 2;
        ctx.text(g, String(b.next), cx, y + 28 * k, { size: 52 * k, weight: 900, color: RED, stroke: '#FFFFFF', lw: 5 * k, shadow: 'rgba(0,0,0,.27)', blur: 8, oy: 3 });
        var bt = best === null ? '-' : String(Math.round(best));
        g.font = ctx.font(13 * k, 800);
        var pw = 20 * k + 19 * k + g.measureText(bt).width, ph = 22 * k, py = y + 58 * k;
        ctx.rrect(g, cx - pw / 2, py, pw, ph, ph / 2); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
        iconTrophy(ctx, g, cx - pw / 2 + 10 * k + 7.5 * k, py + ph / 2, 15 * k, '#E0A526');
        ctx.text(g, bt, cx - pw / 2 + 29 * k, py + ph / 2 + 1, { size: 13 * k, weight: 800, color: INK, align: 'left' });
      }

      function resultCard(g) {
        var t = Math.min(1, phaseT / 0.3), e = ctx.ease.outBack(t), C = ctx.C, col = ctx.dark ? '#5B6CFF' : INK, hot = ctx.dark ? '#8C9BFF' : INK;
        g.fillStyle = 'rgba(0,0,0,' + (0.3 * t).toFixed(3) + ')'; g.fillRect(0, 0, aw, ah);
        var cw2 = Math.min(aw - 24, 320), pad = 18, ch = 250, cx = (aw - cw2) / 2, cy = (ah - ch) / 2;
        g.save(); g.globalAlpha = t; g.translate(aw / 2, ah / 2); g.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e); g.translate(-aw / 2, -ah / 2);
        g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
        ctx.rrect(g, cx, cy, cw2, ch, 24); g.fillStyle = C.surface; g.fill(); g.restore();
        g.lineWidth = 1; g.strokeStyle = C.hair; ctx.rrect(g, cx + 0.5, cy + 0.5, cw2 - 1, ch - 1, 24); g.stroke();
        var y = cy + pad + 16;
        ctx.text(g, ctx.t(res.isNew ? TX.newBest : res.missed ? TX.missed : TX.wrong), aw / 2, y, { size: 26, weight: 900, color: C.ink, maxW: cw2 - pad * 2 });
        y += 28;
        ctx.text(g, ctx.f(TX.tilesN, res.score), aw / 2, y, { size: 14, weight: 600, color: C.soft, maxW: cw2 - pad * 2 });
        y += 18;
        var bw = (cw2 - pad * 2 - 10) / 2, bh = 72;
        [[TX.score, String(res.score), res.isNew], [TX.best, res.best === null ? '-' : String(Math.round(res.best)), false]].forEach(function (q, i) {
          var bx = cx + pad + i * (bw + 10);
          ctx.rrect(g, bx, y, bw, bh, 16); g.fillStyle = q[2] ? ctx.rgba(hot, 0.12) : C.surface; g.fill();
          g.lineWidth = 1.4; g.strokeStyle = q[2] ? hot : C.hair; g.stroke();
          ctx.text(g, ctx.t(q[0]), bx + bw / 2, y + 20, { size: 13, weight: 700, color: C.soft, maxW: bw - 16 });
          ctx.text(g, q[1], bx + bw / 2, y + 48, { size: 27, weight: 900, color: C.ink, maxW: bw - 16 });
        });
        y += bh + 16;
        var btnW = cw2 - pad * 2, btnH = 50;
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
          k = ctx.clamp(aw / 340, 0.75, 1.3); R = Math.round(22 * Math.min(1, k + 0.1));
          cw = aw / LANES; rh = ah / ROWS;
          tile = ctx.layer(cw - 3, rh - 3, function (c, w, h) {
            var gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3A4256'); gr.addColorStop(1, '#151923');
            ctx.rrect(c, 0, 0, w, h, 6); c.fillStyle = gr; c.fill();
            ctx.rrect(c, 5, 5, w - 10, h * 0.18, 4); c.fillStyle = 'rgba(255,255,255,.07)'; c.fill();
          });
        },

        update: function (dt) {
          phaseT += dt; mileT += dt; tintT += dt; nudgeT += dt;
          if (phase === 'play') {
            b.time += dt; b.scroll += speedFor(b.next) * dt;
            if (b.scroll >= b.next + 1) { b.over = true; b.missedRow = b.next; fail(); }
            view = b.scroll;
          } else if (phase === 'over') {
            if (b.missedRow >= 0) view += (b.missedRow - 0.25 - view) * Math.min(1, dt * 9);
            if (phaseT > 1.3) toResult();
          } else if (phase === 'result' && phaseT > 3.6) toReady();
          var i;
          for (i = splashes.length - 1; i >= 0; i--) if ((splashes[i].t += dt) > 0.45) splashes.splice(i, 1);
          for (i = notes.length - 1; i >= 0; i--) { var n = notes[i]; n.t += dt; n.x += n.vx * dt; n.y += n.vy * dt; if (n.t > 0.9) notes.splice(i, 1); }
        },

        draw: function (g) {
          var w = aw, h = ah, i;
          g.save(); g.translate(ax, ay);
          if (!ctx.dark) {
            g.save(); g.shadowColor = 'rgba(16,20,16,.16)'; g.shadowBlur = 22; g.shadowOffsetY = 8;
            ctx.rrect(g, 0, 0, w, h, R); g.fillStyle = '#FFFFFF'; g.fill(); g.restore();
          }
          ctx.rrect(g, 0, 0, w, h, R); g.clip();
          var tn = ctx.mix(TINTS[(tint + TINTS.length - 1) % TINTS.length], TINTS[tint % TINTS.length], Math.min(1, tintT / 0.6));
          var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, tn); gr.addColorStop(1, '#FFFFFF');
          g.fillStyle = gr; g.fillRect(0, 0, w, h);
          g.strokeStyle = '#E1E4EC'; g.lineWidth = 1; g.beginPath();
          for (i = 1; i < LANES; i++) { g.moveTo(cw * i, 0); g.lineTo(cw * i, h); }
          var first = Math.max(0, Math.floor(view) - 1), last = Math.floor(view) + ROWS + 1, blink = Math.floor(phaseT * 8) % 2 === 0 && phase === 'over';
          for (i = first; i <= last; i++) { var yb = rowBottom(i); if (yb >= 0 && yb <= h + rh) { g.moveTo(0, yb); g.lineTo(w, yb); } }
          g.stroke();
          for (i = first; i <= last; i++) {
            var bottom = rowBottom(i), top = bottom - rh;
            if (bottom < 0 || top > h) continue;
            var lane = laneOf(b, i), x = lane * cw + 1.5, y = top + 1.5;
            if (b.missedRow === i) { ctx.rrect(g, x, y, cw - 3, rh - 3, 6); g.fillStyle = blink ? RED : INK; g.fill(); continue; }
            if (i < b.next) { ctx.rrect(g, x, y, cw - 3, rh - 3, 6); g.fillStyle = '#DCE0E9'; g.fill(); continue; }
            if (i === 0 && !b.started) {
              var nk = nudgeT < 0.35 ? 1 + 0.07 * Math.sin(nudgeT / 0.35 * Math.PI) : 1, mx = x + (cw - 3) / 2, my = y + (rh - 3) / 2;
              g.save(); g.translate(mx, my); g.scale(nk, nk); g.translate(-mx, -my);
              g.drawImage(tile, x, y, cw - 3, rh - 3);
              ctx.text(g, ctx.t(TX.start), mx, my - cw * 0.08, { size: cw * 0.26, weight: 900, color: '#FFFFFF', maxW: cw * 0.86 });
              g.fillStyle = '#FFD34D'; g.beginPath(); g.moveTo(mx - cw * 0.07, my + cw * 0.14); g.lineTo(mx + cw * 0.08, my + cw * 0.22); g.lineTo(mx - cw * 0.07, my + cw * 0.3); g.closePath(); g.fill();
              g.restore();
            } else g.drawImage(tile, x, y, cw - 3, rh - 3);
          }
          for (i = 0; i < splashes.length; i++) {
            var s = splashes[i], sb = rowBottom(s.row), sx = s.lane * cw + 1.5, sy = sb - rh + 1.5, kq = Math.min(1, s.t / 0.45);
            g.save(); ctx.rrect(g, sx, sy, cw - 3, rh - 3, 6); g.clip();
            g.globalAlpha = 0.55 * (1 - kq); g.fillStyle = s.c; g.fillRect(sx, sy, cw - 3, rh - 3);
            g.globalAlpha = 0.8 * (1 - kq); g.strokeStyle = '#FFFFFF'; g.lineWidth = Math.max(0.1, cw * 0.12 * (1 - kq));
            g.beginPath(); g.arc(sx + s.ax * (cw - 3), sy + s.ay * (rh - 3), Math.max(0.1, (rh - 3) * 1.1 * ctx.ease.outQuad(kq)), 0, TAU); g.stroke();
            g.restore();
          }
          if (b.wrongRow >= 0) {
            ctx.rrect(g, b.wrongLane * cw + 1.5, rowBottom(b.wrongRow) - rh + 1.5, cw - 3, rh - 3, 6);
            g.fillStyle = ctx.rgba(RED, blink || phase !== 'over' ? 0.95 : 0.35); g.fill();
          }
          for (i = 0; i < notes.length; i++) {
            var n = notes[i]; g.globalAlpha = Math.max(0, 1 - n.t / 0.9); g.fillStyle = n.c;
            drawNote(g, n.x * w, n.y * h, n.s * w, n.spin * n.t);
          }
          g.globalAlpha = 1;
          if (mileT < 0.9 && milestone > 0) {
            g.save(); g.translate(w / 2, h * 0.45); var ms = 0.7 + 0.5 * ctx.ease.outQuad(Math.min(1, mileT / 0.9)); g.scale(ms, ms);
            ctx.text(g, String(milestone), 0, 0, { size: w * 0.36, weight: 900, color: '#FFB020', shadow: 'rgba(0,0,0,.33)', blur: 8, oy: 3, alpha: Math.max(0, 0.85 * (1 - mileT / 0.9)) });
            g.restore();
          }
          if (phase === 'over') {
            var label = ctx.t(res && res.missed ? TX.missed : TX.wrong), fs = 26 * k;
            g.font = ctx.font(fs, 900);
            var bw = Math.min(w - 24, g.measureText(label).width + 44 * k), bh = fs + 24 * k, sc = ctx.ease.elasticOut(Math.min(1, phaseT / 0.5));
            g.save(); g.translate(w / 2, h * 0.575); g.scale(Math.max(0.01, sc), Math.max(0.01, sc));
            g.save(); g.shadowColor = 'rgba(0,0,0,.27)'; g.shadowBlur = 14; g.shadowOffsetY = 6;
            ctx.rrect(g, -bw / 2, -bh / 2, bw, bh, bh / 2); g.fillStyle = '#E5484D'; g.fill(); g.restore();
            ctx.text(g, label, 0, 1, { size: fs, weight: 900, color: '#FFFFFF', maxW: bw - 28 * k });
            g.restore();
          }
          if (phase === 'result') resultCard(g); else hud(g);
          g.restore();
        },

        down: function (p) {
          var ux = p.x - ax, uy = p.y - ay;
          if (ux < -4 || ux > aw + 4 || uy < -4 || uy > ah + 4) return;
          if (phase === 'result') { if (phaseT > 0.45) { toReady(); ctx.sfx.click(); ctx.haptic('light'); } return; }
          if (phase === 'over') return;
          var lane = Math.max(0, Math.min(LANES - 1, Math.floor(ux / cw))), rowPos = view + (ah - uy) / rh, row = b.next;
          var r = tap(b, lane, rowPos);
          if (r === 'hit') { hit(row, lane, ux, uy, rowPos); if (phase === 'ready') { phase = 'play'; phaseT = 0; } }
          else if (r === 'wrong') fail();
          else if (phase === 'ready') { nudgeT = 0; ctx.sfx.click(); ctx.haptic('light'); }
        },

        // the lowest black tile (the start tile at first); the replay button on the result card
        hint: function () {
          if (phase === 'ready') { var c0 = tileCenter(0); return { x: c0.x, y: c0.y + rh * 0.24 }; }
          if (phase === 'play') return tileCenter(b.next);
          return phase === 'result' && again && phaseT > 0.45 ? { x: again.x, y: again.y } : null;
        },

        debug: function () {
          var t = [];
          if (phase === 'ready' || phase === 'play') for (var r = b.next; r < b.next + 3; r++) { var c = tileCenter(r); if (c.y > ay) t.push({ row: r, x: Math.round(c.x), y: Math.round(c.y) }); }
          return { phase: phase, score: b.next, started: b.started, speed: +speedFor(b.next).toFixed(2), scroll: +view.toFixed(2), best: ctx.getBest(),
            arena: { x: ax, y: ay, w: aw, h: ah }, targets: t };
        },

        destroy: function () { tile = null; splashes.length = notes.length = 0; }
      };
    }
  };
})();
