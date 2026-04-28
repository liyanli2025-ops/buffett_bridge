/**
 * 巴菲特桥牌H5 - 游戏核心逻辑 V2 (方案C)
 * 牌背(谜面) → 翻牌 → 牌面(投资价值+按钮决策) → 下一张
 * 结算页：双翻牌（牌背→公司揭晓→巴菲特点评）
 */
(function () {
  'use strict';

  const DEAL_COUNT = 6;

  const state = {
    deck: [],
    currentIndex: 0,
    choices: [],
    isAnimating: false
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    intro: $('#screen-intro'),
    game: $('#screen-game'),
    result: $('#screen-result')
  };

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function drawCards(cards, count) {
    let attempts = 0;
    let deck;
    do {
      deck = shuffle(cards).slice(0, count);
      const s = deck.filter(c => c.type === 'success').length;
      const f = deck.filter(c => c.type === 'failure').length;
      if (s >= 2 && f >= 1) break;
      attempts++;
    } while (attempts < 200);
    return deck;
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
      el.classList.toggle('hidden', key !== name);
    });
  }

  // ========== 开屏页 ==========
  var gameStarted = false;
  var introTransitionDone = false;

  function initIntro() {
    var btnStart = document.getElementById('btn-start');
    if (!btnStart) return;

    btnStart.onclick = function () {
      if (introTransitionDone) return;
      btnStart.disabled = true;
      var videoStart = document.getElementById('videoStart');
      var videoChupai = document.getElementById('videoChupai');
      var videoWrap = document.querySelector('.intro-video-wrap');
      var introOverlay = document.querySelector('.intro-overlay');

      if (introOverlay) {
        introOverlay.style.transition = 'opacity 0.4s ease';
        introOverlay.style.opacity = '0';
        introOverlay.style.pointerEvents = 'none';
      }
      if (videoStart) videoStart.pause();

      if (videoChupai) {
        videoChupai.classList.add('active');
        videoChupai.currentTime = 0;
        var p = videoChupai.play();
        if (p && p.then) {
          p.then(function () {
            videoChupai.onended = function () { doTransition(videoWrap); };
            setTimeout(function () { doTransition(videoWrap); }, 15000);
          }).catch(function () { doTransition(videoWrap); });
        } else { doTransition(videoWrap); }
      } else { doTransition(videoWrap); }
    };
  }

  function doTransition(videoWrap) {
    if (introTransitionDone) return;
    introTransitionDone = true;
    if (videoWrap) videoWrap.classList.add('blur-out');
    setTimeout(function () { startGame(); }, 600);
  }

  // ========== 游戏逻辑 ==========
  function startGame() {
    if (gameStarted) return;
    gameStarted = true;

    state.deck = drawCards(CARDS, DEAL_COUNT);
    state.currentIndex = 0;
    state.choices = [];
    state.isAnimating = false;

    $$('.progress-dot').forEach(dot => { dot.className = 'progress-dot'; });

    showScreen('game');
    updateStatus();
    renderCard();

    setTimeout(() => { gameStarted = false; }, 800);
  }

  function updateStatus() {
    $('.status-progress').innerHTML = `第 <span>${Math.min(state.currentIndex + 1, DEAL_COUNT)}/${DEAL_COUNT}</span> 张`;
  }

  // ========== 方案C：牌背(谜面) + 翻牌 → 牌面(投资价值+按钮) ==========
  function renderCard() {
    if (state.currentIndex >= DEAL_COUNT) {
      finishGame();
      return;
    }

    const card = state.deck[state.currentIndex];
    const area = $('.card-area');
    const old = area.querySelector('.game-card-wrap');
    if (old) old.remove();

    const info = card.valueInfo || {};
    const metricsHTML = (info.metrics || []).map(m =>
      `<span class="vp-metric-tag"><span class="vp-metric-label">${m.label}</span><span class="vp-metric-value">${m.value}</span></span>`
    ).join('');
    const prosHTML = (info.pros || []).map(p => `<span class="vp-tag pro">${p}</span>`).join('');
    const consHTML = (info.cons || []).map(c => `<span class="vp-tag con">${c}</span>`).join('');

    const wrap = document.createElement('div');
    wrap.className = 'game-card-wrap card-enter';
    wrap.innerHTML = `
      <div class="gc-flipper">
        <!-- 牌背：谜面 -->
        <div class="gc-face gc-back">
          <div class="gc-back-inner">
            <img class="gc-totem" src="${card.totemImg}" alt="${card.totemName}" onerror="this.style.display='none'">
            <div class="gc-riddle">${card.riddle}</div>
            <div class="gc-flip-btn">翻牌查看详情</div>
          </div>
        </div>
        <!-- 牌面：投资价值 -->
        <div class="gc-face gc-front">
          <div class="gc-front-inner">
            <div class="gc-front-header">
              <img class="gc-front-totem" src="${card.totemImg}" alt="" onerror="this.style.display='none'">
              <div class="gc-front-time">${info.time || ''}</div>
            </div>
            ${metricsHTML ? `<div class="gc-section"><div class="gc-section-title">财务指标</div><div class="gc-metrics">${metricsHTML}</div></div>` : ''}
            <div class="gc-section"><div class="gc-section-title">优势</div><div class="gc-tags">${prosHTML}</div></div>
            <div class="gc-section"><div class="gc-section-title">风险</div><div class="gc-tags">${consHTML}</div></div>
            <div class="gc-detail">${info.detail || ''}</div>
            <div class="gc-actions">
              <button class="gc-btn gc-btn-pass" data-choice="pass">放弃</button>
              <button class="gc-btn gc-btn-invest" data-choice="invest">投资</button>
            </div>
          </div>
        </div>
      </div>
    `;

    area.appendChild(wrap);

    // 点击牌背翻牌
    const backFace = wrap.querySelector('.gc-back');
    backFace.addEventListener('click', () => {
      if (state.isAnimating) return;
      wrap.classList.add('flipped');
    });

    // 投资/放弃按钮
    wrap.querySelectorAll('.gc-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.isAnimating) return;
        const isInvest = btn.dataset.choice === 'invest';
        makeChoice(wrap, card, isInvest);
      });
    });
  }

  function makeChoice(wrap, card, isInvest) {
    if (state.isAnimating) return;
    if (state.currentIndex >= DEAL_COUNT) return;
    state.isAnimating = true;

    // 记录选择
    state.choices.push({ card: card, userChoice: isInvest ? 'invest' : 'pass' });

    // 更新进度点
    const dots = $$('.progress-dot');
    const dot = dots[state.currentIndex];
    if (dot) {
      dot.classList.add('filled');
      dot.classList.add(isInvest ? 'invest' : 'pass');
    }

    // 卡片飞出动画
    wrap.classList.add(isInvest ? 'fly-right' : 'fly-left');

    state.currentIndex++;

    setTimeout(() => {
      state.isAnimating = false;
      updateStatus();
      renderCard();
    }, 500);
  }

  // ========== 结果计算 ==========
  function finishGame() {
    let correctCount = 0;
    state.choices.forEach(({ card, userChoice }) => {
      const isCorrect = (userChoice === 'invest' && card.isCorrectToInvest) ||
        (userChoice === 'pass' && !card.isCorrectToInvest);
      if (isCorrect) correctCount++;
    });
    const titleObj = TITLES.find(t => correctCount >= t.min && correctCount <= t.max);
    showScreen('result');
    renderResult(correctCount, titleObj);
  }

  function renderResult(correctCount, titleObj) {
    const container = $('#screen-result');

    let cardsGridHTML = '';
    state.choices.forEach((choice, i) => {
      cardsGridHTML += `
        <div class="result-flip-card" data-index="${i}" data-flip="0">
          <div class="rfc-inner">
            <div class="rfc-face rfc-back">
              <img class="rfc-totem" src="${choice.card.totemImg}" alt="${choice.card.totemName}" onerror="this.style.display='none'">
              <div class="rfc-totem-name">${choice.card.totemName}</div>
              <div class="rfc-tap-hint">点击翻牌</div>
            </div>
            <div class="rfc-face rfc-front-b">
              ${buildFaceBHTML(choice)}
            </div>
            <div class="rfc-face rfc-front-c">
              ${buildFaceCHTML(choice)}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="result-video-hero">
        <video autoplay loop muted playsinline>
          <source src="./final.mp4" type="video/mp4">
        </video>
        <div class="result-video-overlay">
          <div class="result-overlay-stat">
            <div class="overlay-sv">${correctCount}/${DEAL_COUNT}</div>
            <div class="overlay-sl">正确决策</div>
          </div>
        </div>
      </div>
      <div class="result-title-section">
        <div class="result-title-text">${titleObj.emoji} ${titleObj.title}</div>
        <div class="result-title-desc">${titleObj.desc}</div>
      </div>
      <div class="result-section-label">点击每张牌，揭晓真相</div>
      <div class="result-flip-grid">${cardsGridHTML}</div>
      <div class="result-actions hidden" id="resultActions">
        <button class="btn-action btn-replay">再来一局</button>
      </div>
      <div class="result-footer">伯克希尔哈撒韦 2026 股东会特别策划</div>
    `;

    bindResultFlipEvents(container);
  }

  function buildFaceBHTML(choice) {
    const card = choice.card;
    const userChoice = choice.userChoice;
    const isCorrect = (userChoice === 'invest' && card.isCorrectToInvest) ||
      (userChoice === 'pass' && !card.isCorrectToInvest);
    const choiceLabel = userChoice === 'invest' ? '你选择了投资' : '你选择了放弃';
    const resultIcon = isCorrect ? '✓' : '✗';
    const resultText = isCorrect ? '正确决策' : '错误决策';
    const resultCls = isCorrect ? 'correct' : 'wrong';

    return `
      <div class="rfb-badge ${resultCls}">
        <span class="rfb-badge-icon">${resultIcon}</span>
        <span>${choiceLabel} · ${resultText}</span>
      </div>
      <div class="rfb-company">${card.answer}</div>
      <div class="rfb-type ${card.type}">${TYPE_LABELS[card.type].text}</div>
      <div class="rfb-result">${card.investResult}</div>
      <div class="rfb-next-hint">再次点击 → 看巴菲特怎么说</div>
    `;
  }

  function buildFaceCHTML(choice) {
    const card = choice.card;
    const quoteHTML = card.buffettQuote ? card.buffettQuote.replace(/\n/g, '<br>') : '';
    return `
      <div class="rfc-icon">🃏</div>
      <div class="rfc-label">巴菲特怎么说</div>
      <div class="rfc-theory">${card.theory}</div>
      ${quoteHTML ? `<div class="rfc-quote">${quoteHTML}</div>` : ''}
    `;
  }

  function bindResultFlipEvents(container) {
    let revealedCount = 0;

    container.querySelectorAll('.result-flip-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.dataset.flip === '2') return;
        const idx = parseInt(card.dataset.index);
        const choice = state.choices[idx];
        openCardModal(choice, card, () => {
          if (card.dataset.flip !== '2') {
            card.dataset.flip = '2';
            card.classList.add('revealed');
            revealedCount++;
            if (revealedCount >= DEAL_COUNT) {
              setTimeout(() => {
                const actions = container.querySelector('#resultActions');
                if (actions) {
                  actions.classList.remove('hidden');
                  actions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
              }, 600);
            }
          }
        });
      });
    });

    const replay = container.querySelector('.btn-replay');
    if (replay) replay.addEventListener('click', () => startGame());
  }

  /* ========== 放大纸牌弹窗 ========== */
  function openCardModal(choice, triggerCard, onClose) {
    const card = choice.card;
    const userChoice = choice.userChoice;
    const isCorrect = (userChoice === 'invest' && card.isCorrectToInvest) ||
      (userChoice === 'pass' && !card.isCorrectToInvest);
    const choiceLabel = userChoice === 'invest' ? '你选择了投资' : '你选择了放弃';
    const resultIcon = isCorrect ? '✓' : '✗';
    const resultText = isCorrect ? '正确决策' : '错误决策';
    const resultCls = isCorrect ? 'correct' : 'wrong';
    const quoteHTML = card.buffettQuote ? card.buffettQuote.replace(/\n/g, '<br>') : '';
    const typeLabel = TYPE_LABELS[card.type];

    const overlay = document.createElement('div');
    overlay.className = 'flip-modal-overlay';
    overlay.innerHTML = `
      <div class="flip-card-container">
        <button class="flip-modal-close">✕</button>
        <div class="flip-card-inner face-a">
          <!-- 面A：公司揭晓 -->
          <div class="flip-face flip-face-a">
            <div class="flip-hero">
              <div class="flip-hero-accent ${card.type}"></div>
              <img class="flip-totem" src="${card.totemImg}" alt="${card.totemName}" onerror="this.style.display='none'">
              <div class="flip-hero-divider"></div>
            </div>
            <div class="flip-info">
              <div class="flip-match-badge ${resultCls}">
                <span>${resultIcon}</span>
                <span>${choiceLabel} · ${resultText}</span>
              </div>
              <div class="flip-header">
                <span class="flip-company">${card.answer}</span>
                <span class="flip-type-tag ${card.type}">${typeLabel.text}</span>
              </div>
              <div class="flip-result-section">
                <div class="flip-result-label">投资结局</div>
                <div class="flip-result-text">${card.investResult}</div>
              </div>
              <div class="flip-cta" id="modalFlipBtn">翻牌 → 看巴菲特怎么说</div>
            </div>
          </div>
          <!-- 面B：巴菲特点评 -->
          <div class="flip-face flip-face-b">
            <div class="flip-b-content">
              <div class="flip-b-icon">🃏</div>
              <div class="flip-b-label">巴菲特怎么说</div>
              <div class="flip-b-theory">${card.theory}</div>
              ${quoteHTML ? `<div class="flip-b-quote">${quoteHTML}</div>` : ''}
            </div>
            <div class="flip-b-back-hint" id="modalBackBtn">← 翻回查看详情</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { overlay.classList.add('show'); });
    });

    const inner = overlay.querySelector('.flip-card-inner');
    const flipBtn = overlay.querySelector('#modalFlipBtn');
    const backBtn = overlay.querySelector('#modalBackBtn');
    const closeBtn = overlay.querySelector('.flip-modal-close');

    flipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      inner.classList.remove('face-a');
      inner.classList.add('face-b');
    });
    backBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      inner.classList.remove('face-b');
      inner.classList.add('face-a');
    });

    function closeModal() {
      overlay.classList.remove('show');
      setTimeout(() => {
        overlay.remove();
        if (onClose) onClose();
      }, 400);
    }

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // ========== 初始化 ==========
  function init() {
    initIntro();
    showScreen('intro');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
