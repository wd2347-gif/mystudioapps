// MyPocketGames 플레이어블 세트(사용자 10/11: 세트 12개 이상, 매번 무작위 · 직전 세트 제외, 남은 수 표시 없음).
// 세트 하나: [첫 게임, '다른 게임' 1번째, 2번째], 세 번째에서 '다른 게임'을 누르면 설치.
// 규칙: 세 게임은 서로 다르고 같은 셋 묶음은 두 번 없음, 모든 게임이 3번씩, 첫 게임 9가지(바로 알아보는 것만),
// 한 세트 안에서 갈래(아케이드 A · 퍼즐 P · 두뇌 B)를 섞는다.
// A: whack slice darts tiles flappy breakout   P: watersort match3 bubble flow   B: oddcolor reflex
var SETS = [
  ['whack', 'watersort', 'oddcolor'],   // A P B
  ['slice', 'match3', 'reflex'],        // A P B
  ['darts', 'flow', 'tiles'],           // A P A
  ['tiles', 'bubble', 'whack'],         // A P A
  ['flappy', 'oddcolor', 'watersort'],  // A B P
  ['watersort', 'breakout', 'reflex'],  // P A B
  ['oddcolor', 'flappy', 'match3'],     // B A P
  ['match3', 'darts', 'reflex'],        // P A B
  ['breakout', 'bubble', 'slice'],      // A P A
  ['slice', 'flow', 'breakout'],        // A P A
  ['darts', 'bubble', 'flappy'],        // A P A
  ['whack', 'flow', 'tiles']            // A P A
];
