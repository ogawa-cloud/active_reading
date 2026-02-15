// timer.js — 読書タイマー機能

const Timer = {
  interval: null,
  startTime: null,
  elapsed: 0,      // 秒
  isRunning: false,
  currentBookId: null,

  STORAGE_KEY: 'readingTimerState',
  LOG_KEY: 'readingTimerLogs',

  // タイマー状態の復元
  restore() {
    const state = Storage.get(this.STORAGE_KEY);
    if (state && state.isRunning) {
      this.currentBookId = state.bookId;
      this.startTime = new Date(state.startTime);
      this.elapsed = state.elapsed;
      this.isRunning = true;
      this.tick();
      this.interval = setInterval(() => this.tick(), 1000);
    }
  },

  // タイマー状態の保存
  saveState() {
    Storage.save(this.STORAGE_KEY, {
      isRunning: this.isRunning,
      bookId: this.currentBookId,
      startTime: this.startTime ? this.startTime.toISOString() : null,
      elapsed: this.elapsed,
    });
  },

  start(bookId) {
    if (this.isRunning) return;
    this.currentBookId = bookId;
    this.startTime = new Date();
    this.isRunning = true;
    this.elapsed = 0;
    this.saveState();
    this.interval = setInterval(() => this.tick(), 1000);
    this.updateUI();
  },

  pause() {
    if (!this.isRunning) return;
    clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
    this.saveState();
    this.updateUI();
  },

  resume() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = new Date(Date.now() - this.elapsed * 1000);
    this.saveState();
    this.interval = setInterval(() => this.tick(), 1000);
    this.updateUI();
  },

  stop() {
    if (this.elapsed > 0) {
      this.saveLog();
    }
    clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
    this.elapsed = 0;
    this.startTime = null;
    this.currentBookId = null;
    Storage.save(this.STORAGE_KEY, null);
    this.updateUI();
  },

  tick() {
    if (this.startTime) {
      this.elapsed = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
      this.saveState();
    }
    this.updateUI();
  },

  // 読書ログ保存
  saveLog() {
    const logs = Storage.get(this.LOG_KEY) || [];
    logs.push({
      id: generateUUID(),
      bookId: this.currentBookId,
      date: todayISO(),
      duration: this.elapsed,
      createdAt: nowISO(),
    });
    Storage.save(this.LOG_KEY, logs);
  },

  // 本ごとの合計読書時間（秒）
  getTotalTime(bookId) {
    const logs = Storage.get(this.LOG_KEY) || [];
    return logs
      .filter(l => l.bookId === bookId)
      .reduce((sum, l) => sum + l.duration, 0);
  },

  // 全体の合計読書時間（秒）
  getTotalTimeAll() {
    const logs = Storage.get(this.LOG_KEY) || [];
    return logs.reduce((sum, l) => sum + l.duration, 0);
  },

  // 秒を表示用文字列に変換
  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  formatTimeLabel(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}時間${m}分`;
    return `${m}分`;
  },

  // UI更新
  updateUI() {
    const display = document.getElementById('timer-display');
    const startBtn = document.getElementById('timer-start-btn');
    const pauseBtn = document.getElementById('timer-pause-btn');
    const stopBtn = document.getElementById('timer-stop-btn');

    if (!display) return;

    display.textContent = this.formatTime(this.elapsed);
    display.classList.toggle('running', this.isRunning);

    if (startBtn) startBtn.style.display = this.isRunning ? 'none' : 'inline-flex';
    if (pauseBtn) pauseBtn.style.display = this.isRunning ? 'inline-flex' : 'none';
    if (stopBtn) stopBtn.style.display = (this.elapsed > 0) ? 'inline-flex' : 'none';

    // 本の詳細画面の読書時間表示
    const totalEl = document.getElementById('timer-total');
    if (totalEl && this.currentBookId) {
      const total = this.getTotalTime(this.currentBookId);
      totalEl.textContent = `累計: ${this.formatTimeLabel(total)}`;
    }
  },

  // 本の詳細画面にタイマーUIを描画
  renderForBook(bookId) {
    const container = document.getElementById('timer-container');
    if (!container) return;

    const totalTime = this.getTotalTime(bookId);
    const isThisBook = this.currentBookId === bookId;

    container.innerHTML = `
      <div class="timer-widget">
        <div class="timer-display-row">
          <span class="timer-display${this.isRunning && isThisBook ? ' running' : ''}" id="timer-display">
            ${isThisBook ? this.formatTime(this.elapsed) : '00:00'}
          </span>
        </div>
        <div class="timer-controls">
          <button class="btn btn-primary timer-btn" id="timer-start-btn"
            style="display:${this.isRunning && isThisBook ? 'none' : 'inline-flex'}"
            onclick="Timer.${isThisBook && this.elapsed > 0 ? 'resume' : 'start'}('${bookId}')">
            ${isThisBook && this.elapsed > 0 ? '再開' : '開始'}
          </button>
          <button class="btn btn-secondary timer-btn" id="timer-pause-btn"
            style="display:${this.isRunning && isThisBook ? 'inline-flex' : 'none'}"
            onclick="Timer.pause()">
            一時停止
          </button>
          <button class="btn btn-secondary timer-btn" id="timer-stop-btn"
            style="display:${isThisBook && this.elapsed > 0 ? 'inline-flex' : 'none'}"
            onclick="Timer.stop()">
            終了
          </button>
        </div>
        <div class="timer-total" id="timer-total">累計: ${this.formatTimeLabel(totalTime)}</div>
      </div>
    `;
  },
};
