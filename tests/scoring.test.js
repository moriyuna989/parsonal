const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['js/core/constants.js', 'js/core/wait_engine.js', 'js/scoring/legacy.js', 'js/training/templates.js', 'js/scoring/engine.js']) {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}

function score(tiles, winTile, extra) {
  const context = Object.assign({
    isTsumo: false, dealer: false, seatWindNum: 2, roundWindNum: 1
  }, extra || {});
  const melds = context.melds || [];
  delete context.melds;
  return scoreHand(tiles, winTile, melds, context);
}

let r = score(['1m','2m','3m','4m','5m','6m','7m','8m','9m','2p','3p','4p','5s','5s'], '4m', { isTsumo: true });
assert.equal(r.isComplete, true);
assert.equal(r.fu, 20);
assert.equal(r.han, 4);
assert.ok(r.breakdownParts.includes('平和'));
assert.ok(r.breakdownParts.includes('門前清自摸和'));
assert.ok(r.breakdownParts.includes('一気通貫'));

r = score(['1m','2m','3m','1m','2m','3m','4m','5m','6m','7p','8p','9p','5s','5s'], '6m');
assert.ok(r.breakdownParts.includes('一盃口'));
r = score(['1m','2m','3m','1p','2p','3p','1s','2s','3s','4z','4z','4z','5p','5p'], '1m', {
  riichi: true, doubleRiichi: true, ippatsu: true
});
assert.ok(r.breakdownParts.includes('ダブルリーチ'));
assert.ok(r.breakdownParts.includes('一発'));
assert.ok(!r.breakdownParts.includes('リーチ'), 'double riichi replaces ordinary riichi');

const contextHand = ['1m','2m','3m','4m','5m','6m','7p','8p','9p','2s','3s','4s','5z','5z'];
assert.ok(score(contextHand, '6m', { isTsumo: true, haitei: true }).breakdownParts.includes('海底摸月'));
assert.ok(score(contextHand, '6m', { houtei: true }).breakdownParts.includes('河底撈魚'));
assert.ok(score(contextHand, '6m', { chankan: true }).breakdownParts.includes('搶槓'));
r = score(contextHand, '6m', { isTsumo: true, rinshan: true, haitei: true });
assert.ok(r.breakdownParts.includes('嶺上開花'));
assert.ok(!r.breakdownParts.includes('海底摸月'), 'rinshan and haitei cannot combine');

r = score(['1m','2m','3m','4m','5m','6m','7m','8m','9m','2p','3p','4p','3z','3z'], '4m', { roundWindNum: 1, seatWindNum: 2 });
assert.ok(r.breakdownParts.includes('平和'), '客風牌の雀頭は平和を妨げない');
r = score(['1m','2m','3m','4m','5m','6m','7m','8m','9m','2p','3p','4p','1z','1z'], '4m', { roundWindNum: 1, seatWindNum: 1 });
assert.ok(!r.breakdownParts.includes('平和'), 'a double-wind pair is a value pair and blocks pinfu');

r = score(['1m','2m','3m','2p','3p','4p','4s','5s','6s','6z','6z','6z','8s','8s'], '6s');
assert.ok(r.breakdownParts.includes('役牌(發)'), 'dragon triplets grant yakuhai');
r = score(['1m','2m','3m','2p','3p','4p','4s','5s','6s','2z','2z','2z','8s','8s'], '6s', {
  seatWindNum: 3, roundWindNum: 1
});
assert.equal(r.isComplete, true);
assert.equal(r.noYaku, true, 'a non-seat, non-round wind triplet alone is not yakuhai');

r = score(['2m','3m','4m','5m','6m','7m','6s','7s','8s','5p','5p'], '6s', { isOpen: true, melds: [{ type: 'chi', tiles: ['3p','4p','5p'] }] });
assert.equal(r.fu, 30, '副露した平和形ロンは30符');
assert.ok(r.breakdownParts.includes('断么九'));

r = score(['9p','9p','9p','1s','1s','1s','1z','1z','1z','2z','2z'], '2z', { isOpen: true, melds: [{ type: 'pon', tiles: ['1m','1m','1m'] }] });
assert.ok(r.breakdownParts.includes('混老頭'));
assert.ok(r.breakdownParts.includes('対々和'));
assert.ok(!r.breakdownParts.includes('混全帯么九'), '順子を含まない混老頭にチャンタを付けない');

