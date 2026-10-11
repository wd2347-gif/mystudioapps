/* MyFidget playable sets: [opener, 2nd, 3rd]. One set is picked at random per load (never the previous one).
 * Rules: 3 different games, no repeated trio, every pool game in 2+ sets, openers are instantly readable,
 * no two games of the same kind in one set (pop/press, spin, swipe/rub, squish, break, visual, music). */
var SETS = [
  ['bubble_wrap', 'fireworks', 'kalimba'],
  ['popit', 'scratch', 'plinko'],
  ['fireworks', 'jelly', 'keycaps'],
  ['spinner', 'powerwash', 'popit'],
  ['ice', 'plinko', 'bubble_wrap'],
  ['jelly', 'soapcut', 'fireworks'],
  ['scratch', 'keycaps', 'ice'],
  ['plinko', 'spinner', 'soapcut'],
  ['keycaps', 'powerwash', 'jelly'],
  ['popit', 'kalimba', 'ice'],
  ['bubble_wrap', 'soapcut', 'spinner'],
  ['powerwash', 'fireworks', 'popit'],
  ['fireworks', 'scratch', 'kalimba'],
  ['ice', 'jelly', 'kalimba']
];
