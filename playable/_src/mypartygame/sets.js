/* MyPartyGame playable: 12 sets of 3 (owner rule 10/11). Each load picks one at random, never the same as the last load.
   Pool of 12, each game in exactly 3 sets, no pair of games shares two sets, first game is an opener you get in 1 to 2 seconds.
   Types: bet: roulette bomb pirate croc balloon finger, duel vs the computer: tapwar reaction airhockey, solo: g2048 tower apple.
   Every set mixes types; look-alikes never meet (pirate/croc, bomb/balloon, roulette/finger, tower/g2048). */
var SETS = [
  ['roulette', 'tapwar', 'tower'],
  ['tapwar', 'bomb', 'finger'],
  ['finger', 'reaction', 'pirate'],
  ['balloon', 'apple', 'roulette'],
  ['g2048', 'roulette', 'croc'],
  ['airhockey', 'bomb', 'pirate'],
  ['pirate', 'tapwar', 'g2048'],
  ['tower', 'balloon', 'finger'],
  ['croc', 'reaction', 'tower'],
  ['g2048', 'airhockey', 'balloon'],
  ['bomb', 'apple', 'reaction'],
  ['airhockey', 'croc', 'apple']
];
