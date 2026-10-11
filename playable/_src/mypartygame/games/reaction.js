/* 반응속도 대결 (reaction): the app's reaction duel (reaction.dart, two players) against the computer on the dark #15181C board.
   Top zone = computer (pink edge, words turned 180 degrees), bottom zone = you (blue edge), a signal badge in the middle band.
   Grey "Ready…" for a random 1.5 to 4 s, then both zones turn green "Now!" with a beep: the first tap scores (ding, gold zone,
   trophy, ms); a tap on grey is "Too soon!" and the point goes to the other side. The computer reacts in about 230 to 420 ms.
   First to 3 wins, then a new match starts by itself. */
(function () {
  'use strict';
  var GO = '#2FC85E', WAIT = '#3A4048', BAD = '#E5484D', GOLD = '#FFB020', ME = ['#FF5C7A', '#3E9BFF'], WIN_TO = 3;
  var T = {
    ko: { ready: '준비…', now: '지금!', soon: '성급했어요!', ms: '{0}ms', best: '최고 {0}ms', missed: '아쉬워요', others: '상대가 성급했어요!',
      champ: '최종 승리!', next: '다음엔 꼭!', again: '다시 하기', cpu: '컴퓨터', you: '나' },
    ja: { ready: '準備…', now: '今！', soon: 'フライング！', ms: '{0}ms', best: 'ベスト {0}ms', missed: '惜しい！', others: '相手がフライング！',
      champ: '優勝！', next: '次こそ！', again: 'もう一回', cpu: 'コンピューター', you: 'あなた' },
    en: { ready: 'Ready…', now: 'Now!', soon: 'Too soon!', ms: '{0} ms', best: 'Best {0} ms', missed: 'Too slow', others: 'They jumped the gun!',
      champ: 'Champion!', next: 'Next time!', again: 'Play again', cpu: 'Computer', you: 'You' }
  };
  var BOLT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" d="M14.4 2.4 6.7 13.4H12l-2.4 8.2 7.7-11.5H12z"/></svg>';
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function dim(hex, k) { var c = rgb(hex); return 'rgb(' + Math.round(c[0] * (1 - k)) + ',' + Math.round(c[1] * (1 - k)) + ',' + Math.round(c[2] * (1 - k)) + ')'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  GAMES['reaction'] = {
    name: { ko: '반응속도 대결', ja: '反射神経バトル', en: 'Reaction Duel' },
    tip: { ko: '초록이 되는 순간 탭! 성급하면 실격', ja: '緑になった瞬間タップ！早すぎたら失格', en: 'Tap when it turns green, too early is out' },
    cat: 'duel', accent: '#3E9BFF', full: true,
    make: function (ctx) {
      var t = ctx.pick(T), S = ctx.sfx;
      var root = ctx.el;
      function zone(i) {
        return '<div class="z z' + i + '"><div class="zi"><div class="fit"><div class="pop">' +
          '<div class="tro">' + ctx.ICON.trophy + '</div><div class="lb"></div><div class="bs"></div>' +
          '<div class="pips"><i></i><i></i><i></i></div></div></div></div>' +
          '<span class="tag">' + ctx.esc(i ? t.you : t.cpu) + '</span></div>';
      }
      root.innerHTML = zone(0) + zone(1) + '<div class="badge wait">' + BOLT + '</div>' +
        '<div class="res"><div class="box"><button class="go" type="button">' + ctx.ICON.again + '<span>' + ctx.esc(t.again) + '</span></button></div></div>';
      var Z = [0, 1].map(function (i) {
        var z = root.querySelector('.z' + i);
        return { el: z, zi: z.querySelector('.zi'), fit: z.querySelector('.fit'), pop: z.querySelector('.pop'), tro: z.querySelector('.tro'),
          lb: z.querySelector('.lb'), sb: z.querySelector('.bs'), dots: z.querySelectorAll('.pips i'), key: '' };
      });
      var badge = root.querySelector('.badge'), res = root.querySelector('.res'), againBtn = res.querySelector('.go');

      var W = 0, H = 0, BAND = 92;
      var st = 'waiting', score = [0, 0], out = [false, false], best = [null, null], winner = -1, msShown = null;
      var goAt = 0, goTimer = 0, aiTimer = 0, tickTimer = 0, nextTimer = 0, armed = true, resultReady = false, touched = false;
      var rounds = 0, matches = 0, lastMs = null;

      function layout() {
        W = root.clientWidth; H = root.clientHeight;
        BAND = clamp(Math.round(H * 0.17), 72, 92);
        var top = (H - BAND) / 2, bot = (H + BAND) / 2, gap = 3;
        var rects = [[gap, gap, W - gap * 2, top - gap * 2], [gap, bot + gap, W - gap * 2, H - bot - gap * 2]];
        for (var i = 0; i < 2; i++) {
          var r = rects[i], z = Z[i].el;
          z.style.left = r[0] + 'px'; z.style.top = r[1] + 'px'; z.style.width = r[2] + 'px'; z.style.height = r[3] + 'px';
          // text grows with the zone (the app's k: zone size against 300 x 200, 0.8 to 2.2)
          var k = clamp(Math.min(r[2] / 300, r[3] / 200), 0.8, 2.2);
          z.style.setProperty('--k', k.toFixed(3));
          Z[i].key = '';
        }
        badge.style.top = (H / 2) + 'px';
      }

      // FittedBox(scaleDown): shrink the zone's words if they do not fit (measured on change only)
      function fitZone(z) {
        var aw = (z.zi.clientWidth || 1) - 28, ah = (z.zi.clientHeight || 1) - 28;
        var w = z.pop.offsetWidth || 1, h = z.pop.offsetHeight || 1;
        z.fit.style.transform = 'scale(' + Math.min(1, aw / w, ah / h).toFixed(3) + ')';
      }
      function paintZone(i) {
        var z = Z[i], me = ME[i], isOut = out[i], won = winner === i, bgc, label, sub = '', icon = false, big = false;
        if (st === 'waiting') { bgc = isOut ? BAD : WAIT; label = isOut ? t.soon : t.ready; }
        else if (st === 'go') { bgc = isOut ? BAD : GO; label = isOut ? t.soon : t.now; big = !isOut; }
        else if (st === 'roundOver') {
          if (won) { bgc = GOLD; label = msShown == null ? t.others : ctx.fmt(t.ms, msShown); icon = true; }
          else { bgc = isOut ? dim(BAD, 0.35) : dim(me, 0.45); label = isOut ? t.soon : t.missed; }
        } else {
          bgc = won ? GOLD : dim(me, 0.45); label = won ? t.champ : t.next; icon = won;
          if (best[i] != null) sub = ctx.fmt(t.best, best[i]);
        }
        var key = st + '|' + isOut + '|' + won + '|' + score[i] + '|' + label + '|' + sub;
        z.el.style.background = bgc;
        z.el.classList.toggle('now', st === 'go');
        if (key === z.key) return;
        z.key = key;
        z.lb.textContent = label;
        z.lb.classList.toggle('big', big);
        z.sb.textContent = sub;
        z.sb.style.display = sub ? '' : 'none';
        z.tro.style.display = icon ? '' : 'none';
        for (var d = 0; d < WIN_TO; d++) z.dots[d].classList.toggle('on', d < score[i]);
        fitZone(z);
        z.pop.classList.remove('pp'); void z.pop.offsetWidth; z.pop.classList.add('pp');
      }
      function paint() {
        paintZone(0); paintZone(1);
        badge.className = 'badge ' + (st === 'go' ? 'go' : st === 'roundOver' ? 'gold' : st === 'matchOver' ? 'off' : 'wait');
        res.classList.toggle('on', st === 'matchOver' && resultReady);
      }
      function ripple(i, x, y) {
        var r = ctx.mk('i', 'rip');
        r.style.left = x + 'px'; r.style.top = y + 'px';
        root.appendChild(r);
        ctx.later(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 650);
      }
      function stopTimers() { ctx.clear(goTimer); ctx.clear(aiTimer); ctx.clear(tickTimer); ctx.clear(nextTimer); }

      function round() {
        stopTimers();
        out = [false, false]; winner = -1; msShown = null; st = 'waiting';
        paint();
        // a quiet clock while everybody waits
        tickTimer = ctx.every(function () { S.tick(); }, 500);
        var wait = 1500 + Math.random() * 2500;
        goTimer = ctx.later(go, wait);
        // now and then the computer jumps the gun too (never in the very first round)
        if (rounds > 0 && Math.random() < 0.07) {
          aiTimer = ctx.later(function () { if (st === 'waiting') tapBy(0, null); }, 600 + Math.random() * Math.max(200, wait - 800));
        }
      }
      function go() {
        if (st !== 'waiting') return;
        stopTimers();
        S.beep(true); ctx.buzz(20);
        st = 'go'; paint();
        goAt = performance.now();
        requestAnimationFrame(function () { if (st === 'go') goAt = performance.now(); });
        // the computer: about 230 to 420 ms; slower until the viewer has touched once, so a first try can win
        var react = touched ? 230 + Math.random() * 190 : 720 + Math.random() * 260;
        aiTimer = ctx.later(function () { if (st === 'go') tapBy(0, Math.round(performance.now() - goAt)); }, react);
        if (!touched) ctx.hint(function () { return { x: W / 2, y: (H + BAND) / 2 + (H - BAND) / 4 }; }, { kind: 'tap', delay: 0 });
      }
      function tapBy(i, ms) {
        if (i === 0 && (st === 'waiting' || st === 'go')) ripple(0, W * (0.2 + Math.random() * 0.6), (H - BAND) / 2 * (0.25 + Math.random() * 0.5));
        if (st === 'waiting') {
          if (out[i] || !armed) return;
          out[i] = true;
          if (i === 1) { S.fail(); ctx.buzz([30, 40, 30]); } else S.tone(300, 0.12, 'square', 0.06, 200);
          win(1 - i, null);
        } else if (st === 'go') {
          if (out[i]) return;
          win(i, ms);
        }
      }
      function win(i, ms) {
        stopTimers();
        ctx.hint(null);
        score[i]++; rounds++;
        if (ms != null && (best[i] == null || ms < best[i])) best[i] = ms;
        if (ms != null && i === 1) lastMs = ms;
        winner = i; msShown = ms;
        var match = score[i] >= WIN_TO;
        st = match ? 'matchOver' : 'roundOver';
        resultReady = false;
        if (ms != null) {
          if (i === 1) {
            S.ding(); ctx.buzz(25);
            ctx.burstAt(Z[1].el, 36, { ring: true, speed: 420, colors: ['#FFB020', '#FFFFFF', '#FFE066', '#3E9BFF'] });
          } else S.tone(1320, 0.22, 'sine', 0.12);
        } else if (i === 1) ctx.later(S.ding, 320);
        paint();
        if (match) {
          matches++;
          ctx.later(S.stamp, 250);
          ctx.later(function () {
            if (i === 1) { S.win(); ctx.burstAt(Z[1].el, 90, { speed: 700 }); ctx.rain(46); } else S.lose();
          }, 450);
          nextTimer = ctx.later(function () { resultReady = true; paint(); nextTimer = ctx.later(newMatch, 2600); }, 900);
        } else nextTimer = ctx.later(round, 2300);
      }
      function newMatch() {
        if (st !== 'matchOver') return;
        stopTimers();
        score = [0, 0]; best = [null, null]; resultReady = false;
        armed = false; ctx.later(function () { armed = true; }, 450);
        round();
      }

      ctx.on(root, 'pointerdown', function (e) {
        if (e.target.closest && e.target.closest('.go')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        var q = ctx.local(e);
        touched = true;
        if (q.y < H / 2) return;   // the top zone is the computer's
        ripple(1, q.x, q.y);
        if (st === 'matchOver') { if (resultReady) { ctx.click(); newMatch(); } return; }
        tapBy(1, Math.round(performance.now() - goAt));
      });
      ctx.on(againBtn, 'click', function () { if (st === 'matchOver' && resultReady) { ctx.click(); newMatch(); } });

      layout();
      round();
      return {
        resize: function () { layout(); paint(); },
        destroy: function () { stopTimers(); st = 'gone'; },
        debug: function () {
          return { st: st, score: { cpu: score[0], you: score[1] }, out: out.slice(), winner: winner < 0 ? null : winner ? 'you' : 'cpu',
            ms: msShown, lastMs: lastMs, best: best[1], rounds: rounds, matches: matches };
        }
      };
    }
  };
})();
