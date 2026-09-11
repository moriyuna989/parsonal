// =====================================================================
// js/app.js
// ルーター・画面遷移・全体エントリーポイント
// =====================================================================

var appEl = document.getElementById('app');
var practiceConfig = { rounds: 4, redDora: true, cpuLevel: 'hard' };

function shellHtml(eyebrow, title, bodyId) {
  return '<div class="stage"><div class="topbar"><span class="back-link" id="backHome">← ホーム</span></div>' +
    '<div class="masthead"><div class="eyebrow">' + eyebrow + '</div><h1>' + title + '</h1></div>' +
    '<div id="' + bodyId + '"></div></div>';
}

function wireBack() {
  var backBtn = document.getElementById('backHome');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (window._tgKeyHandler) {
        window.removeEventListener('keydown', window._tgKeyHandler);
        window._tgKeyHandler = null;
      }
      if (typeof OnlinePeer !== 'undefined' && OnlinePeer.disconnect) {
        OnlinePeer.disconnect();
      }
      goHome();
    });
  }
}

function homeHtml() {
  return '<div class="stage">' +
    '<div class="masthead"><div class="eyebrow">MAHJONG TRAINING</div><h1>麻雀トレーニング</h1></div>' +
    '<div class="home-cards">' +
    '<button class="nav-card" id="navPractice"><span class="nav-title">実践編（対局）</span>' +
    '<span class="nav-desc">配牌（0巡目）から局をプレイします。他プレイヤーと一緒にツモ・打牌を進め、テンパイやアガリを目指します。</span></button>' +
    '<button class="nav-card" id="navOnline" style="border-color: rgba(30, 144, 255, 0.4);"><span class="nav-title" style="color: #1e90ff;">通信対戦（オンライン） 🌐</span>' +
    '<span class="nav-desc">インターネット経由で離れた友達とリアルタイム対戦！足りない枠はCPUが自動で埋めてすぐに対戦可能です。</span></button>' +
    '<button class="nav-card" id="navTraining"><span class="nav-title">アタリ牌回避訓練場</span>' +
    '<span class="nav-desc">相手のリーチに対してどの牌を切るか練習します。あがる・振り込む・流局するまで対局が続きます。</span></button>' +
    '<button class="nav-card" id="navQuiz"><span class="nav-title">点数計算ドリル</span>' +
    '<span class="nav-desc">アガリの手牌から翻・符・点数を自分で計算する全10問のドリルです。</span></button>' +
    '</div></div>';
}

function wireHome() {
  var btnPractice = document.getElementById('navPractice');
  if (btnPractice) btnPractice.addEventListener('click', goPractice);

  var btnOnline = document.getElementById('navOnline');
  if (btnOnline) btnOnline.addEventListener('click', goOnline);

  var btnTraining = document.getElementById('navTraining');
  if (btnTraining) btnTraining.addEventListener('click', goTraining);

  var btnQuiz = document.getElementById('navQuiz');
  if (btnQuiz) btnQuiz.addEventListener('click', goQuiz);
}

function goHome() {
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = homeHtml();
  wireHome();
}

function goOnline() {
  if (typeof OnlineGame !== 'undefined' && OnlineGame.openOnlineLobby) {
    OnlineGame.openOnlineLobby();
  }
}

function goQuiz() {
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = shellHtml('MAHJONG SCORING DRILL', '点数計算ドリル', 'quizRoot') +
    '<div class="footnote" id="quizFootnote"></div>';
  wireBack();
  initQuiz();
}

