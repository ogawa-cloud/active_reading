// notes.js — 読む前の問い & 章メモ機能

const DEFAULT_QUESTIONS = [
  'この本を読んだら、どんなメリットがあるか？',
  'どんな新しい知識が得られるだろうか？',
  '自分が抱えているどんな悩みが解決しそうか？',
  '誰かに話せる面白いネタが見つかるだろうか？',
  'これを自分の仕事や生活に活かすならどうなるか？',
];

const Notes = {
  // === 読む前の問い ===

  createDefaultQuestions(bookId) {
    const prq = {
      id: generateUUID(),
      bookId,
      questions: DEFAULT_QUESTIONS.map(q => ({
        id: generateUUID(),
        question: q,
        answer: '',
      })),
      createdAt: nowISO(),
    };
    Storage.addItem(Storage.KEYS.PRE_READING_QUESTIONS, prq);
    return prq;
  },

  getQuestions(bookId) {
    const all = Storage.getByField(Storage.KEYS.PRE_READING_QUESTIONS, 'bookId', bookId);
    return all[0] || null;
  },

  saveQuestions(bookId) {
    const prq = this.getQuestions(bookId);
    if (!prq) return;

    prq.questions.forEach(q => {
      const textarea = document.getElementById(`question-${q.id}`);
      if (textarea) {
        q.answer = textarea.value.trim();
      }
    });

    Storage.updateItem(Storage.KEYS.PRE_READING_QUESTIONS, prq.id, { questions: prq.questions });
  },

  renderQuestions(bookId) {
    const container = document.getElementById('tab-questions');
    const prq = this.getQuestions(bookId);

    if (!prq) {
      container.innerHTML = '<p class="empty-message">質問データがありません</p>';
      return;
    }

    container.innerHTML = prq.questions.map(q => `
      <div class="question-item">
        <p class="question-text">${Book.escapeHtml(q.question)}</p>
        <textarea class="question-answer" id="question-${q.id}" placeholder="あなたの考えを書いてみましょう...">${Book.escapeHtml(q.answer)}</textarea>
      </div>
    `).join('') + `
      <button class="btn btn-primary save-questions-btn" onclick="Notes.saveQuestions('${bookId}')">回答を保存</button>
    `;
  },

  // === 章メモ ===

  addChapter(bookId, data) {
    const note = {
      id: generateUUID(),
      bookId,
      chapterNumber: data.chapterNumber,
      chapterTitle: data.chapterTitle || '',
      important: data.important || '',
      memory: data.memory || '',
      application: data.application || '',
      createdAt: nowISO(),
    };
    Storage.addItem(Storage.KEYS.CHAPTER_NOTES, note);
    return note;
  },

  updateChapter(id, updates) {
    return Storage.updateItem(Storage.KEYS.CHAPTER_NOTES, id, updates);
  },

  deleteChapter(id) {
    Storage.deleteItem(Storage.KEYS.CHAPTER_NOTES, id);
  },

  getChapters(bookId) {
    return Storage.getByField(Storage.KEYS.CHAPTER_NOTES, 'bookId', bookId)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
  },

  getNextChapterNumber(bookId) {
    const chapters = this.getChapters(bookId);
    if (chapters.length === 0) return 1;
    return Math.max(...chapters.map(c => c.chapterNumber)) + 1;
  },

  showAddChapterForm(bookId) {
    document.getElementById('chapter-form-title').textContent = '章メモを追加';
    document.getElementById('chapter-form-id').value = '';
    document.getElementById('chapter-form-bookId').value = bookId;
    document.getElementById('chapter-form-number').value = this.getNextChapterNumber(bookId);
    document.getElementById('chapter-form-chapterTitle').value = '';
    document.getElementById('chapter-form-important').value = '';
    document.getElementById('chapter-form-memory').value = '';
    document.getElementById('chapter-form-application').value = '';
    App.navigate('chapter-form');
  },

  showEditChapterForm(id) {
    const note = Storage.getById(Storage.KEYS.CHAPTER_NOTES, id);
    if (!note) return;
    document.getElementById('chapter-form-title').textContent = '章メモを編集';
    document.getElementById('chapter-form-id').value = note.id;
    document.getElementById('chapter-form-bookId').value = note.bookId;
    document.getElementById('chapter-form-number').value = note.chapterNumber;
    document.getElementById('chapter-form-chapterTitle').value = note.chapterTitle;
    document.getElementById('chapter-form-important').value = note.important;
    document.getElementById('chapter-form-memory').value = note.memory;
    document.getElementById('chapter-form-application').value = note.application;
    App.navigate('chapter-form');
  },

  handleChapterFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('chapter-form-id').value;
    const bookId = document.getElementById('chapter-form-bookId').value;
    const data = {
      chapterNumber: parseInt(document.getElementById('chapter-form-number').value) || 1,
      chapterTitle: document.getElementById('chapter-form-chapterTitle').value.trim(),
      important: document.getElementById('chapter-form-important').value.trim(),
      memory: document.getElementById('chapter-form-memory').value.trim(),
      application: document.getElementById('chapter-form-application').value.trim(),
    };

    if (!data.important) return;

    if (id) {
      Notes.updateChapter(id, data);
    } else {
      Notes.addChapter(bookId, data);
    }
    App.navigate('book-detail', bookId);
  },

  handleDeleteChapter(id, bookId) {
    App.confirm('この章メモを削除しますか？', () => {
      Notes.deleteChapter(id);
      Notes.renderChapters(bookId);
    });
  },

  renderChapters(bookId) {
    const container = document.getElementById('chapter-list');
    const chapters = this.getChapters(bookId);
    const addBtn = document.getElementById('add-chapter-btn');
    addBtn.onclick = () => Notes.showAddChapterForm(bookId);

    if (chapters.length === 0) {
      container.innerHTML = '<p class="empty-message">章メモはまだありません</p>';
      return;
    }

    container.innerHTML = chapters.map(ch => `
      <div class="chapter-card" id="chapter-card-${ch.id}">
        <div class="chapter-header" onclick="Notes.toggleChapter('${ch.id}')">
          <span class="chapter-number">${ch.chapterNumber}</span>
          <span class="chapter-title">${Book.escapeHtml(ch.chapterTitle) || '(無題)'}</span>
          <div class="chapter-actions">
            <button class="icon-btn" onclick="event.stopPropagation(); Notes.showEditChapterForm('${ch.id}')" title="編集">✏️</button>
            <button class="icon-btn" onclick="event.stopPropagation(); Notes.handleDeleteChapter('${ch.id}', '${bookId}')" title="削除">🗑️</button>
          </div>
        </div>
        <div class="chapter-body" id="chapter-body-${ch.id}">
          <div class="chapter-field">
            <div class="chapter-field-label">重要なこと</div>
            <div class="chapter-field-text">${Book.escapeHtml(ch.important)}</div>
          </div>
          ${ch.memory ? `
          <div class="chapter-field">
            <div class="chapter-field-label">記憶方法</div>
            <div class="chapter-field-text">${Book.escapeHtml(ch.memory)}</div>
          </div>` : ''}
          ${ch.application ? `
          <div class="chapter-field">
            <div class="chapter-field-label">応用方法</div>
            <div class="chapter-field-text">${Book.escapeHtml(ch.application)}</div>
          </div>` : ''}
        </div>
      </div>
    `).join('');
  },

  toggleChapter(id) {
    const body = document.getElementById(`chapter-body-${id}`);
    if (body) {
      body.classList.toggle('open');
    }
  },
};
