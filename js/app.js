/**
 * 巴菲特桥牌H5 - 游戏核心逻辑
 * 24张卡牌，牌背(图腾) → 牌面A(谜面) → 牌面B(结果)
 */
(function () {
  'use strict';

  const MAX_INVEST = 6;
  const SWIPE_THRESHOLD = 80;
  const TOTAL_CARDS = CARDS.length;

  const state = {
    deck: [],
    currentIndex: 0,
    invested: [],
    passed: [],
    remaining: MAX_INVEST,
    isAnimating: false,
    cardEl: null
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    intro: $('#screen-intro'),
    game: $('#screen-game'),
    result: $('#screen-result')
  };

  /** Fisher-Yates 洗牌 */
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** 平衡洗牌：前5张至少包含成功和失败各1张 */
  function balancedShuffle(cards) {
    const types = ['success', 'failure'];
    let attempts = 0;
    let deck;
    do {
      deck = shuffle(cards);
      const first5Types = new Set(deck.slice(0, 5).map(c => c.type));
      if (types.every(t => first5Types.has(t))) break;
      attempts++;
    } while (attempts < 100);
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

  function initIntro() {
    var btnStart = document.getElementById('btn-start');
    if (!btnStart) return;

    btnStart.onclick = function() {
      btnStart.disabled = true;
      var videoStart = document.getElementById('videoStart');
      var videoChupai = document.getElementById('videoChupai');
      var videoWrap = document.querySelector('.intro-video-wrap');
      var introOverlay = document.querySelector('.intro-overlay');

      // 隐藏文字区
      if (introOverlay) {
        introOverlay.style.transition = 'opacity 0.4s ease';
        introOverlay.style.opacity = '0';
        introOverlay.style.pointerEvents = 'none';
      }

      // 停止循环视频
      if (videoStart) videoStart.pause();

      // 尝试播放出牌视频
      if (videoChupai) {
        videoChupai.classList.add('active');
        videoChupai.currentTime = 0;
        var p = videoChupai.play();
        if (p && p.then) {
          p.then(function() {
            videoChupai.onended = function() {
              doTransition(videoWrap);
            };
            // 兜底
            setTimeout(function() { doTransition(videoWrap); }, 15000);
          }).catch(function() {
            doTransition(videoWrap);
          });
        } else {
          doTransition(videoWrap);
        }
      } else {
        doTransition(videoWrap);
      }
    };
  }

  function doTransition(videoWrap) {
    if (gameStarted) return;
    gameStarted = true;
    if (videoWrap) videoWrap.classList.add('blur-out');
    setTimeout(function() { startGame(); }, 600);
  }

  // ========== 游戏逻辑 ==========
  function startGame() {
    gameStarted = false;
    state.deck = balancedShuffle(CARDS);
    state.currentIndex = 0;
    state.invested = [];
    state.passed = [];
    state.remaining = MAX_INVEST;
    state.isAnimating = false;

    showScreen('game');
    renderCard();
    updateStatus();
  }

  function updateStatus() {
    $('.status-progress').innerHTML = `第 <span>${state.currentIndex + 1}/${TOTAL_CARDS}</span> 张`;
    $('.chance-badge').textContent = state.remaining;
    $$('.invest-dot').forEach((dot, i) => {
      dot.classList.toggle('filled', i < MAX_INVEST - state.remaining);
    });
  }

  function renderCard() {
    if (state.currentIndex >= TOTAL_CARDS || state.remaining <= 0) {
      finishGame();
      return;
    }

    const card = state.deck[state.currentIndex];
    const area = $('.card-area');
    const old = area.querySelector('.game-card');
    if (old) old.remove();

    const el = document.createElement('div');
    el.className = 'game-card card-enter';
    el.innerHTML = `
      <div class="card-front-content">
        <div class="front-totem-row">
          <img class="front-totem-small" src="${card.totemImg}" alt="">
        </div>
        <div class="card-divider"></div>
        <div class="card-riddle">${card.riddle}</div>
      </div>
      <div class="swipe-indicator invest"></div>
      <div class="swipe-indicator pass"></div>
    `;

    area.appendChild(el);
    state.cardEl = el;
    bindSwipe(el);
  }

  // ========== 滑动手势（全局单例管理） ==========
  let _swipeCleanup = null;

  function bindSwipe(el) {
    // 先清理上一张卡牌的事件
    if (_swipeCleanup) {
      _swipeCleanup();
      _swipeCleanup = null;
    }

    let directionLocked = null;
    let dragging = false;
    let startX = 0, startY = 0, currentX = 0;

    const onStart = (e) => {
      if (state.isAnimating) return;
      dragging = true;
      directionLocked = null;
      const point = e.touches ? e.touches[0] : e;
      startX = point.clientX;
      startY = point.clientY;
      currentX = 0;
      el.style.transition = 'none';
    };

    const onMove = (e) => {
      if (!dragging || state.isAnimating) return;
      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;

      if (!directionLocked) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          directionLocked = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
        }
        return;
      }

      if (directionLocked === 'vertical') return;

      e.preventDefault();
      currentX = dx;

      const riddle = el.querySelector('.card-riddle');
      if (riddle) riddle.style.overflowY = 'hidden';

      const rotateY = Math.min(Math.max(dx * 0.08, -25), 25);
      el.style.transform = `translateX(${dx}px) perspective(800px) rotateY(${rotateY}deg)`;
    };

    const onEnd = () => {
      if (!dragging || state.isAnimating) return;
      dragging = false;

      const riddle = el.querySelector('.card-riddle');
      if (riddle) riddle.style.overflowY = '';

      if (directionLocked !== 'horizontal') {
        directionLocked = null;
        return;
      }
      directionLocked = null;

      if (Math.abs(currentX) > SWIPE_THRESHOLD) {
        completeSwipe(el, currentX > 0);
      } else {
        el.style.transition = 'transform 0.3s ease';
        el.style.transform = '';
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    // 保存清理函数
    _swipeCleanup = () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('mousedown', onStart);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      dragging = false;
    };
  }

  function completeSwipe(el, isInvest) {
    if (state.isAnimating) return;
    state.isAnimating = true;

    // 立即清理事件
    if (_swipeCleanup) {
      _swipeCleanup();
      _swipeCleanup = null;
    }

    const card = state.deck[state.currentIndex];
    el.style.transition = '';
    el.classList.add(isInvest ? 'fly-right' : 'fly-left');

    if (isInvest) {
      state.invested.push({ ...card, userChoice: 'invest' });
      state.remaining--;
    } else {
      state.passed.push({ ...card, userChoice: 'pass' });
    }

    setTimeout(() => {
      state.currentIndex++;
      state.isAnimating = false;
      updateStatus();
      renderCard();
    }, 500);
  }

  // ========== Toast ==========
  function showToast(text, type) {
    let toast = $('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.className = `toast ${type}`;
    toast.textContent = text;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // ========== 结果计算 ==========
  function finishGame() {
    // 把所有未翻到的牌也记录（用户没有机会看的牌）
    for (let i = state.currentIndex; i < TOTAL_CARDS; i++) {
      const c = state.deck[i];
      if (!state.invested.find(x => x.id === c.id) && !state.passed.find(x => x.id === c.id)) {
        state.passed.push({ ...c, userChoice: 'unseen' });
      }
    }

    let correctCount = 0;
    state.invested.forEach(card => {
      if (card.isCorrectToInvest) correctCount++;
    });
    const titleObj = TITLES.find(t => correctCount >= t.min && correctCount <= t.max);
    showScreen('result');
    renderResult(correctCount, titleObj);
  }

  function renderResult(correctCount, titleObj) {
    const container = $('#screen-result');
    let totalScore = 0;
    state.invested.forEach(card => { totalScore += card.scoreValue; });

    const scoreDisplay = totalScore > 0 ? `+${totalScore}%` : `${totalScore}%`;

    // 6张牌背HTML
    let cardsGridHTML = '';
    state.invested.forEach((card, i) => {
      cardsGridHTML += `
        <div class="result-mini-card" data-id="${card.id}" data-index="${i}">
          <img class="mini-card-bg" src="./image/card.png" alt="牌背">
          <img class="mini-card-totem" src="${card.totemImg}" alt="${card.totemName}">
        </div>
      `;
    });

    // 用户放弃的牌
    const passedCards = state.passed;
    let othersHTML = '';
    passedCards.forEach((card, i) => {
      othersHTML += `
        <div class="result-mini-card" data-id="${card.id}" data-source="passed">
          <img class="mini-card-bg" src="./image/card.png" alt="牌背">
          <img class="mini-card-totem" src="${card.totemImg}" alt="${card.totemName}">
        </div>
      `;
    });

    container.innerHTML = `
      <!-- 顶部英雄区 -->
      <div class="result-hero">
        <div class="result-hero-info">
          <div class="result-hero-title">${titleObj.emoji} ${titleObj.title}</div>
          <div class="result-stat-row">
            <div class="result-stat-card">
              <div class="sv">${correctCount}/${MAX_INVEST}</div>
              <div class="sl">正确决策</div>
            </div>
            <div class="result-stat-card">
              <div class="sv">${scoreDisplay}</div>
              <div class="sl">累计收益率</div>
            </div>
          </div>
          <div class="result-hero-desc">${titleObj.desc}</div>
        </div>
        <div class="result-video-corner">
          <video autoplay loop muted playsinline>
            <source src="./final.mp4" type="video/mp4">
          </video>
        </div>
      </div>

      <!-- 投资组合 -->
      <div class="result-section-label">你的投资组合</div>
      <div class="result-cards-grid">
        ${cardsGridHTML}
      </div>

      <!-- 放弃的机会 -->
      ${passedCards.length > 0 ? `
      <div class="result-passed-section">
        <div class="result-section-label">那些被你放弃的机会</div>
        <div class="result-cards-grid">
          ${othersHTML}
        </div>
      </div>
      ` : ''}

      <div class="result-actions">
        <button class="btn-action btn-replay">再来一局</button>
        <button class="btn-action btn-share">分享战绩</button>
      </div>
      <div class="result-footer">伯克希尔哈撒韦 2026 股东会特别策划</div>
    `;

    bindResultEvents();
  }

  function bindResultEvents() {
    const container = $('#screen-result');

    // 所有牌背点击 → 弹出翻牌弹窗
    container.querySelectorAll('.result-mini-card').forEach(mc => {
      mc.addEventListener('click', () => {
        const id = parseInt(mc.dataset.id);
        const cardData = state.invested.find(c => c.id === id)
          || state.passed.find(c => c.id === id)
          || CARDS.find(c => c.id === id);
        if (cardData) showFlipModal(cardData);
      });
    });

    const replay = container.querySelector('.btn-replay');
    if (replay) replay.addEventListener('click', () => startGame());

    const share = container.querySelector('.btn-share');
    if (share) share.addEventListener('click', () => showToast('分享功能即将上线', 'invest'));
  }

  // ========== 翻牌弹窗 ==========
  function showFlipModal(card) {
    let overlay = $('.flip-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'flip-modal-overlay';
      document.body.appendChild(overlay);
    }

    const typeConf = TYPE_LABELS[card.type];
    const isCorrect = card.isCorrectToInvest;
    const userInvested = state.invested.find(c => c.id === card.id);
    const userPassed = state.passed.find(c => c.id === card.id);

    // 巴菲特的决策
    const buffettChoice = card.isCorrectToInvest ? '投资' : '不投资';
    const buffettChoiceClass = card.isCorrectToInvest ? 'correct' : 'wrong';

    // 用户的决策
    let userVerdictHTML = '';
    if (userInvested) {
      const match = isCorrect;
      userVerdictHTML = `
        <div class="flip-verdict ${match ? 'correct' : 'wrong'}">
          你的选择：投资 ${match ? '✓ 与巴菲特一致' : '✗ 与巴菲特相反'}
        </div>`;
    } else if (userPassed) {
      const match = !isCorrect;
      userVerdictHTML = `
        <div class="flip-verdict ${match ? 'correct' : 'wrong'}">
          你的选择：放弃 ${match ? '✓ 与巴菲特一致' : '✗ 与巴菲特相反'}
        </div>`;
    }

    overlay.innerHTML = `
      <div class="flip-card-container">
        <div class="flip-modal-close" id="flipClose">✕</div>
        <div class="flip-card-inner face-a" id="flipInner">
          <!-- 正面A：公司信息 -->
          <div class="flip-face flip-face-a">
            <img class="flip-totem" src="${card.totemImg}" alt="">
            <div class="flip-company">${card.answer}</div>
            <span class="flip-type-tag" style="background:${typeConf.bgColor};color:${typeConf.color}">${typeConf.text}</span>
            <div class="flip-buffett-choice ${buffettChoiceClass}">巴菲特的选择：${buffettChoice}</div>
            ${userVerdictHTML}
            <div class="flip-result-label">投资结局</div>
            <div class="flip-result-text">${card.investResult}</div>
            <div class="flip-cta" id="flipCta">看看巴菲特怎么说 →</div>
          </div>
          <!-- 背面B：巴菲特理论 -->
          <div class="flip-face flip-face-b">
            <div class="flip-b-icon">🃏</div>
            <div class="flip-b-label">巴菲特投资理论</div>
            <div class="flip-b-theory">${card.theory}</div>
            <div class="flip-b-quote">${card.buffettQuote}</div>
          </div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => overlay.classList.add('show'));

    const flipInner = overlay.querySelector('#flipInner');
    const flipCta = overlay.querySelector('#flipCta');
    const flipClose = overlay.querySelector('#flipClose');

    // 点击"看看巴菲特怎么说" → 翻到B面
    flipCta.addEventListener('click', (e) => {
      e.stopPropagation();
      flipInner.classList.remove('face-a');
      flipInner.classList.add('face-b');
    });

    // 点击B面 → 翻回A面
    overlay.querySelector('.flip-face-b').addEventListener('click', (e) => {
      e.stopPropagation();
      flipInner.classList.remove('face-b');
      flipInner.classList.add('face-a');
    });

    // 关闭
    flipClose.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.remove('show');
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('show');
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
