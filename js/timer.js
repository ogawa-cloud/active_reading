// timer.js — 読書タイマー機能（ポモドーロ対応）

const Timer = {
  interval: null,
  startTime: null,
  elapsed: 0,          // 秒（フリーモード用 / ポモドーロでは残り時間の計算に使う）
  isRunning: false,
  currentBookId: null,

  // ポモドーロ設定
  mode: 'free',        // 'free' | 'pomodoro'
  pomodoroPhase: 'work', // 'work' | 'break'
  pomodoroCount: 0,    // 完了したポモドーロ数
  WORK_MIN: 25,
  BREAK_MIN: 5,
  LONG_BREAK_MIN: 15,  // 4ポモドーロごと
  pomodoroRemaining: 0, // 残り秒数

  STORAGE_KEY: 'readingTimerState',
  LOG_KEY: 'readingTimerLogs',

  // タイマー状態の復元
  restore() {
    const state = Storage.get(this.STORAGE_KEY);
    if (!state) return;

    this.mode = state.mode || 'free';
    this.pomodoroPhase = state.pomodoroPhase || 'work';
    this.pomodoroCount = state.pomodoroCount || 0;
    this.pomodoroRemaining = state.pomodoroRemaining || 0;
    this.currentBookId = state.bookId;
    this.elapsed = state.elapsed || 0;

    if (state.isRunning) {
      this.startTime = new Date(state.startTime);
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
      mode: this.mode,
      pomodoroPhase: this.pomodoroPhase,
      pomodoroCount: this.pomodoroCount,
      pomodoroRemaining: this.pomodoroRemaining,
    });
  },

  // フリーモード開始
  start(bookId) {
    if (this.isRunning) return;
    this.mode = 'free';
    this.currentBookId = bookId;
    this.startTime = new Date();
    this.isRunning = true;
    this.elapsed = 0;
    this.saveState();
    this.interval = setInterval(() => this.tick(), 1000);
    this.renderForBook(bookId);
  },

  // ポモドーロモード開始
  startPomodoro(bookId) {
    if (this.isRunning) return;
    this.mode = 'pomodoro';
    this.currentBookId = bookId;
    this.pomodoroPhase = 'work';
    this.pomodoroRemaining = this.WORK_MIN * 60;
    this.startTime = new Date();
    this.isRunning = true;
    this.elapsed = 0;
    this.saveState();
    this.interval = setInterval(() => this.tick(), 1000);
    this.renderForBook(bookId);
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
    if (this.mode === 'free') {
      this.startTime = new Date(Date.now() - this.elapsed * 1000);
    } else {
      this.startTime = new Date();
    }
    this.saveState();
    this.interval = setInterval(() => this.tick(), 1000);
    this.updateUI();
  },

  stop() {
    if (this.elapsed > 0 && this.mode === 'free') {
      this.saveLog();
    }
    if (this.mode === 'pomodoro' && this.pomodoroPhase === 'work') {
      // 途中で止めても経過分は記録
      const worked = (this.WORK_MIN * 60) - this.pomodoroRemaining;
      if (worked > 30) this.saveLog(worked);
    }
    this.reset();
  },

  reset() {
    clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
    this.elapsed = 0;
    this.startTime = null;
    this.pomodoroPhase = 'work';
    this.pomodoroRemaining = 0;
    this.pomodoroCount = 0;
    this.currentBookId = null;
    this.mode = 'free';
    Storage.save(this.STORAGE_KEY, null);
    this.updateUI();
  },

  tick() {
    if (!this.startTime) return;

    if (this.mode === 'free') {
      this.elapsed = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    } else {
      // ポモドーロ: 残り時間を減らす
      this.elapsed += 1;
      this.pomodoroRemaining = Math.max(0, this.pomodoroRemaining - 1);

      if (this.pomodoroRemaining <= 0) {
        this.onPomodoroEnd();
        return;
      }
    }

    // 10秒ごとに保存（パフォーマンス）
    if (this.elapsed % 10 === 0) {
      this.saveState();
    }
    this.updateUI();
  },

  onPomodoroEnd() {
    clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;

    if (this.pomodoroPhase === 'work') {
      // 作業完了 → ログ保存
      this.saveLog(this.WORK_MIN * 60);
      this.pomodoroCount++;

      // 休憩フェーズへ
      const isLongBreak = this.pomodoroCount % 4 === 0;
      this.pomodoroPhase = 'break';
      this.pomodoroRemaining = (isLongBreak ? this.LONG_BREAK_MIN : this.BREAK_MIN) * 60;
      this.elapsed = 0;
      this.saveState();

      this.notify(isLongBreak
        ? `${this.pomodoroCount}ポモドーロ完了！${this.LONG_BREAK_MIN}分の長い休憩です`
        : `ポモドーロ完了！${this.BREAK_MIN}分休憩しましょう`
      );
    } else {
      // 休憩完了 → 次の作業フェーズへ
      this.pomodoroPhase = 'work';
      this.pomodoroRemaining = this.WORK_MIN * 60;
      this.elapsed = 0;
      this.saveState();

      this.notify('休憩終了！次のポモドーロを始めましょう');
    }

    this.renderForBook(this.currentBookId);
  },

  notify(message) {
    // 通知音（ビープ）
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1000;
        gain2.gain.value = 0.3;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.3);
      }, 400);
    } catch {}

    // ブラウザ通知
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('アクティブリーディング', { body: message });
    }

    // フォールバック: アラート的な表示
    const container = document.getElementById('timer-container');
    if (container) {
      const alertEl = document.createElement('div');
      alertEl.className = 'timer-alert';
      alertEl.textContent = message;
      container.prepend(alertEl);
      setTimeout(() => alertEl.remove(), 5000);
    }
  },

  // 読書ログ保存
  saveLog(duration) {
    const d = duration || this.elapsed;
    if (d <= 0) return;
    const logs = Storage.get(this.LOG_KEY) || [];
    logs.push({
      id: generateUUID(),
      bookId: this.currentBookId,
      date: todayISO(),
      duration: d,
      createdAt: nowISO(),
    });
    Storage.save(this.LOG_KEY, logs);
  },

  // 本ごとの合計読書時間（秒）
  getTotalTime(bookId) {
    const logs = Storage.get(this.LOG_KEY) || [];
    return logs.filter(l => l.bookId === bookId).reduce((sum, l) => sum + l.duration, 0);
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
    if (!display) return;

    if (this.mode === 'pomodoro') {
      display.textContent = this.formatTime(this.pomodoroRemaining);
    } else {
      display.textContent = this.formatTime(this.elapsed);
    }
    display.classList.toggle('running', this.isRunning);
    display.classList.toggle('break', this.mode === 'pomodoro' && this.pomodoroPhase === 'break');

    // リングの進捗更新
    const ring = document.getElementById('timer-ring');
    if (ring) {
      ring.style.setProperty('--progress', this.ringProgress());
    }

    // ポモドーロドット更新
    const dotsEl = document.getElementById('pomo-dots');
    if (dotsEl) {
      dotsEl.style.display = this.mode === 'pomodoro' ? 'flex' : 'none';
      dotsEl.innerHTML = this.pomoDots();
    }

    const startBtn = document.getElementById('timer-start-btn');
    const pomoBtn = document.getElementById('timer-pomo-btn');
    const pauseBtn = document.getElementById('timer-pause-btn');
    const stopBtn = document.getElementById('timer-stop-btn');

    const hasElapsed = this.elapsed > 0 || this.pomodoroRemaining > 0;
    const showStart = !this.isRunning && !hasElapsed;
    const showResume = !this.isRunning && hasElapsed;
    const showPause = this.isRunning;

    if (startBtn) startBtn.style.display = showStart ? 'inline-flex' : 'none';
    if (pomoBtn) pomoBtn.style.display = showStart ? 'inline-flex' : 'none';
    if (pauseBtn) {
      pauseBtn.style.display = (showPause || showResume) ? 'inline-flex' : 'none';
      pauseBtn.textContent = showResume ? '再開' : '一時停止';
      pauseBtn.onclick = showResume ? () => Timer.resume() : () => Timer.pause();
    }
    if (stopBtn) stopBtn.style.display = hasElapsed ? 'inline-flex' : 'none';

    // ポモドーロ情報
    const infoEl = document.getElementById('timer-pomo-info');
    if (infoEl) {
      if (this.mode === 'pomodoro') {
        const phaseLabel = this.pomodoroPhase === 'work' ? '集中' : '休憩';
        infoEl.textContent = `${phaseLabel}中`;
        infoEl.style.display = 'block';
      } else {
        infoEl.style.display = 'none';
      }
    }

    // 累計表示
    const totalEl = document.getElementById('timer-total');
    if (totalEl && this.currentBookId) {
      totalEl.textContent = `累計: ${this.formatTimeLabel(this.getTotalTime(this.currentBookId))}`;
    }
  },

  // リング進捗（0〜100）を計算
  ringProgress() {
    if (this.mode === 'pomodoro') {
      const total = this.pomodoroPhase === 'work'
        ? this.WORK_MIN * 60
        : (this.pomodoroCount % 4 === 0 ? this.LONG_BREAK_MIN : this.BREAK_MIN) * 60;
      return total > 0 ? Math.round((1 - this.pomodoroRemaining / total) * 100) : 0;
    }
    // フリーモード: 60分を100%とする
    return Math.min(100, Math.round(this.elapsed / 3600 * 100));
  },

  // ポモドーロドットHTML
  pomoDots() {
    const filled = this.pomodoroCount % 4;
    return Array.from({ length: 4 }, (_, i) =>
      `<span class="pomo-dot${i < filled ? ' filled' : ''}"></span>`
    ).join('');
  },

  // 本の詳細画面にタイマーUIを描画
  renderForBook(bookId) {
    const container = document.getElementById('timer-container');
    if (!container) return;

    const totalTime = this.getTotalTime(bookId);
    const isThisBook = this.currentBookId === bookId;
    const active = isThisBook && (this.isRunning || this.elapsed > 0 || this.pomodoroRemaining > 0);

    let displayTime = '00:00';
    if (isThisBook) {
      displayTime = this.mode === 'pomodoro'
        ? this.formatTime(this.pomodoroRemaining)
        : this.formatTime(this.elapsed);
    }

    const phaseClass = (this.mode === 'pomodoro' && this.pomodoroPhase === 'break') ? ' break' : '';
    const progress = isThisBook ? this.ringProgress() : 100;
    const showPomo = isThisBook && this.mode === 'pomodoro';

    container.innerHTML = `
      <div class="timer-widget">
        <div class="timer-ring" id="timer-ring" style="--progress:${progress}">
          <span class="timer-display${this.isRunning && isThisBook ? ' running' : ''}${phaseClass}" id="timer-display">
            ${displayTime}
          </span>
        </div>
        <div class="pomo-dots" id="pomo-dots" style="display:${showPomo ? 'flex' : 'none'}">
          ${this.pomoDots()}
        </div>
        <div class="timer-pomo-info" id="timer-pomo-info" style="display:${showPomo ? 'block' : 'none'}">
          ${this.mode === 'pomodoro' ? `${this.pomodoroPhase === 'work' ? '集中' : '休憩'}中` : ''}
        </div>
        <div class="timer-controls">
          <button class="btn btn-primary timer-btn" id="timer-start-btn"
            style="display:${active ? 'none' : 'inline-flex'}"
            onclick="Timer.start('${bookId}')">
            フリー
          </button>
          <button class="btn btn-accent timer-btn" id="timer-pomo-btn"
            style="display:${active ? 'none' : 'inline-flex'}"
            onclick="Timer.requestNotification(); Timer.startPomodoro('${bookId}')">
            🍅 25分
          </button>
          <button class="btn btn-secondary timer-btn" id="timer-pause-btn"
            style="display:${active ? 'inline-flex' : 'none'}"
            onclick="${this.isRunning && isThisBook ? 'Timer.pause()' : 'Timer.resume()'}">
            ${this.isRunning && isThisBook ? '一時停止' : '再開'}
          </button>
          <button class="btn btn-secondary timer-btn" id="timer-stop-btn"
            style="display:${active ? 'inline-flex' : 'none'}"
            onclick="Timer.stop()">
            終了
          </button>
        </div>
        <div class="timer-total" id="timer-total">累計: ${this.formatTimeLabel(totalTime)}</div>
      </div>
    `;
  },

  // 通知許可リクエスト
  requestNotification() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  },
};