r = score(['2m','3m','4m','2p','3p','4p','2s','3s','4s','6p','7p','8p','5z','5z'], '4m');
assert.ok(r.breakdownParts.includes('三色同順'));
r = score(['2p','3p','4p','2s','3s','4s','6p','7p','8p','5z','5z'], '4p', {
  isOpen: true, melds: [{ type: 'chi', tiles: ['2m','3m','4m'] }]
});
assert.ok(r.breakdownParts.includes('三色同順'));
assert.equal(r.han, 1, 'open sanshoku doujun is reduced to one han');

r = score(['2m','3m','4m','7z','7z'], '4m', { isOpen: true, melds: [
  { type: 'pon', tiles: ['1m','1m','1m'] }, { type: 'pon', tiles: ['1p','1p','1p'] }, { type: 'pon', tiles: ['1s','1s','1s'] }
] });
assert.ok(r.breakdownParts.includes('三色同刻'));
r = score(['1m','2m','3m','4m','4m','4m','7z','7z'], '3m', { isOpen: true, melds: [
  { type: 'pon', tiles: ['5z','5z','5z'] }, { type: 'pon', tiles: ['6z','6z','6z'] }
] });
assert.ok(r.breakdownParts.includes('小三元'));
r = score(['1m','2m','3m','5z','5z'], '3m', { isOpen: true, melds: [
  { type: 'kan', subType: 'minkan', tiles: ['1p','1p','1p','1p'] },
  { type: 'kan', subType: 'minkan', tiles: ['2p','2p','2p','2p'] },
  { type: 'kan', subType: 'minkan', tiles: ['3s','3s','3s','3s'] }
] });
assert.ok(r.breakdownParts.includes('三槓子'));

r = score(['1m','2m','3m','7m','8m','9m','1p','1p','1p','9s','9s','9s','1z','1z'], '3m');
assert.ok(r.breakdownParts.includes('混全帯么九'));
r = score(['1m','2m','3m','7m','8m','9m','1p','1p','1p','9s','9s','9s','1s','1s'], '3m');
assert.ok(r.breakdownParts.includes('純全帯么九'));
r = score(['1m','2m','3m','4m','5m','6m','7m','8m','9m','1m','1m','1m','5m','5m'], '9m');
assert.ok(r.breakdownParts.includes('清一色'));
r = score(['2m','2m','4m','4m','3p','3p','6p','6p','4s','4s','5s','5s','7s','7s'], '7s');
assert.equal(r.fu, 25);
assert.ok(r.breakdownParts.includes('七対子'));

r = score(['1m','2m','3m','1m','2m','3m','4m','5m','6m','4m','5m','6m','7p','7p'], '6m');
assert.ok(r.breakdownParts.includes('二盃口'));
assert.ok(!r.breakdownParts.includes('一盃口'));

r = score(['2p','2p','3p','3p','4p','4p','6p','6p','7p','7p','8p','8p','5z','5z'], '8p');
assert.ok(r.breakdownParts.includes('二盃口'), '七対子と通常形の両方が成立するとき高得点の通常形を選ぶ');
assert.ok(r.breakdownParts.includes('混一色'));

r = score(['5z','5z','5z','6z','6z','6z','7z','7z','7z','1z','1z','1z','2z','2z'], '2z');
assert.equal(r.yakumanUnits, 3, '大三元・四暗刻・字一色を複合する');
assert.equal(r.total, 96000);
r = score(['1m','2m','3m','4s','4s'], '3m', {
  isOpen: true,
  paoResponsibility: { daisangen: 'p2' },
  melds: [
    { type: 'pon', tiles: ['5z','5z','5z'], from: 'p3' },
    { type: 'pon', tiles: ['6z','6z','6z'], from: 'p4' },
    { type: 'pon', tiles: ['7z','7z','7z'], from: 'p2' }
  ]
});
assert.equal(r.pao[0].responsibleSeat, 'p2', '大三元の責任払い対象が採点結果に入る');

