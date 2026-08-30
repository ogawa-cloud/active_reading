// journal.js — 夜のジャーナリング & 翌日の1問1答

const Journal = {
  // =========================================================
  // データアクセス
  // =========================================================
  getByDate(date) {
    const all = Storage.getAll(Storage.KEYS.JOURNAL_ENTRIES);
    return all.find(j => j.date === date) || null;
  },

  save(date, summary, quizPairs) {
    const existing = this.getByDate(date);
    const entry = {
      id: existing ? existing.id : generateUUID(),
      date,
      summary: summary || '',
      quizPairs: quizPairs || [],
      createdAt: existing ? existing.createdAt : nowISO(),
      updatedAt: nowISO(),
    };

    if (existing) {
      const all = Storage.getAll(Storage.KEYS.JOURNAL_ENTRIES);
      const idx = all.findIndex(j => j.id === existing.id);
      if (idx !== -1) {
        all[idx] = entry;
        Storage.save(Storage.KEYS.JOURNAL_ENTRIES, all);
      }
    } else {
      Storage.addItem(Storage.KEYS.JOURNAL_ENTRIES, entry);
    }
    return entry;
  },

  // =========================================================
  // ジャーナル画面の描画
  // =========================================================
  render(date) {
    date = date || todayISO();
    const screen = document.getElementById('journal-screen');
    if (screen) screen.dataset.date = date;

    const dateEl = document.getElementById('journal-date');
    if (dateEl) dateEl.textContent = formatDate(date);

    const existing = this.getByDate(date);
    const todayCycles = Cycles.getByDate(date);

    // 今日のサイクルまとめ
    this.renderCyclesSummary(todayCycles);

    // ジャーナルテキスト
    const textarea = document.getElementById('journal-summary');
    if (textarea) textarea.value = existing ? existing.summary : '';

    // Q&Aペア
    this.renderQuizPairsForm(existing ? existing.quizPairs : []);

    // 昨日の1問1答
    this.renderYesterdayQuiz();
  },

  renderCyclesSummary(cycles) {
    const container = document.getElementById('journal-cycles-summary');
    if (!container) return;

    if (cycles.length === 0) {
      container.innerHTML = '<p class="empty-message">今日の読書サイクルはまだありません</p>';
      return;
    }

    container.innerHTML = cycles.map((c, i) => {
      const book = Book.getById(c.bookId);
      const hasIfThen = c.ifThen && c.ifThen.situation && c.ifThen.action;
      return `
      <div class="journal-cycle-item">
        <div class="journal-cycle-header">
          <span class="cycle-num">サイクル ${i + 1}</span>
          ${book ? `<span class="journal-cycle-book">📖 ${Book.escapeHtml(book.title)}</span>` : ''}
          <span class="journal-cycle-duration">${Math.floor(c.duration / 60)}分</span>
        </div>
        ${c.insight ? `<div class="journal-insight">💡 ${Book.escapeHtml(c.insight)}</div>` : ''}
        ${hasIfThen ? `
        <div class="journal-ifthen-row">
          <label class="ifthen-check-label">
            <input type="checkbox" ${c.ifThen.executed ? 'checked' : ''}
              onchange="Cycles.toggleExecuted('${c.id}'); Journal.render(document.getElementById('journal-screen').dataset.date)">
            <span class="${c.ifThen.executed ? 'text-done' : ''}">
              📌 「${Book.escapeHtml(c.ifThen.situation)}」→「${Book.escapeHtml(c.ifThen.action)}」
              ${c.ifThen.executed ? '✅' : ''}
            </span>
          </label>
        </div>` : ''}
      </div>`;
    }).join('');
  },

  // =========================================================
  // Q&Aペアフォーム
  // =========================================================
  renderQuizPairsForm(pairs) {
    const container = document.getElementById('journal-quiz-pairs');
    if (!container) return;
    pairs = pairs || [];

    if (pairs.length === 0) {
      container.innerHTML = '<p class="empty-message quiz-empty">まだ問題がありません。「自動生成」または「+ 問題を追加」で作成しましょう</p>';
      return;
    }

    container.innerHTML = pairs.map((p, i) => `
      <div class="quiz-pair-row">
        <div class="quiz-pair-num">Q${i + 1}</div>
        <div class="quiz-pair-inputs">
          <input type="text" class="quiz-q-input" placeholder="問題文"
            value="${Book.escapeHtml(p.question || '')}"
            onchange="Journal.updatePairField(${i}, 'question', this.value)">
          <input type="text" class="quiz-a-input" placeholder="答え"
            value="${Book.escapeHtml(p.answer || '')}"
            onchange="Journal.updatePairField(${i}, 'answer', this.value)">
        </div>
        <button class="icon-btn quiz-pair-del" onclick="Journal.removePair(${i})" title="削除">✕</button>
      </div>
    `).join('');
  },

  updatePairField(idx, field, value) {
    const date = document.getElementById('journal-screen')?.dataset.date || todayISO();
    const existing = this.getByDate(date);
    if (!existing || !existing.quizPairs[idx]) return;
    existing.quizPairs[idx][field] = value;
    this.save(date, existing.summary, existing.quizPairs);
  },

  removePair(idx) {
    const date = document.getElementById('journal-screen')?.dataset.date || todayISO();
    const existing = this.getByDate(date);
    if (!existing) return;
    existing.quizPairs.splice(idx, 1);
    this.save(date, existing.summary, existing.quizPairs);
    this.renderQuizPairsForm(existing.quizPairs);
  },

  addPair() {
    const date = document.getElementById('journal-screen')?.dataset.date || todayISO();
    let existing = this.getByDate(date);
    if (!existing) {
      const summary = document.getElementById('journal-summary')?.value || '';
      existing = this.save(date, summary, []);
    }
    const pairs = [...(existing.quizPairs || []), { question: '', answer: '' }];
    this.save(date, existing.summary, pairs);
    this.renderQuizPairsForm(pairs);
  },

  // if-thenプランから問題を自動生成
  autoGeneratePairs() {
    const date = document.getElementById('journal-screen')?.dataset.date || todayISO();
    const cycles = Cycles.getByDate(date);

    const newPairs = cycles
      .filter(c => c.ifThen && c.ifThen.situation && c.ifThen.action)
      .map(c => ({
        question: `「${c.ifThen.situation}」のとき、何をするよう決めましたか？`,
        answer: c.ifThen.action,
      }));

    if (newPairs.length === 0) {
      this.showToast('if-thenプランがないため自動生成できません。サイクルを記録してください。');
      return;
    }

    let existing = this.getByDate(date);
    if (!existing) {
      const summary = document.getElementById('journal-summary')?.value || '';
      existing = this.save(date, summary, []);
    }

    const merged = [...(existing.quizPairs || []), ...newPairs];
    this.save(date, existing.summary, merged);
    this.renderQuizPairsForm(merged);
    this.showToast(`${newPairs.length}件の問題を自動生成しました！`);
  },

  // ジャーナル保存
  saveJournal() {
    const date = document.getElementById('journal-screen')?.dataset.date || todayISO();
    const summary = document.getElementById('journal-summary')?.value.trim() || '';
    const existing = this.getByDate(date);
    const quizPairs = existing ? existing.quizPairs : [];
    this.save(date, summary, quizPairs);
    this.showToast('ジャーナルを保存しました ✅');
  },

  // =========================================================
  // 昨日の1問1答セクション（ジャーナル画面下部）
  // =========================================================
  renderYesterdayQuiz() {
    const container = document.getElementById('journal-yesterday-quiz');
    if (!container) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const journal = this.getByDate(yesterdayStr);
    if (!journal || !journal.quizPairs || journal.quizPairs.length === 0) {
      container.innerHTML = '<p class="empty-message">昨日の問題はありません</p>';
      return;
    }

    const sectionEl = document.getElementById('journal-quiz-section');
    if (sectionEl) sectionEl.style.display = 'block';

    container.innerHTML = `
      <p class="quiz-invitation">昨日（${formatDate(yesterdayStr)}）の問題が ${journal.quizPairs.length}問あります</p>
      <button class="btn btn-primary" onclick="App.navigate('quiz', '${yesterdayStr}')">
        🧠 1問1答を始める
      </button>
    `;
  },

  // =========================================================
  // クイズ画面
  // =========================================================
  quizState: [],
  quizDate: null,
  currentQuizIdx: 0,

  renderQuiz(date) {
    date = date || todayISO();
    this.quizDate = date;

    const dateEl = document.getElementById('quiz-date');
    if (dateEl) dateEl.textContent = formatDate(date);

    const journal = this.getByDate(date);
    const content = document.getElementById('quiz-content');
    if (!content) return;

    if (!journal || !journal.quizPairs || journal.quizPairs.length === 0) {
      content.innerHTML = `
        <div class="quiz-empty-state">
          <p class="empty-message">この日の問題はありません</p>
          <p class="empty-sub">ジャーナル画面で問題を作成するか、「自動生成」を使いましょう</p>
          <button class="btn btn-primary" onclick="App.navigate('journal')">ジャーナルへ</button>
        </div>
      `;
      return;
    }

    this.quizState = journal.quizPairs.map(p => ({
      question: p.question,
      answer: p.answer,
      userAnswer: '',
      revealed: false,
      correct: null,
    }));

    this.renderQuizQuestion(0);
  },

  renderQuizQuestion(idx) {
    this.currentQuizIdx = idx;
    const content = document.getElementById('quiz-content');
    if (!content) return;

    const total = this.quizState.length;

    if (idx >= total) {
      // 終了画面
      const correct = this.quizState.filter(q => q.correct === true).length;
      const wrong = this.quizState.filter(q => q.correct === false).length;
      const pct = Math.round((correct / total) * 100);
      content.innerHTML = `
        <div class="quiz-complete">
          <div class="quiz-score-circle">
            <span class="quiz-score-num">${pct}%</span>
            <span class="quiz-score-label">正答率</span>
          </div>
          <div class="quiz-score-detail">
            <span class="quiz-correct">✅ 正解 ${correct}問</span>
            <span class="quiz-wrong">❌ 不正解 ${wrong}問</span>
          </div>
          <p class="quiz-complete-msg">${pct === 100 ? '完璧です！🎉' : pct >= 70 ? 'よくできました！💪' : 'もう一度復習しましょう！📖'}</p>
          <div class="quiz-complete-actions">
            <button class="btn btn-secondary" onclick="Journal.renderQuiz('${this.quizDate}')">もう一度</button>
            <button class="btn btn-primary" onclick="App.navigate('journal')">ジャーナルへ</button>
          </div>
          <div class="quiz-review">
            <h3>復習</h3>
            ${this.quizState.map((q, i) => `
              <div class="quiz-review-item ${q.correct ? 'correct' : 'wrong'}">
                <div class="quiz-review-q">Q${i+1}: ${Book.escapeHtml(q.question)}</div>
                <div class="quiz-review-a">答え: ${Book.escapeHtml(q.answer)}</div>
                ${q.userAnswer ? `<div class="quiz-review-user">あなたの答え: ${Book.escapeHtml(q.userAnswer)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
      return;
    }

    const q = this.quizState[idx];
    content.innerHTML = `
      <div class="quiz-progress-bar-wrap">
        <div class="quiz-progress-bar-fill" style="width:${Math.round((idx/total)*100)}%"></div>
      </div>
      <div class="quiz-progress-label">${idx + 1} / ${total}問</div>
      <div class="quiz-question-card">
        <p class="quiz-question-text">${Book.escapeHtml(q.question)}</p>
        <textarea class="quiz-answer-input" id="quiz-answer-input"
          placeholder="答えを入力...">${Book.escapeHtml(q.userAnswer || '')}</textarea>
        <div class="quiz-action-area">
          ${!q.revealed ? `
            <button class="btn btn-primary quiz-reveal-btn" onclick="Journal.revealAnswer(${idx})">
              答えを確認する
            </button>
          ` : `
            <div class="quiz-reveal-area">
              <div class="quiz-correct-answer">
                <span class="quiz-answer-label">正解:</span>
                ${Book.escapeHtml(q.answer)}
              </div>
              <p class="quiz-judge-prompt">自分の答えと比べてどうでしたか？</p>
              <div class="quiz-judge-buttons">
                <button class="btn btn-success" onclick="Journal.judgeAnswer(${idx}, true)">
                  ✅ 正解
                </button>
                <button class="btn btn-danger" onclick="Journal.judgeAnswer(${idx}, false)">
                  ❌ 不正解
                </button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;

    // フォーカス
    const input = document.getElementById('quiz-answer-input');
    if (input) setTimeout(() => input.focus(), 100);
  },

  revealAnswer(idx) {
    const input = document.getElementById('quiz-answer-input');
    if (input) this.quizState[idx].userAnswer = input.value;
    this.quizState[idx].revealed = true;
    this.renderQuizQuestion(idx);
  },

  judgeAnswer(idx, isCorrect) {
    this.quizState[idx].correct = isCorrect;
    this.renderQuizQuestion(idx + 1);
  },

  // =========================================================
  // トースト通知
  // =========================================================
  showToast(msg) {
    const existing = document.querySelector('.journal-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'journal-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  },

  // =========================================================
  // ホーム画面：クイズ通知
  // =========================================================
  renderHomeQuizAlert() {
    const el = document.getElementById('home-quiz-alert');
    if (!el) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const journal = this.getByDate(yesterdayStr);
    if (journal && journal.quizPairs && journal.quizPairs.length > 0) {
      el.style.display = 'flex';
      const countEl = el.querySelector('.quiz-alert-count');
      if (countEl) countEl.textContent = journal.quizPairs.length;
    } else {
      el.style.display = 'none';
    }
  },
};
