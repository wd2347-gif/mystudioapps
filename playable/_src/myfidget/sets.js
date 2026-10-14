/* MyFidget playable sets: [opener, 2nd, 3rd]. One set is picked at random per load (never the previous one).
 * Rules: 3 different games, no repeated trio, every pool game in 2+ sets, openers are instantly readable,
 * no two games of the same kind in one set (pop/press, spin, swipe/rub, squish, break, visual, music).
 * 2026-10-14 사용자("체험형에 클리커를 포함한 인기 게임으로 유도"): 앱 인기 순위(28일, tool/toy_ranking.py) 1 뽁뽁이 ·
 * 2 키캡 클리커(1인 4분 10초로 가장 오래 놂, 1.1.0 에서 다시 프리미엄) · 3 말랑 젤리 · 4 피젯 스피너 → 모든 세트에 이 넷 중
 * 하나 이상, 키캡은 14세트 중 8세트(첫 판 5), 첫 판은 이 넷만. */
var SETS = [
  ['keycaps', 'jelly', 'fireworks'],
  ['bubble_wrap', 'spinner', 'kalimba'],
  ['keycaps', 'spinner', 'ice'],
  ['jelly', 'keycaps', 'powerwash'],
  ['bubble_wrap', 'jelly', 'soapcut'],
  ['spinner', 'keycaps', 'scratch'],
  ['keycaps', 'fireworks', 'soapcut'],
  ['bubble_wrap', 'fireworks', 'plinko'],
  ['jelly', 'popit', 'spinner'],
  ['keycaps', 'ice', 'kalimba'],
  ['spinner', 'bubble_wrap', 'powerwash'],
  ['keycaps', 'scratch', 'plinko'],
  ['spinner', 'popit', 'scratch'],
  ['jelly', 'keycaps', 'kalimba']
];