r = score(['1m','2m','3m','1p','2p','3p','1s','2s','3s','4z','4z','4z','5p','5p'], '1m', {
  isTsumo: true, dealer: true, tenhou: true
});
assert.equal(r.yakumanUnits, 1, '天和 is counted once alongside a standard hand');
assert.equal(r.breakdownParts.filter(x => x === '天和').length, 1);
r = score(['1m','2m','3m','1p','2p','3p','1s','2s','3s','4z','4z','4z','5p','5p'], '1m', {
  isTsumo: true, chiihou: true
});
assert.equal(r.yakumanUnits, 1, '地和 is counted once');
assert.equal(r.breakdownParts.filter(x => x === '地和').length, 1);

r = score(['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z','1m'], '1m');
assert.ok(r.isComplete, '国士無双');
assert.equal(r.yakumanUnits, 1);
r = score(['1z','1z','1z','2z','2z','2z','3z','3z','3z','1m','2m','3m','4z','4z'], '1m');
assert.ok(r.breakdownParts.includes('小四喜'));
r = score(['1z','1z','1z','2z','2z','2z','3z','3z','3z','4z','4z','4z','5z','5z'], '5z');
assert.ok(r.breakdownParts.includes('大四喜'));
assert.ok(r.breakdownParts.includes('字一色'));
r = score(['1m','1m','1m','9m','9m','9m','1p','1p','1p','9p','9p','9p','9s','9s'], '9s');
assert.ok(r.breakdownParts.includes('清老頭'));
r = score(['2s','2s','2s','3s','3s','3s','4s','4s','4s','6s','6s','6s','8s','8s'], '8s');
assert.ok(r.breakdownParts.includes('緑一色'));
r = score(['1m','1m','1m','2m','3m','4m','5m','5m','6m','7m','8m','9m','9m','9m'], '5m');
assert.ok(r.breakdownParts.includes('九蓮宝燈'));
r = score(['5z','5z'], '5z', { isOpen: true, melds: [
  { type: 'kan', subType: 'minkan', tiles: ['1m','1m','1m','1m'] },
  { type: 'kan', subType: 'minkan', tiles: ['2p','2p','2p','2p'] },
  { type: 'kan', subType: 'minkan', tiles: ['3s','3s','3s','3s'] },
  { type: 'kan', subType: 'minkan', tiles: ['4m','4m','4m','4m'] }
] });
assert.ok(r.breakdownParts.includes('四槓子'));

assert.equal(scorePoints(5, 30, false, true, 0).perDealer, 4000);
assert.equal(scorePoints(5, 30, false, true, 0).perNonDealer, 2000);
assert.equal(scorePoints(5, 30, true, true, 0).perAll, 4000);
assert.equal(scorePoints(2, 25, false, false, 0).total, 1600, 'M League seven-pairs base payment');
assert.equal(scorePoints(2, 25, true, false, 0).total, 2400);
assert.equal(scorePoints(13, 30, false, false, 0).tierName, '三倍満', 'M League does not count ordinary 13-han hands as yakuman');
assert.equal(scorePoints(13, 30, false, false, 0).total, 24000);
assert.equal(scorePoints(13, 30, true, false, 0).total, 36000);
assert.equal(scorePoints(13, 0, false, false, 1).total, 32000, 'explicit yakuman remain yakuman');

r = score(['1m','1m','1m','2p','2p','2p','3s','3s','3s','4m','5m','6m','8p','8p'], '6m');
assert.ok(r.breakdownParts.includes('三暗刻'), 'ron on a sequence preserves all three concealed triplets');
r = score(['1m','1m','1m','2p','2p','2p','3s','3s','3s','4m','5m','6m','8p','8p'], '1m', { riichi: true });
assert.ok(!r.breakdownParts.includes('三暗刻'), 'ron completing a shanpon triplet opens that triplet for yaku and fu');

