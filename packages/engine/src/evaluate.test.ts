import { expect, test } from 'vitest';
import { compareHands, evaluateHand } from './index.ts';
import { cards } from './test-cards.ts';

function compareHoleCards(holeA: string, holeB: string, board: string) {
  return compareHands(evaluateHand(cards(holeA), cards(board)), evaluateHand(cards(holeB), cards(board)));
}

function descriptionOf(hole: string, board: string) {
  return evaluateHand(cards(hole), cards(board)).description;
}

test('high card', () => {
  expect(descriptionOf('As 9d', '7c 4h 2s Jd 3c')).toBe('High Card, Ace');
});

test('pair', () => {
  expect(descriptionOf('Ks 9d', '7c Kh 2s Jd 3c')).toBe('Pair of Kings');
});

test('two pair', () => {
  expect(descriptionOf('Ks 7d', '7c Kh 2s Jd 3c')).toBe('Two Pair, Kings and Sevens');
});

test('three of a kind', () => {
  expect(descriptionOf('7s 7d', '7c Kh 2s Jd 3c')).toBe('Three of a Kind, Sevens');
});

test('full house', () => {
  expect(descriptionOf('Ks 7d', '7c Kh 2s Kd 3c')).toBe('Full House, Kings over Sevens');
});

test('four of a kind', () => {
  expect(descriptionOf('As Ad', 'Ac Kh 2s Ah 3c')).toBe('Four of a Kind, Aces');
});

test('straight', () => {
  expect(descriptionOf('9s 8d', '7c 6h 5s Kd 2c')).toBe('Straight, Nine High');
});

test('the wheel is a five-high straight', () => {
  expect(descriptionOf('As 2d', '3c 4h 5s Kd Jc')).toBe('Straight, Five High');
});

test('flush', () => {
  expect(descriptionOf('Ah 9h', '7h 4h 2h Jd 3c')).toBe('Flush, Ace High');
});

test('straight flush', () => {
  expect(descriptionOf('9h 8h', '7h 6h 5h Kd 2c')).toBe('Straight Flush, Nine High');
});

test('a five-high straight flush', () => {
  expect(descriptionOf('Ad 2d', '3d 4d 5d Kd Jc')).toBe('Straight Flush, Five High');
});

test('royal flush', () => {
  expect(descriptionOf('As Ks', 'Qs Js Ts 2d 3c')).toBe('Royal Flush');
});

test('each category beats the one below it', () => {
  const ladder = [
    ['As 9d', '7c 4h 2s Jd 3c'],
    ['Ks 9d', '7c Kh 2s Jd 3c'],
    ['Ks 7d', '7c Kh 2s Jd 3c'],
    ['7s 7d', '7c Kh 2s Jd 3c'],
    ['9s 8d', '7c 6h 5s Kd 2c'],
    ['Ah 9h', '7h 4h 2h Jd 3c'],
    ['Ks 7d', '7c Kh 2s Kd 3c'],
    ['As Ad', 'Ac Kh 2s Ah 3c'],
    ['9h 8h', '7h 6h 5h Kd 2c'],
    ['As Ks', 'Qs Js Ts 2d 3c'],
  ].map(([hole, board]) => evaluateHand(cards(hole!), cards(board!)));
  for (let i = 1; i < ladder.length; i++) {
    expect(compareHands(ladder[i]!, ladder[i - 1]!)).toBe(1);
    expect(compareHands(ladder[i - 1]!, ladder[i]!)).toBe(-1);
  }
});

test('the higher kicker wins a pair', () => {
  expect(compareHoleCards('Ks Qd', 'Kd Jc', 'Kh 8c 5s 3d 2h')).toBe(1);
});

test('the fifth card can be the deciding kicker', () => {
  expect(compareHoleCards('Ah 8d', 'Ac 7s', 'Kh Qc 9s 3d 2h')).toBe(1);
});

test('the kicker decides between equal two pairs', () => {
  expect(compareHoleCards('Kd Qd', 'Kc Js', 'Ks 7h 7d 4c 2h')).toBe(1);
});

test('the higher trips win a full house before the pair counts', () => {
  expect(compareHoleCards('9s 9d', '8s 8d', '9h 8h 2c 2d 5s')).toBe(1);
});

test('the wheel loses to a six-high straight', () => {
  expect(compareHoleCards('As Kd', '6s Kc', '2c 3h 4s 5d Jh')).toBe(-1);
});

test('equal hands in different suits tie', () => {
  expect(compareHoleCards('Ah Kh', 'Ad Kd', 'Qc 8s 5d 3h 2c')).toBe(0);
});

test('a Board that plays ties both Players', () => {
  const board = cards('As Ks Qs Js Ts');
  const first = evaluateHand(cards('2c 3d'), board);
  const second = evaluateHand(cards('4h 5h'), board);
  expect(first.cards).toEqual(board);
  expect(compareHands(first, second)).toBe(0);
});

test('a straight on the Board ties when no Player improves it', () => {
  expect(compareHoleCards('2c 2d', 'Ah 3s', '5s 6h 7d 8c 9h')).toBe(0);
});

test('the best five cards are returned, most significant first', () => {
  expect(evaluateHand(cards('Ks 7d'), cards('7c Kh 2s Jd 3c')).cards).toEqual(cards('Ks Kh 7d 7c Jd'));
});

test('evaluates on the flop and the turn', () => {
  expect(descriptionOf('Ks 7d', '7c Kh 2s')).toBe('Two Pair, Kings and Sevens');
  expect(descriptionOf('Ks 7d', '7c Kh 2s Kd')).toBe('Full House, Kings over Sevens');
});

test('rejects anything but 2 Hole Cards and 3 to 5 Board cards', () => {
  expect(() => evaluateHand(cards('As'), cards('Kd Qc Js'))).toThrow(RangeError);
  expect(() => evaluateHand(cards('As Kd'), cards('Qc Js'))).toThrow(RangeError);
  expect(() => evaluateHand(cards('As Kd'), cards('Qc Js Th 9h 8h 7h'))).toThrow(RangeError);
});

test('names rank groups in the plural', () => {
  expect(descriptionOf('6s 6d', '6c Kh 2s Jd 3c')).toBe('Three of a Kind, Sixes');
});
