// actions.js — 実践項目機能

const Actions = {
  add(bookId, content) {
    const item = {
      id: generateUUID(),
      bookId,
      content,
      isDone: false,
      doneDate: null,
      note: '',
      createdAt: nowISO(),
    };
    Storage.addItem(Storage.KEYS.ACTION_ITEMS, item);
    return item;
  },

  toggle(id) {
    const item = Storage.getById(Storage.KEYS.ACTION_ITEMS, id);
    if (!item) return;
    const isDone = !item.isDone;
    Storage.updateItem(Storage.KEYS.ACTION_ITEMS, id, {
      isDone,
      doneDate: isDone ? todayISO() : null,
    });
  },

  updateNote(id, note) {
    Storage.updateItem(Storage.KEYS.ACTION_ITEMS, id, { note });
  },

  delete(id) {
    Storage.deleteItem(Storage.KEYS.ACTION_ITEMS, id);
  },

  getByBook(bookId) {
    return Storage.getByField(Storage.KEYS.ACTION_ITEMS, 'bookId', bookId);
  },

  getAllPending() {
    return Storage.getAll(Storage.KEYS.ACTION_ITEMS).filter(a => !a.isDone);
  },

  getAll() {
    return Storage.getAll(Storage.KEYS.ACTION_ITEMS);
  },

  getCompletionRate() {
    const all = this.getAll();
    if (all.length === 0) return 0;
    const done = all.filter(a => a.isDone).length;
    return Math.round((done / all.length) * 100);
  },

  // 本の詳細画面での実践リスト描画
  renderList(bookId) {
    const container = document.getElementById('action-list');
    const input = document.getElementById('new-action-input');
    const addBtn = document.getElementById('add-action-btn');

    addBtn.onclick = () => {
      const content = input.value.trim();
      if (!content) return;
      Actions.add(bookId, content);
      input.value = '';
      Actions.renderList(bookId);
    };

    // Enterキーで追加
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addBtn.click();
      }
    };

    const items = this.getByBook(bookId);
    // 未完了を上に
    items.sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (items.length === 0) {
      container.innerHTML = '<p class="empty-message">実践項目はまだありません</p>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="action-item${item.isDone ? ' done' : ''}">
        <input type="checkbox" class="action-checkbox" ${item.isDone ? 'checked' : ''}
          onchange="Actions.handleToggle('${item.id}', '${bookId}')">
        <div class="action-content">
          <div class="action-text${item.isDone ? ' done' : ''}">${Book.escapeHtml(item.content)}</div>
          ${item.doneDate ? `<div class="action-date">完了: ${formatDate(item.doneDate)}</div>` : ''}
          <div class="action-note">
            <textarea class="action-note-input" placeholder="実践メモ..."
              onblur="Actions.handleNoteBlur('${item.id}', this)">${Book.escapeHtml(item.note)}</textarea>
          </div>
        </div>
        <button class="action-delete" onclick="Actions.handleDelete('${item.id}', '${bookId}')" title="削除">×</button>
      </div>
    `).join('');
  },

  handleToggle(id, bookId) {
    this.toggle(id);
    this.renderList(bookId);
  },

  handleNoteBlur(id, textarea) {
    this.updateNote(id, textarea.value.trim());
  },

  handleDelete(id, bookId) {
    App.confirm('この実践項目を削除しますか？', () => {
      Actions.delete(id);
      Actions.renderList(bookId);
    });
  },

  // ホーム画面用：未完了の実践項目リスト
  renderHomeActions() {
    const container = document.getElementById('home-actions');
    const empty = document.getElementById('home-no-actions');
    const pending = this.getAllPending().slice(0, 5);

    if (pending.length === 0) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    container.innerHTML = pending.map(item => {
      const book = Book.getById(item.bookId);
      const bookTitle = book ? book.title : '';
      return `
        <div class="action-item">
          <input type="checkbox" class="action-checkbox"
            onchange="Actions.handleHomeToggle('${item.id}')">
          <div class="action-content">
            <div class="action-text">${Book.escapeHtml(item.content)}</div>
            ${bookTitle ? `<div class="action-date">${Book.escapeHtml(bookTitle)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  handleHomeToggle(id) {
    this.toggle(id);
    App.renderHome();
  },
};
