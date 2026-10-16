const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'mahjong_training.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="(js\/[^\"]+)"\s*><\/script>/g)]
  .map(match => match[1])
  .filter(file => file !== 'js/app.js');

const seats = [
  { seat: 'you', name: 'ホスト（あなた）', id: 'host-peer', isCpu: false },
  { seat: 'p2', name: '対戦相手 (南家)', id: 'guest-peer', isCpu: false },
  { seat: 'p3', name: 'CPU (対面)', id: null, isCpu: true },
  { seat: 'p4', name: 'CPU (上家)', id: null, isCpu: true }
];

function createContext(isHost, myLogicalSeat) {
  const app = { innerHTML: '' };
  const rootElement = { innerHTML: '', querySelectorAll: () => [] };
  const eventTarget = { addEventListener() {} };
  const context = {
    console,
    setTimeout: () => 0,
    clearTimeout() {},
    document: {
      getElementById(id) {
        if (id === 'app') return app;
        if (id === 'onlineRoot') return rootElement;
        return eventTarget;
      }
    }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of scripts) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }

  context.OnlinePeer = {
    isHost: () => isHost,
    getRoomCode: () => 'ABCD'
  };
  context.shellHtml = () => '';
  context.wireBack = () => {};
  vm.runInContext(
    'OnlineGameRuntime.isOnline = true; OnlineGameRuntime.myLogicalSeat = ' + JSON.stringify(myLogicalSeat) +
      '; OnlineGameRuntime.seatsConfig = ' + JSON.stringify(seats) + ';',
    context
  );
  context.matchState = null;
  context.G = {
    gameOver: false,
    outcome: null,
    dealerSeat: 'you',
    seatWind: { you: '東', p2: '南', p3: '西', p4: '北' },
    players: {
      you: { hand: [], river: [], melds: [], riichi: false, ippatsu: false, wait: [] },
      p2: { hand: [], river: [], melds: [], riichi: false, ippatsu: false, wait: [] },
      p3: { hand: [], river: [], melds: [], riichi: false, ippatsu: false, wait: [] },
      p4: { hand: [], river: [], melds: [], riichi: false, ippatsu: false, wait: [] }
    }
  };
  return { context, app, rootElement };
}

function assertIdentityMarkup(markup, expectedLabels) {
  for (const label of expectedLabels) assert.ok(markup.includes(label), `expected ${label} in identity markup`);
  assert.ok(!markup.includes('あなた'), 'online identity markup must not use the ambiguous あなた label');
}

const host = createContext(true, 'you');
assert.equal(host.context.OnlineGame.getSeatInfo('you').name, '自分（ホスト）');
assert.equal(host.context.OnlineGame.getSeatInfo('p2').name, '対戦相手');
assert.equal(host.context.OnlineGame.getSeatInfo('p3').name, 'CPU');
assertIdentityMarkup(host.context.youMiniHtml(), ['自分（ホスト）']);
assertIdentityMarkup(host.context.oppBlockHtml('p2'), ['対戦相手']);
assertIdentityMarkup(host.context.allHandsHtml(), ['自分（ホスト）', '対戦相手', 'CPU']);
host.context.renderLobby();
assertIdentityMarkup(host.rootElement.innerHTML, ['自分（ホスト）', '対戦相手', 'CPU']);
assert.equal((host.rootElement.innerHTML.match(/自分（ホスト）/g) || []).length, 1);

const guest = createContext(false, 'p2');
assert.equal(guest.context.OnlineGame.getSeatInfo('you').name, '自分');
assert.equal(guest.context.OnlineGame.getSeatInfo('p4').name, 'ホスト');
assert.equal(guest.context.OnlineGame.getSeatInfo('p3').name, 'CPU');
assertIdentityMarkup(guest.context.youMiniHtml(), ['自分']);
assertIdentityMarkup(guest.context.oppBlockHtml('p4'), ['ホスト']);
assertIdentityMarkup(guest.context.allHandsHtml(), ['自分', 'ホスト', 'CPU']);
guest.context.renderLobby();
assertIdentityMarkup(guest.rootElement.innerHTML, ['自分', 'ホスト', 'CPU']);
assert.equal((guest.rootElement.innerHTML.match(/自分/g) || []).length, 1);

console.log('online identity tests passed');
