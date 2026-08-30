// cycles.js — 読書サイクル管理（気づき記録・if-thenプラン・X投稿）

const Cycles = {
  INSIGHT_MIN: 5,       // 気づき記録タイマー（分）
  insightTimer: null,
  insightElapsed: 0,
  pendingBookId: null,
  pendingDuration: 0,

  // =========================================================
  // サイクル完了コールバック（timer.js から呼ばれる）
  // =========================================================
  onCycleComplete(bookId, duration) {
    this.pendingBookId = bookId;
    this.pendingDuration = duration;
    App.navigate('cycle-insight', bookId);
  },

  // =========================================================
  // 気づき記録画面の初期化
  // =========================================================
  renderInsightScreen(bookId) {
    // タイトル
    const todayCycles = this.getByDate(todayISO()).filter(c => c.bookId === bookId);
    const cycleNum = todayCycles.length + 1;
    const titleEl = document.getElementById('cycle-insight-title');
    if (titleEl) titleEl.textContent = `サイクル #${cycleNum} — 気づきを記録`;

    const durationEl = document.getElementById('cycle-book-duration');
    if (durationEl) {
      const min = Math.floor(this.pendingDuration / 60);
      durationEl.textContent = `読書時間: ${min}分`;
    }

    // フォームをリセット
    const fields = ['cycle-insight-text', 'cycle-if-situation', 'cycle-if-action',
      'cycle-if-place', 'cycle-x-text'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const dateEl = document.getElementById('cycle-planned-date');
    if (dateEl) {
      // 翌日をデフォルト
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateEl.value = tomorrow.toISOString().slice(0, 10);
    }
    const postedEl = document.getElementById('cycle-x-posted');
    if (postedEl) postedEl.checked = false;

    // 気づきタイマー開始
    this.startInsightTimer();
  },

  // =========================================================
  // 気づき記録タイマー
  // =========================================================
  startInsightTimer() {
    this.insightElapsed = 0;
    clearInterval(this.insightTimer);
    const totalSec = this.INSIGHT_MIN * 60;

    this.insightTimer = setInterval(() => {
      this.insightElapsed++;
      const remaining = Math.max(0, totalSec - this.insightElapsed);
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      const el = document.getElementById('insight-timer-display');
      if (el) {
        el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (remaining <= 60) el.classList.add('urgent');
        else el.classList.remove('urgent');
        if (remaining <= 0) {
          el.textContent = '⏰ 時間です！';
          clearInterval(this.insightTimer);
        }
      }
    }, 1000);
  },

  stopInsightTimer() {
    clearInterval(this.insightTimer);
    this.insightTimer = null;
  },

  // =========================================================
  // X投稿テキスト自動生成
  // =========================================================
  generateXText() {
    const insight = (document.getElementById('cycle-insight-text')?.value || '').trim();
    const sit = (document.getElementById('cycle-if-situation')?.value || '').trim();
    const act = (document.getElementById('cycle-if-action')?.value || '').trim();

    let text = '';
    if (insight) text += `💡 ${insight}`;
    if (sit && act) {
      text += `${text ? '\n\n' : ''}📌 if-thenプラン\n「${sit}」→「${act}」`;
    }
    text += `${text ? '\n\n' : ''}#アクティブリーディング #読書記録`;

    const xEl = document.getElementById('cycle-x-text');
    if (xEl) xEl.value = text;
  },

  postToX() {
    const text = (document.getElementById('cycle-x-text')?.value || '').trim();
    if (!text) {
      alert('投稿テキストを入力するか「テキスト生成」ボタンで生成してください');
      return;
    }
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    const postedEl = document.getElementById('cycle-x-posted');
    if (postedEl) postedEl.checked = true;
  },

  // =========================================================
  // サイクル保存
  // =========================================================
  saveCycle() {
    const insight = (document.getElementById('cycle-insight-text')?.value || '').trim();
    const situation = (document.getElementById('cycle-if-situation')?.value || '').trim();
    const action = (document.getElementById('cycle-if-action')?.value || '').trim();
    const place = (document.getElementById('cycle-if-place')?.value || '').trim();
    const plannedDate = document.getElementById('cycle-planned-date')?.value || todayISO();
    const xText = (document.getElementById('cycle-x-text')?.value || '').trim();
    const xPosted = document.getElementById('cycle-x-posted')?.checked || false;

    const cycle = {
      id: generateUUID(),
      bookId: this.pendingBookId,
      date: todayISO(),
      duration: this.pendingDuration,
      insight,
      ifThen: {
        situation,
        action,
        place,
        plannedDate,
        executed: false,
        executedDate: null,
        executedNote: '',
      },
      xPostText: xText,
      xPosted,
      createdAt: nowISO(),
    };

    this.stopInsightTimer();
    Storage.addItem(Storage.KEYS.READING_CYCLES, cycle);

    const bookId = this.pendingBookId;
    this.pendingBookId = null;
    this.pendingDuration = 0;

    App.navigate('book-detail', bookId);
    App.activateTab('cycles');
    return cycle;
  },

  cancelCycle() {
    this.stopInsightTimer();
    const bookId = this.pendingBookId;
    this.pendingBookId = null;
    this.pendingDuration = 0;
    if (bookId) App.navigate('book-detail', bookId);
    else App.navigate('home');
  },

  // =========================================================
  // データアクセス
  // =========================================================
  getByBook(bookId) {
    return Storage.getByField(Storage.KEYS.READING_CYCLES, 'bookId', bookId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getByDate(date) {
    return Storage.getAll(Storage.KEYS.READING_CYCLES)
      .filter(c => c.date === date)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  getAll() {
    return Storage.getAll(Storage.KEYS.READING_CYCLES);
  },

  toggleExecuted(cycleId) {
    const cycles = Storage.getAll(Storage.KEYS.READING_CYCLES);
    const idx = cycles.findIndex(c => c.id === cycleId);
    if (idx === -1) return;
    const wasExecuted = cycles[idx].ifThen.executed;
    cycles[idx].ifThen.executed = !wasExecuted;
    cycles[idx].ifThen.executedDate = !wasExecuted ? todayISO() : null;
    Storage.save(Storage.KEYS.READING_CYCLES, cycles);
  },

  // =========================================================
  // 本詳細画面のサイクル一覧
  // =========================================================
  renderBookCycles(bookId) {
    const container = document.getElementById('cycle-list');
    if (!container) return;

    const cycles = this.getByBook(bookId);
    if (cycles.length === 0) {
      container.innerHTML = '<p class="empty-message">まだサイクルはありません。タイマーで10分・15分を選んで読書を始めましょう！</p>';
      return;
    }

    container.innerHTML = cycles.map((c, i) => {
      const num = cycles.length - i;
      const hasIfThen = c.ifThen && c.ifThen.situation && c.ifThen.action;
      return `
      <div class="cycle-card">
        <div class="cycle-card-header">
          <span class="cycle-num">サイクル #${num}</span>
          <span class="cycle-date">${formatDate(c.date)}</span>
          <span class="cycle-duration-badge">${Math.floor(c.duration / 60)}分</span>
        </div>
        ${c.insight ? `
        <div class="cycle-insight-preview">
          <span class="cycle-field-icon">💡</span>
          <span>${Book.escapeHtml(c.insight)}</span>
        </div>` : ''}
        ${hasIfThen ? `
        <div class="cycle-ifthen-card ${c.ifThen.executed ? 'executed' : ''}">
          <div class="ifthen-header">
            <span class="ifthen-icon">📌</span>
            <span class="ifthen-label">if-thenプラン</span>
            ${c.ifThen.executed ? '<span class="ifthen-done-badge">✅ 実行済み</span>' : ''}
          </div>
          <div class="ifthen-text">
            <span class="ifthen-if">if:</span> ${Book.escapeHtml(c.ifThen.situation)}<br>
            <span class="ifthen-then">then:</span> ${Book.escapeHtml(c.ifThen.action)}
          </div>
          ${c.ifThen.place ? `<div class="ifthen-place">🗓 ${Book.escapeHtml(c.ifThen.place)}</div>` : ''}
          ${c.ifThen.plannedDate ? `<div class="ifthen-planned">実行予定: ${formatDate(c.ifThen.plannedDate)}</div>` : ''}
          <label class="ifthen-check-label">
            <input type="checkbox" ${c.ifThen.executed ? 'checked' : ''}
              onchange="Cycles.toggleExecuted('${c.id}'); Cycles.renderBookCycles('${bookId}')">
            実行済みにする
          </label>
        </div>` : ''}
        ${c.xPosted ? '<div class="cycle-x-badge">𝕏 X投稿済み</div>' : ''}
      </div>`;
    }).join('');
  },

  // =========================================================
  // ホーム画面：今日のif-thenプラン
  // =========================================================
  renderHomeTodayPlans() {
    const container = document.getElementById('home-ifthen-list');
    const emptyEl = document.getElementById('home-no-ifthen');
    if (!container) return;

    const todayCycles = this.getByDate(todayISO())
      .filter(c => c.ifThen && c.ifThen.situation && c.ifThen.action);

    if (todayCycles.length === 0) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    container.innerHTML = todayCycles.map(c => {
      const book = Book.getById(c.bookId);
      return `
      <div class="home-ifthen-item ${c.ifThen.executed ? 'executed' : ''}">
        <label class="ifthen-check-label">
          <input type="checkbox" ${c.ifThen.executed ? 'checked' : ''}
            onchange="Cycles.toggleExecuted('${c.id}'); Cycles.renderHomeTodayPlans()">
          <div class="home-ifthen-content">
            <div class="home-ifthen-text">
              <span class="ifthen-if">if:</span> ${Book.escapeHtml(c.ifThen.situation)} →
              <span class="ifthen-then">then:</span> ${Book.escapeHtml(c.ifThen.action)}
            </div>
            ${book ? `<div class="home-ifthen-book">📖 ${Book.escapeHtml(book.title)}</div>` : ''}
          </div>
        </label>
      </div>`;
    }).join('');
  },
};
