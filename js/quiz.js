// =====================================================================
// js/quiz.js
// 点数計算ドリル（クイズ）画面・出題・正誤判定ロジック
// =====================================================================

function initQuiz() {
  var TOTAL = 10;
  var state = { round: 0, score: 0, current: null, answered: false, history: [] };
  var root = document.getElementById('quizRoot');
  root.innerHTML = '<div class="progress" id="progress"></div><div class="card" id="card"></div>';
  document.getElementById('quizFootnote').textContent =
    'アガリの手牌から翻・符を自分で計算し、点数を入力してください。ドラ表示牌の次の牌がドラです（例: 3pの表示なら4pがドラ、9なら1に戻ります。字牌は東→南→西→北→東、白→發→中→白の順）。ツモであがった場合は支払いの内訳（親のツモは「オール」、子のツモは「子・親」の順）で答えます。';

  var progressEl = document.getElementById('progress');
  var cardEl = document.getElementById('card');

  function makeQuestion() {
    var t = pickWeightedTemplate();
    var dealer = Math.random() < 0.5;
    var kyokuWind = Math.random() < 0.5 ? '東' : '南';
    var kyokuNumber = 1 + Math.floor(Math.random() * 4);
    var seatWind = dealer ? '東' : ['南', '西', '北'][Math.floor(Math.random() * 3)];
    var winType = Math.random() < 0.5 ? 'ron' : 'tsumo';
    var isTsumo = winType === 'tsumo';
    var riichiActive = t.riichiMode === 'forced' ? true : (t.riichiMode === 'optional' ? Math.random() < 0.5 : false);
    var ippatsuActive = riichiActive && (Math.random() < 0.25);

    var full = templateFullTiles(t);
    var winIdx = full.indexOf(t.winTile);
    var concealed = full.slice();
    if (winIdx !== -1) concealed.splice(winIdx, 1);
    else concealed.pop();

    var quizMelds = [];
    if (t.isOpen && t.melds) {
      t.melds.forEach(function (m) {
        if (!m.concealed) {
          var mTiles = meldTiles(m);
          quizMelds.push({
            type: m.type === 'run' ? 'chi' : 'pon',
            tiles: mTiles,
            from: m.from || (m.type === 'run' ? 'kamicha' : 'toimen'),
            calledTile: mTiles[0]
          });
          mTiles.forEach(function (code) {
            var idx = concealed.indexOf(code);
            if (idx !== -1) concealed.splice(idx, 1);
          });
        }
      });
    }
    concealed = sortTiles(concealed);

    var doraIndicator = null, doraCount = 0, uraIndicator = null, uraDoraCount = 0, redDoraCount = 0;
    if (!t.isYakuman) {
      doraIndicator = randomTileCode();
      var doraTile = nextTile(doraIndicator);
      doraCount = full.filter(function (c) { return isSameTileType(c, doraTile); }).length;
      redDoraCount = full.filter(isRedTile).length;
      if (riichiActive) {
        uraIndicator = randomTileCode();
        var uraTile = nextTile(uraIndicator);
        uraDoraCount = full.filter(function (c) { return isSameTileType(c, uraTile); }).length;
      }
    }

    var yakuHan = isTsumo ? t.yakuHanTsumo : t.yakuHanRon;
    var han = t.isYakuman ? 13 : (yakuHan + (riichiActive ? 1 : 0) + (ippatsuActive ? 1 : 0) + doraCount + redDoraCount + (riichiActive ? uraDoraCount : 0));
    var fu = t.isYakuman ? 0 : computeFu(t, isTsumo);

    var tier = tierForHan(han);
    var base = null;
    if (!tier) {
      base = fu * Math.pow(2, 2 + han);
      if (base > 2000) { base = 2000; tier = { name: '満貫', nondealer: 8000, dealer: 12000 }; }
    }

    var total, perAll = null, perDealer = null, perNonDealer = null;
    if (tier) {
      total = dealer ? tier.dealer : tier.nondealer;
      if (isTsumo) {
        if (dealer) perAll = total / 3;
        else { perNonDealer = total / 4; perDealer = total / 2; }
      }
    } else {
      if (isTsumo) {
        if (dealer) { perAll = roundUp100(base * 2); total = perAll * 3; }
        else { perDealer = roundUp100(base * 2); perNonDealer = roundUp100(base * 1); total = perDealer + perNonDealer * 2; }
      } else {
        total = dealer ? roundUp100(base * 6) : roundUp100(base * 4);
      }
    }

    var yakuNames = (t.isYakuman ? t.yakuNamesRon : (isTsumo ? t.yakuNamesTsumo : t.yakuNamesRon)).slice();
    var parts = yakuNames.slice();
    if (!t.isYakuman) {
      if (riichiActive) parts.push('リーチ');
      if (ippatsuActive) parts.push('一発');
      if (doraCount > 0) parts.push('ドラ' + doraCount);
      if (redDoraCount > 0) parts.push('赤ドラ' + redDoraCount);
      if (riichiActive && uraDoraCount > 0) parts.push('裏ドラ' + uraDoraCount);
    }
    var breakdownText = t.isYakuman
      ? (parts.join('+') + ' → 役満')
      : (parts.join('+') + ' = ' + han + '翻' + (tier ? '（' + tier.name + '）' : ' ' + fu + '符'));

    return {
      t: t, dealer: dealer, winType: winType, isTsumo: isTsumo,
      kyokuWind: kyokuWind, kyokuNumber: kyokuNumber, seatWind: seatWind,
      concealed: concealed, winTile: t.winTile, melds: quizMelds,
      riichiActive: riichiActive, ippatsuActive: ippatsuActive,
      doraIndicator: doraIndicator, uraIndicator: uraIndicator,
      total: total, perAll: perAll, perDealer: perDealer, perNonDealer: perNonDealer,
      tierName: tier ? tier.name : null, breakdownText: breakdownText
    };
  }

  function scoreTableHtml() {
    var hans = [1, 2, 3, 4];
    function ronCell(fu, han, dealer) {
      var tier = tierForHan(han);
      if (tier) return (dealer ? tier.dealer : tier.nondealer).toLocaleString();
      var base = fu * Math.pow(2, 2 + han);
      if (base > 2000) return dealer ? '12,000' : '8,000';
      return roundUp100(base * (dealer ? 6 : 4)).toLocaleString();
    }
    function tsumoNonDealerCell(fu, han) {
      var tier = tierForHan(han);
      if (tier) return (tier.nondealer / 4).toLocaleString() + '・' + (tier.nondealer / 2).toLocaleString();
      var base = fu * Math.pow(2, 2 + han);
      if (base > 2000) return '2,000・4,000';
      return roundUp100(base).toLocaleString() + '・' + roundUp100(base * 2).toLocaleString();
    }
    function tsumoDealerCell(fu, han) {
      var tier = tierForHan(han);
      if (tier) return (tier.dealer / 3).toLocaleString();
      var base = fu * Math.pow(2, 2 + han);
      if (base > 2000) return '4,000';
      return roundUp100(base * 2).toLocaleString();
    }
    function buildTable(title, fus, cellFn) {
      var head = '<tr><th>符＼翻</th>' + hans.map(function (h) { return '<th>' + h + '翻</th>'; }).join('') + '</tr>';
      var rows = fus.map(function (fu) {
        return '<tr><th>' + fu + '符</th>' + hans.map(function (han) { return '<td>' + cellFn(fu, han) + '</td>'; }).join('') + '</tr>';
      }).join('');
      return '<div class="score-table-block"><div class="score-table-title">' + title + '</div>' +
        '<div class="score-table-scroll"><table class="score-table">' + head + rows + '</table></div></div>';
    }
    var fusRon = [25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
    var fusTsumo = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
    var html = '';
    html += buildTable('子・ロン', fusRon, function (fu, han) { return ronCell(fu, han, false); });
    html += buildTable('親・ロン', fusRon, function (fu, han) { return ronCell(fu, han, true); });
    html += buildTable('子・ツモ（子・親の順）', fusTsumo, tsumoNonDealerCell);
    html += buildTable('親・ツモ（オール）', fusTsumo, tsumoDealerCell);
    var manganRows = [
      ['満貫（5翻）', '8,000', '12,000'], ['跳満（6〜7翻）', '12,000', '18,000'],
      ['倍満（8〜10翻）', '16,000', '24,000'], ['三倍満（11〜12翻）', '24,000', '36,000'],
      ['役満（13翻〜）', '32,000', '48,000']
    ];
    html += '<div class="score-table-block"><div class="score-table-title">満貫以上（符に関わらず固定）</div>' +
      '<div class="score-table-scroll"><table class="score-table mangan-table"><tr><th></th><th>子</th><th>親</th></tr>' +
      manganRows.map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>'; }).join('') +
      '</table></div></div>';
    return html;
  }

  function renderProgress() {
    progressEl.innerHTML = '';
    for (var i = 0; i < TOTAL; i++) {
      var chip = document.createElement('div');
      chip.className = 'chip';
      if (i < state.history.length) chip.setAttribute('data-state', state.history[i].correct ? 'correct' : 'wrong');
      else if (i === state.round) chip.setAttribute('data-state', 'current');
      progressEl.appendChild(chip);
    }
  }

  function tilesRowHtml(q) {
    var html = q.concealed.map(function (c) { return tileEl(c); }).join('');
    html += tileEl(q.winTile, 'win');
    var meldsHtml = (q.melds && q.melds.length)
      ? '<div class="quiz-melds">' + renderMeldsHtml(q.melds, 'you') + '</div>'
      : '';
    return '<div class="tiles-wrap"><div class="tiles-row">' + html + meldsHtml + '</div></div>';
  }

  function infoStripHtml(q) {
    var parts = [];
    if (q.doraIndicator) parts.push('<div class="indicator">' + tileEl(q.doraIndicator) + '<span class="cap">ドラ表示</span></div>');
    if (q.riichiActive && q.uraIndicator) parts.push('<div class="indicator">' + tileEl(q.uraIndicator) + '<span class="cap">裏ドラ表示</span></div>');
    if (!parts.length) return '';
    return '<div class="info-strip">' + parts.join('') + '</div>';
  }

  function inputRowHtml(q) {
    if (q.winType === 'ron') {
      return '<div class="input-row"><div class="tray"><input id="ansMain" type="number" inputmode="numeric" placeholder="0" autocomplete="off" /><span class="suffix">点</span></div></div>';
    }
    if (q.dealer) {
      return '<div class="input-row"><div class="tray"><input id="ansMain" type="number" inputmode="numeric" placeholder="0" autocomplete="off" /><span class="suffix">点 オール</span></div></div>';
    }
    return '<div class="input-row dual">' +
      '<div class="tray"><span class="label">子</span><input id="ansChild" type="number" inputmode="numeric" placeholder="0" autocomplete="off" /><span class="suffix">点</span></div>' +
      '<span class="connector">・</span>' +
      '<div class="tray"><span class="label">親</span><input id="ansDealer" type="number" inputmode="numeric" placeholder="0" autocomplete="off" /><span class="suffix">点</span></div>' +
      '</div>';
  }

  function renderQuestion() {
    var q = state.current;
    var pills = '<span class="pill strong">' + (q.dealer ? '親' : '子') + '</span>' +
      '<span class="pill">' + q.seatWind + '家</span>' +
      '<span class="pill strong">' + (q.winType === 'ron' ? 'ロン' : 'ツモ') + '</span>';
    if (q.riichiActive) pills += '<span class="pill riichi">リーチ</span>';
    if (q.ippatsuActive) pills += '<span class="pill ippatsu">一発</span>';
    cardEl.innerHTML =
      '<div class="qnum"><span>問題 ' + (state.round + 1) + ' / ' + TOTAL + '</span><span class="qnum-kyoku">' + q.kyokuWind + q.kyokuNumber + '局</span></div>' +
      '<div class="situation">' + pills + '</div>' +
      tilesRowHtml(q) + infoStripHtml(q) + inputRowHtml(q) +
      '<button class="btn-main" id="submitBtn">回答する</button>' +
      '<div class="feedback" id="feedback"></div>';
    document.getElementById('submitBtn').addEventListener('click', function () { handleSubmit(); });
    var inputs = cardEl.querySelectorAll('input');
    inputs.forEach(function (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSubmit(); }); });
    if (inputs.length) inputs[0].focus();
  }

  function handleSubmit() {
    if (state.answered) { advance(); return; }
    var q = state.current;
    var correct, givenText;
    if (q.winType === 'ron' || q.dealer) {
      var input = document.getElementById('ansMain');
      var raw = input.value.trim();
      if (raw === '') { input.focus(); return; }
      var val = parseInt(raw, 10);
      var expected = q.winType === 'ron' ? q.total : q.perAll;
      correct = val === expected;
      givenText = isNaN(val) ? '―' : (q.winType === 'ron' ? (val.toLocaleString() + '点') : (val.toLocaleString() + '点オール'));
      input.disabled = true;
    } else {
      var childInput = document.getElementById('ansChild');
      var dealerInput = document.getElementById('ansDealer');
      var rawC = childInput.value.trim(), rawD = dealerInput.value.trim();
      if (rawC === '' || rawD === '') { (rawC === '' ? childInput : dealerInput).focus(); return; }
      var valC = parseInt(rawC, 10), valD = parseInt(rawD, 10);
      correct = valC === q.perNonDealer && valD === q.perDealer;
      givenText = (isNaN(valC) ? '―' : valC.toLocaleString()) + '・' + (isNaN(valD) ? '―' : valD.toLocaleString()) + '点';
      childInput.disabled = true; dealerInput.disabled = true;
    }
    state.answered = true;
    state.history.push({ q: q, correct: correct });
    if (correct) state.score++;
    var feedback = document.getElementById('feedback');
    feedback.className = 'feedback show ' + (correct ? 'correct' : 'wrong');
    var lines = '<div class="headline">' + (correct ? '正解！' : '不正解') + '</div>';
    var correctText;
    if (q.winType === 'ron') correctText = q.total.toLocaleString() + '点';
    else if (q.dealer) correctText = q.perAll.toLocaleString() + '点オール（合計 ' + q.total.toLocaleString() + '点）';
    else correctText = q.perNonDealer.toLocaleString() + '・' + q.perDealer.toLocaleString() + '点（合計 ' + q.total.toLocaleString() + '点）';
    lines += '<div class="detail">正解は ' + correctText + ' です';
    if (!correct) lines += '　※ 入力: ' + givenText;
    lines += '</div><div class="yaku">' + q.breakdownText + '</div>';
    lines += '<div class="score-table-toggle"><button class="btn-ghost2" id="btnShowScoreTable">点数表を見る</button></div>';
    lines += '<div class="score-table-wrap" id="scoreTableWrap" style="display:none;">' + scoreTableHtml() + '</div>';
    feedback.innerHTML = lines;
    document.getElementById('submitBtn').textContent = state.round === TOTAL - 1 ? '結果を見る' : '次の問題へ';
    renderProgress();
    document.getElementById('btnShowScoreTable').addEventListener('click', function () {
      var wrap = document.getElementById('scoreTableWrap');
      var isHidden = wrap.style.display === 'none';
      wrap.style.display = isHidden ? 'flex' : 'none';
      this.textContent = isHidden ? '点数表を閉じる' : '点数表を見る';
    });
  }

  function advance() {
    state.round++;
    if (state.round >= TOTAL) { renderResult(); }
    else { state.answered = false; state.current = makeQuestion(); renderProgress(); renderQuestion(); }
  }

  function renderResult() {
    renderProgress();
    var listHtml = state.history.map(function (h, i) {
      var q = h.q;
      var cond = (q.dealer ? '親' : '子') + '/' + (q.winType === 'ron' ? 'ロン' : 'ツモ');
      var ansText = q.winType === 'ron' ? (q.total.toLocaleString() + '点')
        : q.dealer ? (q.perAll.toLocaleString() + '点オール')
          : (q.perNonDealer.toLocaleString() + '・' + q.perDealer.toLocaleString() + '点');
      return '<div class="review-item"><span class="r-cond">' + (i + 1) + '. ' + cond + '</span>' +
        '<span class="r-mark ' + (h.correct ? 'correct' : 'wrong') + '">' + (h.correct ? '○' : '✕') + '</span>' +
        '<span class="r-ans">' + ansText + '</span></div>';
    }).join('');
    cardEl.innerHTML = '<div class="result-score"><div class="label">RESULT</div><div class="big">' + state.score + '<small> / ' + TOTAL + '</small></div></div>' +
      '<button class="btn-main" id="retryBtn">もう一度挑戦する</button><div class="review-list">' + listHtml + '</div>';
    document.getElementById('retryBtn').addEventListener('click', function () {
      state.round = 0; state.score = 0; state.answered = false; state.history = [];
      state.current = makeQuestion(); renderProgress(); renderQuestion();
    });
  }

  state.current = makeQuestion();
  renderProgress();
  renderQuestion();
}