r = score(['3p','4p','5p','4s','5s','6s','6s','7s','8s','1z','1z'], '4p', {
  isOpen: true,
  isTsumo: true,
  seatWindNum: 1,
  roundWindNum: 1,
  melds: [{ type: 'pon', tiles: ['5z','5z','5z'] }]
});
assert.equal(r.fu, 30, 'M League counts a double-wind pair as two fu');
assert.equal(r.han, 1);
r = score(['3p','4p','5p','4s','5s','6s','6s','7s','8s','2z','2z'], '4p', {
  isOpen: true, isTsumo: true, seatWindNum: 1, roundWindNum: 1,
  melds: [{ type: 'pon', tiles: ['1z','1z','1z'] }]
});
assert.equal(r.han, 2, 'double-wind triplet scores both seat and round wind yaku');

r = score(['1m','2m','3m','4m','5m','6m','7p','8p','9p','2s','3s','4s','8s','8s'], '8s', {
  riichi: true,
  doraIndicators: ['1m','1m'],
  uraIndicators: ['1m']
});
assert.ok(r.noYaku === false);
assert.ok(r.breakdownParts.includes('リーチ'));
assert.ok(r.breakdownParts.includes('ドラ2'), 'duplicate indicators each add a dora');
assert.ok(r.breakdownParts.includes('裏ドラ1'));

r = score(['1m','2m','3m','4m','5m','6m','7p','8p','9p','2s','3s','4s','8s','8s'], '8s', {
  doraIndicators: ['1m']
});
assert.equal(r.noYaku, true, 'dora alone never permits a win');

r = score(['4s','5s','6s','8p','8p'], '6s', {
  riichi: true,
  melds: [
    { type: 'kan', subType: 'ankan', concealed: true, tiles: ['1m','1m','1m','1m'] },
    { type: 'kan', subType: 'ankan', concealed: true, tiles: ['2m','2m','2m','2m'] },
    { type: 'kan', subType: 'ankan', concealed: true, tiles: ['3m','3m','3m','3m'] }
  ]
});
assert.ok(r.breakdownParts.includes('三暗刻'), 'concealed kans count as concealed triplets');

global.window = {};
global.render = () => {};
for (const file of ['js/game/state.js', 'js/game/round_scoring.js', 'js/game/calls.js', 'js/game/discards.js', 'js/game/turns.js', 'js/game/kans.js', 'js/game/call_actions.js']) {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}
const ronHand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','2p','3p','4p','5s'];
const player = (river = []) => ({
  hand: ronHand.slice(), river: river.slice(), wait: ['5s'], isTenpai: true,
  riichi: true, melds: [], isOpen: false, ippatsu: false
});
global.G = {
  players: { you: player(), p2: player(), p3: player(), p4: player() },
  dealerSeat: 'you', seatWind: { you: '東', p2: '南', p3: '西', p4: '北' },
  kyokuWind: '東', doraIndicators: [], uraIndicators: []
};
assert.equal(checkRon('5s', 'you'), 'p2', 'ron priority follows seat order from the discarder');
G.players.p2.wait = [];
assert.equal(checkRon('5s', 'you'), 'p2', 'ron is calculated from the dealt hand even before a saved wait is populated');
G.players.p2.river = ['5s'];
assert.equal(checkRon('5s', 'you'), 'p3', 'any own discard in the current wait set creates furiten');
G.players.p2.river = [];
assert.equal(checkRon('5s', 'p2'), 'p3', 'ron priority rotates with the discarder');
G.players.p3.passFuriten = true;
assert.equal(checkRon('5s', 'p2'), 'p4', 'a passed ron creates temporary furiten');
G.players.p3.permanentPassFuriten = true;
clearTemporaryFuriten('p3');
assert.equal(G.players.p3.passFuriten, true, 'riichi pass furiten survives later draws');

G = {
  players: { you: player(), p2: player(), p3: player(), p4: player() },
  dealerSeat: 'you', seatWind: { you: '東', p2: '南', p3: '西', p4: '北' },
  kyokuWind: '東', doraIndicators: [], uraIndicators: [], firstTurnUninterrupted: true,
  firstTsumoSeat: 'you', firstTsumoAvailable: true, firstDrawWindowSeat: null
};
recordDiscardScoringContext('you');
assert.equal(G.firstDrawWindowSeat, 'p2', 'the uninterrupted first-draw window starts after the dealer discards');
recordDiscardScoringContext('p2');
assert.equal(G.firstDrawWindowSeat, 'p3', 'chiihou remains possible for the next player');
recordDiscardScoringContext('p3');
assert.equal(G.firstDrawWindowSeat, 'p4');
recordDiscardScoringContext('p4');
assert.equal(G.firstDrawWindowSeat, null, 'chiihou window ends before the dealer begins a second draw');

