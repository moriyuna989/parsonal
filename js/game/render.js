// js/game/render.js
// 対局画面の組み立てと再描画

function settingsRowHtml() {
  if (isPractice) {
    var cpuLevel = (matchState && matchState.cpuLevel) || 'hard';
    var levelText = cpuLevel === 'easy' ? 'CPU: 初級' : (cpuLevel === 'normal' ? 'CPU: 中級' : 'CPU: 上級（仲林プロAI）');
    return '<div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">' +
      '<span style="font-size:12px; font-weight:700; color:var(--accent); background:var(--surface-alt); border:1px solid var(--line); border-radius:999px; padding:3px 12px;">実践編（対局モード）</span>' +
      '<span style="font-size:12px; font-weight:700; color:var(--ink); background:var(--surface); border:1px solid var(--line); border-radius:999px; padding:3px 10px;">' + levelText + '</span>' +
      '</div>';
  }
  return '<div class="settings-row"><label class="toggle-switch">' +
    '<input type="checkbox" id="toggleDamaten"' + (allowDamaten ? ' checked' : '') + ' />' +
    '<span class="track"></span><span>ダマテンあり（相手がリーチせず聴牌を隠すことがある）</span>' +
    '</label></div>';
}

function render() {
  var html = '<div class="card">';
  html += settingsRowHtml();
  html += '<div class="table-grid">' +
    '<div class="seat-toimen">' + oppBlockHtml('p3') + '</div>' +
    '<div class="seat-kamicha">' + oppBlockHtml('p4') + '</div>' +
    '<div class="seat-center">' + centerInfoHtml() + '</div>' +
    '<div class="seat-shimocha">' + oppBlockHtml('p2') + '</div>' +
    '<div class="seat-you-mini">' + youMiniHtml() + '</div>' +
    '</div>';
  html += '<div class="you-block">';
  if (G.gameOver) {
    // reveal shown separately below
  } else if (G.pendingRonOffer) {
    html += youStatusHtml();
    html += youMeldsHtml();
    html += youHandHtml();
    html += pendingRonOfferHtml();
  } else if (G.processing) {
    html += youStatusHtml();
    html += youMeldsHtml();
    html += youHandHtml();
    html += '<div class="processing-note">相手の番です…</div>';
  } else if (G.pendingCall) {
    html += youStatusHtml();
    html += youMeldsHtml();
    html += youHandHtml();
    html += pendingCallHtml();
  } else {
    html += youStatusHtml();
    html += youMeldsHtml();
    html += youHandHtml();
    html += legendHtml();
    html += controlsHtml();
  }
  html += '</div>';
  if (G.gameOver) html += revealHtml();
  html += '</div>';

  var root = document.getElementById('tgRoot');
  if (root) root.innerHTML = html;
  if (typeof wireEvents === 'function') {
    wireEvents();
  } else if (window.wireEvents) {
    window.wireEvents();
  }
}
window.render = render;

