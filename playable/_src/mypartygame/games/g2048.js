/* 2048 (g2048): app colours from g2048.dart _tileColor (white, greens, teal, sky, violet, gold). DOM tiles that slide (110 ms),
   merged tiles pop, new ones bloom. The first board puts two 2s in one line so the very first swipe merges. Ported from the first playable (10/11). */
(function () {
  'use strict';
  var T = {
    ko: { score: '점수', again: '다시', over: '더 움직일 수 없어요', win: '2048 달성!' },
    ja: { score: 'スコア', again: 'もう一回', over: 'もう動かせません', win: '2048達成！' },
    en: { score: 'Score', again: 'Again', over: 'No more moves', win: 'You made 2048!' }
  };
  var D = '#1B1F1A', W = '#FFFFFF';
  var TILE = {
    2: ['#FFFFFF', D], 4: ['#DDF5E4', D], 8: ['#B2EAC3', D], 16: ['#7FDDA0', D], 32: ['#2FC85E', D], 64: ['#16A889', D],
    128: ['#00C2C7', D], 256: ['#3E9BFF', D], 512: ['#5B4BDB', W], 1024: ['#A368FF', D], 2048: ['#FFB020', D],
    4096: ['#FF5C7A', D], 8192: ['#2D3A8C', W]
  };
  var TILE_DARK = { 2: ['#3A4A3E', W], 4: ['#2F5C3E', W], 8: ['#337A4C', W] };

  GAMES['g2048'] = {
    name: { ko: '2048', ja: '2048', en: '2048' },
    tip: { ko: '밀어서 같은 숫자를 합쳐요', ja: 'スワイプで同じ数字を合わせよう', en: 'Swipe to merge matching numbers' },
    cat: 'solo', who: '1', accent: '#FFB020',
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx, mk = ctx.mk, rnd = ctx.rnd;
      function tileCol(v) { return (ctx.dark && TILE_DARK[v]) || TILE[v] || ['#14361F', W]; }
      var root = ctx.el;
      root.innerHTML =
        '<div class="top"><div class="sc"><span class="sl">' + ctx.esc(t.score) + '</span><b class="sv">0</b></div>' +
        '<button class="rs" type="button" aria-label="' + ctx.esc(t.again) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/></svg></button></div>' +
        '<div class="bw"><div class="board"><div class="cells"></div><div class="tiles"></div>' +
        '<div class="over"><div class="ot"></div><button class="ob" type="button">' + ctx.esc(t.again) + '</button></div></div></div>';
      var bwEl = root.querySelector('.bw'), board = root.querySelector('.board'), cellsEl = root.querySelector('.cells'), tilesEl = root.querySelector('.tiles');
      var scoreEl = root.querySelector('.sv'), overText = root.querySelector('.ot');
      var cellEls = [];
      for (var i = 0; i < 16; i++) { var ce = mk('div', 'cell'); cellsEl.appendChild(ce); cellEls.push(ce); }
      var grid, games = 0, deadAt = 0, score = 0, busy = false, seq = 0, removed = [], merged = [], gained = 0, side = 0, cell = 0, gap = 0, dead = false, won = false;
      var moves = 0, firstHint = null;

      function pos(r, c) { return [gap + c * (cell + gap), gap + r * (cell + gap)]; }
      function place(tile) { var p = pos(tile.r, tile.c); tile.el.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)'; }
      function paint(tile) {
        var v = tile.v, col = tileCol(v), f = tile.f;
        f.textContent = v; f.style.background = col[0]; f.style.color = col[1];
        f.style.fontSize = Math.round(cell * (v < 100 ? 0.44 : v < 1000 ? 0.36 : 0.29)) + 'px';
        f.style.borderRadius = Math.round(cell * 0.16) + 'px';
        f.style.boxShadow = v >= 2048 ? '0 0 18px rgba(255,176,32,.7), 0 2px 0 rgba(0,0,0,.1)' : '';
      }
      function sizeTile(tile) { tile.el.style.width = tile.el.style.height = cell + 'px'; }
      function addTile(r, c, v, cls) {
        var e = mk('div', 'tile', '<div class="tf"></div>');
        var tile = { r: r, c: c, v: v, el: e, f: e.firstChild };
        sizeTile(tile); place(tile); paint(tile);
        if (cls) tile.f.classList.add(cls);
        tilesEl.appendChild(e); grid[r][c] = tile;
        return tile;
      }
      function empties() {
        var out = [];
        for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (!grid[r][c]) out.push([r, c]);
        return out;
      }
      function spawn() {
        var e = empties(); if (!e.length) return;
        var p = e[rnd(e.length)];
        addTile(p[0], p[1], Math.random() < 0.9 ? 2 : 4, 'in');
      }
      function canMove() {
        for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
          var a = grid[r][c]; if (!a) return true;
          if (c < 3 && grid[r][c + 1] && grid[r][c + 1].v === a.v) return true;
          if (r < 3 && grid[r + 1][c] && grid[r + 1][c].v === a.v) return true;
        }
        return false;
      }
      function newGame() {
        busy = false; seq++; games++; removed = []; merged = []; dead = false; won = false; score = 0; scoreEl.textContent = '0';
        board.classList.remove('dead'); tilesEl.innerHTML = '';
        grid = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
        // two matching tiles in one line so the very first swipe merges, plus one more
        var line = rnd(4), horiz = Math.random() < 0.5, a = rnd(4), b = (a + 1 + rnd(3)) % 4;
        if (horiz) { addTile(line, a, 2, 'in'); addTile(line, b, 2, 'in'); } else { addTile(a, line, 2, 'in'); addTile(b, line, 2, 'in'); }
        var e = empties(), p = e[rnd(e.length)]; addTile(p[0], p[1], 4, 'in');
        return { horiz: horiz, line: line };
      }
      function lineCells(dir, i) {
        var out = [];
        for (var k = 0; k < 4; k++) {
          if (dir === 'L') out.push([i, k]); else if (dir === 'R') out.push([i, 3 - k]);
          else if (dir === 'U') out.push([k, i]); else out.push([3 - k, i]);
        }
        return out;
      }
      function move(dir) {
        if (dead) return;
        if (busy) finish(seq);
        var next = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
        var moved = false; removed = []; merged = []; gained = 0;
        for (var i = 0; i < 4; i++) {
          var cells = lineCells(dir, i), slot = 0, last = null;
          for (var k = 0; k < 4; k++) {
            var tile = grid[cells[k][0]][cells[k][1]];
            if (!tile) continue;
            if (last && last.v === tile.v) {
              var at = cells[slot - 1];
              tile.r = at[0]; tile.c = at[1];
              last.v *= 2; gained += last.v;
              removed.push(tile); merged.push(last); last = null; moved = true;
            } else {
              var to = cells[slot];
              if (tile.r !== to[0] || tile.c !== to[1]) moved = true;
              tile.r = to[0]; tile.c = to[1];
              next[to[0]][to[1]] = tile; last = tile; slot++;
            }
          }
        }
        if (!moved) { S.bump(); return; }
        moves++;
        grid = next;
        for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (grid[r][c]) place(grid[r][c]);
        removed.forEach(place);
        busy = true; S.swipe(); ctx.buzz();
        var my = ++seq;
        ctx.later(function () { finish(my); }, 120);
      }
      function finish(my) {
        if (!busy || my !== seq) return;
        busy = false;
        removed.forEach(function (tl) { if (tl.el.parentNode) tl.el.parentNode.removeChild(tl.el); });
        var top = 0;
        merged.forEach(function (tl) {
          paint(tl); tl.f.classList.remove('in', 'mg'); void tl.f.offsetWidth; tl.f.classList.add('mg');
          if (tl.v > top) top = tl.v;
        });
        if (top) S.merge(top);
        removed = []; merged = [];
        if (gained) { score += gained; scoreEl.textContent = String(score); }
        spawn();
        if (top >= 2048 && !won) {
          won = true;
          ctx.burstAt(board, 100, { speed: 720 }); S.win();
          overText.textContent = t.win;
        }
        if (!canMove()) {
          dead = true; deadAt = performance.now(); overText.textContent = t.over;
          var gen = games;
          ctx.later(function () { board.classList.add('dead'); }, 250);
          // never a dead end: a fresh board by itself after a beat (or on the next touch, below)
          ctx.later(function () { if (dead && gen === games) { S.swipe(); newGame(); } }, 3600);
        }
      }
      function resize() {
        var s = Math.floor(Math.min(bwEl.clientWidth, bwEl.clientHeight - 6, 440));
        side = Math.max(160, s); gap = side * 0.028; cell = (side - gap * 5) / 4;
        root.style.setProperty('--bd', side + 'px');
        for (var i = 0; i < 16; i++) {
          var p = pos(Math.floor(i / 4), i % 4), ce = cellEls[i];
          ce.style.width = ce.style.height = cell + 'px'; ce.style.left = p[0] + 'px'; ce.style.top = p[1] + 'px';
          ce.style.borderRadius = Math.round(cell * 0.16) + 'px';
        }
        tilesEl.classList.add('nt');
        for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) { var tl = grid[r][c]; if (tl) { sizeTile(tl); place(tl); paint(tl); } }
        void tilesEl.offsetWidth; tilesEl.classList.remove('nt');
      }

      // swipe anywhere in the game area; arrow keys too
      var sx = 0, sy = 0, pid = null, fired = false;
      ctx.on(root, 'pointerdown', function (e) {
        if (e.target.closest && e.target.closest('button')) return;
        if (dead) { if (performance.now() - deadAt > 900) restart(); return; }
        pid = e.pointerId; sx = e.clientX; sy = e.clientY; fired = false;
        try { root.setPointerCapture(pid); } catch (er) {}
      });
      function swipeCheck(e, end) {
        if (pid === null || e.pointerId !== pid || fired) return;
        var dx = e.clientX - sx, dy = e.clientY - sy, ax = Math.abs(dx), ay = Math.abs(dy);
        if (Math.max(ax, ay) < (end ? 18 : 30)) return;
        fired = true;
        move(ax > ay ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
      }
      ctx.on(root, 'pointermove', function (e) { swipeCheck(e, false); });
      ctx.on(root, 'pointerup', function (e) { swipeCheck(e, true); pid = null; });
      ctx.on(root, 'pointercancel', function () { pid = null; });
      ctx.on(window, 'keydown', function (e) {
        var m = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D', a: 'L', d: 'R', w: 'U', s: 'D' }[e.key];
        if (m) { e.preventDefault(); move(m); }
      });
      function restart() { S.click(); ctx.buzz(); newGame(); }
      ctx.on(root.querySelector('.rs'), 'click', restart);
      ctx.on(root.querySelector('.ob'), 'click', restart);

      grid = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
      resize();
      firstHint = newGame();
      // swipe hint along the line that holds the matching pair (left along a row, down along a column)
      var fh = firstHint, step = (cell + gap) * 1.7;
      ctx.hint(function () {
        var b = board.getBoundingClientRect(), r = root.getBoundingClientRect(), half = cell / 2;
        var p = fh.horiz ? pos(fh.line, 2.6) : pos(0.4, fh.line);
        return { x: b.left - r.left + p[0] + half, y: b.top - r.top + p[1] + half };
      }, { kind: 'swipe', dx: fh.horiz ? -step : 0, dy: fh.horiz ? 0 : step });

      return {
        resize: resize,
        redraw: function () { for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (grid[r][c]) paint(grid[r][c]); },
        destroy: function () { seq++; },
        debug: function () {
          var tiles = [];
          for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (grid[r][c]) tiles.push(grid[r][c].v);
          return { score: score, moves: moves, tiles: tiles.sort(function (a, b) { return a - b; }), dead: dead, games: games };
        }
      };
    }
  };
})();