G.players.you = player();
G.players.p2.hand = []; G.players.p2.wait = []; G.players.p2.riichi = false;
G.players.p3.hand = []; G.players.p3.wait = []; G.players.p3.riichi = false;
let resumedAfterRonPass = false;
assert.equal(checkRon('5s', 'p4', () => { resumedAfterRonPass = true; }), 'pending', 'a local human gets a ron declaration prompt');
assert.equal(G.pendingRonOffer.local, true);
assert.equal(resolveLocalRonAction(false), true);
assert.equal(G.players.you.passFuriten, true);
assert.equal(G.players.you.permanentPassFuriten, true, 'passing ron after riichi creates permanent furiten');
assert.equal(resumedAfterRonPass, true, 'passing ron resumes the interrupted discard sequence');

G.players.you.paoResponsibility = {};
G.players.you.melds = [
  { type: 'pon', tiles: ['5z','5z','5z'], from: 'p2' },
  { type: 'kan', subType: 'ankan', tiles: ['6z','6z','6z','6z'], concealed: true }
];
recordPaoResponsibility('you', { type: 'pon', tiles: ['7z','7z','7z'], from: 'p3' });
assert.equal(G.players.you.paoResponsibility.daisangen, 'p3', '三種類目の三元牌を鳴かせた相手を記録する');
G.players.you.paoResponsibility = {};
G.players.you.melds = [{ type: 'pon', tiles: ['5z','5z','5z'], from: 'p2' }];
recordPaoResponsibility('you', { type: 'pon', tiles: ['7z','7z','7z'], from: 'p3' });
assert.equal(G.players.you.paoResponsibility.daisangen, undefined, '三元牌が二種類そろう前の鳴きでは責任払いにならない');
G.players.you.paoResponsibility = {};
G.players.you.melds = [
  { type: 'pon', tiles: ['1z','1z','1z'], from: 'p2' },
  { type: 'pon', tiles: ['2z','2z','2z'], from: 'p3' },
  { type: 'kan', subType: 'ankan', tiles: ['3z','3z','3z','3z'], concealed: true }
];
recordPaoResponsibility('you', { type: 'pon', tiles: ['4z','4z','4z'], from: 'p4' });
assert.equal(G.players.you.paoResponsibility.daisuushii, 'p4', '四種類目の風牌を鳴かせた相手を記録する');
G.players.you.paoResponsibility = {};
G.players.you.melds = [
  { type: 'kan', subType: 'ankan', tiles: ['1m','1m','1m','1m'], concealed: true },
  { type: 'kan', subType: 'minkan', tiles: ['2m','2m','2m','2m'], from: 'p2' },
  { type: 'kan', subType: 'ankan', tiles: ['3m','3m','3m','3m'], concealed: true }
];
recordPaoResponsibility('you', { type: 'kan', subType: 'minkan', tiles: ['4m','4m','4m','4m'], from: 'p4' });
assert.equal(G.players.you.paoResponsibility.suukantsu, 'p4', '四種類目の槓を大明槓させた相手を記録する');
G.players.you.paoResponsibility = {};
G.players.you.melds = [
  { type: 'kan', subType: 'ankan', tiles: ['1m','1m','1m','1m'], concealed: true },
  { type: 'kan', subType: 'minkan', tiles: ['2m','2m','2m','2m'], from: 'p2' },
  { type: 'kan', subType: 'ankan', tiles: ['3m','3m','3m','3m'], concealed: true }
];
recordPaoResponsibility('you', { type: 'kan', subType: 'kakan', tiles: ['4m','4m','4m','4m'], from: 'p4' });
assert.equal(G.players.you.paoResponsibility.suukantsu, undefined, '加槓では四槓子の責任払いを作らない');