function renderPracticeSettings() {
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = shellHtml('PRACTICE MATCH', '実践編（対局）設定', 'settingsRoot');
  wireBack();
  var root = document.getElementById('settingsRoot');
  root.innerHTML = '<div class="settings-card">' +
    '<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">' +
      '<h2 class="settings-title" style="margin-bottom: 0;">対局ルール設定</h2>' +
      '<span class="mleague-badge">Mリーグルール採用</span>' +
    '</div>' +
    '<div class="settings-desc">対局の長さ（局数）、赤ドラ、およびCPUの強さを選択してください。</div>' +
    '<div class="settings-rule-box">' +
      '<div><strong>【採用ルール】</strong> 25,000点持ち／30,000点返し（オカ20pt）、順位ウマ 1位:+30 / 2位:+10 / 3位:-10 / 4位:-30（実質順位点 +50 / +10 / -10 / -30）</div>' +
      '<div style="margin-top: 4px; font-size: 11px;">※対局終了時の最終持ち点から、Mリーグ公式ルールに基づき最終成績ポイント（pt）が算出されます。</div>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">局数（試合の長さ）</div>' +
      '<div class="settings-options" id="optRoundsGroup">' +
        '<div class="settings-option' + (practiceConfig.rounds === 1 ? ' selected' : '') + '" data-val="1">一局戦<span class="opt-sub">全1局</span></div>' +
        '<div class="settings-option' + (practiceConfig.rounds === 4 ? ' selected' : '') + '" data-val="4">東風戦<span class="opt-sub">全4局（推奨）</span></div>' +
        '<div class="settings-option' + (practiceConfig.rounds === 8 ? ' selected' : '') + '" data-val="8">半荘戦<span class="opt-sub">全8局</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">赤牌（赤ドラ）</div>' +
      '<div class="settings-options" id="optRedGroup">' +
        '<div class="settings-option' + (practiceConfig.redDora ? ' selected' : '') + '" data-val="1">あり<span class="opt-sub">赤5萬・赤5筒・赤5索 各1枚（Mリーグ準拠）</span></div>' +
        '<div class="settings-option' + (!practiceConfig.redDora ? ' selected' : '') + '" data-val="0">なし<span class="opt-sub">赤牌なし</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">CPUレベル（対戦相手の強さ）</div>' +
      '<div class="settings-options" id="optCpuLevelGroup">' +
        '<div class="settings-option' + (practiceConfig.cpuLevel === 'easy' ? ' selected' : '') + '" data-val="easy">初級<span class="opt-sub">攻撃重視・守備甘め</span></div>' +
        '<div class="settings-option' + (practiceConfig.cpuLevel === 'normal' ? ' selected' : '') + '" data-val="normal">中級<span class="opt-sub">標準的・現物警戒</span></div>' +
        '<div class="settings-option' + (practiceConfig.cpuLevel === 'hard' ? ' selected' : '') + '" data-val="hard">上級<span class="opt-sub">仲林プロAI・徹底守備（推奨）</span></div>' +
      '</div>' +
    '</div>' +
    '<button class="btn-main" id="btnStartPracticeMatch" style="margin-top: 10px; width: 100%;">対局を開始する</button>' +
  '</div>';

  var roundOpts = root.querySelectorAll('#optRoundsGroup .settings-option');
  roundOpts.forEach(function (el) {
    el.addEventListener('click', function () {
      roundOpts.forEach(function (o) { o.classList.remove('selected'); });
      el.classList.add('selected');
      practiceConfig.rounds = parseInt(el.getAttribute('data-val'), 10);
    });
  });

  var redOpts = root.querySelectorAll('#optRedGroup .settings-option');
  redOpts.forEach(function (el) {
    el.addEventListener('click', function () {
      redOpts.forEach(function (o) { o.classList.remove('selected'); });
      el.classList.add('selected');
      practiceConfig.redDora = (el.getAttribute('data-val') === '1');
    });
  });

  var cpuOpts = root.querySelectorAll('#optCpuLevelGroup .settings-option');
  cpuOpts.forEach(function (el) {
    el.addEventListener('click', function () {
      cpuOpts.forEach(function (o) { o.classList.remove('selected'); });
      el.classList.add('selected');
      practiceConfig.cpuLevel = el.getAttribute('data-val');
    });
  });

  document.getElementById('btnStartPracticeMatch').addEventListener('click', function () {
    startPracticeMatch(practiceConfig);
  });
}

function goPractice() {
  renderPracticeSettings();
}

function startPracticeMatch(config) {
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = shellHtml('PRACTICE MATCH', '実践編（対局）', 'tgRoot');
  wireBack();
  var match = {
    rounds: config.rounds,
    redDora: config.redDora,
    cpuLevel: config.cpuLevel || 'hard',
    kyokuIndex: 1,
    maxKyoku: config.rounds,
    roundName: config.rounds === 1 ? '一局戦' : (config.rounds === 4 ? '東風戦' : '半荘戦'),
    kyokuWind: '東',
    kyokuNum: 1,
    honba: 0,
    riichiPool: 0,
    scores: { you: 25000, p2: 25000, p3: 25000, p4: 25000 },
    dealerSeat: 'you'
  };
  initTraining('practice', match);
}

function goTraining() {
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = shellHtml('DEAL-IN AVOIDANCE DOJO', 'アタリ牌回避訓練場', 'tgRoot');
  wireBack();
  initTraining('training');
}

// ================= BOOT =================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', goHome);
} else {
  goHome();
}