global.isPractice = true;
global.matchState = { riichiPool: 0, scores: { you: 25000, p2: 25000, p3: 25000, p4: 25000 } };
for (const file of ['js/game/settlement.js', 'js/game/match_results.js']) {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}
G = {
  scoresSettled: false, dealerSeat: 'p3', honba: 0,
  players: { you: player(), p2: player(), p3: player(), p4: player() }
};
settleScores({ type: 'opp_tsumo', seat: 'p2', score: { dealer: false, perDealer: 4000, perNonDealer: 2000 } });
assert.deepEqual(matchState.scores, { you: 23000, p2: 33000, p3: 21000, p4: 23000 }, 'rounded tsumo payments settle to all seats');
assert.equal(Object.values(matchState.scores).reduce((a, b) => a + b, 0), 100000);
settleScores({ type: 'opp_tsumo', seat: 'p2', score: { dealer: false, perDealer: 4000, perNonDealer: 2000 } });
assert.equal(matchState.scores.p2, 33000, 'settlement is applied only once');

matchState = { riichiPool: 0, scores: { you: 25000, p2: 25000, p3: 25000, p4: 25000 } };
G = { scoresSettled: false, dealerSeat: 'p4', honba: 1, players: { you: player(), p2: player(), p3: player(), p4: player() } };
settleScores({ type: 'other_ron', ronner: 'you', discarder: 'p3', score: { dealer: false, total: 32000, pao: [{ yaku: '大三元', responsibleSeat: 'p2' }] } });
assert.deepEqual(G.settleDiffs, { you: 32300, p2: -16300, p3: -16000, p4: 0 }, '放銃者と責任払い者が役満点を折半し、本場は責任払い者が負担する');
assert.equal(Object.values(G.settleDiffs).reduce((a, b) => a + b, 0), 0);

matchState = { riichiPool: 0, scores: { you: 25000, p2: 25000, p3: 25000, p4: 25000 } };
G = { scoresSettled: false, dealerSeat: 'p3', honba: 1, players: { you: player(), p2: player(), p3: player(), p4: player() } };
settleScores({ type: 'user_tsumo', score: { dealer: false, perDealer: 16000, perNonDealer: 8000, total: 32000, pao: [{ yaku: '大三元', responsibleSeat: 'p2' }] } });
assert.deepEqual(G.settleDiffs, { you: 32300, p2: -32300, p3: 0, p4: 0 }, 'ツモの責任払いでは責任者が役満点と本場を全額負担する');
assert.equal(Object.values(G.settleDiffs).reduce((a, b) => a + b, 0), 0);

matchState = { riichiPool: 0, scores: { you: 25000, p2: 25000, p3: 25000, p4: 25000 } };
G = { scoresSettled: false, dealerSeat: 'p3', honba: 1, players: { you: player(), p2: player(), p3: player(), p4: player() } };
settleScores({ type: 'user_tsumo', score: { dealer: false, perDealer: 32000, perNonDealer: 16000, total: 64000, pao: [{ yaku: '大三元', responsibleSeat: 'p2' }] } });
assert.deepEqual(G.settleDiffs, { you: 64300, p2: -40300, p3: -16000, p4: -8000 }, '複合役満では責任を負う役満分と本場を支払い、残りを通常精算する');
assert.equal(Object.values(G.settleDiffs).reduce((a, b) => a + b, 0), 0);

for (const t of TEMPLATES) {
  let full = templateFullTiles(t).slice();
  const winIndex = full.findIndex(x => isSameTileType(x, t.winTile));
  if (winIndex >= 0) full.splice(winIndex, 1);
  const openMelds = (t.melds || []).filter(m => !m.concealed).map(m => ({
    type: m.type === 'run' ? 'chi' : 'pon', tiles: meldTiles(m)
  }));
  for (const meld of openMelds) for (const tile of meld.tiles) {
    const i = full.findIndex(x => isSameTileType(x, tile));
    if (i >= 0) full.splice(i, 1);
  }
  full.push(t.winTile);
  const q = scoreHand(full, t.winTile, openMelds, {
    isTsumo: false, isOpen: t.isOpen,
    riichi: t.riichiMode === 'forced', seatWindNum: 2, roundWindNum: 1
  });
  assert.ok(q.isComplete && !q.noYaku, 'quiz template should have a valid yaku: ' + t.id);
}

console.log('scoring tests passed');
